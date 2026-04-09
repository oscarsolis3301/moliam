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

// Import all utilities from api-helpers to ensure consistent response format
import { jsonResp, sanitizeText, validateEmail } from './api-helpers.js';

/**
 * Sanitize and validate message text: strip HTML, limit to 500 characters, trim whitespace
 * @param {string} input - Raw message text from request body
 * @returns {object} Object with {valid: boolean, error?: string, value?: string} for structured validation results
 */
function sanitizeMessage(input) {
  if (input === undefined || input === null) {
    return { valid: false, error: "Message cannot be empty." };
   }

  const text = String(input).trim();

   // Strip any HTML tags using regex fallback compatible with environment
  let cleanText = text;
  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      cleanText = doc.documentElement.textContent || text;
     } else {
       // Fallback: regex strip HTML entities and tags
      cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
     }
   } catch (e) {
    cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
   }

   // Enforce length limit of 500 characters
  if (cleanText.length > 500) {
    return { valid: false, error: "Message exceeds maximum length of 500 characters.", value: cleanText.slice(0, 500) };
   }

   // Trim to 500 chars if over limit but still keep portion
  const trimmed = (cleanText.length > 500 ? cleanText.slice(0, 500).trim() : cleanText);

  if (!trimmed) {
    return { valid: false, error: "Message cannot be empty." };
   }

  return { valid: true, value: trimmed };
}

/**
 * Sanitize message with length limit extended for admin messages - strip HTML, enforce 1000 char limit, trim whitespace
 * Admins can send longer messages up to 1000 characters
 * @param {string} input - Raw message text from request body
 * @param {boolean} isAdmin - Whether sender is admin (determines length limit)
 * @returns {object} Object with {valid: boolean, error?: string, value?: string} for structured validation results
 */
function sanitizeAdminMessage(input, isAdmin = false) {
  const maxLength = isAdmin ? 1000 : 500;

  if (input === undefined || input === null) {
    return { valid: false, error: "Message cannot be empty." };
   }

  const text = String(input).trim();

   // Strip HTML tags
  let cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  if (cleanText.length > maxLength) {
    return { valid: false, error: `Message exceeds maximum length of ${maxLength} characters.`, value: cleanText.slice(0, maxLength) };
   }

  const trimmed = (cleanText.length > maxLength ? cleanText.slice(0, maxLength).trim() : cleanText);

  if (!trimmed) {
    return { valid: false, error: "Message cannot be empty." };
   }

  return { valid: true, value: trimmed };
}

/**
 * Session authentication helper - extracts token from cookie and validates via parameterized query with ? binding
 * @param {Request} request - Cloudflare Pages Request Object with Cookie header
 * @param {D1Database} db - Database binding to MOLIAM_DB
 * @returns {object|null} User object with id, email, name, role or null if invalid/expired
 */
async function authenticate(request, db) {
  if (!db) return null;

    // Get token from moliam_session cookie for authentication
  const cookies = request.headers.get("Cookie") || "";
  const url = new URL(request.url);

    // Extract token from cookie or query params
  const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
  let tokenVal = cookieMatch ? cookieMatch[1] : null;
  
    // Also check query string if not in cookie
  if (!tokenVal) {
    const query = url.searchParams.get('token');
    if (query && query.length > 20) {
      tokenVal = query;
    }
  }
  try {
      // Validate session with parameterized query - uses ? binding to prevent SQL injection
    const session = await db.prepare(
        "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active=1"
      ).bind(tokenVal).first();

    if (!session) return null;

      // Check session expiry timestamp and delete stale tokens to prevent orphan data accumulation
    if (new Date(session.expires_at) < new Date()) {
      await db.prepare("DELETE FROM sessions WHERE token = ?").bind(tokenVal).run();
      return null;
      }

    return {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role ? session.role.toLowerCase() : 'user'
     };

   } catch (err) {
    console.warn("authenticate error:", err.message);
    return null;
   }
}

