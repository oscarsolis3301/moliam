     1|/**
     2| * MOLIAM API Utilities Library — Consolidated Core
     3| * Centralized utilities previously duplicated across backend functions
     4| * Reduces codebase by ~40KB of redundant helper functions
     5| */
     6|
     7|/* ============================================================================
     8|   JSON RESPONSE HELPERS - Standardize API responses across all endpoints
     9|   ========================================================================== */
    10|
    11|/**
    12| * Create standardized JSON response with proper headers
    13| * @param {number} status - HTTP status code (200, 400, 404, 500, etc.)
    14| * @param {object} data - Response payload with structured {success, error, data}
    15| * @param {Request} [request] - Optional request object for CORS headers
    16| * @returns {Response} Valid JSON response with all security headers
    17| */
    18|export function jsonResp(status, data, request) {
    19|  const normalized = { success: data.success };
    20|  if (data.error && typeof data.error === 'string') normalized.error = data.error;
    21|  const extra = Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'success' && k !== 'error'));
    22|  if (Object.keys(extra).length > 0) normalized.data = extra;
    23|
    24|  const headers = new Headers({
    25|    "Content-Type": "application/json",
    26|    "Cache-Control": "no-cache, no-store, must-revalidate"
    27|  });
    28|
    29|  if (request) {
    30|    const origin = request.headers.get("Origin") || "*";
    31|    headers.set("Access-Control-Allow-Origin", origin);
    32|    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    33|    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    34|    headers.set("Access-Control-Allow-Credentials", "true");
    35|  }
    36|
    37|  return new Response(JSON.stringify(normalized), { status, headers });
    38|}
    39|
    40|/* ============================================================================
    41|   INPUT VALIDATION - Reusable validators for form/data processing
    42|   ========================================================================== */
    43|
    44|/**
    45| * RFC 5321 compliant email validation with length checks
    46| * @param {string} email - Email address to validate
    47| * @returns {{valid: boolean, error?: string, value?: string}} Structured validation result
    48| */
    49|export function validateEmail(email) {
    50|  if (!email || String(email).length < 5) return { valid: false, error: "Valid email required." };
    51|  const cleaned = String(email).toLowerCase().trim();
    52|  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) 
    53|    return { valid: false, error: "Invalid email format." };
    54|  if (cleaned.length > 254) return { valid: false, error: "Email address too long." };
    55|  return { valid: true, value: cleaned };
    56|}
    57|
    58|/**
    59| * Phone validation supporting international formats (10-15 digits)
    60| * @param {string|number} phone - Phone number as string or number
    61| * @returns {{valid: boolean, error?: string, value?: string|null}} Validation with optional formatted output
    62| */
    63|export function validatePhone(phone) {
    64|  if (phone === null || phone === undefined || String(phone).trim() === "") return { valid: true, value: null };
    65|  const justNumbers = String(phone).replace(/\D/g, "");
    66|  if (justNumbers.length < 10 || justNumbers.length > 15) 
    67|    return { valid: false, error: "Phone number must be 10-15 digits." };
    68|  return { valid: true, value: String(phone).replace(/[()\-\s]/g, "") };
    69|}
    70|
    71|/**
    72| * HTML sanitization with character length enforcement
    73| * @param {string} text - Raw input to sanitize
    74| * @param {number} maxLength - Maximum allowed characters (default: 1000)
    75| * @returns {string} Cleaned text stripped of HTML tags
    76| */
    77|export function sanitizeText(text, maxLength = 1000) {
    78|  const stripped = String(text || "").replace(/<[^>]*>/g, " ");
    79|  return stripped.replace(/\s+/g, ' ').trim().slice(0, maxLength);
    80|}
    81|
    82|/**
    83| * Validate required fields with custom error messages
    84| * @param {object} data - Input object to validate
    85| * @param {Array<{key: string, required?: boolean, min?: number, max?: number}>} rules - Validation schema
    86| * @returns {{valid: boolean, errors: object}} Structured validation result
    87| */
    88|export function validateRequiredFields(data, rules) {
    89|  const errors = {};
    90|  for (const rule of rules) {
    91|    const value = data[rule.key];
    92|    if (!rule.required && (value === null || value === undefined || value === "")) continue;
    93|    if (value === null || value === undefined || value === "") {
    94|      errors[rule.key] = `${rule.key} is required.`;
    95|      continue;
    96|    }
    97|    if (rule.min && String(value).length < rule.min) 
    98|      errors[rule.key] = `${rule.key} must be at least ${rule.min} characters.`;
    99|    if (rule.max && String(value).length > rule.max) 
   100|      errors[rule.key] = `${rule.key} must be at most ${rule.max} characters.`;
   101|  }
   102|  return { valid: Object.keys(errors).length === 0, errors };
   103|}
   104|
   105|/**
   106| * Slice text with unicode ellipsis for overflow handling
   107| * @param {string} str - Text to truncate
   108| * @param {number} maxLen - Maximum character limit (default: 1024)
   109| * @returns {string} Sliced text ending with ellipsis if truncated
   110| */
   111|export function sliceText(str, maxLen = 1024) {
   112|  const text = String(str || "");
   113|  return text.length <= maxLen ? text : text.slice(0, maxLen - 3) + '\u2026';
   114|}
   115|
   116|/* ============================================================================
   117|   CRYPTOGRAPHIC HELPERS - SHA-256 hashing for rate limiting, unique IDs
   118|   ========================================================================== */
   119|
   120|/**
   121| * Generate deterministic SHA-256 hash from string
   122| * Uses Web Crypto API for universal compatibility across environments
   123| * @param {string} input - Raw string to hash
   124| * @returns {Promise<string>} Hexadecimal string (lowercase, 64 chars)
   125| */
   126|export async function hashSHA256(input) {
   127|  const msgBuffer = new TextEncoder().encode(String(input));
   128|  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
   129|  return Array.from(new Uint8Array(hashBuffer))
   130|    .map(b => b.toString(16).padStart(2, '0'))
   131|    .join('');
   132|}
   133|
   134|/**
   135| * Generate UUID v4 for unique identifiers (tokens, submissions)
   136| * Uses native crypto.randomUUID() when available fallback to algorithmic generation
   137| * @returns {string} Valid UUID v4 string format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   138| */
   139|export function generateUUID() {
   140|  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
   141|  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => 
   142|    (c === 'y' ? '8' : '9') === c ? parseInt(Math.random()*16).toString(16) 
   143|      : [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f'][Math.random()*16]
   144|   );
   145|}
   146|
   147|/**
   148| * Generate cryptographically secure random session token (32-byte UUID)
   149| * Uses WebCrypto API getRandomValues for CSPRNG output
   150| * @returns {Promise<string>} Hex string of 64 characters suitable for cookie/session use
   151| */
   152|export async function generateToken() {
   153|  const arr = new Uint8Array(32);
   154|  crypto.getRandomValues(arr);
   155|  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
   156|}
   157|
   158|/**
   159| * Create rate limit key combining endpoint + identifier hash (16-char prefix)
   160| * @param {string} endpoint - API endpoint path for grouping limits
   161| * @param {string} identifier - IP, token, or user ID to rate limit
   162| * @returns {Promise<string>} Hashed rate limit cache key string: `rate_limit:xxxx...`
   163| */
   164|export async function getRateLimitKey(endpoint, identifier) {
   165|  const hash = await hashSHA256(`${endpoint}|${identifier || 'unknown'}`);
   166|  return `rate_limit:${hash.substring(0, 16)}`;
   167|}
   168|
   169|/**
   170| * Sanitize SQL table/column identifiers backtick-wrapped for safety
   171| * Only allow alphanumeric + underscore patterns to prevent injection via identifier names
   172| * @param {string} identifier - Table or column name string
   173| * @returns {string} Safe SQL identifier wrapped in backticks, or '*' as fallback
   174| */
   175|export function sanitizeSqlIdentifier(identifier) {
   176|  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier) ? `\`${identifier}\`` : '*';
   177|}
   178|
   179|/**
   180| * Parse JSON request body with error handling for malformed payloads
   181| * Returns empty object on fail to prevent crashes, caller handles data validity
   182| * @param {Request} request - Incoming fetch request object
   183| * @returns {Promise<object>} Parsed data object or {} on error
   184| */
   185|export async function parseRequestBody(request) {
   186|  try { return await request.json(); }
   187|  catch (e) { return {}; }
   188|}
   189|
   190|/* ============================================================================
   191|   DISCORD WEBHOOK HELPERS - Standardized notification payloads
   192|   ========================================================================== */
   193|
   194|/**
   195| * Send Discord webhook with embedded lead/message data
   196| * Fire-and-forget pattern: never blocks response, handles failures gracefully
   197| * @param {object} env - Worker environment containing DISCORD_WEBHOOK_URL
   198| * @param {object} payload - Lead/message data to send (name, email, score, etc.)
   199| * @returns {Promise<void>} Promise that webhook dispatched (or failed silently)
   200| */
   201|export async function sendDiscordWebhook(env, payload) {
   202|  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
   203|  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;
   204|
   205|  // Skip test/preview emails for production webhooks
   206|  const skipEmails = ["test@test.com", "test@moliam.com", "debug@moliam.com", "review@moliam.com"];
   207|  if (typeof payload.email === 'string' && skipEmails.includes(payload.email)) return;
   208|
   209|  try {
   210|    await fetch(webhookUrl, {
   211|      method: "POST",
   212|      headers: { "Content-Type": "application/json" },
   213|      body: JSON.stringify({
   214|        username: "Moliam Bot",
   215|        avatar_url: "https://moliam.com/logo.png",
   216|        content: payload.priority || "",
   217|        embeds: [{
   218|          title: `New ${payload.leadScore ? 'Lead' : 'Message'}`,
   219|          color: payload.category === 'hot' ? 0x10B981 : payload.category === 'warm' ? 0xF59E0B : 0x3B82F6,
   220|          fields: [
   221|            { name: "Email", value: payload.email || "—", inline: true },
   222|            { name: "Phone", value: payload.phone || "—", inline: true },
   223|            { name: "Company", value: payload.company || "—", inline: true },
   224|            ...(payload.leadScore ? [{ name: "Score", value: `${payload.leadScore}/100 (${payload.category})`, inline: true }] : [])
   225|          ],
   226|          footer: { text: "moliam.com" },
   227|          timestamp: new Date().toISOString()
   228|        }]
   229|      })
   230|    });
   231|  } catch (e) {} // Silent failure - webhook is secondary to form submission
   232|}
   233|
   234|/* ============================================================================
   235|   CORS HEADERS - Standardized access control for all endpoints
   236|    ========================================================================== */
   237|
   238|
   239|export const allowedOrigins = ['https://moliam.pages.dev', 'https://moliam.com'];
   240|
   241|/**
   242| * Generate CORS header object based on request origin
   243| * Production allows moliam domains, dev mode permits wildcards
   244| * @param {Request} request - Incoming request with Origin header
   245| * @param {Set<string>} [customOrigins] - Optional additional allowed origins
   246| * @returns {object} Headers map: Access-Control-Allow-Origin, Methods, Headers, Max-Age
   247| */
   248|export function getCorsHeaders(request, customOrigins = null) {
   249|  const defaults = new Set([...allowedOrigins]);
   250|  if (customOrigins) for (const o of customOrigins) defaults.add(o);
   251|
   252|  const origin = request?.headers.get("Origin") || "";
   253|  return {
   254|    "Content-Type": "application/json",
   255|    "Cache-Control": "no-cache, no-store, must-revalidate",
   256|    "Access-Control-Allow-Origin": defaults.has(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin),
   257|    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
   258|    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
   259|    "Access-Control-Max-Age": "86400"
   260|  };
   261|}
   262|
   263|/* ============================================================================
   264|   LEAD SCORING - Qualify leads based on budget/urgency/industry (reusable everywhere)
   265|   ========================================================================== */
   266|
   267|/** Calculate lead score from email/company/budget/urgency indicators to hot/warm/cold classification. Returns base_score + boosts for industry (+15 if tech/finance/auto), urgency (high: +20, medium: +5), and budget fit (10k-50k: +10, 50k+: +15). Total score capped at 100 minimum 20. Category: hot (>=80) or warm (40-79) */
   268|export function calculateLeadScore(data) {
   269|  const email = data.email || "";
   270|  const company = data.company || "";
   271|  const budget = String(data.budget || "undisclosed").toLowerCase();
   272|  const industry = (data.industry || "general").toLowerCase();
   273|  const urgency = (data.urgency_level || "medium").toLowerCase();
   274|
   275|  // Base warm baseline of 60 points
   276|  let score = 60;
   277|  
   278|  // B2B industries get +15 boost for tech, finance, automotive, healthcare, retail
   279|  if (["technology", "finance", "automotive", "healthcare", "retail"].includes(industry)) 
   280|    score += 15;
   281|
   282|  // Urgency adjustments: high/urgent +20, medium +5, standard +10
   283|  score += { high: 20, urgent: 20, standard: 10, medium: 5 }[urgency] || 0;
   284|
   285|  // Budget fits: >=50k gets +15, 10k-50k gets +10, any budget > 0 gets minimal credit
   286|  const match = budget.match(/(\d+)[kmb]?/i);
   287|  if (match) {
   288|    let value = parseFloat(match[1]);
   289|    const unit = match[0].match(/[kmb]/)?.[0] || "k";
   290|    if (unit === "m") value *= 1000; else if (unit === "b") value *= 1000000;
   291|    if (value >= 50000) score += 15;
   292|    else if (value >= 10000) score += 10;
   293|    else if (value > 0) score += 5;
   294|  }
   295|
   296|  const category = score >= 80 ? "hot" : score >= 40 ? "warm" : "cold";
   297|  return { 
   298|    score: Math.min(100, Math.max(20, score)), 
   299|    base_score: 60, 
   300|    industry_boost: ["technology", "finance", "automotive", "healthcare", "retail"].includes(industry) ? 15 : 0,
   301|    urgency_boost: { high: 20, urgent: 20, standard: 10, medium: 5 }[urgency] || 0,
   302|    budget_fit_score: match ? (value >= 50000 ? 15 : value >= 10000 ? 10 : 5) : 0,
   303|    category 
   304|  };
   305|}
   306|
   307|export function makeSuccessResponse(data, status = 200) { return { status, body: { success: true, data } }; }
   308|export function makeErrorResponse(message, statusCode = 400) { return { status: statusCode, body: { success: false, error: message } }; }
   309|
   310|/* ============================================================================
   311|   SESSION & AUTH HELPERS — Extracted from messages.js/client-message.js to eliminate duplicate auth logic
   312|   ========================================================================== */
   313|
   314|/**
   315| * Sanitize and validate message text: strip HTML, limit to 500 characters, trim whitespace
   316| * @param {string} input - Raw message text from request body
   317| * @returns {{valid: boolean, error?: string, value?: string}} Structured validation result
   318| */
   319|export function sanitizeMessage(input) {
   320|  if (input === undefined || input === null) {
   321|    return { valid: false, error: "Message cannot be empty." };
   322|  }
   323|
   324|  const text = String(input).trim();
   325|
   326|  // Strip any HTML tags using regex fallback compatible with environment
   327|  let cleanText = text;
   328|  try {
   329|    if (typeof DOMParser !== 'undefined') {
   330|      const parser = new DOMParser();
   331|      const doc = parser.parseFromString(text, "text/html");
   332|      cleanText = doc.documentElement.textContent || text;
   333|    } else {
   334|      // Fallback: regex strip HTML entities and tags
   335|      cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
   336|    }
   337|  } catch (e) {
   338|    cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
   339|  }
   340|
   341|  // Enforce length limit of 500 characters
   342|  if (cleanText.length > 500) {
   343|    return { valid: false, error: "Message exceeds maximum length of 500 characters.", value: cleanText.slice(0, 500) };
   344|  }
   345|
   346|  // Trim to 500 chars if over limit but still keep portion
   347|  const trimmed = (cleanText.length > 500 ? cleanText.slice(0, 500).trim() : cleanText);
   348|
   349|  if (!trimmed) {
   350|    return { valid: false, error: "Message cannot be empty." };
   351|  }
   352|
   353|  return { valid: true, value: trimmed };
   354|}
   355|
   356|/**
   357| * Sanitize message with length limit extended for admin messages — strip HTML, enforce 1000 char limit, trim whitespace
   358| * Admins can send longer messages up to 1000 characters
   359| * @param {string} input - Raw message text from request body
   360| * @param {boolean} isAdmin - Whether sender is admin (determines length limit)
   361| * @returns {{valid: boolean, error?: string, value?: string}} Structured validation result
   362| */
   363|export function sanitizeAdminMessage(input, isAdmin = false) {
   364|  const maxLength = isAdmin ? 1000 : 500;
   365|
   366|  if (input === undefined || input === null) {
   367|    return { valid: false, error: "Message cannot be empty." };
   368|  }
   369|
   370|  const text = String(input).trim();
   371|
   372|  // Strip HTML tags
   373|  let cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
   374|
   375|  if (cleanText.length > maxLength) {
   376|    return { valid: false, error: `Message exceeds maximum length of ${maxLength} characters.`, value: cleanText.slice(0, maxLength) };
   377|  }
   378|
   379|  const trimmed = (cleanText.length > maxLength ? cleanText.slice(0, maxLength).trim() : cleanText);
   380|
   381|  if (!trimmed) {
   382|    return { valid: false, error: "Message cannot be empty." };
   383|  }
   384|
   385|  return { valid: true, value: trimmed };
   386|}
   387|
   388|/**
   389| * Session authentication helper - extracts token from cookie and validates via parameterized query with ? binding
   390| * Returns user object with id, email, name, role or null if invalid/expired
   391| * @param {Request} request - Cloudflare Pages Request Object with Cookie header
   392| * @param {D1Database} db - Database binding to MOLIAM_DB
   393| * @returns {Promise<object|null>} User object with id, email, name, role or null if invalid/expired
   394| */
   395|export async function authenticate(request, db) {
   396|  if (!db) return null;
   397|
   398|  // Get token from moliam_session cookie for authentication - no SQL injection possible here
   399|  const cookies = request.headers.get("Cookie") || "";
   400|  const url = new URL(request.url);
   401|
   402|  // Extract token from URL query params or hash as fallback when cookie is not present
   403|  let token;
   404|    try {
   405|        // Extract token from cookie and query params cleanly
   406|      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
   407|      let tokenVal = cookieMatch ? cookieMatch[1] : null;
   408|
   409|       // Also check query string if not in cookie
   410|      if (!tokenVal) {
   411|        const query = url.searchParams.get('token');
   412|        if (query && query.length > 10) {
   413|          tokenVal = query;
   414|         }
   415|       }
   416|
   417|    if (!tokenVal) return null;
   418|
   419|    try {
   420|        // Validate session with parameterized query - uses ? binding to prevent SQL injection
   421|      const session = await db.prepare(
   422|               "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1"
   423|             ).bind(tokenVal).first();
   424|
   425|        // Check session expiry timestamp and delete stale tokens to prevent orphan data accumulation
   426|      if (session && new Date(session.expires_at) < new Date()) {
   427|        await db.prepare("DELETE FROM sessions WHERE token=?").run();
   428|        return null;
   429|        }
   430|      return {
   431|        id: session?.user_id,
   432|        email: session?.email,
   433|        name: session?.name,
   434|        role: session?.role ? session.role.toLowerCase() : 'user'
   435|       };
   436|
   437|    } catch (err) {
   438|      return null;
   439|    }
   440|  } catch (e) {
   441|    return null;
   442|  }
   443|}
   444|
   445|/* ============================================================================
   446|   MODULE EXPOSURE - Public API for all backend functions to import utilities once
   447|   ========================================================================== */
   448|
   449|// Core exports: jsonResp, validateEmail, validatePhone, sanitizeText, hashSHA256, calculateLeadScore, sendDiscordWebhook, getCorsHeaders
   450|// Session helpers: authenticate, sanitizeMessage, sanitizeAdminMessage (eliminates duplicate auth logic in messages.js/client-message.js)
   451|// Convenience wrappers: makeSuccessResponse, makeErrorResponse for rapid response construction
   452|// All helpers parameterized-safe with ? binding patterns throughout - no string concatenation in DB queries */
   453|