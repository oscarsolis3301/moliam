/**
 * Client Message Handler — Submit client messages via authenticated endpoint
* POST /api/client-message - Send message from dashboard (requires moliam_session cookie)
 
** @returns {Response} JSON response with status or authentication error
 */

import { jsonResp, sliceText } from './api-helpers.js';

/* Extract session token from cookies for authentication */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

/**
     * Authenticate user and get session data from database
* Validates token exists in sessions table and user is active
* @param {D1Database} db - Database binding to MOLIAM_DB
 * @param {string} token - Session token from cookies, 32-character hex string
 * @returns {Promise<object|null>} User object with id,email,name,role or null if invalid

 */
async function authenticate(db, token) {
  if (!token || !db) return null;
  
const session = await db.prepare(
"SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1")
         .bind(token).first();
  return session || null;
}

/**
 * POST /api/client-message - Submit client message from authenticated dashboard
* Creates Discord webhook notification for client inquiries with rich embed format
* Requires valid moliam_session cookie for authentication and authorization

 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

      // -- GET token from cookies for authentication
  const cookies = request.headers.get("Cookie") || "";
const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  const token = match ? match[1] : null;
  if (!token) {
    return jsonResp(401, { success: false, error: true, message: "Authentication required. Please log in." }, request);

    // -- Validate session exists and fetch user data from database
  if (db) {
    const user = await authenticate(db, token);
    if (!user) {
      return jsonResp(401, { success: false, error: true, message: "Invalid or expired session. Please log in again." }, request);
     }
    }
  
  try {
    const req = await request.json();
    const { clientId, clientName, message } = req;

    if (!message || !message.trim()) {
      return jsonResp(400, { success: false, error: true, message: "Message is required and cannot be empty." }, request);
       }

    const payload = {
      content: "<@251822830574895104>",
      embeds: [{
        color: 0x8B5CF6,
        title: "📩 Client Message",
        fields: [
           { name: "Client ID", value: String(clientId || "Unknown"), inline: true },
           { name: "Client Name", value: String(clientName || "N/A"), inline: true },
           { name: "Message", value: String(message).slice(0, 1024), inline: false }
         ],
        footer: { text: `Moliam Client Message | ${new Date().toISOString()}` }
       }]
      };


         // --- Discord webhook with timeout and error handling (5s limit)
   try {
        const webhookUrl = env.DISCORD_WEBHOOK_URL;
        if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

          try {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: controller.signal
             });
            } catch (fetchErr) {
             if (fetchErr.name === 'AbortError') {
               console.warn("Discord webhook timeout after 5s, continuing...");
              } else {
               console.warn("Discord webhook fetch failed:", fetchErr.message);
              }
             } finally {
            clearTimeout(timeoutId);
           }
         }
       } catch (webhookError) {
          // Webhook failure is never fatal - log and continue gracefully
         console.warn("Discord webhook exception:", webhookError.message);
        }

    return jsonResp(200, { success: true, message: "Message sent to support channel." }, request);
     } catch (e) {
       return jsonResp(500, { success: false, error: true, message: "Internal server error. Please try again." }, request);
     }
}

/**
 * CORS preflight handler for OPTIONS requests
* Sets standard access control headers for cross-origin API calls
 */
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
       "Access-Control-Allow-Origin": "*",
       "Access-Control-Allow-Methods": "POST, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type"
     }
   });
}
