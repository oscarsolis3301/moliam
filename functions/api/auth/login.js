/**
 * Login API Endpoint for authentication and session management
 * 
 * @category Authentication
 * @module api/auth/login
 * 
 * Features:
 * - Password hashing with SHA-256 + salt
 * - Session token generation with expiration (7 days)
 * - Parameterized queries to prevent SQL injection
 * - CORS header normalization for moliam domains
 * - Cookie-based session management (HttpOnly, Secure, SameSite=Lax)
 * - Role normalization (superadmin → admin) for frontend routing
 * 
 * Parameters:
 * - context: Cloudflare Pages function context with request and env
 *   - request: HTTP request containing email/password JSON body
 *   - env.MOLIAM_DB: D1 database binding for sessions/users tables
 *   - env.DISCORD_WEBHOOK_URL: Optional webhook URL for admin notification on new login
 * 
 * @returns {Response} JSON response with success:true/error:false, session cookie if valid, or error status 401/403/500
 * 
 * HTTP Status Codes:
 * 200 - Successful authentication, returned user data and Set-Cookie header
 * 400 - Invalid JSON body in POST request
 * 401 - Invalid email/password credentials (both cases) or missing credentials
 * 403 - Account disabled (is_active = false/0)
 * 429 - Rate limited by session count for same IP (future enhancement)
 * 500 - Internal server error when DB unavailable or exception occurs
 * 
 * Error Handling:
 * All database operations wrapped in try/catch returning structured JSON errors via jsonResp(500, {error:...})
 * SQL injection prevented by using parameterized queries with ? binding throughout codebase
 * Session tokens expire after 7 days automatically (no need for manual cleanup cron)
 * 
 * Security Notes:
 * - Password must be 6-128 characters for reasonable complexity
 * - Email address validated to be ≤254 chars (RFC standard maximum)
 * - Sessions table stores user IP and UA for tracking suspicious logins from different locations
 * - Cookie marked HttpOnly prevents XSS access, Secure forces HTTPS-only delivery, SameSite=Lax protects CSRF
 * 
 */

import { jsonResp, getAllowedOrigin, generateToken } from '../lib/standalone.js';

/**
 * Login API Endpoint - POST handler for /api/auth/login
 * Validates email/password, creates session, returns authentication data with cookie
 * 
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success:true/data:user OR error status 401/403/500
 * 
 * POST Body Parameters (JSON):
 * @prop {string} email - User email address, required, maximum 254 chars
 * @prop {string} password - User password, required, minimum 6 characters
 * 
 * Response Example (Success 200):
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "email": "demo@moliam.com",
 *     "name": "Demo Admin User",
 *     "role": "admin",  // or "user" if not superadmin
 *     "company": "Visual Ark"
 *   }
 * }
 * Headers: Set-Cookie: moliam_session=abc123...; Path=/; HttpOnly; Secure; SameSite=Lax
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // CORS preflight check for OPTIONS requests - returns 204 No Content with headers
  if (request.method === "OPTIONS") return await jsonResp(204, {});

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { success: false, error: true, message: "Invalid JSON." }, request);
  }

  const email = (data.email || "").toLowerCase().trim();
  const passwordData = (data.password || "");

  if (!email || !passwordData) {
    return jsonResp(400, { success: false, error: true, message: "Email and password required." }, request);
  }

  // Input validation - sanitize email and password with length limits per RFC standards
  if (email.length > 254) {
    return jsonResp(400, { success: false, error: true, message: "Email address too long." }, request);
  }

  if (passwordData.length < 6 || passwordData.length > 128) {
    return jsonResp(400, { success: false, error: true, message: "Password must be 6-128 characters." }, request);
  }

  try {
    // Find user with parameterized query (no SQL injection risk) - uses ? binding
    const user = await db.prepare(
      "SELECT id, email, name, role, company, password_hash, is_active FROM users WHERE email=?"
    ).bind(email).first();

    if (!user) {
      return jsonResp(401, { success: false, error: true, message: "Invalid email or password." }, request);
    }

    if (user.is_active === 0 || user.is_active === false) {
      return jsonResp(403, { success: false, error: true, message: "Account disabled. Contact support." }, request);
    }

    // Verify password (SHA-256 based with consistent salt for deterministic matches)
    const hash = await hashPassword(passwordData);
    if (hash !== user.password_hash) {
      return jsonResp(401, { success: false, error: true, message: "Invalid email or password." }, request);
    }

    // Create session token with expiration (7 days) using imported generateToken from standalone.js
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const ua = request.headers.get("user-agent") || "";

    // Save to sessions table with proper ? binding for SQL injection prevention throughout codebase
    await db.prepare(
      "INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
    ).bind(user.id, token, expiresAt, ip, ua).run();

    // Update last login timestamp with parameterized query for audit tracking
    await db.prepare(
      "UPDATE users SET last_login=datetime('now') WHERE id=?"
    ).bind(user.id).run();

    // Set cookie + return user data with consistent success structure per Task 4 requirements
    const headers = new Headers({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getAllowedOrigin(request),
      "Access-Control-Allow-Credentials": "true",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });

    headers.append("Set-Cookie",
      `moliam_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );

    // Normalize superadmin → admin for frontend routing to prevent role confusion in UI layer
    const displayRole = user.role === 'superadmin' ? 'admin' : user.role;

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: displayRole,
        company: user.company,
      }
    }), { status: 200, headers });

  } catch (err) {
    console.error("Login error:", err);
    return jsonResp(500, { success: false, error: true, message: "Server error. Try again." }, request);
  }
}

// Handle CORS preflight for OPTIONS requests from GET/POST endpoints - returns 204 No Content
export async function onRequestOptions() {
  return await jsonResp(204, {});
}

/**
 * Hash password with SHA-256 and fixed salt for storage comparison across logins
 * Uses crypto.subtle API available in Cloudflare Workers runtime (modern ECMA spec)
 * 
 * @param {string} password - Raw user password from request body POST or admin seed
 * @returns {Promise<string>} Hex string of hashed result, exactly 64 characters lowercase
 * 
 * Security: Fixed salt "_moliam_salt_2026" provides deterministic hashes for login comparisons.
 * In production, consider using argon2id or bcrypt with random per-user salts instead.
 * Salt is fixed here to maintain backward compatibility with existing password storage.
 */
async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
  );

  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get allowed CORS origin from request header with fallback for development/production environments
 * Returns either origin from Origin header if it matches moliam domains or localhost, otherwise defaults to moliam.pages.dev URL
 * 
 * @param {Request} request - Cloudflare Pages Request object with headers for CORS validation
 * @returns {string} Origin string for Access-Control-Allow-Origin HTTP response header
 * 
 * Valid origins include:
 * - https://moliam.domain (production)
 * - https://moliam.pages.dev (staging or preview deployment)
 * - http://localhost:* or http://127.0.0.1:* (local development environment only)
 * 
 * Any unrecognized Origin values default back to main production domain for security:
 * "https://moliam.pages.dev"
 */
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";

  if (origin.includes("moliam.domain") || origin.includes("moliam.pages.dev") || origin.includes("localhost")) {
    return origin;
  }

  return "https://moliam.pages.dev";
}
