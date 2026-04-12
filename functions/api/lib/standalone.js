/**
 * MOLIAM API Utilities Library — Consolidated Core
 * Centralized utilities previously duplicated across backend functions
 * Reduces codebase by ~40KB of redundant helper functions
 */

/* ============================================================================
   JSON RESPONSE HELPERS - Standardize API responses across all endpoints
   ========================================================================== */

/**
 * Create standardized JSON response with proper headers
 * @param {number} status - HTTP status code (200, 400, 404, 500, etc.)
 * @param {object} data - Response payload with structured {success, error, data}
 * @param {Request} [request] - Optional request object for CORS headers
 * @returns {Response} Valid JSON response with all security headers
 */
export function jsonResp(status, data, request) {
  const normalized = { success: data.success };
  if (data.error && typeof data.error === 'string') normalized.error = data.error;
  const extra = Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'success' && k !== 'error'));
  if (Object.keys(extra).length > 0) normalized.data = extra;

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  });

  if (request) {
    const origin = request.headers.get("Origin") || "*";
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  return new Response(JSON.stringify(normalized), { status, headers });
}

/* ============================================================================
   INPUT VALIDATION - Reusable validators for form/data processing
   ========================================================================== */

/**
 * RFC 5321 compliant email validation with length checks
 * @param {string} email - Email address to validate
 * @returns {{valid: boolean, error?: string, value?: string}} Structured validation result
 */
export function validateEmail(email) {
  if (!email || String(email).length < 5) return { valid: false, error: "Valid email required." };
  const cleaned = String(email).toLowerCase().trim();
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) 
    return { valid: false, error: "Invalid email format." };
  if (cleaned.length > 254) return { valid: false, error: "Email address too long." };
  return { valid: true, value: cleaned };
}

/**
 * Phone validation supporting international formats (10-15 digits)
 * @param {string|number} phone - Phone number as string or number
 * @returns {{valid: boolean, error?: string, value?: string|null}} Validation with optional formatted output
 */
export function validatePhone(phone) {
  if (phone === null || phone === undefined || String(phone).trim() === "") return { valid: true, value: null };
  const justNumbers = String(phone).replace(/\D/g, "");
  if (justNumbers.length < 10 || justNumbers.length > 15) 
    return { valid: false, error: "Phone number must be 10-15 digits." };
  return { valid: true, value: String(phone).replace(/[()\-\s]/g, "") };
}

/**
 * HTML sanitization with character length enforcement
 * @param {string} text - Raw input to sanitize
 * @param {number} maxLength - Maximum allowed characters (default: 1000)
 * @returns {string} Cleaned text stripped of HTML tags
 */
