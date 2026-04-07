/**
 * /api/admin/projects
 * GET — list all projects (with client info)
 * POST — create new project for a client
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const db = env.MOLIAM_DB;

  try {
    const { results: projects } = await db.prepare(
      `SELECT p.*, u.name as client_name, u.company as client_company, u.email as client_email
      FROM projects p JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC`
    ).all();

    return jsonResp(200, { success: true, projects }, request);
  } catch (err) {
    console.error("List projects error:", err);
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

  const userId = data.user_id;
  const name = (data.name || "").trim();
  const type = data.type || "website";
  const monthlyRate = data.monthly_rate || 0;
  const setupFee = data.setup_fee || 0;
  const notes = (data.notes || "").trim();

  if (!userId || !name) {
    return jsonResp(400, { error: true, message: "Client ID and project name required." }, request);
  }

  const validTypes = ["website", "gbp", "lsa", "retainer"];
  if (!validTypes.includes(type)) {
    return jsonResp(400, { error: true, message: `Type must be one of: ${validTypes.join(", ")}` }, request);
  }

  try {
    // Verify client exists
    const client = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'client'").bind(userId).first();
    if (!client) {
      return jsonResp(404, { error: true, message: "Client not found." }, request);
    }

    const result = await db.prepare(
      "INSERT INTO projects (user_id, name, type, monthly_rate, setup_fee, start_date, notes) VALUES (?, ?, ?, ?, ?, datetime('now'), ?)"
    ).bind(userId, name, type, monthlyRate, setupFee, notes || null).run();

    const projectId = result.meta.last_row_id;

    // Auto-create onboarding update
    await db.prepare(
      "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, 'milestone')"
    ).bind(projectId, "Project Created", `${name} (${type}) onboarding started.`).run();

    return jsonResp(201, {
      success: true,
      message: `Project "${name}" created.`,
      project: { id: projectId, name, type, monthly_rate: monthlyRate, setup_fee: setupFee }
    }, request);

  } catch (err) {
    console.error("Create project error:", err);
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
