/**
 * MOLIAM Health Check — CloudFlare Pages Function
 * GET /api/health
 */

export async function onRequestGet(context) {
  const { env } = context;
  const result = { status: 'ok', timestamp: new Date().toISOString() };

  try {
    const check = await env.MOLIAM_DB.prepare("SELECT 1 as ping").first();
    result.database = check?.ping === 1 ? 'connected' : 'error';
  } catch (err) {
    result.status = 'degraded';
    result.database = 'error';
    result.db_error = err.message;
  }

  return new Response(JSON.stringify(result), {
    status: result.status === 'ok' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
