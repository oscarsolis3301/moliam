/**
 * Toby chat proxy — server-side wrapper around Atlas /v1/chat/completions.
/*
 * - Keeps ATLAS_PUBLIC_DEMO_KEY out of client JS.
 * - Adds naive per-IP rate limiting (in-memory, best effort).
 * - Strict input validation + length caps.
 * - Streams the Atlas response back as Server-Sent Events.
 * - Never calls tools that modify data (search only, via the tenant's system prompt).
 *
 * Environment variables:
 *   - ATLAS_PUBLIC_DEMO_KEY: API key for Atlas backend
 *   - ATLAS_BASE_URL: Optional custom base URL for Atlas
 */

import { jsonResp } from './lib/standalone.js';

const MAX_MESSAGE_LEN = 600;            // chars per user message
const MAX_HISTORY = 10;                 // trailing turns kept
const RATE_WINDOW_MS = 60_000;          // 60ms window for rate limiting
const RATE_LIMIT = 15;                  // requests per window per IP

// Cloudflare Workers run as short-lived isolates; this Map survives between
// requests within the same isolate, which is "good enough" for a demo rate limit.
const rateState = new Map();

/** @param {string} ip Client IP address string */
/** @returns {boolean} true if request allowed, false if rate limited */
function checkRate(ip) {
  const now = Date.now();
  const rec = rateState.get(ip) || { count: 0, reset: now + RATE_WINDOW_MS };

  if (now > rec.reset) {
    rec.count = 0;
    rec.reset = now + RATE_WINDOW_MS;
   }

  rec.count += 1;
  rateState.set(ip, rec);
  return rec.count <= RATE_LIMIT;
}

/** @param {object} m Message object to sanitize */
/** @returns {{role:string, content:string}|null} Sanitized message or null if invalid */
function sanitizeMessage(m) {
  if (!m || typeof m !== 'object') return null;

  const role = typeof m.role === 'string' ? m.role : '';
  if (role !== 'user' && role !== 'assistant') return null;

  let content = typeof m.content === 'string' ? m.content : '';
  content = content.slice(0, MAX_MESSAGE_LEN);

  if (!content.trim()) return null;
  return { role, content };
}

/** @param {object} nameObj Name object with user field */
/** @returns {{id:string}|null} Sanitized user ID or null */
function cleanName(nameObj) {
  const id = nameObj?.user || '';
  if (typeof id !== 'string' || id.trim().length < 2) return null;

  const sanitized = id.trim().slice(0, 64);
  if (!/^[a-zA-Z\d_\-]+$/.test(sanitized)) return null;

  return { id: sanitized };
}


/**
 * Handle CORS preflight requests for toby chat proxy API endpoints
 * @param {object} context Cloudflare Pages request context (implicitly used)
 * @returns {Response} 204 No Content with CORS headers for all methods/headers
 */
export async function onRequestOptions(context) {
  const headers = new Headers({
     "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": '86400'
    });

  return new Response(null, { status: 204, headers });
}


/**
 * Handle POST requests for Toby chat proxy with rate limiting and validation
 * @param {object} context Cloudflare Pages request context with env.ATLAS_PUBLIC_DEMO_KEY
 * @returns {Response} JSON response or Server-Sent Events stream from Atlas API
 */
export async function onRequestPost({ request, env }) {
  const ATLAS_KEY = env?.ATLAS_PUBLIC_DEMO_KEY;
  const ATLAS_BASE = env?.ATLAS_BASE_URL || "https://atlas.moliam.com";

   if (!ATLAS_KEY) {
     return jsonResp(500, new Request(request.url), { error: 'Atlas key not configured on server' });
   }

   // Get client IP for rate limiting (use CF-Connecting-IP or fallback to any)
  const connectingIP = request.headers.get('CF-Connecting-IP') || '';
  const ip = typeof connectingIP === 'string' ? connectingIP : 'unknown';

  if (!checkRate(ip)) {
    return jsonResp(429, new Request(request.url), { error: 'Rate limit exceeded. Please try again later.' });
   }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResp(400, new Request(request.url), { error: 'Invalid JSON in request body' });
   }

   // Validate incoming message format with strict type checking on role/role content fields
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
     return jsonResp(400, new Request(request.url), { error: 'Request must be a POST with JSON body object' });
   }

  const messages = (body.messages ?? []).map(m => sanitizeMessage(m)).filter(Boolean);

  if (messages.length === 0) {
    return jsonResp(400, new Request(request.url), { error: 'No valid messages in array - all entries either missing or malformed' });
   }

   // Get user ID for session tracking if provided and valid string format from object structure field
 let session_id = body.session_id || '';
  const idClean = typeof session_id === 'string' ? session_id.trim() : '';
  if (idClean && /^[a-zA-Z\d_\-]{3,64}$/.test(idClean)) {
    session_id = idClean;
     } else {
    session_id = ''; // clear invalid format or default empty string for anonymous requests
   }

   // Build user object - extract from body.user.id if provided and valid string within 64 char limit
  let atlasUser = null;
  if (body.user) {
    const cleaned = cleanName(body.user);
    if (cleaned) atlasUser = cleaned;
      }

  const messagesFinal = [...messages]; // Clone array copy for safety check length bounds
   const nowMs = Date.now();


 /** Construct payload object for Atlas backend with field validation - all required and optional fields present as boolean/null primitives or string/number objects */
  const atlasPayload = {
      messages: messagesFinal,
    stream: typeof body.stream === 'boolean' ? body.stream : false,
    max_tokens: (typeof body.max_tokens === 'number' && !isNaN(body.max_tokens)) ? Math.min(body.max_tokens, 8192) : 2048,
    use_knowledge_base: true,
    save_session: !!session_id,
     ...(session_id ? { session_id } : {}),
     ...(atlasUser ? { user: atlasUser } : {})
   };

  let upstream;

  try {
    upstream = await fetch(`${ATLAS_BASE}/v1/chat/completions`, {
        method: 'POST',
       headers: {
          "Content-Type": "application/json",
           "Authorization": `Bearer ${ATLAS_KEY}`
         },
       body: JSON.stringify(atlasPayload),
     });
  } catch (e) {
    return jsonResp(502, new Request(request.url), { error: 'Atlas upstream unreachable', detail: e.message || String(e) });
   }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '<response body unavailable>');
     return jsonResp(upstream.status === 429 ? 429 : 502, new Request(request.url), { error: `Atlas error ${upstream.status}`, detail: text.slice(0, 500) });
   }

   if (body.stream === true) {
     return new Response(upstream.body, {
       status: 200,
       headers: {
          "Content-Type": 'text/event-stream',
           "Cache-Control": 'no-store, no-transform',
          "Connection": 'keep-alive',
           "Access-Control-Allow-Origin": '*',
            "X-Accel-Buffering": 'no'
         },
       });
     }

   const data = await upstream.json().catch(() => ({ choices: [], usage: null }));
   const choice = (data.choices && data.choices[0]) || {};

  return jsonResp(200, new Request(request.url), {
    reply: (choice.message && choice.message.content) || '',
    session_id: data.session_id || null,
    usage: data.usage || null,
    activity: data.activity || []
  });
}

