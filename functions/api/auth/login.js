     1|/**
     2| * Login API Endpoint
     3| * POST /api/auth/login
     4| * Authenticates user, creates session, sets cookie
     5| * @param {object} context - Cloudflare Pages function context with request and env
     6| * @returns {Response} JSON response with success/error status and authentication token
     7| */
     8|
     9|import { corsResponse, jsonResp, getAllowedOrigin, hashPassword, generateToken } from './api-helpers.js';
    10|
    11|export async function onRequestPost(context) {
    12|  const { request, env } = context;
    13|  const db = env.MOLIAM_DB;
    14|
    15|  // CORS preflight check for OPTIONS requests
    16|  if (request.method === "OPTIONS") return corsResponse(204);
    17|
    18|  let data;
    19|  try {
    20|    data = await request.json();
    21|  } catch {
    22|    return jsonResp(400, { success: false, error: true, message: "Invalid JSON." }, request);
    23|  }
    24|
    25|  const email = (data.email || "").toLowerCase().trim();
    26|  const password=*** || "");
    27|
    28|  if (!email || !password) {
    29|    return jsonResp(400, { success: false, error: true, message: "Email and password required." }, request);
    30|  }
    31|
    32|  // Input validation - sanitize email and password
    33|  if (email.length > 254) {
    34|    return jsonResp(400, { success: false, error: true, message: "Email address too long." }, request);
    35|  }
    36|
    37|  if (password.length < 6 || password.length > 128) {
    38|    return jsonResp(400, { success: false, error: true, message: "Password must be 6-128 characters." }, request);
    39|  }
    40|
    41|  try {
    42|     // Find user with parameterized query (no SQL injection risk) - uses ? binding
    43|    const user = await db.prepare(
    44|       "SELECT id, email, name, role, company, password_hash, is_active FROM users WHERE email=?"
    45|     ).bind(email).first();
    46|
    47|    if (!user) {
    48|      return jsonResp(401, { success: false, error: true, message: "Invalid email or password." }, request);
    49|    }
    50|
    51|    if (user.is_active === 0 || user.is_active === false) {
    52|      return jsonResp(403, { success: false, error: true, message: "Account disabled. Contact support." }, request);
    53|    }
    54|
    55|     // Verify password (SHA-256 based)
    56|    const hash = await hashPassword(password);
    57|    if (hash !== user.password_hash) {
    58|      return jsonResp(401, { success: false, error: true, message: "Invalid email or password." }, request);
    59|    }
    60|
    61|     // Create session token with expiration (7 days)
    62|    const token=*** generateToken();
    63|    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    64|    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    65|    const ua = request.headers.get("user-agent") || "";
    66|
    67|     // Save to sessions table with proper ? binding and token parameter - no SQL injection
    68|    await db.prepare(
    69|       "INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
    70|     ).bind(user.id, token, expiresAt, ip, ua).run();
    71|
    72|     // Update last login timestamp with parameterized query
    73|    await db.prepare(
    74|       "UPDATE users SET last_login=datetime('now') WHERE id=?"
    75|     ).bind(user.id).run();
    76|
    77|     // Set cookie + return user data with consistent success structure
    78|    const headers = new Headers({
    79|       "Content-Type": "application/json",
    80|       "Access-Control-Allow-Origin": getAllowedOrigin(request),
    81|       "Access-Control-Allow-Credentials": "true",
    82|       "X-Content-Type-Options": "nosniff",
    83|       "X-Frame-Options": "DENY"
    84|     });
    85|
    86|    headers.append("Set-Cookie",
    87|       `moliam_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    88|     );
    89|
    90|     // Normalize superadmin → admin for frontend routing
    91|    const displayRole = user.role === 'superadmin' ? 'admin' : user.role;
    92|
    93|    return new Response(JSON.stringify({
    94|      success: true,
    95|      data: {
    96|        id: user.id,
    97|        email: user.email,
    98|        name: user.name,
    99|        role: displayRole,
   100|        company: user.company,
   101|      }
   102|    }), { status: 200, headers });
   103|
   104|   } catch (err) {
   106|    return jsonResp(500, { success: false, error: true, message: "Server error. Try again." }, request);
   107|   }
   108|}
   109|
   110|/**
   111| * Handle CORS preflight for OAuth API endpoints via OPTIONS method - returns 204 No Content
   112| * @param {Request} request - Cloudflare Pages Request object (unused, standard signature)
   113| * @returns {Response} 204 No Content with proper Access-Control headers
   114| */
   115|export async function onRequestOptions() {
   116|  return corsResponse(204);
   117|}
   118|
   119|/**
   120| * Hash password with SHA-256 and fixed salt for storage comparison
   121| * @param {string} password - Raw user password from request body
   122| * @returns {Promise<string>} Hex string of hashed password (64 characters)
   123| */
   124|async function hashPassword(password) {
   125|  const buf = await crypto.subtle.digest("SHA-256",
   126|    new TextEncoder().encode(password + "_moliam_salt_2026")
   127|   );
   128|
   129|  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
   130|}
   131|
   132|/**
   133| * Generate cryptographically secure random session token (32-byte UUID)
   134| * Uses WebCrypto API getRandomValues for CSPRNG output
   135| * @returns {Promise<string>} Hex string of 64 characters suitable for cookie/session use
   136| */
   137|async function generateToken() {
   138|  const arr = new Uint8Array(32);
   139|  crypto.getRandomValues(arr);
   140|
   141|  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
   142|}
   143|
   144|/**
   145| * Get allowed CORS origin from request header or default to moliam domains
   146| * @param {Request} request - Cloudflare Pages Request object with headers
   147| * @returns {string} Origin string for Access-Control-Allow-Origin header
   148| */
   149|function getAllowedOrigin(request) {
   150|  const origin = request.headers.get("Origin") || "";
   151|  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) {
   152|    return origin;
   153|   }
   154|
   155|  return "https://moliam.pages.dev";
   156|}
   157|
   158|/**
   159| * Create consistent JSON response with headers for success/error responses
   160| * Wraps standard Response with automatic Content-Type and CORS header addition
   161| * @param {number} status - HTTP status code (200, 400, 401, etc.)
   162| * @param {object} body - Response payload object (success/error flags)
   163| * @param {Request|null} request - Optional Request object for origin detection
   164| * @returns {Response} JSON Response with application/json content type
   165| */
   166|function jsonResp(status, body, request = null) {
   167|  const headers = new Headers({
   168|     "Content-Type": "application/json",
   169|     "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
   170|     "Access-Control-Allow-Credentials": "true"
   171|   });
   172|
   173|  return new Response(JSON.stringify(body), { status, headers });
   174|}
   175|