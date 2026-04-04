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

const API_VERSION = "1.0.0";

export async function onRequestGet(context) {
  const { env } = context;
  const result = {
    api_version: API_VERSION,
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "unknown",
    tables: [],
    uptime_note: "Serverless — no persistent uptime",
  };

  // 1) D1 connectivity check
  try {
    const check = await env.MOLIAM_DB.prepare("SELECT 1 AS ping").first();
    result.database = check?.ping === 1 ? "connected" : "unexpected_result";
  } catch (err) {
    result.status = "degraded";
    result.database = "error";
    result.db_error = err.message;
    // Return early — can't enumerate tables if DB is down
    return respond(result, 503);
  }

  // 2) Table list with row counts
  try {
    const { results: tables } = await env.MOLIAM_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
    ).all();

    const tableInfo = [];
    for (const t of tables) {
      try {
        const row = await env.MOLIAM_DB.prepare(
          `SELECT COUNT(*) AS cnt FROM "${t.name}"`
        ).first();
        tableInfo.push({ name: t.name, row_count: row?.cnt ?? 0 });
      } catch {
        tableInfo.push({ name: t.name, row_count: "error" });
      }
    }
    result.tables = tableInfo;
    result.table_count = tableInfo.length;
  } catch (err) {
    result.tables_error = err.message;
  }

  // 3) Quick data integrity checks
  try {
    const checks = {};

    // Admin exists?
    const admin = await env.MOLIAM_DB.prepare(
      "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'"
    ).first();
    checks.admin_users = admin?.cnt ?? 0;

    // Active sessions
    const sessions = await env.MOLIAM_DB.prepare(
      "SELECT COUNT(*) AS cnt FROM sessions WHERE expires_at > datetime('now')"
    ).first();
    checks.active_sessions = sessions?.cnt ?? 0;

    // Expired sessions (cleanup candidate)
    const expired = await env.MOLIAM_DB.prepare(
      "SELECT COUNT(*) AS cnt FROM sessions WHERE expires_at <= datetime('now')"
    ).first();
    checks.expired_sessions = expired?.cnt ?? 0;

    result.integrity = checks;
  } catch {
    // Non-fatal — tables may not exist yet
  }

  return respond(result, 200);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function respond(body, status) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
