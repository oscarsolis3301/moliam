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
import { jsonResp, balanceSuccessError } from './api-helpers.js';

const API_VERSION = "1.0.0";

/** Helper to ensure success/error structure on health responses */
function normalizeHealthResult(result) {
  return balanceSuccessError({ ...result, success: true });
}

/**
 * GET /api/health -- Health check endpoint
 * Returns API version, D1 connectivity, table row counts, integrity checks
 * @param {object} context - Cloudflare Pages function context
 * @returns {Response} JSON response with health status or error
 */
export async function onRequestGet(context) {
  try {
    const { env } = context;

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
    try {
      const check = await db.prepare("SELECT 1 AS ping").first();
      databaseStatus = check?.ping === 1 ? "connected" : "unexpected_result";
    } catch (err) {
      databaseStatus = "error";
    }

    // 2) Table list with row counts
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
      tables: tableInfo,
      table_count: tableInfo.length,
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
 * @param {Request} request - Cloudflare Pages request object (unused, standard signature)
 * @returns {Response} 204 No Content with CORS headers for moliam.com and moliam.pages.dev
 */
export async function onRequestOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
       "Access-Control-Allow-Origin": "https://moliam.pages.dev",
       "Access-Control-Allow-Methods": "GET, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
     },
   });
}
