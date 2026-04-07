/**
 * POST /api/admin/updates
 * Add update/milestone to a project
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const db = env.MOLIAM_DB;

  let data;
  try { data = await request.json(); } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." }, request);
  }

  const projectId = data.project_id;
  const title = (data.title || "").trim();
  const description = (data.description || "").trim();
  const type = data.type || "update";

  if (!projectId || !title) {
    return jsonResp(400, { error: true, message: "Project ID and title required." }, request);
  }

  const validTypes = ["update", "milestone", "deliverable", "report", "invoice"];
  if (!validTypes.includes(type)) {
    return jsonResp(400, { error: true, message: `Type must be one of: ${validTypes.join(", ")}` }, request);
  }

  try {
    const project = await db.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
    if (!project) return jsonResp(404, { error: true, message: "Project not found." }, request);

    await db.prepare(
      "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, ?)"
    ).bind(projectId, title, description || null, type).run();

    // Update project's updated_at
    await db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").bind(projectId).run();

    return jsonResp(201, { success: true, message: "Update added." }, request);
  } catch (err) {
    console.error("Add update error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  }});
}

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

function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
    "Access-Control-Allow-Credentials": "true",
  }});
}
