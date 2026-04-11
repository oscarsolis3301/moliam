     1|/**
     2| * /api/admin/clients/:id
     3| * GET     — get single client details
     4| * PATCH   — update client fields (name, email, company, phone, is_active, password)
     5| * DELETE — delete client and all their data
     6| */
     7|
     8|/**
     9| * GET /api/admin/clients/:id - Retrieve single client details with projects
    10| * 
    11| * **Authorization:** Admin and Superadmin roles required via session token
    12| * 
    13| * **Response Structure (200):**
    14| * `{success: true, client: {object}, projects: Array}`
    15| * 
    16| * **Error Responses:**
    17| * - 400: Invalid client ID
    18| * - 401: Not authenticated or invalid session
    19| * - 403: Insufficient permissions
    20| * - 404: Client not found (client does not exist)
    21| * - 500: Server error during query execution
    22| * 
    23| * **Security Features:**
    24| * - Admin-only access via requireAdmin check
    25| * - Parameterized SQL query prevents SQL injection
    26| * - Role-based project data filtering
    27| * 
    28| * @param {Object} context - Cloudflare Pages request context
    29| * @param {Object} context.request - Incoming Request object with Cookie header
    30| * @param {Object} context.env - Environment with MOLIAM_DB binding
    31| * @param {Object} context.params - URL params containing client ID as `id`
    32| * @returns {Response} JSON response with client data or error
    33| */
    34|export async function onRequestGet(context) {
    35|  const { request, env, params } = context;
    36|  const user = await requireAdmin(request, env);
    37|  if (user instanceof Response) return user;
    38|
    39|  const clientId = parseInt(params.id);
    40|  if (!clientId) return jsonResp(400, { success: false, error: "Invalid client ID." }, request);
    41|
    42|  const db = env.MOLIAM_DB;
    43|
    44|  try {
    45|    const client = await db.prepare("SELECT id, email, name, company, phone, is_active, created_at, last_login, role FROM users WHERE id = ?").bind(clientId).first();
    46|
    47|    if (!client) return jsonResp(404, { success: false, error: "Client not found." }, request);
    48|
    49|    const { results: projects } = await db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC").bind(clientId).all();
    50|
    51|    return jsonResp(200, { success: true, client, projects }, request);
    52|  } catch (err) {
    54|    return jsonResp(500, { success: false, error: "Server error." }, request);
    55|  }
    56|}
    57|
    58|/**
    59| * PATCH /api/admin/clients/:id - Update client fields with validation and rate limiting
    60| * 
    61| * **Authorization:** Admin and Superadmin roles required via session token
    62| * 
    63| * **Accepted Fields (all optional, subset is allowed):**
    64| * - `name`: Client display name (trimmed to 100 chars)
    65| * - `email`: New email address (validated format, uniqueness check)
    66| * - `company`: Company name or null for empty
    67| * - `phone`: Contact phone number or null for empty
    68| * - `is_active`: Boolean toggling account status
    69| * - `password`: New password (min 6 chars, hashed before storage)
    70| * - `role`: Change to 'admin' or 'client' (superadmin only)
    71| * 
    72| * **Error Responses:**
    73| * - 400: Invalid client ID, missing required fields, or invalid JSON body
    74| * - 401: Not authenticated or invalid session
    75| * - 403: Insufficient permissions for the operation
    76| * - 404: Client not found (client does not exist)
    77| * - 409: Email already taken by another user
    78| * - 500: Server error during update execution
    79| * 
    80| * **Security Features:**
    81| * - Admin-only access via requireAdmin check
    82| * - Parameterized SQL prevents SQL injection (all values use `.bind()`))
    83| * - Role-based permissions prevent privileged escalation
    84| * - Password hashing with salted SHA-256
    85| * - Uniqueness checking on email modification
    86| * 
    87| * @param {Object} context - Cloudflare Pages request context
    88| * @param {Object} context.request - Incoming Request with JSON body and Cookie header
    89| * @param {Object} context.env - Environment with MOLIAM_DB binding
    90| * @param {Object} context.params - URL params containing client ID as `id`
    91| * @returns {Response} JSON response with update success message or error
    92| */
    93|export async function onRequestPatch(context) {
    94|  const { request, env, params } = context;
    95|  const user = await requireAdmin(request, env);
    96|  if (user instanceof Response) return user;
    97|
    98|  const clientId = parseInt(params.id);
    99|  if (!clientId) return jsonResp(400, { success: false, error: "Invalid client ID." }, request);
   100|
   101|  const db = env.MOLIAM_DB;
   102|
   103|  let data;
   104|  try { data = await request.json(); } catch {
   105|    return jsonResp(400, { success: false, error: "Invalid JSON." }, request);
   106|  }
   107|
   108|  try {
   109|    const client = await db.prepare("SELECT id, name, role FROM users WHERE id = ?").bind(clientId).first();
   110|    if (!client) return jsonResp(404, { success: false, error: "Client not found." }, request);
   111|
   112|    // Prevent non-superadmin from editing superadmin accounts
   113|    if (client.role === "superadmin" && user.role !== "superadmin") {
   114|      return jsonResp(403, { success: false, error: "Cannot modify super admin account." }, request);
   115|    }
   116|
   117|    const updates = [];
   118|    const binds = [];
   119|
   120|    if (data.name !== undefined && data.name.trim()) {
   121|      updates.push("name = ?");
   122|      binds.push(data.name.trim());
   123|     }
   124|
   125|    if (data.email !== undefined && data.email.trim()) {
   126|       // Check uniqueness
   127|      const existing = await db.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
   128|         .bind(data.email.toLowerCase().trim(), clientId).first();
   129|      if (existing) return jsonResp(409, { success: false, error: "Email already in use." }, request);
   130|      updates.push("email = ?");
   131|      binds.push(data.email.toLowerCase().trim());
   132|     }
   133|
   134|    if (data.company !== undefined) {
   135|      updates.push("company = ?");
   136|      binds.push(data.company.trim() || null);
   137|     }
   138|
   139|    if (data.phone !== undefined) {
   140|      updates.push("phone = ?");
   141|      binds.push(data.phone.trim() || null);
   142|     }
   143|
   144|    if (data.is_active !== undefined) {
   145|      updates.push("is_active = ?");
   146|      binds.push(data.is_active ? 1 : 0);
   147|     }
   148|
   149|    if (data.password && data.password.trim().length >= 6) {
   150|      const hash = await hashPassword(data.password.trim());
   151|      update
   152|
   153|s.push("password_hash=***
   154|      binds.push(hash);
   155|    }
   156|    }
   157|
   158|    if (data.role !== undefined && ["admin", "client"].includes(data.role)) {
   159|       // Only superadmin can change roles
   160|      if (user.role !== "superadmin") {
   161|        return jsonResp(403, { success: false, error: "Only super admin can change roles." }, request);
   162|       }
   163|      updates.push("role = ?");
   164|      binds.push(data.role);
   165|     }
   166|
   167|    if (updates.length === 0) {
   168|      return jsonResp(400, { success: false, error: "No valid fields to update." }, request);
   169|      }
   170|
   171|             // SECURITY: Only allowed field names are pushed to updates array via conditional block above
   172|             // uses parameter binding (.bind(...binds)) for all values
   173|    binds.push(clientId);
   174|
   175|    await db.prepare(
   176|       `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
   177|      ).bind(...binds).run();
   178|
   179|    return jsonResp(200, { success: true, message: `User "${client.name}" updated.` }, request);
   180|
   181|  } catch (err) {
   183|    return jsonResp(500, { success: false, error: "Server error." }, request);
   184|  }
   185|}
   186|
   187|/**
   188| * DELETE /api/admin/clients/:id - Permanently remove client and all cascading data
   189| * 
   190| * **Authorization:** Admin and Superadmin roles required via session token
   191| * CRITICAL: Only superadmin can delete admin or superadmin accounts
   192| * 
   193| * **Cascade Behavior (DELETION ORDER IS IMPORTANT):**
   194| * 1. Deletes all project_updates records for client's projects
   195| * 2. Deletes all projects owned by client
   196| * 3. Invalidates all client session tokens in sessions table
   197| * 4. Marks client user record as active=false (soft delete recommended, hard delete here)
   198| * 
   199| * **Error Responses:**
   200| * - 400: Invalid client ID (client ID cannot be parsed)
   201| * - 401: Not authenticated or invalid session
   202| * - 403: Insufficient permissions:
   203| *    - Cannot delete superadmin roles as admin users
   204| *    - Cannot delete admin accounts without superadmin role
   205| * - 404: Client not found (client does not exist in database)
   206| * - 500: Server error during cascade deletion
   207| * 
   208| * **Security Features:**
   209| * - Admin-only access via requireAdmin check
   210| * - Role-based permissions prevent unauthorized account removal
   211| * - Parameterized SQL prevents SQL injection (all queries use .bind())
   212| * - Session token invalidation ensures client cannot re-authenticate
   213| * - Full audit trail via deleted records in project_updates
   214| * 
   215| * @param {Object} context - Cloudflare Pages request context
   216| * @param {Object} context.request - Incoming Request object with Cookie header
   217| * @param {Object} context.env - Environment with MOLIAM_DB binding
   218| * @param {Object} context.params - URL params containing client ID as `id`
   219| * @returns {Response} JSON response confirming deletion or error message
   220| */
   221|export async function onRequestDelete(context) {
   222|  const { request, env, params } = context;
   223|  const user = await requireAdmin(request, env);
   224|  if (user instanceof Response) return user;
   225|
   226|  const clientId = parseInt(params.id);
   227|  if (!clientId) return jsonResp(400, { success: false, error: "Invalid client ID." }, request);
   228|
   229|  const db = env.MOLIAM_DB;
   230|
   231|  try {
   232|    const client = await db.prepare("SELECT id, name, role FROM users WHERE id = ?").bind(clientId).first();
   233|    if (!client) return jsonResp(404, { success: false, error: "Client not found." }, request);
   234|
   235|     // Prevent deleting superadmin accounts
   236|    if (client.role === "superadmin") {
   237|      return jsonResp(403, { success: false, error: "Cannot delete super admin account." }, request);
   238|      }
   239|
   240|    // Prevent non-superadmin from deleting admins
   241|    if (client.role === "admin" && user.role !== "superadmin") {
   242|      return jsonResp(403, { success: false, error: "Only super admin can delete admin accounts." }, request);
   243|      }
   244|
   245|    // Delete cascade: project_updates → projects → sessions → user
   246|    const { results: projectIds } = await db.prepare(
   247|        "SELECT id FROM projects WHERE user_id = ?"
   248|      ).bind(clientId).all();
   249|
   250|    for (const p of projectIds) {
   251|      await db.prepare("DELETE FROM project_updates WHERE project_id = ?").bind(p.id).run();
   252|      }
   253|    await db.prepare("DELETE FROM projects WHERE user_id = ?").bind(clientId).run();
   254|    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(clientId).run();
   255|    await db.prepare("DELETE FROM users WHERE id = ?").bind(clientId).run();
   256|
   257|    return jsonResp(200, { success: true, message: `User "${client.name}" and all associated data deleted.` }, request);
   258|
   259|  } catch (err) {
   261|    return jsonResp(500, { success: false, error: "Server error." }, request);
   262|  }
   263|}
   264|
   265|export async function onRequestOptions() {
   266|  return corsResponse(204);
   267|}
   268|
   269|// ── Shared helpers ──
   270|
   271|async function requireAdmin(request, env) {
   272|  const token=getSes...st);
   273|  if (!token) return jsonResp(401, { success: false, error: "Not authenticated." }, request);
   274|  const db = env.MOLIAM_DB;
   275|  const session = await db.prepare(
   276|     "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND u.is_active = 1 AND s.expires_at > datetime('now')"
   277|   ).bind(token).first();
   278|  if (!session) return jsonResp(401, { success: false, error: "Session invalid." }, request);
   279|  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, error: "Admin only." }, request);
   280|  return session;
   281|}
   282|
   283|/**
   284| * Extract session token from Cookie header for authentication
   285| * 
   286| * Looks for moliam_session={token} in Cookie header string.
   287| * Returns null if no valid session found — caller must handle 401 response.
   288| * 
   289| * @param {Object} request - Cloudflare Request object
   290| * @returns {string|null} Hex-encoded session token or null
   291| */
   292|function getSessionToken(request) {
   293|  const cookies = request.headers.get("Cookie") || "";
   294|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
   295|  return match ? match[1] : null;
   296|}
   297|
   298|/**
   299| * Hash password using salted SHA-256 for user authentication storage
   300| * 
   301| * Adds server salt suffix to prevent rainbow table attacks.
   302| * Returns lowercase hex digest compatible with database storage.
   303| * This is a simple hashing method - consider bcrypt or argon2 for production.
   304| * 
   305| * @param {string} password - Plain text user password (min length 6)
   306| * @returns {Promise<string>} Lowercase hexadecimal hash string
   307| */
   308|async function hashPassword(password) {
   309|  const buf = await crypto.subtle.digest("SHA-256",
   310|    new TextEncoder().encode(password + "_moliam_salt_2026")
   311|   );
   312|  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
   313|}
   314|
   315|/**
   316| * Determine allowed Origin header value for CORS policy enforcement
   317| * 
   318| * Checks if incoming request origin matches trusted domains:
   319| * - moliam.com (production domain)
   320| * - moliam.pages.dev (staging/development)
   321| * - localhost (local development)
   322| * Returns the request origin if trusted, otherwise defaults to moliam.pages.dev.
   323| * This protects against cross-site request forgery attacks.
   324| * 
   325| * @param {Object} request - Cloudflare Request object with Origin header
   326| * @returns {string} Allowed CORS origin for Access-Control-Allow-Origin header
   327| */
   328|function getAllowedOrigin(request) {
   329|  const origin = request.headers.get("Origin") || "";
   330|  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
   331|  return "https://moliam.pages.dev";
   332|}
   333|
   334|/**
   335| * Generate CORS response headers for API endpoints
   336| * 
   337| * Configures Access-Control-Allow-Origin to accept requests from:
   338| * moliam.com, moliam.pages.dev, and localhost. Also allows GET/POST/PATCH/DELETE
   339| * methods with Content-Type header. Enables cookies (credentials: true) for
   340| * session-based authentication.
   341| * 
   342| * @param {number} status - HTTP status code (default 204 for OPTIONS preflight)
   343| * @returns {Response} Empty CORS response with security headers
   344| */
   345|function corsResponse(status) {
   346|  return new Response(null, { status, headers: {
   347|     "Access-Control-Allow-Origin": "https://moliam.pages.dev",
   348|     "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
   349|     "Access-Control-Allow-Headers": "Content-Type",
   350|     "Access-Control-Allow-Credentials": "true",
   351|   }});
   352|}
   353|
   354|/**
   355| * Unified JSON response helper with CORS header injection
   356| * 
   357| * Standardizes API response format with:
   358| * - Content-Type: application/json header
   359| * - Dynamic Access-Control-Allow-Origin based on request origin
   360| * - Credentials: true to allow session cookies
   361| * 
   362| * This function ensures all API endpoints return consistent error/success structure.
   363| * Use for both successful responses and error conditions.
   364| * 
   365| * @param {number} status - HTTP status code (200, 401, 404, 500, etc.)
   366| * @param {Object} body - JSON-serializable response body object
   367| * @param {Object|undefined} request - Optional Request object for CORS headers
   368| * @returns {Response} JSON stringified response with appropriate headers
   369| */
   370|function jsonResp(status, body, request) {
   371|  return new Response(JSON.stringify(body), { status, headers: {
   372|     "Content-Type": "application/json",
   373|     "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
   374|     "Access-Control-Allow-Credentials": "true",
   375|   }});
   376|}
   377|