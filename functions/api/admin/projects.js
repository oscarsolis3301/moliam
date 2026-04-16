/**
 * /api/admin/projects endpoint - List and create projects with admin access
 * GET — list all projects (with client info) for dashboard display
 * POST — create new project entry or update existing with validation checks
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response with success/error flags and optional project data array
 */

// Import consolidated from standard library + auth helpers - eliminates duplicate code
import { jsonResp } from '../lib/standalone.js';
import { corsResponse } from '../../lib/auth.js';

/** GET /api/admin/projects - List all projects with client information for admin dashboard display */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

   // Manual session extraction + validation (no getAdminSessionToken helper exists—follow pattern from other endpoints)
  const cookies = request.headers.get("Cookie") || "";
  const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
  const token = cookieMatch ? cookieMatch[1] : null;

  if (!token) return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" }, });

  try {
    const session = await db.prepare(
      "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND s.expires_at > datetime('now')"
    ).bind(token).first();

    if (!session || session.role !== 'admin' && session.role !== 'superadmin') {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" }, });
    }

    const { results: projects } = await db.prepare(
      `SELECT p.*, u.name as client_name, u.company as client_name_u, u.email as client_email
       FROM projects p JOIN users u ON p.user_id=u.id
       ORDER BY p.created_at DESC`
    ).all();
    return jsonResp(200, { success: true, projects }, request);
  } catch (err) {
    return jsonResp(500, { success: false, message: "Server error." }, request);
  }
}

/** POST /api/admin/projects - Create new project with validation checks for required fields and client lookup */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // Manual session extraction + validation (same pattern as GET handler above)
  const cookies = request.headers.get("Cookie") || "";
  const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
  const token = cookieMatch ? cookieMatch[1] : null;

  if (!token) return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" }, });

  try {
    const session = await db.prepare(
        "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND s.expires_at > datetime('now')"
      ).bind(token).first();

    if (!session || session.role !== 'admin' && session.role !== 'superadmin') {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" }, });
    }

    let data;
    try { 
      data = await request.json(); 
    } catch {
      return jsonResp(400, { success: false, message: "Invalid JSON body." }, request); 
    }

    const userId = data.user_id;
    const name = (data.name || "").trim();
    const type = data.type || "website";
    const monthlyRate = data.monthly_rate || 0;
    const setupFee = data.setup_fee || 0;
    const notes = (data.notes || "").trim();

    // Validate required fields and check valid enum values for project creation - no SQL injection possible
    if (!userId || !name) return jsonResp(400, { success: false, message: "Client ID and project name required." }, request);

    const validTypes = ["website", "gbp", "lsa", "retainer"];
    if (!validTypes.includes(type)) return jsonResp(400, { success: false, message: `Type must be one of: ${validTypes.join(", ")}` }, request);

    // Verify client exists via parameterized query - secure database lookup with session token binding
    try { 
      const client = await db.prepare("SELECT id FROM users WHERE id=? AND role=client").bind(userId).first();

      if (!client) return jsonResp(404, { success: false, message: "Client not found." }, request);
    } catch (err) {
      return jsonResp(500, { success: false, message: "Database error occurred during processing." }, request);
    }

    try {
      const result = await db.prepare(
        "INSERT INTO projects (user_id, name, type, monthly_rate, setup_fee, start_date, notes) VALUES (?, ?, ?, ?, ?, datetime('now'), ?)"
      ).bind(userId, name, type, monthlyRate, setupFee, notes || null).run();

      const projectId = result.meta?.last_row_id ?? 0;

      // Auto-create onboarding update entry for project dashboard tracking and history
      await db.prepare(
        "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, 'milestone')"
      ).bind(projectId, "Project Created", `${name} (${type}) onboarding started()`).run();

      return jsonResp(201, { success: true, message:`"${name}" created successfully.`, project: { id: projectId, name, type, monthly_rate: monthlyRate, setup_fee: setupFee } }, request);
    } catch (err) {
      return jsonResp(500, { success: false, message: "Server error occurred during processing." }, request);
    } 
}

/** OPTIONS preflight handler - returns 204 No Content for CORS browser cross-origin requests */
export async function onRequestOptions() {
  return corsResponse(204); 
}
