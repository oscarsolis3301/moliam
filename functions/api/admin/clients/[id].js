/**
 * /api/admin/clients/:id
 * PATCH — update client fields (is_active, etc.)
 */

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const clientId = parseInt(params.id);
  if (!clientId) {
    return jsonResp(400, { error: true, message: "Invalid client ID." }, request);
  }

  const db = env.MOLIAM_DB;

  let data;
  try { data = await request.json(); } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." }, request);
  }

  try {
    const client = await db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'client'").bind(clientId).first();
    if (!client) {
      return jsonResp(404, { error: true, message: "Client not found." }, request);
    }

    const updates = [];
    const binds = [];

    if (data.is_active !== undefined) {
      updates.push("is_active = ?");
      binds.push(data.is_active ? 1 : 0);
    }

    if (data.company !== undefined) {
      updates.push("company = ?");
      binds.push(data.company);
    }

    if (data.phone !== undefined) {
      updates.push("phone = ?");
      binds.push(data.phone);
    }

    if (updates.length === 0) {
      return jsonResp(400, { error: true, message: "No valid fields to update." }, request);
    }

    binds.push(clientId);

    await db.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...binds).run();

    return jsonResp(200, {
      success: true,
      message: `Client "${client.name}" updated.`,
    }, request);

  } catch (err) {
    console.error("Update client error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

export async function onRequestOptions() {
  return corsResponse(204);
}

// ── Shared helpers ──

async function requireAdmin(request, env) {
  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { error: true, message: "Not authenticated." }, request);
  const db = env.MOLIAM_DB;
  const session = await db.prepare(
    "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1 AND s.expires_at > datetime('now')"
  ).bind(token).first();
  if (!session) return jsonResp(401, { error: true, message: "Session invalid." }, request);
  if (session.role !== "admin") return jsonResp(403, { error: true, message: "Admin only." }, request);
  return session;
}

function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
  return "https://moliam.pages.dev";
}

function corsResponse(status) {
  return new Response(null, { status, headers: {
    "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  }});
}

function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
    "Access-Control-Allow-Credentials": "true",
  }});
}
