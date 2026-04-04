/**
 * POST /api/auth/logout
 * Destroys session, clears cookie
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const token = getSessionToken(request);

  if (token) {
    try {
      await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    } catch (err) {
      console.error("Logout DB error:", err);
    }
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": getAllowedOrigin(request),
    "Access-Control-Allow-Credentials": "true",
  });

  // Clear cookie
  headers.append("Set-Cookie",
    "moliam_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
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
