     1|/**
     2| * /api/admin/updates endpoint - Add milestone/update to project or create project with client info
     3| * POST — add update/milestone to existing project for tracking history and dashboard display
     4| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
     5| * @returns {Response} JSON response with success/error flags and optional metadata object
     6| */
     7|
     8|/** Validate admin sessions and return authenticated user or Response error for unauthorized requests */
     9|async function requireAdmin(request, env) {
    10|
    11|       const cookies = request.headers.get("Cookie") || "";
    12|
    13|
    14|    const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    15|
    16|
    17|  const token=*** ? match[1] : null;
    18|
    19|  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
    20|
    21|       // Validate session with parameterized ? binding - secure database lookup via .bind() method for SQL safety
    22|  const db = env.MOLIAM_DB;
    23|
    24|
    25|      const session = await db.prepare(
    26|        "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=*** AND u.is_active=1 AND s.expires_at>datetime('now')"
    27|       ).bind(token).first();
    28|
    29|     // Return error Response for invalid/missing/expired session or 403 if admin role required but not granted
    30|
    31|
    32|      if (!session) return jsonResp(401, { success: false, message: "Session invalid." }, undefined, request);
    33|
    34|
    35|    if (session.role !== "admin" && session_role!== "superadmin") return jsonResp(403, { success: false, message: "Admin only access." }, undefined, request);
    36|
    37|  return session; }
    38|
    39|/** Extract 32-char hex session token from Cookie header for authentication and session validation checks */
    40|function getSessionToken(request) {
    41|
    42|
    43|      const cookies = request.headers.get("Cookie") || "";
    44|
    45|
    46|    const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    47|
    48|
    49|  return match ? match[1] : null; }
    50|
    51|/** Get allowed CORS origin domain from request Origin header or default to moliam.pages.dev for cross-origin */
    52|function getAllowedOrigin(request) {
    53|
    54|
    55|       const origin = request.headers.get("Origin") || "";
    56|
    57|
    58|     if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
    59|
    60|
    61|  return "https://moliam.pages.dev"; }
    62|
    63|/** Create JSON response with proper headers and status code for API endpoint success/error handling */
    64|function jsonResp(status, body, request) {
    65|
    66|
    67|  return new Response(JSON.stringify(body), {status, headers: {
    68|           "Content-Type": "application/json",
    69|
    70|
    71|         "Access-Control-Allow-Origin": getAllowedOrigin(request),
    72|
    73|
    74|       "Access-Control-Allow-Credentials": "true"} } ); }
    75|
    76|/** OPTIONS preflight handler - returns 204 No Content for CORS browser cross-origin requests */
    77|export async function onRequestOptions() {
    78|
    79|      return new Response(null, { status: 204, headers: {
    80|            "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    81|
    82|
    83|         "Access-Control-Allow-Methods": "POST, OPTIONS",
    84|
    85|
    86|        "Access-Control-Allow-Headers": "Content-Type",
    87|
    88|
    89|     "Access-Control-Allow-Credentials": "true",
    90|       }}); }
    91|
    92|/** POST /api/admin/updates - Add update/milestone to project with validation for required fields */
    93|export async function onRequestPost(context) {
    94|
    95|   const { request, env } = context;
    96|
    97|
    98|    const user = await requireAdmin(request, env);
    99|
   100|
   101|  if (user instanceof Response) return user; // Early return if unauthorized or invalid session in cookies
   102|
   103|
   104|       const db = env.MOLIAM_DB;
   105|
   106|
   107|  let data;
   108|
   109|  try { data = await request.json(); } catch {
   110|
   111|
   112|      return jsonResp(400, { success: false, message: "Invalid JSON body." }, undefined, request);
   113|
   114|     }
   115|
   116|         // Extract and validate project update fields from request - no SQL injection risk via parameterized query
   117|  const projectId = data.project_id;
   118|
   119|  const title = (data.title || "").trim();
   120|
   121|  const description = (data.description || "").trim();
   122|
   123|
   124|   const type = data.type || "update";
   125|
   126|    if (!projectId || !title) return jsonResp(400, { success: false, message: "Project ID and title required." }, undefined, request);
   127|
   128|
   129|       // Validate type against allowed enum values - no user input goes directly into SQL via parameterized query
   130|  const validTypes = ["update", "milestone", "deliverable", "report", "invoice"];
   131|
   132|  if (!validTypes.includes(type)) return jsonResp(400, { success: false, message: `Type must be one of: ${validTypes.join(", ")}` }, undefined, request);
   133|
   134|  try {
   135|       // Verify project exists first via ? parameterized query for SQL injection protection - safe database lookup
   136|    const project = await db.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();
   137|
   138|      if (!project) return jsonResp(404, { success: false, message: "Project not found." }, undefined, request);
   139|
   140|      // Insert project_updates record with auto-generated timestamp and description - uses ? binding for database safety
   141|
   142|
   143|    await db.prepare(
   144|         "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, ?)"
   145|
   146|
   147|      ).bind(projectId, title, description || null, type).run();
   148|
   149|     // Update parent project's updated_at timestamp automatically when child record created - uses parameterized query
   150|
   151|    await db.prepare("UPDATE projects SET updated_at=datetime('now') WHERE id=?").bind(projectId).run();
   152|
   153|  return jsonResp(201, { success: true, message: "Project update added successfully." }, request); } catch (err) {
   155|
   156|    return jsonResp(500, { success: false, message: "Database operation failed." }, undefined, request);
   157|  }
   158|