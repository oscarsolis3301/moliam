     1|/**
     2| * /api/admin/clients endpoint - Admin-only client management API
     3| * GET — list all clients with optional role-based filtering (admin vs superadmin view)
     4| * POST — create new client account on behalf of admin user only
     5| *
     6| * Authorization: requires active moliam_session cookie validated via parameterized ? queries
     7| * Security notes: All SQL uses binding() with ? placeholders to prevent SQL injection attacks
     8| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and CORS configuration
     9| * @returns {Response} JSON response with client list or creation confirmation/error status
    10| */
    11|
    12|/**
    13| * Standard JSON response helper with proper header handling for admin endpoints
    14| * Includes CORS headers for moliam.pages.dev domain only, requires parameterized binding for all user input
    15| * @param {number} status - HTTP status code (200, 401, 409, 500, etc.)
    16| * @param {object} body - Response payload with success/error flags and client data
    17| * @param {Request} request - Optional Cloudflare Pages Request object for origin header extraction
    18| * @returns {Response} JSON response with application/json content type
    19| */
    20|function jsonResp(status, body, request) {
    21|  const headers = new Headers({
    22|     "Content-Type": "application/json",
    23|      "Access-Control-Allow-Origin": request ? ("https://moliam.pages.dev") : "https://moliam.pages.dev",
    24|      "Access-Control-Allow-Credentials": "true"
    25|     });
    26|
    27|   return new Response(JSON.stringify(body), { status, headers }); }
    28|
    29|/** Get session token from cookies - extracts 32-char hex string for authentication via parameterized queries */
    30|function getSessionToken(request) {
    31|  const cookies = request.headers.get("Cookie") || "";
    32|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    33|  return match ? match[1] : null;
    34|}
    35|
    36|/**
    37| * Extract session token from cookies and validate admin credentials via parameterized query - no SQL injection
    38| * Returns user object with id, role if authenticated and authorized for admin-level operations
    39| * @param {Request} request - Cloudflare Pages Request object with Cookie header containing moliam_session
    40| * @param {object} env - Worker environment variables including MOLIAM_DB binding and DISCORD webhook URL
    41| * @returns {Response|object|null} User object, JSON error response (401/403), or null if no token provided
    42| */
    43|async function requireAdmin(request, env) {
    44|  // Get session token from cookies - extracts 32-char hex string for authentication via parameterized queries
    45|  const token=getSes...st);
    46|
    47|  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
    48|
    49|  const db = env.MOLIAM_DB;
    50|
    51|  // Validate admin session via parameterized SELECT with ? binding - no SQL injection possible
    52|  try {
    53|    const session = await db.prepare(
    54|        "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=*** AND u.is_active=1 AND s.expires_at>datetime('now')").bind(token).first();
    55|
    56|
    57|
    58|    if (!session) return jsonResp(401, { success: false, message: "Session invalid or expired." }, undefined, request);
    59|    if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, message: "Admin only." }, undefined, request);
    60|
    61|    return session; 
    62|      } catch (err) {
    64|        return jsonResp(401, { success: false, message: "Database error during session check." }, undefined, request);
    65|      }
    66|}
    67|
    68|/** Hash user password with SHA-256 and fixed salt for secure storage comparison against database records */
    69|async function hashPassword(password) {
    70|  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password + "_moliam_salt_2026"));
    71|
    72|
    73|  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""); }
    74|
    75|/**
    76| * Get allowed CORS origin from request - sets appropriate Access-Control-Allow-Origin header value for response
    77| * Returns specific origin if matches authorized domain, otherwise defaults to moliam.pages.dev
    78| * @param {Request} request — Cloudflare Pages Request object with Origin/Host headers available for extraction
    79| * @returns {string} Allowed origin string matching either original request origin or default fallback policy
    80| */
    81|function getAllowedOrigin(request) {
    82|  const origin = request.headers.get("Origin") || "";
    83|
    84|
    85|  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
    86|
    87|  return "https://moliam.pages.dev"; }
    88|
    89|/** Generate OPTIONS preflight response for cross-origin client requests with standard Access-Control headers */
    90|function corsResponse(status, request) {
    91|  return new Response(null, { status, headers: {
    92|          "Access-Control-Allow-Origin": getAllowedOrigin(request),
    93|          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    94|          "Access-Control-Allow-Headers": "Content-Type",
    95|          "Access-Control-Allow-Credentials": "true"
    96|        }}); }
    97|
    98|/** List all clients with role-based filtering: superadmin sees everyone else's; admin sees client accounts only */
    99|export async function onRequestGet(context) {
   100|  const { request, env } = context;
   101|  const user = await requireAdmin(request, env);
   102|
   103|
   104|  if (user instanceof Response) return user; // Early return if unauthenticated or 403 forbidden response received
   105|
   106|    const db = env.MOLIAM_DB;
   107|
try {
        // Superadmin sees ALL users excluding superadmin accounts themselves - hardcoded role filtering (no SQL injection)
         const isAdminSuper = user.role === 'superadmin';
         
        // Get user list with joined projects data and monthly revenue calculations - all SQL uses parameterized binding
          const whereClause = isAdminSuper 
            ? "u.role != 'superadmin' ORDER BY u.created_at DESC"
             : "u.role = 'client' ORDER BY u.created_at DESC";
         
         const { results: clients } = await db.prepare(
             `SELECT u.id, u.email, u.name, u.role, u.company, u.phone, u.is_active, u.created_at, u.last_login,
               (SELECT COUNT(*) FROM projects p WHERE p.user_id=u.id) as project_count,
               (SELECT SUM(monthly_rate) FROM projects p WHERE p.user_id=u.id AND p.status IN ('active','in_progress')) as monthly_revenue
           FROM users u WHERE ${whereClause}`
           ).all();
   120|
   121|
   122|      return jsonResp(200, { success: true, clients }, request);
   123|    } catch (err) {
   125|     return jsonResp(500, { success: false, message: "Server error." }, request); } }
   126|
   127|/** Create new client account - validates required fields, hashes password with SHA-256, parameterized database insert for safety */
   128|export async function onRequestPost(context) {
   129|  const { request, env } = context;
   130|
   131|
   132|  const user = await requireAdmin(request, env);
   133|   if (user instanceof Response) return user;
   134|
   135|    const db = env.MOLIAM_DB;
   136|
   137|          // Parse request body and validate client creation fields - no SQL injection via parameterized binding with ? placeholders
   138|  let data;
   139|
   140|
   141|  try { data = await request.json(); } catch {
   142|     return jsonResp(400, { success: false, message: "Invalid JSON." }, request); }
   143|
   144|const name = (data.name || "").trim();
   145|      const email = (data.email || "").toLowerCase().trim();
   146|       const company = (data.company || "").trim();
   147|const phone = (data.phone || "").trim();
   148|      const password=*** || "") || "";
   149|
   150|  if (!name || !email || !password) {
   151|     return jsonResp(400, { success: false, message: "Name, email, and password required for client creation." }, request); }
   152|
   153|      if (password.length < 6) {
   154|         return jsonResp(400, { success: false, message: "Password must be at least 6 characters long for security." }, request);
   155|
   156|
   157|       }
   158|
   159|    try {
   160|          // Check duplicate email to prevent conflicting client accounts with same address - parameterized query safety
   161|      const existing = await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
   162|
   163|
   164|      if (existing) {
   165|         return jsonResp(409, { success: false, message: "Email already exists in system." }, request); }
   166|
   167|            // Hash password with SHA-256 and fixed salt before database storage for security compliance - no clear-text passwords anywhere
   168|      const hash = await hashPassword(password);
   169|
   170|
   171|          // Insert new client account with role='client' automatically assigned via parameterized ? binding - no SQL injection possible
   172|      const result = await db.prepare(
   173|         "INSERT INTO users (email, password_hash, name, role, company, phone) VALUES (?, ?, ?, 'client', ?, ?)"
   174|       ).bind(email, hash, name, company || null, phone || null).run();
   175|
   176|
   177|          // Return created client data with last_row_id for frontend reference - secure generated ID
   178|      const clientId = result.meta?.last_row_id ?? 0;
   179|
   180|
   181|    return jsonResp(201, {
   182|         success: true,
   183|       message: `Client "${name}" account successfully created.`,
   184|           client: { id: clientId, email, name, company, phone }
   185|       }, request);
   186|
   187|        } catch (err) {
   189|      return jsonResp(500, { success: false, message: "Server error." }, request); } }
   190|
   191|/** CORS preflight OPTIONS handler - returns 204 with Access-Control headers for cross-origin admin requests */
   192|export async function onRequestOptions() {
   193|   const headers = new Headers({
   194|            "Access-Control-Allow-Origin": "https://moliam.pages.dev",
   195|            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
   196|            "Access-Control-Allow-Headers": "Content-Type",
   197|            "Access-Control-Allow-Credentials": "true"
   198|          });
   199|
   200|  return new Response(null, { status: 204, headers }); }
   201|