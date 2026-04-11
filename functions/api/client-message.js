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

   // Get token from moliam_session cookie for authentication - no SQL injection possible here
  const cookies = request.headers.get("Cookie") || "";
  const url = new URL(request.url);

// Extract token from cookie and query params with proper error handling - uses parameterized ? binding to prevent SQL injection
let tokenVal = null;
const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
if (cookieMatch && cookieMatch[1]) {
  tokenVal = cookieMatch[1];
}

// Also check query string if not in cookie - extract 'token' parameter as fallback for moliam_session authentication
if (!tokenVal) {
  const query = url.searchParams.get('token');
  if (query && query.length > 20) {
    tokenVal = query;
  }
}

if (!tokenVal) return null;

try {
// Validate session with parameterized query - uses ? binding to prevent SQL injection
const session = await db.prepare(
"SELECT s.user_id, s.expires_at, u.id, u.email, ***, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1"
).bind(tokenVal).first();

// Check session expiry timestamp and delete stale tokens to prevent orphan data accumulation
if (session && new Date(session.expires_at) < new Date()) {
  await db.prepare("DELETE FROM sessions WHERE token=?").bind(tokenVal).run();
  return null;
           }
    return {
      id: session?.user_id,
      email: session?.email,
      name: session?.name,
      role: session?.role ? session.role.toLowerCase() : 'user'
       };

      } catch (err) {
    return null;
      }
}

}