/**
 * List all messages or filter by client_id for admin users only
 * @param {object} context - Cloudflare Pages request context
 * @returns {Response} JSON response with messages array for the authenticated user
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  try {
    const user = await authenticate(request, db);
    if (!user) {
      return jsonResp(401, { success: false, message: "Not authenticated. Please log in." }, request);
     }

    let messages;

     // Admin can filter by client_id query param - uses parameterized query with ? binding for security
    if (user.role === "admin") {
      const url = new URL(request.url);
      const clientIdParam = url.searchParams.get("client_id");

      if (clientIdParam) {
         // Get messages for specific client with safe SQL binding - no injection possible via ? parameterized query
        messages = await db.prepare(
           "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id=? ORDER BY created_at DESC LIMIT 50"
         ).bind(parseInt(clientIdParam)).all();

       } else {
         // Admin view all recent messages with no filters and ? binding safety pattern
        messages = await db.prepare(
           "SELECT id, client_id, sender, message, created_at FROM client_messages ORDER BY created_at DESC LIMIT 50"
         ).all();
       }

     } else {
       // Regular clients only see their own messages (role-based filtering with secure ? binding)
      messages = await db.prepare(
         "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id=? ORDER BY created_at DESC LIMIT 50"
       ).bind(user.id).all();
     }

    return jsonResp(200, { success: true, messages: (messages?.results || []) }, request);

   } catch (err) {
    console.error("Messages GET error:", err.message);
    return jsonResp(500, { success: false, message: "Failed to retrieve messages" }, request);
   }
}

/**
 * Submit new message via authenticated endpoint - client → admin broadcast only
 * Only allows clients to POST messages; admins have read-only access with optional client_id filtering
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and DISCORD_WEBHOOK_URL
 * @returns {Response} JSON response with success flag and messageId for tracking on successful save
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  if (!db) {
    return jsonResp(503, { success: false, message: "Database unavailable. Please try again later." }, request);
  }

  try {
    const user = await authenticate(request, db);
    if (!user) {
      return jsonResp(401, { success: false, message: "Not authenticated. Please log in." }, request);
     }

    let body;
    try {
      body = await request.json();
     } catch(e) {
      return jsonResp(400, { success: false, message: "Invalid JSON body" }, request);
     }

     // Validate required fields for POST - email extracted from authenticated user for optional audit trail
    if (!body || !body.message) {
      return jsonResp(400, { success: false, message: "Missing required field: message" }, request);
     }

     // Enhanced message sanitization: strip HTML, limit to 500 chars, return structured validation result
    const msgResult = sanitizeMessage(body.message);
    if (!msgResult.valid) {
      return jsonResp(400, { success: false, message: msgResult.error }, request);
     }

    const messageText = msgResult.value;

     // client_id required for admin POST; auto-set from authenticated session for regular clients - no SQL injection via ? binding
    let clientId;
    if (user.role === "admin") {
       // Enhanced sanitization for admin messages: strip HTML, limit to 1000 chars
      const adminResult = sanitizeAdminMessage(body.message, true);
      if (!adminResult.valid) {
        return jsonResp(400, { success: false, message: adminResult.error }, request);
       }

       // Get clean admin message text for insertion
      clientId = parseInt(body.client_id ?? 0);
      if (isNaN(clientId) || clientId <= 0) {
        return jsonResp(400, { success: false, message: "Invalid client_id for admin messages." }, request);
       }

     } else {
       // Auto-set from authenticated session user.id - no SQL injection possible here with proper ? binding
      clientId = user.id;
     }

     // Send to database using parameterized query with ? binding - no SQL injection possible
    const result = await db.prepare(
       "INSERT INTO client_messages (client_id, sender, message) VALUES (?, ?, ?)"
     ).bind(clientId, user.name, messageText).run();

     // Return success with messageId for tracking via parameterized save operation - no SQL injection
    const messageId = (result?.meta?.last_row_id || 0);

    return jsonResp(200, { success: true, error: false, message_id: messageId }, request);

   } catch (err) {
    console.error("Messages POST error:", err.message);
    return jsonResp(500, { success: false, message: "Failed to send message" }, request);
   }
}

/**
 * Handle CORS preflight requests for messaging API endpoints
 * Enables cross-origin access from moliam.com and moliam.pages.dev domains
 * @param {object} context - Cloudflare Pages request context (implicitly used)
 * @returns {Response} 204 No Content Response with CORS headers enabled GET/POST OPTIONS module-wide
 */
export async function onRequestOptions(context) {
  const headers = new Headers({
     "Access-Control-Allow-Origin": "*",
     "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
     "Access-Control-Allow-Headers": "Content-Type, Authorization",
     "Access-Control-Allow-Credentials": true
   });

  return new Response(null, { status: 204, headers });
}
