/**
 * Client Messaging API — CloudFlare Pages Function
 * GET    /api/messages — list messages for authenticated user with role-based filtering
 * POST   /api/messages — send a message from client to admin (requires session cookie)
 *
 * Auth: session cookie pattern moliam_session=[token] in Cookie header
 * Schema: client_messages(client_id, sender, message, created_at)
 * NOTE: client_messages FK references client_profiles(id) but we treat client_id as users.id — FK won't enforce
 *       client Messages unification required in Phase 3B to resolve client_id vs user_id ambiguity
 *
 */

// --- Centralized API helpers for consistent error handling and response formatting ---
import { jsonResp, authenticate } from './auth.js';

// --- GET: list messages with pagination and role-based filtering ---
/**
 * List messages with optional admin filter (client_id param for admin users)
* Returns up to 50 recent messages ordered by created_at DESC
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON object with messages array or authentication/error responses
 *
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const user = await authenticate(request, db);
  if (!user) {
    return jsonResp(401, { error: true, message: "Not authenticated. Please log in." }, request);
  }

  try {
    let messages;

    if (user.role === "admin") {
       // Admin: optionally filter by client_id query parameter from URL
      const url = new URL(request.url);
      const clientId = url.searchParams.get("client_id");

      if (clientId) {
        messages = await db.prepare(
           "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 50"
         ).bind(parseInt(clientId)).all();
       } else {
          // No filter: return all recent messages for admin oversight
        messages = await db.prepare(
           "SELECT id, client_id, sender, message, created_at FROM client_messages ORDER BY created_at DESC LIMIT 50"
         ).all();
         }
     } else {
         // Client: only their own messages (cannot see other clients' threads)
      messages = await db.prepare(
           "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 50"
         ).bind(user.id).all();
         }

    return jsonResp(200, { success: true, messages: messages.results || [] }, request);

    } catch (err) {
    console.error("Messages GET error:", err.message);
    return jsonResp(500, { error: true, message: "Failed to retrieve messages" }, request);
  }
}

// --- POST: send a message from client or admin user ---
/**
 * Send new message from authenticated user (client → admin) with Discord webhook notification
* Only clients can POST - admins use read-only access
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and env.DISCORD_WEBHOOK_URL
 * * @returns {Response} JSON object with success flag and messageId on database insert
 *
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const user = await authenticate(request, db);
  if (!user) {
    return jsonResp(401, { error: true, message: "Not authenticated. Please log in." }, request);
  }

  let body;
  try {
    body = await request.json();
    } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body" }, request);
     }

  const messageText = (body.message || "").trim();
  if (!messageText) {
    return jsonResp(400, { error: true, message: "Message text is required and cannot be empty." }, request);
     }

       // client_id: required field for admin users, auto-set to authenticated user for clients
  let clientId;
  if (user.role === "admin") {
    clientId = body.client_id;
    if (!clientId) {
      return jsonResp(400, { error: true, message: "client_id is required for admin messages" }, request);
       }
       } else {
    clientId = user.id;
     }

      // sender = authenticated user's name from session (never from request body — prevents identity spoofing)
  const sender = user.name || "Unknown";

  try {
       // Insert into client_messages table and capture message ID for tracking
    const result = await db.prepare(
         "INSERT INTO client_messages (client_id, sender, message) VALUES (?, ?, ?)"
       ).bind(clientId, sender, messageText).run();

    const messageId = result.meta.last_row_id;

       // Discord webhook: only POST to admin channel for client → admin messages (not admin replies)
    if (user.role === "client") {
      await sendDiscordWebhook(env, sender, messageText);
       }

    return jsonResp(200, { success: true, message_id: messageId }, request);

    } catch (err) {
    console.error("Messages POST error:", err.message);
    return jsonResp(500, { error: true, message: "Failed to send message" }, request);
     }
}

// --- CORS preflight handler for OPTIONS requests ---
/**
 * Handle browser CORS preflight by returning standard access control headers
* Only called automatically by browsers - no body response expected
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
         "Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
         "Access-Control-Allow-Headers": "Content-Type",
         "Access-Control-Allow-Credentials": "true",
       },
     });
}

/**
 * Session authentication helper for client → admin messaging API
* Reads moliam_session cookie from request, validates token in sessions table
 * Returns user object with id,email,name,role if session active and not expired
 *
 * @param {Request} request - Cloudflare Pages Request object with Cookie header
 * @param {D1Database} db - Database binding to MOLIAM_DB
* @returns {Promise<object|null>} User object or null if invalid/inactive/expired token
 */
      // --- Authenticate via session cookie (copied from auth/me.js pattern) ---
    async function authenticate(request, db) {
  if (!db) return null;

  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  if (!match) return null;

  const token = match[1];

  try {
    const session = await db.prepare(
               "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1")
             .bind(token).first();

    if (!session) return null;

        // Check session expiry - delete stale tokens to prevent orphan data accumulation
    if (new Date(session.expires_at) < new Date()) {
      await db.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
      return null;
          }

    return {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
          };
       } catch {
    return null;
      }


// --- Discord webhook notification for client → admin messages (fire-and-forget) ---
/**
 * Send new client message to Discord via webhooks with emoji prefix and preview text
* Truncates message preview to first 100 chars for embed field, logs errors silently
 * ** @param {object} env - Worker environment variables including optional DISCORD_WEBHOOK_URL
 * @param {string} senderName - Client identifier from session (not client_id for privacy)
 * @param {string} messageText - Message body to broadcast
 *
 */
// --- Discord webhook (client → admin only) ---
async function sendDiscordWebhook(env, senderName, messageText) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

  try {
    const preview = messageText.length > 100 ? messageText.slice(0, 100) + "…" : messageText;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Moliam Messages",
        content: `📩 New message from ${senderName}: ${preview}`,
        }),
      });
    } catch (whErr) {
    console.warn("Discord webhook failed:", whErr.message);
     }
}
