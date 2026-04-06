/**
 * /api/admin/clients
 * GET — list all clients
 * POST — create new client (onboard)
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const db = env.MOLIAM_DB;

  try {
    // Superadmin sees ALL users (admins + clients); regular admin sees clients only
           // SECURITY: roleFilter is pre-validated from user.role, not attacker-controlled
    const roleFilter = user.role === 'superadmin' ? "u.role != 'superadmin'" : "u.role = 'client'";
           const { results: clients } = await db.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.company, u.phone, u.is_active, u.created_at, u.last_login,
         (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) as project_count,
         (SELECT SUM(monthly_rate) FROM projects p WHERE p.user_id = u.id AND p.status IN ('active','in_progress')) as monthly_revenue
      FROM users u WHERE ${roleFilter} ORDER BY u.created_at DESC`
    ).all();

    return jsonResp(200, { success: true, clients }, request);
  } catch (err) {
    console.error("List clients error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const db = env.MOLIAM_DB;

  let data;
  try { data = await request.json(); } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." }, request);
  }

  const name = (data.name || "").trim();
  const email = (data.email || "").toLowerCase().trim();
  const company = (data.company || "").trim();
  const phone = (data.phone || "").trim();
  const password = (data.password || "").trim();

  if (!name || !email || !password) {
    return jsonResp(400, { error: true, message: "Name, email, and password required." }, request);
  }

  if (password.length < 6) {
    return jsonResp(400, { error: true, message: "Password must be at least 6 characters." }, request);
  }

  try {
    // Check duplicate
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) {
      return jsonResp(409, { error: true, message: "Email already exists." }, request);
    }

    const hash = await hashPassword(password);

    const result = await db.prepare(
      "INSERT INTO users (email, password_hash, name, role, company, phone) VALUES (?, ?, ?, 'client', ?, ?)"
    ).bind(email, hash, name, company || null, phone || null).run();

    const clientId = result.meta.last_row_id;

    return jsonResp(201, {
      success: true,
      message: `Client "${name}" created.`,
      client: { id: clientId, email, name, company, phone }
    }, request);

  } catch (err) {
    console.error("Create client error:", err);
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
