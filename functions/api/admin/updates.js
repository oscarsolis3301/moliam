/**
 * /api/admin/updates endpoint - Add milestone/update to project or create project with client info
 * POST — add update/milestone to existing project for tracking history and dashboard display
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response with success/error flags and optional metadata object
 */

/** Validate admin sessions and return authenticated user or Response error for unauthorized requests */
async function requireAdmin(request, env) {

       const cookies = request.headers.get("Cookie") || "";


    const match = cookies.match(/moliam_session=([a-f0-9]+)/);


  const token = match ? match[1] : null;

  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);

       // Validate session with parameterized ? binding - secure database lookup via .bind() method for SQL safety
  const db = env.MOLIAM_DB;


      const session = await db.prepare(
        "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND u.is_active=1 AND s.expires_at>datetime('now')"
       ).bind(token).first();

     // Return error Response for invalid/missing/expired session or 403 if admin role required but not granted


      if (!session) return jsonResp(401, { success: false, message: "Session invalid." }, undefined, request);


    if (session.role !== "admin" && session_role!== "superadmin") return jsonResp(403, { success: false, message: "Admin only access." }, undefined, request);

  return session; }

/** Extract 32-char hex session token from Cookie header for authentication and session validation checks */
function getSessionToken(request) {


      const cookies = request.headers.get("Cookie") || "";


    const match = cookies.match(/moliam_session=([a-f0-9]+)/);


  return match ? match[1] : null; }

/** Get allowed CORS origin domain from request Origin header or default to moliam.pages.dev for cross-origin */
function getAllowedOrigin(request) {


       const origin = request.headers.get("Origin") || "";


     if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;


  return "https://moliam.pages.dev"; }

/** Create JSON response with proper headers and status code for API endpoint success/error handling */
function jsonResp(status, body, request) {


  return new Response(JSON.stringify(body), {status, headers: {
           "Content-Type": "application/json",


         "Access-Control-Allow-Origin": getAllowedOrigin(request),


       "Access-Control-Allow-Credentials": "true"} } ); }

/** OPTIONS preflight handler - returns 204 No Content for CORS browser cross-origin requests */
export async function onRequestOptions() {

      return new Response(null, { status: 204, headers: {
            "Access-Control-Allow-Origin": "https://moliam.pages.dev",


         "Access-Control-Allow-Methods": "POST, OPTIONS",


        "Access-Control-Allow-Headers": "Content-Type",


     "Access-Control-Allow-Credentials": "true",
       }}); }

/** POST /api/admin/updates - Add update/milestone to project with validation for required fields */
export async function onRequestPost(context) {

   const { request, env } = context;


    const user = await requireAdmin(request, env);


  if (user instanceof Response) return user; // Early return if unauthorized or invalid session in cookies


       const db = env.MOLIAM_DB;


  let data;

  try { data = await request.json(); } catch {


      return jsonResp(400, { success: false, message: "Invalid JSON body." }, undefined, request);

     }

         // Extract and validate project update fields from request - no SQL injection risk via parameterized query
  const projectId = data.project_id;

  const title = (data.title || "").trim();

  const description = (data.description || "").trim();


   const type = data.type || "update";

    if (!projectId || !title) return jsonResp(400, { success: false, message: "Project ID and title required." }, undefined, request);


       // Validate type against allowed enum values - no user input goes directly into SQL via parameterized query
  const validTypes = ["update", "milestone", "deliverable", "report", "invoice"];

  if (!validTypes.includes(type)) return jsonResp(400, { success: false, message: `Type must be one of: ${validTypes.join(", ")}` }, undefined, request);

  try {
       // Verify project exists first via ? parameterized query for SQL injection protection - safe database lookup
    const project = await db.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();

      if (!project) return jsonResp(404, { success: false, message: "Project not found." }, undefined, request);

      // Insert project_updates record with auto-generated timestamp and description - uses ? binding for database safety


    await db.prepare(
         "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, ?)"


      ).bind(projectId, title, description || null, type).run();

     // Update parent project's updated_at timestamp automatically when child record created - uses parameterized query

    await db.prepare("UPDATE projects SET updated_at=datetime('now') WHERE id=?").bind(projectId).run();

  return jsonResp(201, { success: true, message: "Project update added successfully." }, request); } catch (err) {
       console.error("Add project update error:", err.message);

    return jsonResp(500, { success: false, message: "Database operation failed." }, undefined, request);
  }
