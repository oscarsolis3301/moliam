/**
 * Quick sanity endpoint for the landing page to show Atlas status.

 */

import { jsonResp, generateRequestId } from './lib/standalone.js';

/** Rate Limiter Integration - protects toby-health endpoint (120/min, 240 burst since this is a public health check) */
async function tobyHealthRateLimiterMiddleware(request, env) {
  const baseRate = 120; // per minute - very high since public monitoring
  const maxBurst = 240; // double the base rate
  
  const now = Date.now();
  
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const clientId = crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + ua))
     .then(d => Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  LIMIT_KEY = `toby_health:${await clientId}`;
  const windowMs = 60 * 1000; // 1 minute window
  
  try {
    if (env && env.MOLIAM_DB) {
      const checkStmt = env.MOLIAM_DB.prepare(
         'SELECT count, expires_at FROM rate_limits WHERE client_id = ? AND expires_at > ?'
       ).bind(LIMIT_KEY.split(':')[1] || LIMIT_KEY, now);
      const state = await checkStmt.first();
      
      if (state && state.expires_at && state.expires_at > now) {
        const count = state.count || 0;
        if (count >= maxBurst) {
          return jsonResp(429, { success: false, error: "Rate limit exceeded", retry_after: Math.ceil((state.expires_at - now) / 1000) });
        } else {
          await env.MOLIAM_DB.prepare(
             'INSERT OR REPLACE INTO rate_limits (client_id, count, expires_at, updated_at) VALUES (?, ?, ?, datetime(\'now\'))'
           ).bind(LIMIT_KEY.split(':')[1] || LIMIT_KEY, count + 1, now + windowMs).run();
        }
       } else {
        await env.MOLIAM_DB.prepare(
           'INSERT OR REPLACE INTO rate_limits (client_id, count, expires_at, updated_at) VALUES (?, 1, ?, datetime(\'now\'))'
         ).bind(LIMIT_KEY.split(':')[1] || LIMIT_KEY, now + windowMs).run();
       }
     } else {
      const memoryKey = LIMIT_KEY;
      const memoryState = globalThis.moliamRateLimitMemory?.get(memoryKey);
      
      if (!memoryState || now > memoryState.windowStart + windowMs) {
        if (memoryState) globalThis.moliamRateLimitMemory.delete(memoryKey);
        globalThis.moliamRateLimitMemory.set(memoryKey, { count: 1, windowStart: now });
       } else {
        const currentCount = memoryState.count || 0;
        if (currentCount >= maxBurst) {
          return jsonResp(429, { success: false, error: "Rate limit exceeded", retry_after: Math.ceil((memoryState.windowStart + windowMs - now) / 1000) });
         }
        memoryState.count = currentCount + 1;
       }
     }
   } catch (err) {
    console.warn('[toby-health-rate-limiter]: rate check failed:', err.message);
   }
  
   return null; // continue to handler
}

globalThis.moliamRateLimitMemory = /*#__PURE__*/ new Map();
let LIMIT_KEY;

export async function onRequestGet({ request, env }) {
  // Apply rate limiting before processing (very high limit for public health check)
  const rateLimitResult = await tobyHealthRateLimiterMiddleware(request, env);
  if (rateLimitResult) return rateLimitResult;
  
  try {
    const base = env.ATLAS_BASE_URL || "https://atlas.moliam.com";
    const r = await fetch(`${base}/healthz`);
    const data = await r.json();

    if (r.ok) {
      return jsonResp(200, { ok: true, status: data.status || 'unknown', backends: data.backends || null }, new Request(`http://localhost${env?.MOLIAM_DB ? '/health' : ''}`, { headers: request.headers }));
    } else {
      return jsonResp(502, { ok: false, status: data.status || 'unknown', error: `Atlas returned status ${r.status}` }, request);
    }
  } catch (e) {
    return jsonResp(502, { ok: false, error: e.message || String(e) }, request);
  }
}
