     1|/**
     2| * /api/admin/projects endpoint - List and create projects with admin access
     3| * GET — list all projects (with client info) for dashboard display
     4| * POST — create new project entry or update existing with validation checks
     5| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
     6| * @returns {Response} JSON response with success/error flags and optional project data array
     7| */
     8|
     9|/** Validate admin sessions from cookies and return authenticated user object for authorized requests only */
    10|async function requireAdmin(request, env) {
    11|     const cookies = request.headers.get("Cookie") || "";
    12|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    13|  const token=*** ? match[1] : null;
    14|
    15|  if (!token) return jsonResp(401, { success: false, message: "Not authenticated." }, undefined, request);
    16|
    17|   /** Secure database query with parameterized ? binding - no SQL injection possible here via .bind() method */
    18|  const db = env.MOLIAM_DB;
    19|  const session = await db.prepare(
    20|        "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=*** AND u.is_active=1 AND s.expires_at>datetime('now')"
    21|      ).bind(token).first();
    22|
    23|  if (!session) return jsonResp(401, { success: false, message: "Session invalid." }, undefined, request);
    24|  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, message: "Admin only." }, undefined, request);
    25|
    26|
    27|  return session;
    28|
    29|/** Extract 32-character hex session token from Cookie header for authentication checks and validations */
    30|function getSessionToken(request) {
    31|  const cookies = request.headers.get("Cookie") || "";
    32|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    33|
    34|
    35|  return match ? match[1] : null; }
    36|
    37|/** Get allowed CORS origin domain from request Origin header or default to moliam.pages.dev */
    38|function getAllowedOrigin(request) {
    39|  const origin = request.headers.get("Origin") || "";
    40|   if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
    41|
    42|
    43|  return "https://moliam.pages.dev"; }
    44|
    45|/** Create JSON response with CORS headers and proper HTTP status code for API endpoint */
    46|function corsResponse(status, request) {
    47|  return new Response(null, { status, headers: {
    48|        "Access-Control-Allow-Origin": getAllowedOrigin(request),
    49|        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    50|        "Access-Control-Allow-Headers": "Content-Type",
    51|        "Access-Control-Allow-Credentials": "true"
    52|      } });
    53|
    54|/** Standard JSON response helper with CORS header addition and proper status handling for API endpoints */
    55|function jsonResp(status, body, request) {
    56|
    57|
    58|  return new Response(JSON.stringify(body), { status, headers: {
    59|         "Content-Type": "application/json","Access-Control-Allow-Origin": getAllowedOrigin(request),
    60|     "Access-Control-Allow-Credentials": "true"
    61|   }}); }
    62|
    63|/** GET /api/admin/projects - List all projects with client information for admin dashboard display */
    64|export async function onRequestGet(context) {
    65|
    66|  const { request,env } = context;
    67|
    68|
    69|      const user = await requireAdmin(request, env);
    70|
    71|
    72|  if (user instanceof Response) return user; // Early return if unauthorized or missing session token in cookies
    73|
    74|       const db = env.MOLIAM_DB;
    75|
    76|  try {
    77|        const { results: projects } = await db.prepare(
    78|           `SELECT p.*, u.name as client_name, u.company as client_company, u.email as client_email
    79|            FROM projects p JOIN users u ON p.user_id=u.id
    80|            ORDER BY p.created_at DESC`
    81|
    82|
    83|         ).all();
    84|
    85|    return jsonResp(200, { success: true, projects }, request); } catch (err) {
    86|
    87|
    89|
    90|
    91|    return jsonResp(500, { success: false, message: "Server error." }, request);
    92|
    93|}
    94|
    95|/** POST /api/admin/projects - Create new project with validation checks for required fields and client lookup */
    96|export async function onRequestPost(context) {
    97|
    98|  const { request, env } = context;
    99|
   100|
   101|    const user = await requireAdmin(request, env);
   102|
   103|
   104|  if (user instanceof Response) return user; // Early return if unauthorized admin or no session token found in cookies
   105|
   106|       const db = env.MOLIAM_DB;
   107|      let data;
   108|
   109|   try { data = await request.json(); } catch {
   110|           return jsonResp(400, { success: false, message: "Invalid JSON body." }, undefined, request); }
   111|
   112|   const userId = data.user_id;
   113|
   114|
   115|  const name = (data.name || "").trim();
   116|
   117|
   118|    const type = data.type || "website";
   119|
   120|
   121|     const monthlyRate = data.monthly_rate || 0;
   122|
   123|
   124|  const setupFee = data.setup_fee || 0;
   125|
   126|
   127|      const notes = (data.notes || "").trim();
   128|
   129|         // Validate required fields and check valid enum values for project creation - no SQL injection possible
   130|    if (!userId || !name) return jsonResp(400, { success: false, message: "Client ID and project name required." }, undefined, request);
   131|
   132|
   133|   const validTypes = ["website", "gbp", "lsa", "retainer"];
   134|
   135|       if (!validTypes.includes(type)) return jsonResp(400, { success: false, message: `Type must be one of: ${validTypes.join(", ")}` }, undefined, request);
   136|
   137|           // Verify client exists via parameterized query - secure database lookup with session token binding
   138|          try { const client = await db.prepare("SELECT id FROM users WHERE id=? AND role='client'").bind(userId).first();
   139|
   140|
   141|     if (!client) return jsonResp(404, { success: false, message: "Client not found." }, undefined, request);
   142|
   143|             // Insert project record with auto-generated creation timestamp and notes field - uses ? binding for database safety
   144|       const result = await db.prepare(
   145|         "INSERT INTO projects (user_id, name, type, monthly_rate, setup_fee, start_date, notes) VALUES (?, ?, ?, ?, ?, datetime('now'), ?)"
   146|
   147|        ).bind(userId, name, type, monthlyRate, setupFee, notes || null).run();
   148|
   149|
   150|         const projectId = result.meta?.last_row_id ?? 0;
   151|
   152|       // Auto-create onboarding update entry for project dashboard tracking and history
   153|       await db.prepare(
   154|         "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, 'milestone')"
   155|
   156|
   157|       ).bind(projectId, "Project Created", `${name} (${type}) onboarding started.`).run();
   158|
   159|     return jsonResp(201, { success: true, message:`"${name}" created successfully.`, project: { id: projectId, name, type, monthly_rate: monthlyRate, setup_fee: setupFee } }, request);
   160|
   161|             } catch (err) {
   163|
   164|
   165|              return jsonResp(500, { success: false, message: "Server error occurred during processing." }, undefined, request);
   166|
   167|   } }
   168|
   169|/** OPTIONS preflight handler - returns 204 No Content for CORS browser cross-origin requests */
   170|export async function onRequestOptions() {
   171|
   172|  return corsResponse(204); }
   173|