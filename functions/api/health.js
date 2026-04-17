/**
 * MOLIAM Health Check — CloudFlare Pages Function
 * GET /api/health
 *
 * Returns:
 *  1) API version
 *  2) D1 connection status (SELECT 1)
 *  3) Table list with row counts
 *  4) Timestamp
 */

/**
 * API Helpers import for standardized error handling and response formatting
 */
import { jsonResp, generateRequestId, balanceSuccessError } from './lib/standalone.js';

/** Rate Limiter Integration - protects health endpoint from abuse */
import { createRateLimiterMiddleware } from './lib/rate-limiter.js';

const API_VERSION = "1.0.0";

/** Wrapper: Health Check with rate limiter middleware (60/min, 120 burst - high limit since monitoring needs to never fail). Wrap before handler executes. */
async function healthRateLimiterMiddleware(request, env) {
  const baseRate = 60; // per minute
  const maxBurst = 120; // double the base rate
  const now = Date.now();
  
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const clientId = crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + ua))
    .then(d => Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  const LIMIT_KEY = `health_rate:${await clientId}`;
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
        }
      } else {
        await env.MOLIAM_DB.prepare(
          'INSERT OR REPLACE INTO rate_limits (client_id, count, expires_at, updated_at) VALUES (?, 1, ?, datetime(\'now\')'
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
    console.warn('[health-rate-limiter]: rate check failed:', err.message);
  }
  
  return null; // continue to handler
}

globalThis.moliamRateLimitMemory = /*#__PURE__*/ new Map();

/** Helper to ensure success/error structure on health responses */
function normalizeHealthResult(result) {
  return balanceSuccessError({ ...result, success: true });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // Apply rate limiting before processing health check (high limit: 60/min, 120 burst for monitoring safety)
  const rateLimitResult = await healthRateLimiterMiddleware(request, env);
  if (rateLimitResult) return rateLimitResult;

  try {
    if (!env.MOLIAM_DB) {
      return jsonResp(503, balanceSuccessError({ 
        success: false, 
        error: "Database not bound", 
        api_version: API_VERSION 
      }));
    }

    const db = env.MOLIAM_DB;

    // 1) D1 connectivity check
    let databaseStatus = "connected";
    let dbError = null;
    try {
      const check = await db.prepare("SELECT 1 AS ping").first();
      databaseStatus = check?.ping === 1 ? "connected" : "unexpected_result";
    } catch (err) {
      databaseStatus = "error";
      dbError = err.message;
    }

    // 2) Table list with row counts
    let tables = [];
    let tableCount = 0;
    let tablesError = null;
    try {
      const { results: tablesRaw } = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
      ).all();

      const tableInfo = [];
      for (const t of tablesRaw) {
        try {
          const row = await db.prepare(
            "SELECT COUNT(*) AS cnt FROM ?"
          ).bind(t.name).first();
          tableInfo.push({ name: t.name, row_count: row?.cnt ?? 0 });
        } catch {
          tableInfo.push({ name: t.name, row_count: "error" });
        }
      }
      tables = tableInfo;
      tableCount = tableInfo.length;
    } catch (err) {
      tablesError = err.message;
    }

    // 3) Quick data integrity checks
    const integrity = {};
    try {
      // Admin exists?
      const admin = await db.prepare(
        "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'"
      ).first();
      integrity.admin_users = admin?.cnt ?? 0;

      // Active sessions
      const sessions = await db.prepare(
        "SELECT COUNT(*) AS cnt FROM sessions WHERE expires_at > datetime('now')"
      ).first();
      integrity.active_sessions = sessions?.cnt ?? 0;

      // Expired sessions (cleanup candidate)
      const expired = await db.prepare(
        "SELECT COUNT(*) AS cnt FROM sessions WHERE expires_at <= datetime('now')"
      ).first();
      integrity.expired_sessions = expired?.cnt ?? 0;
    } catch {
      // Non-fatal — tables may not exist yet
    }

    const result = balanceSuccessError({ 
      success: true, 
      api_version: API_VERSION,
      status: databaseStatus === "error" ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      database: databaseStatus,
      tables,
      table_count: tableCount,
      db_error: dbError,
      tables_error: tablesError,
      integrity,
      uptime_note: "Serverless — no persistent uptime"
    });

    return jsonResp(databaseStatus === "error" ? 503 : 200, result);
  } catch (err) {
    return jsonResp(503, balanceSuccessError({ 
      success: false, 
      error: err.message || "Internal server error", 
      api_version: API_VERSION 
    }));
  }
}

/**
 * Handle CORS preflight requests to Health Check endpoint  
 * @returns {Response} 204 No Content with Access-Control headers for moliam.com and moliam.pages.dev
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
       "Access-Control-Allow-Origin": "https://moliam.pages.dev",
       "Access-Control-Allow-Methods": "GET, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
     },
   });
}
