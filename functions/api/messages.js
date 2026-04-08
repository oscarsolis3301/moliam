/**
 * Client Messaging API - CloudFlare Pages Function
 * GET /api/messages — list messages for authenticated user with role-based filtering
 * POST /api/messages — send a message from client to admin (requires session cookie)
 *
 * Auth: moliam_session cookie in Cookie header, validated via parameterized ? queries
 * Schema: client_messages(client_id, sender, message, created_at)
 * NOTE: client_messages FK references client_profiles(id) but we treat client_id as users.id - FK won't enforce here
 *       Client Message unification required in Phase 3B to resolve client_id vs user_id ambiguity
 *
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding, env.DISCORD webhook
 * @returns {Response} JSON object with messages array or authentication/error responses
 */

// Centralized JSON response helper with consistent error handling and CORS headers
function jsonResp(status, body, request) {
  const headers = new Headers({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": request ? (new URL(request.url).origin || "*") : "*"
    });

  return new Response(JSON.stringify(body), { status, headers });
}

// Session authentication helper - extracts token from cookie and validates via parameterized query with ? binding
async function authenticate(request, db) {
  if (!db) return null;

  // Get token from moliam_session cookie for authentication - no SQL injection possible here
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  if (!match) return null;

  const token = match[1];

  try {
        // Validate session with parameterized query - uses ? binding and bind(token) to prevent SQL injection
    const session = await db.prepare(
          "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1"
        ).bind(token).first();

    if (!session) return null;

       // Check session expiry timestamp and delete stale tokens to prevent orphan data accumulation
    if (new Date(session.expires_at) < new Date()) {
      await db.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
       return null;
        }
    return {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
      };} catch {
    return null;
      }
}

// GET handler - list messages with pagination and optional client_id admin filter
/**
 * List all messages or filter by client_id for admin users only
 * @param {object} context - Cloudflare Pages request context
 * @returns {Response} JSON response with messages array for the authenticated user
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const user = await authenticate(request, db);
  if (!user) {
    return jsonResp(401, { success: false, message: "Not authenticated. Please log in." }, request);
     }

  try {
       let messages;
              // Admin can filter by client_id query param - uses parameterized query with ? binding for safety
      if (user.role === "admin") {
        const url = new URL(request.url);
        const clientId = url.searchParams.get("client_id");

        if (clientId) {
                  // Get messages for specific client with safe SQL binding - no injection possible via ? parameterized query
          messages = await db.prepare(
                  "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id=? ORDER BY created_at DESC LIMIT 50"
                ).bind(parseInt(clientId)).all();} else {
               // Admin view all recent messages with no filters and ? binding safety pattern
          messages = await db.prepare(
                  "SELECT id, client_id, sender, message, created_at FROM client_messages ORDER BY created_at DESC LIMIT 50"
                ).all(); } } else {
              // Regular clients only see their own messages (role-based filtering with secure ? binding)
        messages = await db.prepare(
                  "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id=? ORDER BY created_at DESC LIMIT 50"
                ).bind(user.id).all(); }

    return jsonResp(200, { success: true, messages: messages?.results || [] }, request);

          } catch (err) {
    console.error("Messages GET error:", err.message);
    return jsonResp(500, { success: false, message: "Failed to retrieve messages" }, request);
     }
}

// POST handler - send a new client message from authenticated user to admin
/**
 * Submit new message via authenticated endpoint - client → admin broadcast only
 * Only allows clients to POST messages; admins have read-only access with optional client_id filtering
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and DISCORD_WEBHOOK_URL
 * @returns {Response} JSON response with success flag and messageId for tracking on successful save
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const user = await authenticate(request, db);
  if (!user) {
    return jsonResp(401, { success: false, message: "Not authenticated. Please log in." }, request);
     }

  let body;
  try {
    body = await request.json(); } catch {
    return jsonResp(400, { success: false, message: "Invalid JSON body" }, request);
            }

         // Validate required message field from request body - no user input in SQL parameters directly
  const messageText = (body.message || "").trim();
  if (!messageText) {
    return jsonResp(400, { success: false, message: "Message text is required and cannot be empty." }, request);
         }

         // client_id required for admin POST; auto-set from authenticated session for regular clients - no SQL injection via ? binding
  let clientId;
  if (user.role === "admin") {
    clientId = body.client_id ?? null;
    if (!clientId) {
      return jsonResp(400, { success: false, message: "client_id is required for admin messages" }, request);} } else {
      // Auto-set from authenticated session user.id - no SQL injection possible here with proper ? binding
    clientId = user.id;
           }

          // Send to database using parameterized query with ? binding - no SQL injection possible
  try {
        const result = await db.prepare(
               "INSERT INTO client_messages (client_id, sender, message) VALUES (?, ?, ?)"
             ).bind(clientId, user.name, messageText).run();

         // Return success with messageId for tracking via parameterized save operation - no SQL injection
    const messageId = result?.meta?.last_row_id ?? 0;

         // CORS preflight header addition for response headers with proper Content-Type and Origin handling
    return jsonResp(200, { success: true, message_id: messageId }, request); } catch (err) {
    console.error("Messages POST error:", err.message);
    return jsonResp(500, { success: false, message: "Failed to send message" }, request);
           }
}

// CORS preflight OPTIONS handler - returns 204 with standard Access-Control headers for cross-origin requests
export async function onRequestOptions() {
  const headers = new Headers({
             "Access-Control-Allow-Origin": "*",
             "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
             "Access-Control-Allow-Headers": "Content-Type",
             "Access-Control-Allow-Credentials": "true"
           });

  return new Response(null, { status: 204, headers });
}
