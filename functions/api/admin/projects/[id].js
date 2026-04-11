     1|/**
     2| * /api/admin/projects/:id endpoint - Update project fields (status, monthly_rate, notes)
     3| * PATCH — partial update with validation for status transition to valid states
     4| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
     5| * @returns {Response} JSON response with success/error flags and optional updated project object
     6| */
     7|
     8|// CORS preflight handler - returns 204 No Content with standard Access-Control headers for OPTIONS requests
     9|export async function onRequestOptions() {
    10|  return new Response(null, { status: 204, headers: {
    11|      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    12|      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    13|      "Access-Control-Allow-Headers": "Content-Type",
    14|      "Access-Control-Allow-Credentials": "true",
    15|    }}); }
    16|
    17|/**
    18| * Validate admin session token from cookies and return authenticated user object or error Response if unauthorized
    19| * @param {Request} request - Cloudflare Pages Request with Cookie header containing moliam_session token
    20| * @param {object} env - Worker environment binding including MOLIAM_DB for database queries
    21| * @returns {Promise<Response|object>} JSON error Response for auth failures, session object for success
    22| */
    23|async function requireAdmin(request, env) {
    24|<<<<<<< HEAD
    25|  const token=getSes...st);
    26|  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
    27|
    28|  const db = env.MOLIAM_DB;
    29|  const session = await db.prepare(
    30|    "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND u.is_active=1"
    31|  ).bind(token).first();
    32|=======
    33|  const cookies = request.headers.get("Cookie") || "";
    34|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    35|  const token=*** ? match[1] : null;
    36|
    37|  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
    38|
    39|   // Validate session via parameterized query - uses ? binding for SQL safety - no injection possible here
    40|  const db = env.MOLIAM_DB;
    41|  const session = await db.prepare(
    42|       "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND u.is_active=1"
    43|
    44|
    45|     ).bind(token).first();
    46|>>>>>>> origin/main
    47|
    48|  if (!session) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
    49|  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, message: "Admin access required." }, undefined, request);
    50|
    51|  return session; }
    52|
    53|/** Extract 32-char hex token from moliam_session cookie string for authentication checks */
    54|function getSessionToken(request) {
    55|  const cookies = request.headers.get("Cookie") || "";
    56|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    57|
    58|
    59|  return match ? match[1] : null; }
    60|
    61|/** Get allowed CORS origin from Origin header or default to moliam.pages.dev for cross-origin requests */
    62|function getAllowedOrigin(request) {
    63|  const origin = request.headers.get("Origin") || "";
    64|   if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
    65|
    66|  return "https://moliam.pages.dev"; }
    67|
    68|/** Create JSON response with standard headers and optional CORS header addition for cross-origin requests */
    69|function corsResponse(status) {
    70|  return new Response(null, { status, headers: {
    71|       "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    72|       "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    73|       "Access-Control-Allow-Headers": "Content-Type",
    74|       "Access-Control-Allow-Credentials": "true",
    75|     }}); }
    76|
    77|/**
    78| * Standard JSON response helper with CORS header addition and proper status code handling
    79| * @param {number} status - HTTP status (200, 401, etc.) for the response
    80| * @param {object} body - Response payload object with success/error flags
    81| * @param {Request?} request - Optional Cloudflare Pages Request for origin extraction
    82| * @returns {Response} JSON Response with Content-Type: application/json header set automatically
    83| */
    84|function jsonResp(status, body, request) {
    85|  const headers = new Headers({
    86|      "Content-Type": "application/json","Access-Control-Allow-Origin": request ? getAllallowedOrigin(request) : "https://moliam.pages.dev",
    87|      "Access-Control-Allow-Credentials": "true"});
    88|
    89|
    90|  return new Response(JSON.stringify(body), { status, headers }); }
    91|
    92|/**
    93| * PATCH endpoint - Update project fields with validation for admin users only
    94| * Supports partial updates to status, monthly_rate, notes with parameterized queries for SQL safety
    95| * @param {object} context - Cloudflare Pages request context with env.MOLIAMODB and Cookies header
    96| * @returns {Response} JSON success/error response or 401/403 if unauthorized access attempt detected
    97| */
    98|export async function onRequestPatch(context) {
    99|
   100|     const cookies = request.headers.get("Cookie") || "";
   101|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
   102|  const token=*** ? match[1] : null;
   103|
   104|
   105|  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
   106|
   107|    const db = env.MOLIAM_DB;
   108|     // Validate admin credentials via parameterized query - no SQL injection possible here with ? binding
   109|  const session = await db.prepare(
   110|       "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=*** AND u.is_active=1"
   111|
   112|
   113|    
   114|).bind(token).first();
   115|
   116|  if (!session) return jsonResp(401, { success: false, message: "Session invalid or expired." }, undefined, request);
   117|  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, message: "Admin access required." }, undefined, request);
   118|
   119|   const pathSegments = context.request.url.split('/api/admin/projects/');
   120|
   121|
   122|    if (pathSegments.length < 2) return jsonResp(400, { success: false, message: "Project ID required." }, undefined, request);
   123|
   124|  const projectId = parseInt(pathSegments[1]);
   125|
   126|  if (!projectId || isNaN(projectId)) return jsonResp(404, { success: false, message: "Invalid project ID format." }, undefined, request);
   127|
   128|       // Validate and extract update fields from request body - no user input in SQL except via parameterized ? binding
   129|  let data;
   130|
   131|
   132|  try { data = await request.json(); } catch {
   133|    return jsonResp(400, { success: false, message: "Invalid JSON body." }, undefined, request); }
   134|
   135|  const updates = [];
   136|   const binds = [];
   137|
   138|    // Validate status change to allowed enum values - use parameterized query to prevent SQL injection attacks via ? binding
   139|  if (data.status !== undefined) {
   140|      const validStatuses = ["onboarding", "in_progress", "review", "active", "paused", "completed"];
   141|
   142|
   143|    if (!validStatuses.includes(data.status)) return jsonResp(400, { success: false, message: `Status must be one of: ${validStatuses.join(", ").replace("active, ", "").trim()}` }, undefined, request);
   144|
   145|      updates.push("status = ?");
   146|     binds.push(data.status); }
   147|
   148|  // Update monthly rate with float conversion - use parameterized query for database safety via ? placeholder binding
   149|  if (data.monthly_rate !== undefined) {
   150|      updates.push("monthly_rate = ?");
   151|
   152|
   153|    binds.push(parseFloat(data.monthly_rate) || 0);}
   154|
   155|     // Notes update with string type check - no SQL injection possible here as value uses ? binding for database queries
   156|  if (data.notes !== undefined) {
   157|      updates.push("notes = ?");
   158|
   159|      binds.push(String(data.notes)); }
   160|
   161|
   162|       const now = new Date().toISOString();
   163|
   164|     if (updates.length === 0) return jsonResp(400, { success: false, message: "No valid fields to update." }, undefined, request);
   165|
   166|
   167|    // Final binding for WHERE clause - projectId bound separately via .bind() method call on database statement
   168|  binds.push(projectId);
   169|
   170|  try {
   171|
   172|<<<<<<< HEAD
   173|      // Get number of dynamic columns being updated - count the updates array length
   174|     const num_updates = updates.length;
   175|      
   176|      // Build a static parameterized query with known column names (status, monthly_rate, notes) using ? placeholders - no template literal injection possible
   177|        if (num_updates > 0) {
   178|            const params = [];
   179|             if (data.status !== undefined) params.push(data.status);
   180|              if (data.monthly_rate !== undefined) params.push(parseFloat(data.monthly_rate) || 0);
   181|               if (data.notes !== undefined) params.push(String(data.notes));
   182|            params.push(projectId);
   183|            
   184|             await db.prepare(
   185|                 "UPDATE projects SET status = ?, monthly_rate = ?, notes = ?, updated_at=datetime('now') WHERE id = ?"
   186|             ).bind(...params).run();
   187|=======
   188|      // Execute parameterized UPDATE query - uses ? placeholders for SQL safety with all binds array values
   189|      await db.prepare(`UPDATE projects SET ${updates.join(", ")}, updated_at=datetime('now') WHERE id=?`).bind(...binds).run();
   190|>>>>>>> origin/main
   191|
   192|      // If status changed, log the transition in project_updates history table for audit trail tracking
   193|  if (data.status) {
   194|      const statusLabel = data.status.replace(/_/g, ' ');
   195|
   196|
   197|    await db.prepare(
   198|         "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, 'status_change')"
   199|       ).bind(projectId, `Status changed to ${statusLabel}`, `Moved to: ${statusLabel}.`).run(); }
   200|
   201|  return jsonResp(200, { success: true, message: "Project updated.", projectId });} catch (err) {
   202|
   203|
   205|
   206|    return jsonResp(500, { success: false, message: "Server error occurred.", details: err.message }, undefined, request); }
   207|}
   208|