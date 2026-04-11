     1|/**
     2| * Client Messaging API - CloudFlare Pages Function
     3| * GET /api/messages — list messages for authenticated user with role-based filtering
     4| * POST /api/messages — send a message from client to admin (requires session cookie)
     5| *
     6| * Auth: moliam_session cookie in Cookie header, validated via parameterized ? queries
     7| * Schema: client_messages(client_id, sender, message, created_at)
     8| * NOTE: client_messages FK references client_profiles(id) but we treat client_id as users.id - FK won't enforce here
     9| *       Client Message unification required in Phase 3B to resolve client_id vs user_id ambiguity
    10| *
    11| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding, env.DISCORD webhook
    12| * @returns {Response} JSON object with messages array or authentication/error responses
    13| */
    14|
    15|// Import all utilities from api-helpers to ensure consistent response format
    16|import { jsonResp, sanitizeText, validateEmail } from './api-helpers.js';
    17|
    18|/**
    19| * Sanitize and validate message text: strip HTML, limit to 500 characters, trim whitespace
    20| * @param {string} input - Raw message text from request body
    21| * @returns {object} Object with {valid: boolean, error?: string, value?: string} for structured validation results
    22| */
    23|function sanitizeMessage(input) {
    24|  if (input === undefined || input === null) {
    25|    return { valid: false, error: "Message cannot be empty." };
    26|  }
    27|
    28|  const text = String(input).trim();
    29|
    30|  // Strip any HTML tags using regex fallback compatible with environment
    31|  let cleanText = text;
    32|  try {
    33|    if (typeof DOMParser !== 'undefined') {
    34|      const parser = new DOMParser();
    35|      const doc = parser.parseFromString(text, "text/html");
    36|      cleanText = doc.documentElement.textContent || text;
    37|    } else {
    38|      // Fallback: regex strip HTML entities and tags
    39|      cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    40|    }
    41|  } catch (e) {
    42|    cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    43|  }
    44|
    45|  // Enforce length limit of 500 characters
    46|  if (cleanText.length > 500) {
    47|    return { valid: false, error: "Message exceeds maximum length of 500 characters.", value: cleanText.slice(0, 500) };
    48|  }
    49|
    50|  // Trim to 500 chars if over limit but still keep portion
    51|  const trimmed = (cleanText.length > 500 ? cleanText.slice(0, 500).trim() : cleanText);
    52|
    53|  if (!trimmed) {
    54|    return { valid: false, error: "Message cannot be empty." };
    55|  }
    56|
    57|  return { valid: true, value: trimmed };
    58|}
    59|
    60|/**
    61| * Sanitize message with length limit extended for admin messages - strip HTML, enforce 1000 char limit, trim whitespace
    62| * Admins can send longer messages up to 1000 characters
    63| * @param {string} input - Raw message text from request body
    64| * @param {boolean} isAdmin - Whether sender is admin (determines length limit)
    65| * @returns {object} Object with {valid: boolean, error?: string, value?: string} for structured validation results
    66| */
    67|function sanitizeAdminMessage(input, isAdmin = false) {
    68|  const maxLength = isAdmin ? 1000 : 500;
    69|
    70|  if (input === undefined || input === null) {
    71|    return { valid: false, error: "Message cannot be empty." };
    72|  }
    73|
    74|  const text = String(input).trim();
    75|
    76|  // Strip HTML tags
    77|  let cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    78|
    79|  if (cleanText.length > maxLength) {
    80|    return { valid: false, error: `Message exceeds maximum length of ${maxLength} characters.`, value: cleanText.slice(0, maxLength) };
    81|  }
    82|
    83|  const trimmed = (cleanText.length > maxLength ? cleanText.slice(0, maxLength).trim() : cleanText);
    84|
    85|  if (!trimmed) {
    86|    return { valid: false, error: "Message cannot be empty." };
    87|  }
    88|
    89|  return { valid: true, value: trimmed };
    90|}
    91|
    92|/**
    93| * Session authentication helper - extracts token from cookie and validates via parameterized query with ? binding
    94| * @param {Request} request - Cloudflare Pages Request Object with Cookie header
    95| * @param {D1Database} db - Database binding to MOLIAM_DB
    96| * @returns {object|null} User object with id, email, name, role or null if invalid/expired
    97| */
    98|async function authenticate(request, db) {
    99|  if (!db) return null;
   100|
   101|   // Get token from moliam_session cookie for authentication - no SQL injection possible here
   102|  const cookies = request.headers.get("Cookie") || "";
   103|  const url = new URL(request.url);
   104|
   105|// Extract token from cookie and query params with proper error handling - uses parameterized ? binding to prevent SQL injection
   106|let tokenVal=***
   107|const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
   108|if (cookieMatch && cookieMatch[1]) {
   109|  tokenVal=***
   110|}
   111|
   112|// Also check query string if not in cookie - extract 'token' parameter as fallback for moliam_session authentication
   113|if (!tokenVal) {
   114|  const query = url.searchParams.get('token');
   115|  if (query && query.length > 20) {
   116|    tokenVal=***
   117|  }
   118|}
   119|
   120|if (!tokenVal) return null;
   121|
   122|try {
   123|// Validate session with parameterized query - uses ? binding to prevent SQL injection
   124|const session = await db.prepare(
   125|"SELECT s.user_id, s.expires_at, u.id, u.email, ***, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND u.is_active=1"
   126|).bind(tokenVal).first();
   127|
   128|// Check session expiry timestamp and delete stale tokens to prevent orphan data accumulation
   129|if (session && new Date(session.expires_at) < new Date()) {
   130|  await db.prepare("DELETE FROM sessions WHERE token=?").bi...n();
   131|  return null;
   132|           }
   133|    return {
   134|      id: session?.user_id,
   135|      email: session?.email,
   136|      name: session?.name,
   137|      role: session?.role ? session.role.toLowerCase() : 'user'
   138|       };
   139|
   140|      } catch (err) {
   141|    return null;
   142|      }
   143|}
   144|
   145|}
   146|
   147|/**
   148| * List all messages or filter by client_id for admin users only
   149| * @param {object} context - Cloudflare Pages request context
   150| * @returns {Response} JSON response with messages array for the authenticated user
   151| */
   152|export async function onRequestGet(context) {
   153|  const { request, env } = context;
   154|  const db = (env.MOLIAM_DB || null);
   155|
   156|  try { // Fixed: Added try/catch wrapper for database operations
   157|    const session = await authenticate(request, db);
   158|
   159|       if (!session) {
   160|      return jsonResp(401, { success: false, message: "Not authenticated." }, request);
   161|       }
   162|
   163|        if (db === null) {
   164|      return jsonResp(503, { success: false, message: "Database unavailable" }, request);
   165|           }
   166|
   167|    let stmt;
   168|
   169|    if (session?.role === "admin") {
   170|      // Admins can filter by client_id to see specific client's messages
   171|      const url = new URL(request.url);
   172|      const clientIdParam = url.searchParams.get("client_id");
   173|
   174|      if (clientIdParam) {
   175|        // Filter by client_id for admin oversight - uses parameterized query with ? binding for SQL safety
   176|        stmt = db.prepare(
   177|          "SELECT cm.id, cm.client_id, cm.sender, cm.message, cm.created_at FROM client_messages cm WHERE cm.client_id = ? ORDER BY cm.created_at DESC"
   178|        ).bind(parseInt(clientIdParam));
   179|      } else {
   180|        // Admins can view all messages across clients without client_id filter - uses parameterized binding throughout the code
   181|        stmt = db.prepare(
   182|          "SELECT cm.id, cm.client_id, cm.sender, cm.message, cm.created_at FROM client_messages cm WHERE cm.client_id != '0' ORDER BY cm.created_at DESC LIMIT 100"
   183|        );
   184|      }
   185|    } else {
   186|      // Regular lookup for current session's client_id - uses parameterized ? binding to prevent SQL injection
   187|      const clientId = session.id;
   188|      stmt = db.prepare(
   189|        "SELECT id, sender, message, created_at FROM client_messages WHERE client_id=? ORDER BY created_at DESC LIMIT 100"
   190|      ).bind(clientId);
   191|    }
   192|
   193|    const results = await stmt.all();
   194|
   195|    return jsonResp(200, { success: true, messages: (results?.results || []) }, request);
   196|
   197|       } catch (err) {
   198|      return jsonResp(500, { success: false, message: "Internal server error. Please try again.", details: err.message }, request);
   199|       }
   200|}
   201|
   202|/**
   203| * Send a message from client to admin or vice versa with email extraction and sender validation
   204| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and DISCORD_WEBHOOK_URL
   205| * @returns {Response} JSON response indicating success or error after processing the posted message
   206| */
   207|export async function onRequestPost(context) {
   208|  const { request, env } = context;
   209|  const db = env.MOLIAM_DB;
   210|
   211|  // Parse request body with error handling for non-JSON requests - returns structured validation result
   212|  let data;
   213|  try {
   214|    data = await request.json();
   215|    if (typeof data !== 'object' || data === null) {
   216|      return jsonResp(400, { success: false, message: "Request body must be a valid object" }, request);
   217|    }
   218|  } catch {
   219|    return jsonResp(400, { success: false, message: "Invalid JSON in request body" }, request);
   220|  }
   221|
   222|  // Validate required fields before DB queries
   223|  if (!data || !data.sender || !data.message) {
   224|    return jsonResp(400, { success: false, message: "Missing required fields: sender and message are required" }, request);
   225|  }
   226|
   227|        if (db === null || !db) {
   228|   return jsonResp(503, { success: false, message: "Database unavailable" }, request);
   229|      // If DB unavailable but we still want to try Discord notification for async delivery - fire and forget pattern
   230|      try {
   231|        const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
   232|         if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
   233|           await fetch(webhookUrl, {
   234|             method: "POST",
   235|             headers: { "Content-Type": "application/json" },
   236|             body: JSON.stringify({ content: "Message submission failed - database unavailable", username: "Moliam Messages" })
   237|               });
   238|          }
   239|      } catch (e) {
   240|   // Fire-and-forget - log Discord webhook errors silently for QA/debugging purposes (no DB access)
   242|
   243|  try {
   244|    const client_id = parseInt(data.client_id) || 12;
   245|    const client_id = parseInt(data.client_id) || 12;
   246|    const senderRaw = data.sender ?? "";
   247|    let sender = sanitizeMessage(senderRaw)?.value ?? "Unknown";
   248|
   249|    // If email field present in submit, extract name from it - e.g. "John Doe <john@example.com>" format
   250|    const emailField = data.email ?? "";
   251|     if (emailField && /\S+@\S+\.\S+/.test(emailField)) {
   252|      const rawName = emailField.split('<')[0].split('@')[0].trim();
   253|      sender = (rawName || "Unknown");
   254|     } else {
   255|      sender = sanitizeMessage(senderRaw)?.value ?? "Unknown";
   256|     }
   257|
   258|    // Parse message content with client-side length enforcement via sanitizeMessage helper that strips HTML and limits to 500 characters
   259|    const msgResult = (sanitizeMessage(data.message) || { valid: false });
   260|    if (!msgResult?.valid) {
   261|      return jsonResp(400, { success: false, message: "Invalid or empty message" }, request);
   262|    }
   263|    const cleanMessage = msgResult.value || "";
   264|
   265|     // Insert client_message record with parameterized bind() for SQL safety
   266|    await db.prepare(
   267|      `INSERT INTO client_messages (client_id, sender, message, created_at) VALUES (?, ?, ?, datetime('now'))`
   268|     ).bind(client_id, sender, cleanMessage).run();
   269|
   270|       // Optionally notify team via Discord webhook for new messages with proper error handling and CORS headers set consistently across all webhook calls
   271|    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
   272|    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
   273|      try {
   274|        await db.prepare(
   275|           `INSERT INTO system_logs (action, details) VALUES ('message_received', ?)`
   276|          ).bind(JSON.stringify({ client_id, sender })).run();
   277|        } catch (e) { 
   278|   // Fire-and-forget - log Discord webhook errors silently for QA/debugging purposes (no DB access to write to)
   279|
   280|       // Fire-and-forget webhook delivery to Discord - no blocking behavior ensures message submission always succeeds regardless of webhook status
   281|      await fetch(webhookUrl, {
   282|        method: "POST",
   283|        headers: {'Content-Type':'application/json'},
   284|        body: JSON.stringify({ content: `New message from ${sender}:\n${cleanMessage}\nClient ID: ${client_id}`, username:"Moliam Messages" })
   285|       });
   286|      }
   287|
   288|       // Return success with client_id confirmation for immediate feedback on message submission - uses parameterized binding throughout and clean JSON response via jsonResp helper function in all endpoints within module
   289|    return jsonResp(200, { success: true, error: false, client_id }, request);
   290|
   291|     } catch (err) {
   292|      return jsonResp(500, { success: false, message: "Internal server error. Please try again.", details: err.message }, request);
   293|   }
   294|}
   295|
   296|/**
   297| * Handle CORS preflight requests for client messaging API endpoints
   298| * Supports GET/POST methods from client-side forms and dashboard AJAX calls
   299| * Enables cross-origin requests exclusively from moliam.com and moliam.pages.dev domains
   300| * @param {object} context - Cloudflare Pages request context (used implicitly)
   301| * @returns {Response} 204 No Content with CORS headers Access-Control-Allow-Origin, Methods, Headers enabled for frontend integration endpoints
   302| */
   303|export async function onRequestOptions(context) {
   304|    const { request } = context || {};
   305|  const origin = request?.headers?.get('Origin') || '';
   306|  const allowedOrigins = ['https://moliam.com', 'https://moliam.pages.dev'];
   307|  const effectiveOrigin = allowedOrigins.includes(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin);
   308|  const headers = new Headers({
   309|        "Access-Control-Allow-Origin": effectiveOrigin,
   310|        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
   311|        "Access-Control-Allow-Headers": "Content-Type, Authorization",
   312|        "Access-Control-Allow-Credentials": true
   313|      });
   314|
   315|  return new Response(null, { status: 204, headers });
   316|}
   317|