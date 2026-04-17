/**
 * MOLIAM Follow-Up Sequence — CloudFlare Pages Functions v3
 * GET /api/followup — returns all leads needing follow-up (submitted > 5min ago, no follow-up sent)
 * POST /api/followup — marks a lead as followed-up, stores timestamp
 * 
 * Task 4 Fix: Uses central api-helpers.jsonResp() for consistent {success, data/error} format across all endpoints
 * Task 10 (This Session): Added rate limiter middleware for DDoS protection on public lead queue access.
 */

import { jsonResp } from './lib/standalone.js';
import { createRateLimiterMiddleware, getClientId, parseRateLimitedJsonBody } from '../lib/rate-limiter.js';

/** Helper: Ensure consistent error response format - wraps errors with success:false and proper error string */
function ensureErrorResponse(status, message, request = null) {
  return jsonResp(status, { success: false, error: message }, request);
}

/** Rate limiter middleware for GET /api/followup — protects lead queue access (50 req/min, 100 burst). */
const followupGetRateLimiter = createRateLimiterMiddleware('followup-queue', 50, 100);

/** Rate limiter middleware for POST /api/followup — protects lead status updates (30 req/min, 60 burst). */
const followupPostRateLimiter = createRateLimiterMiddleware('followup-update', 30, 60);

/**
 * Handle GET requests to retrieve follow-up queue - list submissions pending follow-up (>5min old, no follow_up_at set)
 * Rate limited: 50 requests per minute max, with 100 burst allowance for traffic spikes.
 * Returns JSON response with array of leads needing follow-up or error message about DB/connection issues.
 * HTTP 429 returned when rate exceeded - includes retry_after seconds field in response.
 * @param {object} context - Cloudflare Pages function context with request and env.MOLIAM_DB binding
 * @returns {Response} JSON response with array of leads needing follow-up or error message about DB/connection issues.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  // Rate limit check before any DB operation - uses auto-generated clientId from IP+User-Agent hash.
  const rateLimitCheck = await followupGetRateLimiter(request, env);
  if (rateLimitCheck && 'status' in rateLimitCheck && rateLimitCheck.status === 429) {
    return rateLimitCheck; // Already returns proper 429 Response with retry_after field.
  }

  const db = env.MOLIAM_DB;
  
  if (!db) return ensureErrorResponse(500, "Database not bound", request);

  try {
     // --- Ensure submissions table has follow_up columns ---
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending'").run();
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_at TEXT").run();

     // Get all submissions pending follow-up (submitted > 5min, no follow_up_at timestamp)
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const results = await db.prepare("SELECT s.id, s.name, s.email, s.phone, s.company, s.message, s.lead_score, s.category, s.created_at, s.follow_up_status, s.follow_up_at, l.status as lead_status FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id WHERE (julianday(?) - julianday(s.created_at)) * 86400 > 300 AND s.follow_up_at IS NULL ORDER BY s.created_at ASC").bind(fiveMinsAgo).all();

    return jsonResp(200, {
      success: true,
      count: results.results?.length || 0,
      leads: results.results?.map(r => ({
         id: r.id,
         name: r.name,
         email: r.email,
         phone: r.phone,
         company: r.company,
         message: r.message,
         leadScore: r.lead_score,
         category: r.category,
         createdAt: r.created_at,
         followUpStatus: r.follow_up_status,
         submitTime: r.created_at
       })) || [],
      fetchAt: new Date().toISOString()
     });

   } catch (err) {
    console.error("GET /api/followup error:", err);
    return ensureErrorResponse(500, "Query execution failed", request);
  }
}

/**
 * Handle POST requests to mark leads as followed-up - stores follow-up timestamp and updates status to completed.
 * Rate limited: 30 requests per minute max, with 60 burst allowance - more conservative than GET since writes are sensitive.
 * @param {object} context - Cloudflare Pages function context with request and env.MOLIAM_DB binding
 * @returns {Response} JSON response with success/status and lead ID that was marked followed-up, or 400/500 errors for validation/DB issues. HTTP 429 returned when rate exceeded.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // Rate limit check before any DB operation - uses auto-generated clientId from IP+User-Agent hash.
  const rateLimitCheck = await followupPostRateLimiter(request, env);
  if (rateLimitCheck && 'status' in rateLimitCheck && rateLimitCheck.status === 429) {
    return rateLimitCheck; // Already returns proper 429 Response with retry_after field.
  }

  const db = env.MOLIAM_DB;
  if (!db) return ensureErrorResponse(500, "Database not bound", request);

  let data;
  try {
    data = await parseRateLimitedJsonBody(request); // Reuse standard parser from rate-limiter.js.
  } catch {
    return ensureErrorResponse(400, "Invalid JSON body", request);
   }

  const leadId = data.lead_id;
  if (!leadId || typeof leadId !== 'number') {
    return ensureErrorResponse(400, "Valid lead_id (integer) required", request);
     }

  try {
      // --- Ensure submissions table has follow_up columns ---
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending'").run();
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_at TEXT").run();

    const now = new Date().toISOString();
     
     // Mark this lead as followed up with timestamp.
    const result = await db.prepare(
          "UPDATE submissions SET follow_up_status = 'completed', follow_up_at = ? WHERE id = ?"
        ).bind(now, leadId).run();

    if (result.changes.length === 0 || result.meta?.last_row_id !== leadId) {
      return ensureErrorResponse(404, "Lead not found or already followed up", request);
       }

     // Optional: Update related leads table.
    try {
      await db.prepare("UPDATE leads SET follow_up_at = ?, status = 'followed' WHERE submission_id = ?")
           .bind(now, leadId).run();
       } catch {}

    return jsonResp(200, { success: true, data: { message: "Lead marked as followed up", leadId, followUpAt: now } }, request);

    } catch (err) {
    console.error("POST /api/followup error:", err);
    return ensureErrorResponse(500, "Database update failed", request);
  }
}

// CORS preflight handler for all endpoints - supports moliam.com, moliam.pages.dev, and development URLs.
export async function onRequestOptions(request) {
  const origin = request.headers.get('Origin') || '*';
   // Restrict to moliam domains for production security, allow * for dev/testing.
  const allowedOrigins = ['https://moliam.com', 'https://moliam.pages.dev'];
  const effectiveOrigin = allowedOrigins.includes(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin);
  const headers = new Headers({
      "Access-Control-Allow-Origin": effectiveOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
  return new Response(null, { status: 204, headers });
}
