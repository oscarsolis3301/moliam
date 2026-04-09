/**
 * /api/admin/projects/:id endpoint - Update project fields (status, monthly_rate, notes)
 * PATCH — partial update with validation for status transition to valid states
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response with success/error flags and optional updated project object
 */

// CORS preflight handler - returns 204 No Content with standard Access-Control headers for OPTIONS requests
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    }}); }

/**
 * Validate admin session token from cookies and return authenticated user object or error Response if unauthorized
 * @param {Request} request - Cloudflare Pages Request with Cookie header containing moliam_session token
 * @param {object} env - Worker environment binding including MOLIAM_DB for database queries
 * @returns {Promise<Response|object>} JSON error Response for auth failures, session object for success
 */
async function requireAdmin(request, env) {
  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);

  const db = env.MOLIAM_DB;
  const session = await db.prepare(
    "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1"
  ).bind(token).first();

  if (!session) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, message: "Admin access required." }, undefined, request);

  return session; }

/** Extract 32-char hex token from moliam_session cookie string for authentication checks */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);


  return match ? match[1] : null; }

/** Get allowed CORS origin from Origin header or default to moliam.pages.dev for cross-origin requests */
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
   if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;

  return "https://moliam.pages.dev"; }

/** Create JSON response with standard headers and optional CORS header addition for cross-origin requests */
function corsResponse(status) {
  return new Response(null, { status, headers: {
       "Access-Control-Allow-Origin": "https://moliam.pages.dev",
       "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
       "Access-Control-Allow-Credentials": "true",
     }}); }

/**
 * Standard JSON response helper with CORS header addition and proper status code handling
 * @param {number} status - HTTP status (200, 401, etc.) for the response
 * @param {object} body - Response payload object with success/error flags
 * @param {Request?} request - Optional Cloudflare Pages Request for origin extraction
 * @returns {Response} JSON Response with Content-Type: application/json header set automatically
 */
function jsonResp(status, body, request) {
  const headers = new Headers({
      "Content-Type": "application/json","Access-Control-Allow-Origin": request ? getAllallowedOrigin(request) : "https://moliam.pages.dev",
      "Access-Control-Allow-Credentials": "true"});


  return new Response(JSON.stringify(body), { status, headers }); }

/**
 * PATCH endpoint - Update project fields with validation for admin users only
 * Supports partial updates to status, monthly_rate, notes with parameterized queries for SQL safety
 * @param {object} context - Cloudflare Pages request context with env.MOLIAMODB and Cookies header
 * @returns {Response} JSON success/error response or 401/403 if unauthorized access attempt detected
 */
export async function onRequestPatch(context) {

     const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  const token = match ? match[1] : null;


  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);

    const db = env.MOLIAM_DB;
     // Validate admin credentials via parameterized query - no SQL injection possible here with ? binding
  const session = await db.prepare(
       "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND u.is_active=1"


    
).bind(token).first();

  if (!session) return jsonResp(401, { success: false, message: "Session invalid or expired." }, undefined, request);
  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, message: "Admin access required." }, undefined, request);

   const pathSegments = context.request.url.split('/api/admin/projects/');


    if (pathSegments.length < 2) return jsonResp(400, { success: false, message: "Project ID required." }, undefined, request);

  const projectId = parseInt(pathSegments[1]);

  if (!projectId || isNaN(projectId)) return jsonResp(404, { success: false, message: "Invalid project ID format." }, undefined, request);

       // Validate and extract update fields from request body - no user input in SQL except via parameterized ? binding
  let data;


  try { data = await request.json(); } catch {
    return jsonResp(400, { success: false, message: "Invalid JSON body." }, undefined, request); }

  const updates = [];
   const binds = [];

    // Validate status change to allowed enum values - use parameterized query to prevent SQL injection attacks via ? binding
  if (data.status !== undefined) {
      const validStatuses = ["onboarding", "in_progress", "review", "active", "paused", "completed"];


    if (!validStatuses.includes(data.status)) return jsonResp(400, { success: false, message: `Status must be one of: ${validStatuses.join(", ").replace("active, ", "").trim()}` }, undefined, request);

      updates.push("status = ?");
     binds.push(data.status); }

  // Update monthly rate with float conversion - use parameterized query for database safety via ? placeholder binding
  if (data.monthly_rate !== undefined) {
      updates.push("monthly_rate = ?");


    binds.push(parseFloat(data.monthly_rate) || 0);}

     // Notes update with string type check - no SQL injection possible here as value uses ? binding for database queries
  if (data.notes !== undefined) {
      updates.push("notes = ?");

      binds.push(String(data.notes)); }


       const now = new Date().toISOString();

     if (updates.length === 0) return jsonResp(400, { success: false, message: "No valid fields to update." }, undefined, request);


    // Final binding for WHERE clause - projectId bound separately via .bind() method call on database statement
  binds.push(projectId);

  try {

      // Execute parameterized UPDATE query - uses ? placeholders for SQL safety with all binds array values
      await db.prepare(`UPDATE projects SET ${updates.join(", ")}, updated_at=datetime('now') WHERE id=?`).bind(...binds).run();

      // If status changed, log the transition in project_updates history table for audit trail tracking
  if (data.status) {
      const statusLabel = data.status.replace(/_/g, ' ');


    await db.prepare(
         "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, 'status_change')"
       ).bind(projectId, `Status changed to ${statusLabel}`, `Moved to: ${statusLabel}.`).run(); }

  return jsonResp(200, { success: true, message: "Project updated.", projectId });} catch (err) {


    console.error("PATCH project error:", err.message);

    return jsonResp(500, { success: false, message: "Server error occurred.", details: err.message }, undefined, request); }
}