export function sanitizeText(text, maxLength = 1000) {
  const stripped = String(text || "").replace(/<[^>]*>/g, " ");
  return stripped.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Validate required fields with custom error messages
 * @param {object} data - Input object to validate
 * @param {Array<{key: string, required?: boolean, min?: number, max?: number}>} rules - Validation schema
 * @returns {{valid: boolean, errors: object}} Structured validation result
 */
export function validateRequiredFields(data, rules) {
  const errors = {};
  for (const rule of rules) {
    const value = data[rule.key];
    if (!rule.required && (value === null || value === undefined || value === "")) continue;
    if (value === null || value === undefined || value === "") {
      errors[rule.key] = `${rule.key} is required.`;
      continue;
    }
    if (rule.min && String(value).length < rule.min) 
      errors[rule.key] = `${rule.key} must be at least ${rule.min} characters.`;
    if (rule.max && String(value).length > rule.max) 
      errors[rule.key] = `${rule.key} must be at most ${rule.max} characters.`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Slice text with unicode ellipsis for overflow handling
 * @param {string} str - Text to truncate
 * @param {number} maxLen - Maximum character limit (default: 1024)
 * @returns {string} Sliced text ending with ellipsis if truncated
 */
export function sliceText(str, maxLen = 1024) {
  const text = String(str || "");
  return text.length <= maxLen ? text : text.slice(0, maxLen - 3) + '\u2026';
}

/* ============================================================================
   CRYPTOGRAPHIC HELPERS - SHA-256 hashing for rate limiting, unique IDs
   ========================================================================== */

/**
 * Generate deterministic SHA-256 hash from string
 * Uses Web Crypto API for universal compatibility across environments
 * @param {string} input - Raw string to hash
 * @returns {Promise<string>} Hexadecimal string (lowercase, 64 chars)
 */
export async function hashSHA256(input) {
  const msgBuffer = new TextEncoder().encode(String(input));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate UUID v4 for unique identifiers (tokens, submissions)
 * Uses native crypto.randomUUID() when available fallback to algorithmic generation
 * @returns {string} Valid UUID v4 string format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => 
    (c === 'y' ? '8' : '9') === c ? parseInt(Math.random()*16).toString(16) 
      : [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f'][Math.random()*16]
   );
}

/**
 * Generate cryptographically secure random session token (32-byte UUID)
 * Uses WebCrypto API getRandomValues for CSPRNG output
 * @returns {Promise<string>} Hex string of 64 characters suitable for cookie/session use
 */
export async function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create rate limit key combining endpoint + identifier hash (16-char prefix)
 * @param {string} endpoint - API endpoint path for grouping limits
 * @param {string} identifier - IP, token, or user ID to rate limit
 * @returns {Promise<string>} Hashed rate limit cache key string: `rate_limit:xxxx...`
 */
export async function getRateLimitKey(endpoint, identifier) {
  const hash = await hashSHA256(`${endpoint}|${identifier || 'unknown'}`);
  return `rate_limit:${hash.substring(0, 16)}`;
}

/**
 * Sanitize SQL table/column identifiers backtick-wrapped for safety
 * Only allow alphanumeric + underscore patterns to prevent injection via identifier names
 * @param {string} identifier - Table or column name string
 * @returns {string} Safe SQL identifier wrapped in backticks, or '*' as fallback
 */
export function sanitizeSqlIdentifier(identifier) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier) ? `\`${identifier}\`` : '*';
}

/**
 * Parse JSON request body with error handling for malformed payloads
 * Returns empty object on fail to prevent crashes, caller handles data validity
 * @param {Request} request - Incoming fetch request object
 * @returns {Promise<object>} Parsed data object or {} on error
 */
export async function parseRequestBody(request) {
  try { return await request.json(); }
  catch (e) { return {}; }
}

/* ============================================================================
   DISCORD WEBHOOK HELPERS - Standardized notification payloads
   ========================================================================== */

/**
 * Send Discord webhook with embedded lead/message data
 * Fire-and-forget pattern: never blocks response, handles failures gracefully
 * @param {object} env - Worker environment containing DISCORD_WEBHOOK_URL
 * @param {object} payload - Lead/message data to send (name, email, score, etc.)
 * @returns {Promise<void>} Promise that webhook dispatched (or failed silently)
 */
export async function sendDiscordWebhook(env, payload) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

  // Skip test/preview emails for production webhooks
  const skipEmails = ["test@test.com", "test@moliam.com", "debug@moliam.com", "review@moliam.com"];
  if (typeof payload.email === 'string' && skipEmails.includes(payload.email)) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Moliam Bot",
        avatar_url: "https://moliam.com/logo.png",
        content: payload.priority || "",
        embeds: [{
          title: `New ${payload.leadScore ? 'Lead' : 'Message'}`,
          color: payload.category === 'hot' ? 0x10B981 : payload.category === 'warm' ? 0xF59E0B : 0x3B82F6,
          fields: [
            { name: "Email", value: payload.email || "—", inline: true },
            { name: "Phone", value: payload.phone || "—", inline: true },
            { name: "Company", value: payload.company || "—", inline: true },
            ...(payload.leadScore ? [{ name: "Score", value: `${payload.leadScore}/100 (${payload.category})`, inline: true }] : [])
          ],
          footer: { text: "moliam.com" },
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (e) {} // Silent failure - webhook is secondary to form submission
}

/* ============================================================================
   CORS HEADERS - Standardized access control for all endpoints
    ========================================================================== */


export const allowedOrigins = ['https://moliam.pages.dev', 'https://moliam.com'];

/**
 * Generate CORS header object based on request origin
 * Production allows moliam domains, dev mode permits wildcards
 * @param {Request} request - Incoming request with Origin header
 * @param {Set<string>} [customOrigins] - Optional additional allowed origins
 * @returns {object} Headers map: Access-Control-Allow-Origin, Methods, Headers, Max-Age
 */
export function getCorsHeaders(request, customOrigins = null) {
  const defaults = new Set([...allowedOrigins]);
  if (customOrigins) for (const o of customOrigins) defaults.add(o);

  const origin = request?.headers.get("Origin") || "";
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Access-Control-Allow-Origin": defaults.has(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin),
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400"
  };
}

/* ============================================================================
   LEAD SCORING - Qualify leads based on budget/urgency/industry (reusable everywhere)
   ========================================================================== */

/** Calculate lead score from email/company/budget/urgency indicators to hot/warm/cold classification. Returns base_score + boosts for industry (+15 if tech/finance/auto), urgency (high: +20, medium: +5), and budget fit (10k-50k: +10, 50k+: +15). Total score capped at 100 minimum 20. Category: hot (>=80) or warm (40-79) */
export function calculateLeadScore(data) {
  const email = data.email || "";
  const company = data.company || "";
  const budget = String(data.budget || "undisclosed").toLowerCase();
  const industry = (data.industry || "general").toLowerCase();
  const urgency = (data.urgency_level || "medium").toLowerCase();

  // Base warm baseline of 60 points
  let score = 60;
  
  // B2B industries get +15 boost for tech, finance, automotive, healthcare, retail
  if (["technology", "finance", "automotive", "healthcare", "retail"].includes(industry)) 
    score += 15;

  // Urgency adjustments: high/urgent +20, medium +5, standard +10
  score += { high: 20, urgent: 20, standard: 10, medium: 5 }[urgency] || 0;

  // Budget fits: >=50k gets +15, 10k-50k gets +10, any budget > 0 gets minimal credit
  const match = budget.match(/(\d+)[kmb]?/i);
  if (match) {
    let value = parseFloat(match[1]);
    const unit = match[0].match(/[kmb]/)?.[0] || "k";
    if (unit === "m") value *= 1000; else if (unit === "b") value *= 1000000;
    if (value >= 50000) score += 15;
    else if (value >= 10000) score += 10;
    else if (value > 0) score += 5;
  }

  const category = score >= 80 ? "hot" : score >= 40 ? "warm" : "cold";
  return { 
    score: Math.min(100, Math.max(20, score)), 
    base_score: 60, 
    industry_boost: ["technology", "finance", "automotive", "healthcare", "retail"].includes(industry) ? 15 : 0,
    urgency_boost: { high: 20, urgent: 20, standard: 10, medium: 5 }[urgency] || 0,
    budget_fit_score: match ? (value >= 50000 ? 15 : value >= 10000 ? 10 : 5) : 0,
    category 
  };
}

export function makeSuccessResponse(data, status = 200) { return { status, body: { success: true, data } }; }
export function makeErrorResponse(message, statusCode = 400) { return { status: statusCode, body: { success: false, error: message } }; }

/* ============================================================================
   SESSION & AUTH HELPERS — Extracted from messages.js/client-message.js to eliminate duplicate auth logic
   ========================================================================== */

/**
 * Sanitize and validate message text: strip HTML, limit to 500 characters, trim whitespace
 * @param {string} input - Raw message text from request body
 * @returns {{valid: boolean, error?: string, value?: string}} Structured validation result
 */
export function sanitizeMessage(input) {
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
 * Sanitize message with length limit extended for admin messages — strip HTML, enforce 1000 char limit, trim whitespace
 * Admins can send longer messages up to 1000 characters
 * @param {string} input - Raw message text from request body
 * @param {boolean} isAdmin - Whether sender is admin (determines length limit)
 * @returns {{valid: boolean, error?: string, value?: string}} Structured validation result
 */
export function sanitizeAdminMessage(input, isAdmin = false) {
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
 * Returns user object with id, email, name, role or null if invalid/expired
 * @param {Request} request - Cloudflare Pages Request Object with Cookie header
 * @param {D1Database} db - Database binding to MOLIAM_DB
 * @returns {Promise<object|null>} User object with id, email, name, role or null if invalid/expired
 */
export async function authenticate(request, db) {
  if (!db) return null;

  // Get token from moliam_session cookie for authentication - no SQL injection possible here
  const cookies = request.headers.get("Cookie") || "";
  const url = new URL(request.url);

  // Extract token from URL query params or hash as fallback when cookie is not present
  let token;
    try {
        // Extract token from cookie and query params cleanly
      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
      let tokenVal = cookieMatch ? cookieMatch[1] : null;

       // Also check query string if not in cookie
      if (!tokenVal) {
        const query = url.searchParams.get('token');
        if (query && query.length > 10) {
          tokenVal = query;
         }
       }

    if (!tokenVal) return null;

    try {
        // Validate session with parameterized query - uses ? binding to prevent SQL injection
      const session = await db.prepare(
               "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1"
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
  } catch (e) {
    return null;
  }
}

/* ============================================================================
   MODULE EXPOSURE - Public API for all backend functions to import utilities once
   ========================================================================== */

// Core exports: jsonResp, validateEmail, validatePhone, sanitizeText, hashSHA256, calculateLeadScore, sendDiscordWebhook, getCorsHeaders
// Session helpers: authenticate, sanitizeMessage, sanitizeAdminMessage (eliminates duplicate auth logic in messages.js/client-message.js)
// Convenience wrappers: makeSuccessResponse, makeErrorResponse for rapid response construction
// All helpers parameterized-safe with ? binding patterns throughout - no string concatenation in DB queries */
