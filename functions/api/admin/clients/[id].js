/**
 * /api/admin/clients/:id
 * GET    — get single client details
 * PATCH  — update client fields (name, email, company, phone, is_active, password)
 * DELETE — delete client and all their data
 */

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const clientId = parseInt(params.id);
  if (!clientId) return jsonResp(400, { error: true, message: "Invalid client ID." }, request);

  const db = env.MOLIAM_DB;

  try {
    const client = await db.prepare(
      "SELECT id, email, name, company, phone, is_active, created_at, last_login, role FROM users WHERE id = ?"
    ).bind(clientId).first();

    if (!client) return jsonResp(404, { error: true, message: "Client not found." }, request);

    const { results: projects } = await db.prepare(
      "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(clientId).all();

    return jsonResp(200, { success: true, client, projects }, request);
  } catch (err) {
    console.error("Get client error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const clientId = parseInt(params.id);
  if (!clientId) return jsonResp(400, { error: true, message: "Invalid client ID." }, request);

  const db = env.MOLIAM_DB;

  let data;
  try { data = await request.json(); } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." }, request);
  }

  try {
    const client = await db.prepare("SELECT id, name, role FROM users WHERE id = ?").bind(clientId).first();
    if (!client) return jsonResp(404, { error: true, message: "Client not found." }, request);

    // Prevent non-superadmin from editing superadmin accounts
    if (client.role === "superadmin" && user.role !== "superadmin") {
      return jsonResp(403, { error: true, message: "Cannot modify super admin account." }, request);
    }

    const updates = [];
    const binds = [];

    if (data.name !== undefined && data.name.trim()) {
      updates.push("name = ?");
      binds.push(data.name.trim());
    }

    if (data.email !== undefined && data.email.trim()) {
      // Check uniqueness
      const existing = await db.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .bind(data.email.toLowerCase().trim(), clientId).first();
      if (existing) return jsonResp(409, { error: true, message: "Email already in use." }, request);
      updates.push("email = ?");
      binds.push(data.email.toLowerCase().trim());
    }

    if (data.company !== undefined) {
      updates.push("company = ?");
      binds.push(data.company.trim() || null);
    }

    if (data.phone !== undefined) {
      updates.push("phone = ?");
      binds.push(data.phone.trim() || null);
    }

    if (data.is_active !== undefined) {
      updates.push("is_active = ?");
      binds.push(data.is_active ? 1 : 0);
    }

    if (data.password && data.password.trim().length >= 6) {
      const hash = await hashPassword(data.password.trim());
      updates.push("password_hash = ?");
      binds.push(hash);
    }

    if (data.role !== undefined && ["admin", "client"].includes(data.role)) {
      // Only superadmin can change roles
      if (user.role !== "superadmin") {
        return jsonResp(403, { error: true, message: "Only super admin can change roles." }, request);
      }
      updates.push("role = ?");
      binds.push(data.role);
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
      message: `User "${client.name}" updated.`,
    }, request);

  } catch (err) {
    console.error("Update client error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const clientId = parseInt(params.id);
  if (!clientId) return jsonResp(400, { error: true, message: "Invalid client ID." }, request);

  const db = env.MOLIAM_DB;

  try {
    const client = await db.prepare("SELECT id, name, role FROM users WHERE id = ?").bind(clientId).first();
    if (!client) return jsonResp(404, { error: true, message: "Client not found." }, request);

    // Prevent deleting superadmin accounts
    if (client.role === "superadmin") {
      return jsonResp(403, { error: true, message: "Cannot delete super admin account." }, request);
    }

    // Prevent non-superadmin from deleting admins
    if (client.role === "admin" && user.role !== "superadmin") {
      return jsonResp(403, { error: true, message: "Only super admin can delete admin accounts." }, request);
    }

    // Delete cascade: project_updates → projects → sessions → user
    const { results: projectIds } = await db.prepare(
      "SELECT id FROM projects WHERE user_id = ?"
    ).bind(clientId).all();

    for (const p of projectIds) {
      await db.prepare("DELETE FROM project_updates WHERE project_id = ?").bind(p.id).run();
    }
    await db.prepare("DELETE FROM projects WHERE user_id = ?").bind(clientId).run();
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(clientId).run();
    await db.prepare("DELETE FROM users WHERE id = ?").bind(clientId).run();

    return jsonResp(200, {
      success: true,
      message: `User "${client.name}" and all associated data deleted.`,
    }, request);

  } catch (err) {
    console.error("Delete client error:", err);
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
  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { error: true, message: "Admin only." }, request);
  return session;
}

function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
  return "https://moliam.pages.dev";
}

function corsResponse(status) {
  return new Response(null, { status, headers: {
    "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
