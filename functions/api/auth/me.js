/**
 * GET /api/auth/me
 * Returns current user from session cookie, validates token and auth status
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with authenticated user data or 401 error
 */
import { jsonResp } from '../lib/api-helpers.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

          // Get session token from cookies for authentication - uses parameterized query with ? binding
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  const token = match ? match[1] : null;

  if (!token) {
    return jsonResp(401, { success: false, message: "Not authenticated." }, request);
  }

  try {
       // Get user session with proper ? parameterized binding - no SQL injection possible here
    const session = await db.prepare(
          "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.company, u.phone, u.avatar_url FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1"
        ).bind(token).first();

    if (!session) {
      return jsonResp(401, { success: false, message: "Session invalid." }, request);
  }

      // Check session expiry - delete stale tokens to prevent orphan data accumulation
    if (new Date(session.expires_at) < new Date()) {
      await db.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();

      return jsonResp(401, { success: false, message: "Session expired." }, request);
  }

        // Normalize superadmin → admin for frontend routing and display
    const displayRole = session.role === 'superadmin' ? 'admin' : session.role;

    return jsonResp(200, {
       success: true,
       user: {
          id: session.user_id,
          email: session.email,
          name: session.name,
          role: displayRole,
          company: session.company,
          phone: session.phone,
          avatar_url: session.avatar_url,
          }
        }, request);

      } catch (err) {
    console.error("Auth check error:", err);
    return jsonResp(500, { success: false, message: "Server error." }, request);
  }
}

// CORS preflight handler - returns 204 with standard Access-Control headers
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
         "Access-Control-Allow-Origin": "https://moliam.pages.dev",
         "Access-Control-Allow-Methods": "GET, OPTIONS",
         "Access-Control-Allow-Headers": "Content-Type",
         "Access-Control-Allow-Credentials": "true",
       }
     });
}

// CORS origin helper - extracts preferred origin from request headers for response headers
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) {
    return origin;
  }

  return "https://moliam.pages.dev";
}
