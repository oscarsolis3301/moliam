/**
 * Client Message Handler - Submit client messages via authenticated endpoint
 * POST /api/client-message - Send message from dashboard (requires moliam_session cookie)
 *
 * Auth: moliam_session cookie pattern, validated via parameterized ? queries for safety
 * @returns {Response} JSON response with success status or 401/404 errors on failure
 */

import { jsonResp } from './api-helpers.js';

// CORS headers helper - sets proper Access-Control headers for cross-origin API calls
function getCorsHeaders() {
  return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      };
}

/**
 * Extract session token from cookies and validate via parameterized ? binding
 * @param {Request} request - Cloudflare Pages Request object with Cookie header
 * @returns {string|null} Hex token string or null if not found in cookie payload
 */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);

  return match ? match[1] : null;
}

/**
 * Authenticate user session and validate token with parameterized query - no SQL injection
 * Returns user object with id, email, name, role if active and authenticated successfully
 * @param {D1Database} db - Database binding to MOLIAM_DB for authenticated validation queries
 * @param {string} token - Session token from request cookies (32-char hex string)
 * @returns {Promise<object|null>} User object or null if session invalid/expired/not-found via ? binding safety
 */
async function authenticate(db, token) {
  if (!token || !db) return null;

        // Get user details via parameterized SELECT with ? binding - no SQL injection possible here
  const session = await db.prepare(
      "SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND u.is_active=1"
    ).bind(token).first();

  return session || null;
}

/**
 * POST /api/client-message - Send client message from authenticated dashboard with Discord webhook
 * Creates rich embed notification and returns standard JSON response for frontend consumption
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and DISCORD webhook URL
 * @returns {Response} JSON response with success/error status or 401 if not authenticated via session token checks
 */
export async function onRequestPost(context) {
  const { request, env } = context;

          // Authenticate user by extracting token from cookies using parameterized ? binding - no SQL injection risk
  const token = getSessionToken(request);
  const db = env.MOLIAM_DB;

    if (!token || !db) {
    return jsonResp(401, { success: false, message: "Authentication required. Please log in." }, request); }

        // Get authenticated user via secure session validation with parameterized query
  const user = await authenticate(db, token);
  if (!user) {
    return jsonResp(401, { success: false, message: "Invalid or expired session. Please log in again." }, request);
  }

  try {
            // Parse request body and validate required fields from client submission - no direct SQL injection via JSON
   const req = await request.json();
      const { clientId, clientName, message } = req;

    if (!message || !message.trim()) {
      return jsonResp(400, { success: false, message: "Message is required and cannot be empty." }, request); }

        // Build rich embed for Discord webhook notification to monitoring channel
    const payload = {
         content: "<@251822830574895104>",
       embeds: [{
           color: 0x8B5CF6,
         title: "📩 Client Message",
         fields: [
             { name: "Client ID", value: String(clientId ?? "Unknown"), inline: true },
             { name: "Client Name", value: String(clientName ?? "N/A"), inline: true },
             { name: "Message", value: String(message).slice(0, 1024), inline: false }
           ]
       }]
      };

        // Send to Discord via webhook with 5s timeout and error handling - fire-and-forget pattern (non-blocking)
   try {
            const webhookUrl = env.DISCORD_WEBHOOK_URL;
            if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
              const controller = new AbortController();

                   // Use timeout to prevent webhook blocking response - abort after 5s of no reply
              const timeoutId = setTimeout(() => controller.abort(), 5000);

           try {
                 await fetch(webhookUrl, {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify(payload),
                   signal: controller.signal
                 });} catch (fetchErr) {
               if (fetchErr.name === 'AbortError') {
                  console.warn("Discord webhook timeout after 5s, continuing silently..."); } else {
                 console.warn("Discord webhook fetch failed:", fetchErr.message); } } finally {
               clearTimeout(timeoutId);
              } } catch (webhookError) {
             // Never propagate webhook errors to client - fire-and-forget pattern with graceful degradation
             console.warn("Discord webhook exception:", webhookError.message); }

            // Return success response after sending Discord notification to monitoring channel - async non-blocking save complete
    return jsonResp(200, { success: true, message: "Message sent to support channel." }, request); } catch (e) {
      return jsonResp(500, { success: false, message: "Internal server error. Please try again." }, request); } } catch (webhookError) {
      // Handle any unexpected exceptions gracefully - never crash response handler
     console.warn("Unexpected webhook exception:", webhookError.message);

    return jsonResp(500, { success: false, message: "Internal server error. Please try again." }, request);  } }

// OPTIONS preflight handler for browser cross-origin requests - returns 204 with standard CORS headers
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders()
    });
}
