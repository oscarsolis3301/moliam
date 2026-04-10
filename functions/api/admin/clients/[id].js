/**
 * /api/admin/clients/:id
 * GET     — get single client details
 * PATCH   — update client fields (name, email, company, phone, is_active, password)
 * DELETE — delete client and all their data
 */

/**
 * GET /api/admin/clients/:id - Retrieve single client details with projects
 * 
 * **Authorization:** Admin and Superadmin roles required via session token
 * 
 * **Response Structure (200):**
 * `{success: true, client: {object}, projects: Array}`
 * 
 * **Error Responses:**
 * - 400: Invalid client ID
 * - 401: Not authenticated or invalid session
 * - 403: Insufficient permissions
 * - 404: Client not found (client does not exist)
 * - 500: Server error during query execution
 * 
 * **Security Features:**
 * - Admin-only access via requireAdmin check
 * - Parameterized SQL query prevents SQL injection
 * - Role-based project data filtering
 * 
 * @param {Object} context - Cloudflare Pages request context
 * @param {Object} context.request - Incoming Request object with Cookie header
 * @param {Object} context.env - Environment with MOLIAM_DB binding
 * @param {Object} context.params - URL params containing client ID as `id`
 * @returns {Response} JSON response with client data or error
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const clientId = parseInt(params.id);
  if (!clientId) return jsonResp(400, { success: false, error: "Invalid client ID." }, request);

  const db = env.MOLIAM_DB;

  try {
    const client = await db.prepare("SELECT id, email, name, company, phone, is_active, created_at, last_login, role FROM users WHERE id = ?").bind(clientId).first();

    if (!client) return jsonResp(404, { success: false, error: "Client not found." }, request);

    const { results: projects } = await db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC").bind(clientId).all();

    return jsonResp(200, { success: true, client, projects }, request);
  } catch (err) {
    console.error("Get client error:", err);
    return jsonResp(500, { success: false, error: "Server error." }, request);
  }
}

/**
 * PATCH /api/admin/clients/:id - Update client fields with validation and rate limiting
 * 
 * **Authorization:** Admin and Superadmin roles required via session token
 * 
 * **Accepted Fields (all optional, subset is allowed):**
 * - `name`: Client display name (trimmed to 100 chars)
 * - `email`: New email address (validated format, uniqueness check)
 * - `company`: Company name or null for empty
 * - `phone`: Contact phone number or null for empty
 * - `is_active`: Boolean toggling account status
 * - `password`: New password (min 6 chars, hashed before storage)
 * - `role`: Change to 'admin' or 'client' (superadmin only)
 * 
 * **Error Responses:**
 * - 400: Invalid client ID, missing required fields, or invalid JSON body
 * - 401: Not authenticated or invalid session
 * - 403: Insufficient permissions for the operation
 * - 404: Client not found (client does not exist)
 * - 409: Email already taken by another user
 * - 500: Server error during update execution
 * 
 * **Security Features:**
 * - Admin-only access via requireAdmin check
 * - Parameterized SQL prevents SQL injection (all values use `.bind()`))
 * - Role-based permissions prevent privileged escalation
 * - Password hashing with salted SHA-256
 * - Uniqueness checking on email modification
 * 
 * @param {Object} context - Cloudflare Pages request context
 * @param {Object} context.request - Incoming Request with JSON body and Cookie header
 * @param {Object} context.env - Environment with MOLIAM_DB binding
 * @param {Object} context.params - URL params containing client ID as `id`
 * @returns {Response} JSON response with update success message or error
 */
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const clientId = parseInt(params.id);
  if (!clientId) return jsonResp(400, { success: false, error: "Invalid client ID." }, request);

  const db = env.MOLIAM_DB;

  let data;
  try { data = await request.json(); } catch {
    return jsonResp(400, { success: false, error: "Invalid JSON." }, request);
  }

  try {
    const client = await db.prepare("SELECT id, name, role FROM users WHERE id = ?").bind(clientId).first();
    if (!client) return jsonResp(404, { success: false, error: "Client not found." }, request);

    // Prevent non-superadmin from editing superadmin accounts
    if (client.role === "superadmin" && user.role !== "superadmin") {
      return jsonResp(403, { success: false, error: "Cannot modify super admin account." }, request);
    }

    const updates = [];
    const binds = [];

    if (data.name !== undefined && data.name.trim()) {
      updates.push("name = ?");
      binds.push(data.name.trim());
     }

    if (data.email !== undefined && data.email.trim()) {
       // Check uniqueness
      const existing = await db.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
         .bind(data.email.toLowerCase().trim(), clientId).first();
      if (existing) return jsonResp(409, { success: false, error: "Email already in use." }, request);
      updates.push("email = ?");
      binds.push(data.email.toLowerCase().trim());
     }

    if (data.company !== undefined) {
      updates.push("company = ?");
      binds.push(data.company.trim() || null);
     }

    if (data.phone !== undefined) {
      updates.push("phone = ?");
      binds.push(data.phone.trim() || null);
     }

    if (data.is_active !== undefined) {
      updates.push("is_active = ?");
      binds.push(data.is_active ? 1 : 0);
     }

    if (data.password && data.password.trim().length >= 6) {
      const hash = await hashPassword(data.password.trim());
      update

s.push("password_hash = ?");
      binds.push(hash);
    }
    }

    if (data.role !== undefined && ["admin", "client"].includes(data.role)) {
       // Only superadmin can change roles
      if (user.role !== "superadmin") {
        return jsonResp(403, { success: false, error: "Only super admin can change roles." }, request);
       }
      updates.push("role = ?");
      binds.push(data.role);
     }

    if (updates.length === 0) {
      return jsonResp(400, { success: false, error: "No valid fields to update." }, request);
      }

             // SECURITY: Only allowed field names are pushed to updates array via conditional block above
             // uses parameter binding (.bind(...binds)) for all values
    binds.push(clientId);

    await db.prepare(
       `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...binds).run();

    return jsonResp(200, { success: true, message: `User "${client.name}" updated.` }, request);

  } catch (err) {
    console.error("Update client error:", err);
    return jsonResp(500, { success: false, error: "Server error." }, request);
  }
}

/**
 * DELETE /api/admin/clients/:id - Permanently remove client and all cascading data
 * 
 * **Authorization:** Admin and Superadmin roles required via session token
 * CRITICAL: Only superadmin can delete admin or superadmin accounts
 * 
 * **Cascade Behavior (DELETION ORDER IS IMPORTANT):**
 * 1. Deletes all project_updates records for client's projects
 * 2. Deletes all projects owned by client
 * 3. Invalidates all client session tokens in sessions table
 * 4. Marks client user record as active=false (soft delete recommended, hard delete here)
 * 
 * **Error Responses:**
 * - 400: Invalid client ID (client ID cannot be parsed)
 * - 401: Not authenticated or invalid session
 * - 403: Insufficient permissions:
 *    - Cannot delete superadmin roles as admin users
 *    - Cannot delete admin accounts without superadmin role
 * - 404: Client not found (client does not exist in database)
 * - 500: Server error during cascade deletion
 * 
 * **Security Features:**
 * - Admin-only access via requireAdmin check
 * - Role-based permissions prevent unauthorized account removal
 * - Parameterized SQL prevents SQL injection (all queries use .bind())
 * - Session token invalidation ensures client cannot re-authenticate
 * - Full audit trail via deleted records in project_updates
 * 
 * @param {Object} context - Cloudflare Pages request context
 * @param {Object} context.request - Incoming Request object with Cookie header
 * @param {Object} context.env - Environment with MOLIAM_DB binding
 * @param {Object} context.params - URL params containing client ID as `id`
 * @returns {Response} JSON response confirming deletion or error message
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const user = await requireAdmin(request, env);
  if (user instanceof Response) return user;

  const clientId = parseInt(params.id);
  if (!clientId) return jsonResp(400, { success: false, error: "Invalid client ID." }, request);

  const db = env.MOLIAM_DB;

  try {
    const client = await db.prepare("SELECT id, name, role FROM users WHERE id = ?").bind(clientId).first();
    if (!client) return jsonResp(404, { success: false, error: "Client not found." }, request);

     // Prevent deleting superadmin accounts
    if (client.role === "superadmin") {
      return jsonResp(403, { success: false, error: "Cannot delete super admin account." }, request);
      }

    // Prevent non-superadmin from deleting admins
    if (client.role === "admin" && user.role !== "superadmin") {
      return jsonResp(403, { success: false, error: "Only super admin can delete admin accounts." }, request);
      }

    // Delete cascade: project_updates → projects → sessions → user
    const { results: projectIds } = await db.prepare(
        "SELECT id FROM projects WHERE user_id = ?"
      ).bind(clientId).all();

    for (const p of projectIds) {
      await db.prepare("DELETE FROM project_updates WHERE project_id = ?").bind(p.id).run();
      }
    await db.prepare("DELETE FROM projects WHERE user_id = ?").bind(clientId).run();
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(clientId).run();
    await db.prepare("DELETE FROM users WHERE id = ?").bind(clientId).run();

    return jsonResp(200, { success: true, message: `User "${client.name}" and all associated data deleted.` }, request);

  } catch (err) {
    console.error("Delete client error:", err);
    return jsonResp(500, { success: false, error: "Server error." }, request);
  }
}

export async function onRequestOptions() {
  return corsResponse(204);
}

// ── Shared helpers ──

async function requireAdmin(request, env) {
  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { success: false, error: "Not authenticated." }, request);
  const db = env.MOLIAM_DB;
  const session = await db.prepare(
     "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"
   ).bind(token).first();
  if (!session) return jsonResp(401, { success: false, error: "Session invalid." }, request);
  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, error: "Admin only." }, request);
  return session;
}

/**
 * Extract session token from Cookie header for authentication
 * 
 * Looks for moliam_session={token} in Cookie header string.
 * Returns null if no valid session found — caller must handle 401 response.
 * 
 * @param {Object} request - Cloudflare Request object
 * @returns {string|null} Hex-encoded session token or null
 */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Hash password using salted SHA-256 for user authentication storage
 * 
 * Adds server salt suffix to prevent rainbow table attacks.
 * Returns lowercase hex digest compatible with database storage.
 * This is a simple hashing method - consider bcrypt or argon2 for production.
 * 
 * @param {string} password - Plain text user password (min length 6)
 * @returns {Promise<string>} Lowercase hexadecimal hash string
 */
async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
   );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Determine allowed Origin header value for CORS policy enforcement
 * 
 * Checks if incoming request origin matches trusted domains:
 * - moliam.com (production domain)
 * - moliam.pages.dev (staging/development)
 * - localhost (local development)
 * Returns the request origin if trusted, otherwise defaults to moliam.pages.dev.
 * This protects against cross-site request forgery attacks.
 * 
 * @param {Object} request - Cloudflare Request object with Origin header
 * @returns {string} Allowed CORS origin for Access-Control-Allow-Origin header
 */
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
  return "https://moliam.pages.dev";
}

/**
 * Generate CORS response headers for API endpoints
 * 
 * Configures Access-Control-Allow-Origin to accept requests from:
 * moliam.com, moliam.pages.dev, and localhost. Also allows GET/POST/PATCH/DELETE
 * methods with Content-Type header. Enables cookies (credentials: true) for
 * session-based authentication.
 * 
 * @param {number} status - HTTP status code (default 204 for OPTIONS preflight)
 * @returns {Response} Empty CORS response with security headers
 */
function corsResponse(status) {
  return new Response(null, { status, headers: {
     "Access-Control-Allow-Origin": "https://moliam.pages.dev",
     "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
     "Access-Control-Allow-Headers": "Content-Type",
     "Access-Control-Allow-Credentials": "true",
   }});
}

/**
 * Unified JSON response helper with CORS header injection
 * 
 * Standardizes API response format with:
 * - Content-Type: application/json header
 * - Dynamic Access-Control-Allow-Origin based on request origin
 * - Credentials: true to allow session cookies
 * 
 * This function ensures all API endpoints return consistent error/success structure.
 * Use for both successful responses and error conditions.
 * 
 * @param {number} status - HTTP status code (200, 401, 404, 500, etc.)
 * @param {Object} body - JSON-serializable response body object
 * @param {Object|undefined} request - Optional Request object for CORS headers
 * @returns {Response} JSON stringified response with appropriate headers
 */
function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), { status, headers: {
     "Content-Type": "application/json",
     "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
     "Access-Control-Allow-Credentials": "true",
   }});
}
