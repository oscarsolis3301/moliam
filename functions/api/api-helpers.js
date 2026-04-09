     1|/**
     2| * MOLIAM API Helpers Library — v3
     3| * Core utilities for consistent JSON responses, input validation, and error handling
     4| * All exported functions work across Cloudflare Pages Functions environments
     5| */
     6|
     7|/**
     8| * Create a standardized JSON response with proper headers
     9| * @param {number} status - HTTP status code (200, 400, 404, 500, etc.)
    10| * @param {object} data - Response payload object (success/error flags go here)
    11| * @param {Request} [request] - Optional request object for CORS headers
    12| * @param {Set<string>} [allowedOrigins] - Optional CORS origin set (defaults to moliam domains)
    13| * @returns {Response} properly formatted JSON response with all required headers
    14| */
    15|export function jsonResp(status, data, request, allowedOrigins = null) {
    16|  const defaultOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
    17|  if (allowedOrigins) for (const origin of allowedOrigins) defaultOrigins.add(origin);
    18|  
    19|  const headers = new Headers({
    20|    "Content-Type": "application/json",
    21|    "Cache-Control": "no-cache, no-store, must-revalidate"
    22|  });
    23|  
    24|  if (request) {
    25|    const origin = request.headers.get("Origin") || "*";
    26|    if (defaultOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
    27|    else headers.set("Access-Control-Allow-Origin", "*");
    28|    
    29|    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    30|    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    31|    headers.set("Access-Control-Max-Age", "86400");
    32|    headers.set("Vary", "Origin");
    33|  }
    34|  
    35|  return new Response(JSON.stringify(data), { status, headers });
    36|}
    37|
    38|/**
    39| * Validate email format with RFC 5321 compliance and length checks
    40| * @param {string} email - Email address to validate
    41| * @returns {{valid: boolean, error?: string, value?: string}} Validation result
    42| */
    43|export function validateEmail(email) {
    44|  if (!email || String(email).length < 5) return { valid: false, error: "Valid email required." };
    45|  const cleaned = String(email).toLowerCase().trim();
    46|  // RFC 5321 compliant regex for email format validation
    47|  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) return { valid: false, error: "Invalid email format." };
    48|  if (cleaned.length > 254) return { valid: false, error: "Email address too long." };
    49|  return { valid: true, value: cleaned };
    50|}
    51|
    52|/**
    53| * Validate phone number (10-15 digits global format), return formatted version
    54| * @param {string|number} phone - Phone number as string or number
    55| * @returns {{valid: boolean, error?: string, value?: string|null}} Validation result with optional formatted phone
    56| */
    57|export function validatePhone(phone) {
    58|  if (phone === null || phone === undefined || String(phone).trim() === "") return { valid: true, value: null };
    59|  const rawDigits = String(phone);
    60|  const justNumbers = rawDigits.replace(/\D/g, "");
    61|  if (justNumbers.length < 10 || justNumbers.length > 15) return { valid: false, error: "Phone number must be 10-15 digits." };
    62|  const formatted = rawDigits.replace(/[()\-+\s]/g, "").slice(0, 20);
    63|  return { valid: true, value: formatted };
    64|}
    65|
    66|/**
    67| * Strip HTML tags and limit text length for sanitization
    68| * @param {string} text - Text to sanitize  
    69| * @param {number} maxLength - Maximum allowed length (default 1000)
    70| * @returns {string} Sanitized text with HTML stripped and trimmed
    71| */
    72|export function sanitizeText(text, maxLength = 1000) {
    73|  const stripped = String(text || "").replace(/<[^>]*>/g, "");
    74|  return stripped.trim().slice(0, maxLength);
    75|}
    76|
    77|/**
    78| * Validate required field presence with custom error messages
    79| * @param {object} data - Object containing fields to validate
    80| * @param {Array<{key: string, required: boolean, min?: number, max?: number, customError?: string}>} fields - Array of validation rules

  const text = String(str || "");
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '\u2026'; // Use unicode ellipsis character
}

export function validateRequiredFields(data, fields) {
    84|  const errors = {};
    85|  for (const field of fields) {
    86|    if (!field.required && (data[field.key] === null || data[field.key] === undefined)) continue;
    87|    
    88|    if (data[field.key] === null || data[field.key] === undefined || data[field.key] === "") {
    89|      errors[field.key] = field.customError || `${field.key} is required.`;
    90|      continue;
    91|    }
    92|    
    93|    if (field.min && String(data[field.key]).length < field.min) {
    94|      errors[field.key] = field.customError || `${field.key} must be at least ${field.min} characters.`;
    95|    }
    96|    if (field.max && String(data[field.key]).length > field.max) {
    97|      errors[field.key] = field.customError || `${field.key} must be at most ${field.max} characters.`;
    98|    }
    99|  }
   100|  return { valid: Object.keys(errors).length === 0, errors };
   101|}
   102|
   103|/**
   104| * SHA256 hash helper for creating deterministic hashes from strings (IP addresses, tokens)
   105| * @param {string} input - String to hash
   106| * @returns {Promise<string>} Hex string representation of SHA256 hash
   107| */
   108|export async function hashSHA256(input) {
   109|  const msgBuffer = new TextEncoder().encode(String(input));
   110|  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
   111|  const hashArray = Array.from(new Uint8Array(hashBuffer));
   112|  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
   113|}
   114|
   115|/**
   116| * Sanitize SQL identifier (table/column names) to prevent SQL injection
   117| * @param {string} identifier - Table or column name to sanitize
   118| * @returns {string} Safe identifier wrapped in backticks
   119| */
   120|export function sanitizeSqlIdentifier(identifier) {
   121|  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) return "*";
   122|  return "`" + identifier + "`";
   123|}
   124|
   125|/**
   126| * Create rate limit key for IP/user-based throttling
   127| * @param {string} endpoint - API endpoint path for grouping limits
   128| * @param {string} identifier - User/IP/token to rate limit (will be hashed)
   129| * @returns {Promise<string>} Hashed rate limit key string
   130| */
   131|export async function getRateLimitKey(endpoint, identifier) {
   132|  const hash = await hashSHA256(`${endpoint}|${identifier || 'unknown'}`);
   133|  return `rate_limit:${hash.substring(0, 16)}`;
   134|}
   135|
   136|/**
   137| * Generate UUID v4 for unique identifiers (submissions, tokens, etc.)
   138| * @returns {string} UUID v4 string
   139| */
   140|export function generateUUID() {
   141|  return crypto.randomUUID();
   142|}
   143|
   144|/**
   145| * Check CORS configuration and add appropriate headers
   146| * @param {Request} request - Incoming request object
   147| * @returns {object} CORS header object ready for response
   148| */
   149|export function getCorsHeaders(request) {
   150|  const defaultOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
   151|  const origin = request?.headers.get("Origin") || "*";
   152|  
   153|  return {
   154|    "Content-Type": "application/json",
   155|    "Cache-Control": "no-cache, no-store, must-revalidate",
   156|    "Access-Control-Allow-Origin": defaultOrigins.has(origin) ? origin : "*",
   157|    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
   158|    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
   159|    "Access-Control-Max-Age": "86400",
   160|    "Vary": "Origin"
   161|  };
   162|}
   163|
   164|/**
   165| * Parse and validate JSON request body with error handling
   166| * @param {Request} request - Incoming request object
   167| * @returns {object} Parsed data or empty object on error
   168| */
   169|export async function parseRequestBody(request) {
   170|  try {
   171|    return await request.json();
   172|  } catch (e) {
   173|    return {};
   174|  }
   175|}
   176|
   177|/**
   178| * Standardize success response format for all API endpoints
   179| * @param {object} data - Payload object to wrap in success response
   180| * @param {number} status - HTTP status code (default: 200)
   181| * @returns {{status: number, body: object}} Response object ready for jsonResp wrapper
   182| */
   183|export function makeSuccessResponse(data, status = 200) {
   184|  return {
   185|    status,
   186|    body: { success: true, data }
   187|  };
   188|}
   189|
   190|/**
   191| * Standardize error response format for all API endpoints
   192| * @param {string} message - Human-readable error message
   193| * @param {number} statusCode - HTTP status code (default: 400)
   194| * @returns {{status: number, body: object}} Response object ready for jsonResp wrapper
   195| */
   196|export function makeErrorResponse(message, statusCode = 400) {
   197|  return {
   198|    status: statusCode,
   199|    body: { success: false, error: message }
   200|  };
   201|}
   202|
   203|/**
   204| * Calculate lead score based on email, budget, urgency, and service type
   205| * @param {{email: string, company?: string, budget?: string, scope?: string, industry?: string, urgency_level?: string, message?: string}} data - Lead data object
   206| * @returns {{score: number, category: string, base_score: number, industry_boost: number, urgency_boost: number, budget_fit_score: number}} Lead scoring result with score (0-100), category (hot/warm/cold), and component scores
   207| */
   208|export function calculateLeadScore(data) {
   209|  const email = data.email || "";
   210|  const company = data.company || "";
   211|  const budget = data.budget ? String(data.budget).toLowerCase() : "undisclosed";
   212|  const scopeStr = data.scope || "" ;
   213|  const industry = (data.industry || "general").toLowerCase();
   214|  const urgency_level = (data.urgency_level || "medium").toLowerCase();
   215|  const message = data.message || "";
   216|
   217|  // Base score starts at 60 (warm baseline)
   218|  let base_score = 60;
   219|
   220|  // Industry boost: B2B tech/finance/auto dealerships score higher (+15)
   221|  const b2bIndustries = ["technology", "finance", "automotive", "healthcare", "retail"];
   222|  const industryBoost = b2bIndustries.includes(industry) ? 15 : 0;
   223|
   224|  // Urgency boost: high/urgent adds +20, medium adds +5
   225|  const urgencyBoost = { high: 20, urgent: 20, standard: 10, medium: 5 }[urgency_level] || 0;
   226|
   227|  // Budget fit: ranges of 10k-50k get +10, 50k+ get +15
   228|  let budgetFitScore = 0;
   229|  const budgetMatch = budget.match(/(\d+)[kmb]?/i);
   230|  if (budgetMatch) {
   231|    const budgetNum = parseFloat(budgetMatch[1]);
   232|    const unit = budget.toLowerCase().match(/[kmb]/)?.[0] || "k";
   233|    const budgetVal = unit === "m" ? budgetNum * 1000 : unit === "b" ? budgetNum * 1000000 : budgetNum;
   234|    if (budgetVal >= 50000) budgetFitScore = 15;
   235|    else if (budgetVal >= 10000) budgetFitScore = 10;
   236|     else if (budgetVal > 0) budgetFitScore = 5;
   237|   }
   238|
   239|  // Total score capped at 100, minimum 20
   240|  const total_score = Math.min(100, Math.max(20, base_score + industryBoost + urgencyBoost + budgetFitScore));
   241|
   242|  // Categorize based on score: hot (80+), warm (40-79), cold (<40)
   243|  const category = total_score >= 80 ? "hot" : total_score >= 40 ? "warm" : "cold";
   244|
   245|  return {
   246|    score: total_score,
   247|    category,
   248|    base_score,
   249|    industry_boost: industryBoost,
   250|    urgency_boost: urgencyBoost,
   251|    budget_fit_score: budgetFitScore,
   252|    total_score
   253|  };
   254|}