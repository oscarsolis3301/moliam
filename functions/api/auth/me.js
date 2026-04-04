/**
 * GET /api/auth/me
 * Returns current user from session cookie
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const token = getSessionToken(request);
  if (!token) {
    return jsonResp(401, { error: true, message: "Not authenticated." }, request);
  }

  try {
    const session = await db.prepare(
      "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.company, u.phone, u.avatar_url FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1"
    ).bind(token).first();

    if (!session) {
      return jsonResp(401, { error: true, message: "Session invalid." }, request);
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      return jsonResp(401, { error: true, message: "Session expired." }, request);
    }

    return jsonResp(200, {
      success: true,
      user: {
        id: session.user_id,
        email: session.email,
        name: session.name,
        role: session.role,
        company: session.company,
        phone: session.phone,
        avatar_url: session.avatar_url,
      }
    }, request);

  } catch (err) {
    console.error("Auth check error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

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

function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) {
    return origin;
  }
  return "https://moliam.pages.dev";
}

function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
      "Access-Control-Allow-Credentials": "true",
    }
  });
}
