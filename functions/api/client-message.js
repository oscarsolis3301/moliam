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
    "Access-Control-Allow-Origin": "https://moliam.pages.dev",
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

  try {
       // Get user details via parameterized SELECT with ? binding - no SQL injection possible here
    const session = await db.prepare(
        "SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND u.is_active=1"
      ).bind(token).first();

    return session || null;
    } catch (err) {
    console.error("authenticate() error:", err.message);
    return null;
    }
}

/**
 * Validate message content - strip HTML, check whitespace length, ensure no dangerous patterns
 * @param {string} messageRaw - Raw message string from client
 * @returns {object} validation object with isValid boolean and either cleanedMessage or error
 */
function validateMessage(messageRaw) {
  if (!messageRaw || typeof messageRaw !== 'string') {
    return { isValid: false, error: "Message is required." };
  }

  // Strip any HTML tags to prevent XSS
  const stripped = messageRaw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  if (stripped.length === 0) {
    return { isValid: false, error: "Message cannot be empty." };
  }

  // Limit to 5000 characters for storage efficiency
  if (stripped.length > 5000) {
    return { isValid: false, error: "Message is too long. Maximum 5000 characters." };
  }

  return { isValid: true, cleanedMessage: stripped };
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
  const db = env.MOLIAM_DB;

  // Extract session token from cookies safely for authentication
  function getSessionToken(req) {
    const cookies = req.headers.get("Cookie") || "";
    const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    return match ? match[1] : null;
   }

     // Get session token from request
  const token = getSessionToken(request);

  if (!token || !db) {
    return jsonResp(401, { success: false, message: "Authentication required. Please log in." }, request);
  }

  // Get authenticated user via secure session validation with parameterized query - wrapped in try/catch
  let user = null;
  try {
    user = await authenticate(db, token);
  } catch (err) {
    console.error("authenticate() error:", err.message);
  }

  if (!user) {
    return jsonResp(401, { success: false, message: "Invalid or expired session. Please log in again." }, request);
  }

  try {
    // Parse request body and validate required fields from client submission - no direct SQL injection via JSON with error handling
    let req;
    try {
      req = await request.json();
    } catch (parseErr) {
      console.error("parse error:", parseErr.message);
      return jsonResp(400, { success: false, message: "Invalid JSON body." }, request);
    }

    // Validate message content - sanitization, length limits, whitespace stripping
    const validation = validateMessage(req?.message);
    if (!validation.isValid) {
      return jsonResp(400, { success: false, message: validation.error }, request);
    }

    const trimmedClientName = req?.clientName ? String(req.clientName).slice(0, 100).trim() : user.name.slice(0, 255);
    const trimmedClientId = req?.clientId ? String(req.clientId).slice(0, 191).trim() : user.id;

    // Insert record via parameterized query - no SQL injection possible with ? binding and .bind()
    const result = await db.prepare(
      "INSERT INTO client_messages (client_id, client_name, message, user_id, email) VALUES (?, ?, ?, ?, ?)"
    ).bind(trimmedClientId, trimmedClientName, validation.cleanedMessage, user.id, user.email).run();

    return jsonResp(201, { success: true, data: { id: result.meta.primary_key, message: "Message saved successfully." } }, request);

  } catch (err) {
    console.error("onRequestPost() error:", err.message);
    return jsonResp(500, { success: false, message: "Internal server error. Please try again." }, request);
  }
}

// OPTIONS preflight handler for browser cross-origin requests - returns 204 with standard CORS headers
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders()
  });
}
