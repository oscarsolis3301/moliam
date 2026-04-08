/**
 * Login API Endpoint
 * POST /api/auth/login
 * Authenticates user, creates session, sets cookie
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status and authentication token
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

    // CORS preflight check for OPTIONS requests
  if (request.method === "OPTIONS") return corsResponse(204);

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." });
        }

  const email = (data.email || "").toLowerCase().trim();
  const password = data.password || "";

  if (!email || !password) {
    return jsonResp(400, { success: false, message: "Email and password required." });
  }

  // Input validation - sanitize email and password
  if (email.length > 254) {
    return jsonResp(400, { success: false, message: "Email address too long." });
  }

  if (password.length < 6 || password.length > 128) {
    return jsonResp(400, { success: false, message: "Password must be 6-128 characters." });
  }

  try {
       // Find user with parameterized query (no SQL injection risk) - uses ? binding
    const user = await db.prepare(
         "SELECT id, email, name, role, company, password_hash, is_active FROM users WHERE email = ?"
       ).bind(email).first();

    if (!user) {
      return jsonResp(401, { success: false, message: "Invalid email or password." });
  }

    if (user.is_active === 0 || user.is_active === false) {
      return jsonResp(403, { success: false, message: "Account disabled. Contact support." });
  }

         // Verify password (SHA-256 based)
    const hash = await hashPassword(password);
    if (hash !== user.password_hash) {
      return jsonResp(401, { success: false, message: "Invalid email or password." });
  }

         // Create session token with expiration (7 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const ua = request.headers.get("user-agent") || "";

         // Save to sessions table with proper ? binding and token parameter - no SQL injection
    await db.prepare(
         "INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
       ).bind(user.id, token, expiresAt, ip, ua).run();

         // Update last login timestamp with parameterized query
    await db.prepare(
         "UPDATE users SET last_login = datetime('now') WHERE id = ?"
       ).bind(user.id).run();

         // Set cookie + return user data with consistent success structure
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

         // Normalize superadmin → admin for frontend routing
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
    return jsonResp(500, { success: false, message: "Server error. Try again." });
       }
}

// Handle CORS preflight for OPTIONS requests - returns 204 No Content with proper headers
export async function onRequestOptions() {
  return corsResponse(204);
}

/**
 * Hash password with SHA-256 and fixed salt for storage comparison
 * @param {string} password - Raw user password from request body
 * @returns {Promise<string>} Hex string of hashed password (64 characters)
 */
async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
  );

  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate cryptographically secure random session token (32-byte UUID)
 * Uses WebCrypto API getRandomValues for CSPRNG output
 * @returns {Promise<string>} Hex string of 64 characters suitable for cookie/session use
 */
async function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);

  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get allowed CORS origin from request header or default to moliam domains
 * @param {Request} request - Cloudflare Pages Request object with headers
 * @returns {string} Origin string for Access-Control-Allow-Origin header
 */
function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) {
    return origin;
  }

  return "https://moliam.pages.dev";
}

/**
 * Generate CORS preflight response for OPTIONS requests with standard headers
 * Returns 204 No Content as per CORS specification
 * @param {number} status - HTTP status code (always 204 for OPTIONS)
 * @returns {Response} Empty response with Access-Control headers
 */
function corsResponse(status) {
  return new Response(null, {
    status,
    headers: {
        "Access-Control-Allow-Origin": "https://moliam.pages.dev",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
      }
  });
}

/**
 * Create consistent JSON response with headers for success/error responses
 * Wraps standard Response with automatic Content-Type and CORS header addition
 * @param {number} status - HTTP status code (200, 400, 401, etc.)
 * @param {object} body - Response payload object (success/error flags)
 * @returns {Response} JSON Response with application/json content type
 */
function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://moliam.pages.dev",
        "Access-Control-Allow-Credentials": "true",
      }
  });
}
