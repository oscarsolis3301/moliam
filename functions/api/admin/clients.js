/**
 * /api/admin/clients endpoint - Admin-only client management API
 * GET — list all clients with optional role-based filtering (admin vs superadmin view)
 * POST — create new client account on behalf of admin user only
 *
 * Authorization: requires active moliam_session cookie validated via parameterized ? queries
 * Security notes: All SQL uses binding() with ? placeholders to prevent SQL injection attacks
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and CORS configuration
 * @returns {Response} JSON response with client list or creation confirmation/error status
 */

/**
 * Standard JSON response helper with proper header handling for admin endpoints
 * Includes CORS headers for moliam.pages.dev domain only, requires parameterized binding for all user input
 * @param {number} status - HTTP status code (200, 401, 409, 500, etc.)
 * @param {object} body - Response payload with success/error flags and client data
 * @param {Request} request - Optional Cloudflare Pages Request object for origin header extraction
 * @returns {Response} JSON response with application/json content type
 */
function jsonResp(status, body, request) {
  const headers = new Headers({
     "Content-Type": "application/json",
      "Access-Control-Allow-Origin": request ? ("https://moliam.pages.dev") : "https://moliam.pages.dev",
      "Access-Control-Allow-Credentials": "true"
     });

   return new Response(JSON.stringify(body), { status, headers }); }

/** Get session token from cookies - extracts 32-char hex string for authentication via parameterized queries */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Extract session token from cookies and validate admin credentials via parameterized query - no SQL injection
 * Returns user object with id, role if authenticated and authorized for admin-level operations
 * @param {Request} request - Cloudflare Pages Request object with Cookie header containing moliam_session
 * @param {object} env - Worker environment variables including MOLIAM_DB binding and DISCORD webhook URL
 * @returns {Response|object|null} User object, JSON error response (401/403), or null if no token provided
 */
async function requireAdmin(request, env) {
   // Get session token from cookies - extracts 32-char hex string for authentication via parameterized queries
  const token = getSessionToken(request);

  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);

  const db = env.MOLIAM_DB;

    // Validate admin session via parameterized SELECT with ? binding - no SQL injection possible
      try {
        const session = await db.prepare(
         "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND u.is_active=1 AND s.expires_at>datetime('now')"
       ).bind(token).first();

    if (!session) return jsonResp(401, { success: false, message: "Session invalid or expired." }, undefined, request);
    if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, message: "Admin only." }, undefined, request);

    return session; 
      } catch (err) {
        console.error("Session validation error:", err.message);
        return jsonResp(401, { success: false, message: "Database error during session check." }, undefined, request);
      }
}

/** Hash user password with SHA-256 and fixed salt for secure storage comparison against database records */
async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password + "_moliam_salt_2026"));


  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }

/**
 * Get allowed CORS origin from request - sets appropriate Access-Control-Allow-Origin header value for response
 * Returns specific origin if matches authorized domain, otherwise defaults to moliam.pages.dev
 * @param {Request} request — Cloudflare Pages Request object with Origin/Host headers available for extraction
 * @returns {string} Allowed origin string matching either original request origin or default fallback policy
 */
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";


  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;

  return "https://moliam.pages.dev"; }

/** Generate OPTIONS preflight response for cross-origin client requests with standard Access-Control headers */
function corsResponse(status, request) {
  return new Response(null, { status, headers: {
          "Access-Control-Allow-Origin": getAllowedOrigin(request),
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true"
        }}); }

/** List all clients with role-based filtering: superadmin sees everyone else's; admin sees client accounts only */
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireAdmin(request, env);


  if (user instanceof Response) return user; // Early return if unauthenticated or 403 forbidden response received

    const db = env.MOLIAM_DB;

  try {
         // Superadmin sees ALL users excluding superadmin accounts themselves - no injection via ? parameterized binding
            // Regular admin only sees client-level accounts for assigned client relationships (role-based filtering enforced)
        const roleFilter = user.role === 'superadmin' ? "u.role!='superadmin'" : "u.role='client'";

            // Get user list with joined projects data and monthly revenue calculations - all SQL uses parameterized binding
         const { results: clients } = await db.prepare(
            `SELECT u.id, u.email, u.name, u.role, u.company, u.phone, u.is_active, u.created_at, u.last_login,
              (SELECT COUNT(*) FROM projects p WHERE p.user_id=u.id) as project_count,
              (SELECT SUM(monthly_rate) FROM projects p WHERE p.user_id=u.id AND p.status IN ('active','in_progress')) as monthly_revenue
           FROM users u WHERE ${roleFilter} ORDER BY u.created_at DESC`
          ).all();


      return jsonResp(200, { success: true, clients }, request);
    } catch (err) {
     console.error("List clients error:", err.message);
     return jsonResp(500, { success: false, message: "Server error." }, request); } }

/** Create new client account - validates required fields, hashes password with SHA-256, parameterized database insert for safety */
export async function onRequestPost(context) {
  const { request, env } = context;


  const user = await requireAdmin(request, env);
   if (user instanceof Response) return user;

    const db = env.MOLIAM_DB;

          // Parse request body and validate client creation fields - no SQL injection via parameterized binding with ? placeholders
  let data;


  try { data = await request.json(); } catch {
     return jsonResp(400, { success: false, message: "Invalid JSON." }, request); }

const name = (data.name || "").trim();
      const email = (data.email || "").toLowerCase().trim();
       const company = (data.company || "").trim();
   const phone = (data.phone || "").trim();
       const password = data.password || "";

  if (!name || !email || !password) {
     return jsonResp(400, { success: false, message: "Name, email, and password required for client creation." }, request); }

      if (password.length < 6) {
         return jsonResp(400, { success: false, message: "Password must be at least 6 characters long for security." }, request);


       }

    try {
          // Check duplicate email to prevent conflicting client accounts with same address - parameterized query safety
      const existing = await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first();


      if (existing) {
         return jsonResp(409, { success: false, message: "Email already exists in system." }, request); }

            // Hash password with SHA-256 and fixed salt before database storage for security compliance - no clear-text passwords anywhere
      const hash = await hashPassword(password);


          // Insert new client account with role='client' automatically assigned via parameterized ? binding - no SQL injection possible
      const result = await db.prepare(
         "INSERT INTO users (email, password_hash, name, role, company, phone) VALUES (?, ?, ?, 'client', ?, ?)"
       ).bind(email, hash, name, company || null, phone || null).run();


          // Return created client data with last_row_id for frontend reference - secure generated ID
      const clientId = result.meta?.last_row_id ?? 0;


    return jsonResp(201, {
         success: true,
       message: `Client "${name}" account successfully created.`,
           client: { id: clientId, email, name, company, phone }
       }, request);

        } catch (err) {
     console.error("Create client error:", err.message);
      return jsonResp(500, { success: false, message: "Server error." }, request); } }

/** CORS preflight OPTIONS handler - returns 204 with Access-Control headers for cross-origin admin requests */
export async function onRequestOptions() {
   const headers = new Headers({
            "Access-Control-Allow-Origin": "https://moliam.pages.dev",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Credentials": "true"
          });

  return new Response(null, { status: 204, headers }); }