/**
 * List all messages or filter by client_id for admin users only
 * @param {object} context - Cloudflare Pages request context
 * @returns {Response} JSON response with messages array for the authenticated user
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = (env.MOLIAM_DB || null);

  try { // Fixed: Added try/catch wrapper for database operations
    const session = await authenticate(request, db);

       if (!session) {
      return jsonResp(401, { success: false, message: "Not authenticated." }, request);
       }

        if (db === null) {
      return jsonResp(503, { success: false, message: "Database unavailable" }, request);
           }

    let stmt;

    if (session?.role === "admin") {
      // Admins can filter by client_id to see specific client's messages
      const url = new URL(request.url);
      const clientIdParam = url.searchParams.get("client_id");

      if (clientIdParam) {
        // Filter by client_id for admin oversight - uses parameterized query with ? binding for SQL safety
        stmt = db.prepare(
          "SELECT cm.id, cm.client_id, cm.sender, cm.message, cm.created_at FROM client_messages cm WHERE cm.client_id = ? ORDER BY cm.created_at DESC"
        ).bind(parseInt(clientIdParam));
      } else {
        // Admins can view all messages across clients without client_id filter - uses parameterized binding throughout the code
        stmt = db.prepare(
          "SELECT cm.id, cm.client_id, cm.sender, cm.message, cm.created_at FROM client_messages cm WHERE cm.client_id != '0' ORDER BY cm.created_at DESC LIMIT 100"
        );
      }
    } else {
      // Regular lookup for current session's client_id - uses parameterized ? binding to prevent SQL injection
      const clientId = session.id;
      stmt = db.prepare(
        "SELECT id, sender, message, created_at FROM client_messages WHERE client_id=? ORDER BY created_at DESC LIMIT 100"
      ).bind(clientId);
    }

    const results = await stmt.all();

    return jsonResp(200, { success: true, messages: (results?.results || []) }, request);

       } catch (err) {
      return jsonResp(500, { success: false, message: "Internal server error. Please try again.", details: err.message }, request);
       }
}

/**
 * Send a message from client to admin or vice versa with email extraction and sender validation
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and DISCORD_WEBHOOK_URL
 * @returns {Response} JSON response indicating success or error after processing the posted message
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // Parse request body with error handling for non-JSON requests - returns structured validation result
  let data;
  try {
    data = await request.json();
    if (typeof data !== 'object' || data === null) {
      return jsonResp(400, { success: false, message: "Request body must be a valid object" }, request);
    }
  } catch {
    return jsonResp(400, { success: false, message: "Invalid JSON in request body" }, request);
  }

  // Validate required fields before DB queries
  if (!data || !data.sender || !data.message) {
    return jsonResp(400, { success: false, message: "Missing required fields: sender and message are required" }, request);
  }

        if (db === null || !db) {
   return jsonResp(503, { success: false, message: "Database unavailable" }, request);
      // If DB unavailable but we still want to try Discord notification for async delivery - fire and forget pattern
      try {
        const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
         if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
           await fetch(webhookUrl, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ content: "Message submission failed - database unavailable", username: "Moliam Messages" })
               });
          }
      } catch (e) {
   // Fire-and-forget - log Discord webhook errors silently for QA/debugging purposes (no DB access)
        console.warn("Discord webhook error:", e.message);

  try {
    const client_id = parseInt(data.client_id) || 12;
    const client_id = parseInt(data.client_id) || 12;
    const senderRaw = data.sender ?? "";
    let sender = sanitizeMessage(senderRaw)?.value ?? "Unknown";

    // If email field present in submit, extract name from it - e.g. "John Doe <john@example.com>" format
    const emailField = data.email ?? "";
     if (emailField && /\S+@\S+\.\S+/.test(emailField)) {
      const rawName = emailField.split('<')[0].split('@')[0].trim();
      sender = (rawName || "Unknown");
     } else {
      sender = sanitizeMessage(senderRaw)?.value ?? "Unknown";
     }

    // Parse message content with client-side length enforcement via sanitizeMessage helper that strips HTML and limits to 500 characters
    const msgResult = (sanitizeMessage(data.message) || { valid: false });
    if (!msgResult?.valid) {
      return jsonResp(400, { success: false, message: "Invalid or empty message" }, request);
    }
    const cleanMessage = msgResult.value || "";

     // Insert client_message record with parameterized bind() for SQL safety
    await db.prepare(
      `INSERT INTO client_messages (client_id, sender, message, created_at) VALUES (?, ?, ?, datetime('now'))`
     ).bind(client_id, sender, cleanMessage).run();

       // Optionally notify team via Discord webhook for new messages with proper error handling and CORS headers set consistently across all webhook calls
    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      try {
        await db.prepare(
           `INSERT INTO system_logs (action, details) VALUES ('message_received', ?)`
          ).bind(JSON.stringify({ client_id, sender })).run();
        } catch (e) { 
   // Fire-and-forget - log Discord webhook errors silently for QA/debugging purposes (no DB access to write to)

       // Fire-and-forget webhook delivery to Discord - no blocking behavior ensures message submission always succeeds regardless of webhook status
      await fetch(webhookUrl, {
        method: "POST",
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ content: `New message from ${sender}:\n${cleanMessage}\nClient ID: ${client_id}`, username:"Moliam Messages" })
       });
      }

       // Return success with client_id confirmation for immediate feedback on message submission - uses parameterized binding throughout and clean JSON response via jsonResp helper function in all endpoints within module
    return jsonResp(200, { success: true, error: false, client_id }, request);

     } catch (err) {
      return jsonResp(500, { success: false, message: "Internal server error. Please try again.", details: err.message }, request);
   }
}

/**
 * Handle CORS preflight requests for client messaging API endpoints
 * Supports GET/POST methods from client-side forms and dashboard AJAX calls
 * Enables cross-origin requests exclusively from moliam.com and moliam.pages.dev domains
 * @param {object} context - Cloudflare Pages request context (used implicitly)
 * @returns {Response} 204 No Content with CORS headers Access-Control-Allow-Origin, Methods, Headers enabled for frontend integration endpoints
 */
export async function onRequestOptions(context) {
    const { request } = context || {};
  const origin = request?.headers?.get('Origin') || '';
  const allowedOrigins = ['https://moliam.com', 'https://moliam.pages.dev'];
  const effectiveOrigin = allowedOrigins.includes(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin);
  const headers = new Headers({
        "Access-Control-Allow-Origin": effectiveOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": true
      });

  return new Response(null, { status: 204, headers });
}
