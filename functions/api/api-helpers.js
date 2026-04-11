     /**
     * MOLIAM API Helpers Library — v3
     * Core utilities for consistent JSON responses, input validation, and error handling
     * All exported functions work across Cloudflare Pages Functions environments
     */
     
/**
 * Create a standardized JSON response with proper headers
 * @param {number} status - HTTP status code (200, 400, 404, 500, etc.)
 * @param {object} data - Response payload object (success/error flags go here)
 * @param {Request} [request] - Optional request object for CORS headers
 * @param {Set<string>} [allowedOrigins] - Optional CORS origin set (defaults to moliam domains)
 * @returns {Response} properly formatted JSON response with all required headers
 */
export function jsonResp(status, data, request, allowedOrigins = null) {
  try {
    const defaultOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
    if (allowedOrigins) for (const origin of allowedOrigins) defaultOrigins.add(origin);
    
    // Normalize response: ensure consistent {success, data} or {success, error} format
    const normalizedData = { success: data.success };
    
    // Handle error case: if error field exists and is a string (not boolean), include it
    if (typeof data.error === 'string') {
      normalizedData.error = data.error;
    } else if (data.error === false || data.error === true) {
      // Remove redundant error:true/false boolean flag
      delete data.error;
    }
    
    // Add data field if response has other fields besides success
    const extra = Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'success' && k !== 'error'));
    if (Object.keys(extra).length > 0) {
      normalizedData.data = extra;
    } else if (data.error && typeof data.error === 'string') {
      // If we already set error above, clean up the raw entry
      delete extra.error;
    }


    const headers = new Headers({
       "Content-Type": "application/json",
       "Cache-Control": "no-cache, no-store, must-revalidate"
    });
    
    if (request) {
      const origin = request.headers.get("Origin");
      if (defaultOrigins.has(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
      } else if (!origin) {
        // No Origin header (same-origin or server-side call), allow it
        headers.set("Access-Control-Allow-Origin", "*");
      } else {
        // Unknown origin - don't allow, return without CORS headers except Content-Type
        headers.delete("Access-Control-Allow-Origin");
      }
      
      headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With"
        );
      headers.set("Access-Control-Max-Age", "86400");

    return new Response(JSON.stringify(normalizedData), { status, headers });
  } catch (error) {
    return new Response(JSON.stringify({success: false, error: "Internal server error"}), {status: 500, headers: {"Content-Type":"application/json"}});
  }
}
    
    /**
    * Validate email format with RFC 5321 compliance and length checks
    * @param {string} email - Email address to validate
    * @returns {{valid: boolean, error?: string, value?: string}} Validation result
    */
export function validateEmail(email) {
    try {
    if (!email || String(email).length < 5) return { valid: false, error: "Valid email required." };
    const cleaned = String(email).toLowerCase().trim();
    // RFC 5321 compliant regex for email format validation
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) return { valid: false, error: "Invalid email format." };
    if (cleaned.length > 254) return { valid: false, error: "Email address too long." };
    return { valid: true, value: cleaned };
   } catch (error) {
    return { valid: false, error: "Internal server error" };
   }
}
    
    /**
    * Validate phone number (10-15 digits global format), return formatted version
    * @param {string|number} phone - Phone number as string or number
    * @returns {{valid: boolean, error?: string, value?: string|null}} Validation result with optional formatted phone
    */
export function validatePhone(phone) {
    try {
    if (phone === null || phone === undefined || String(phone).trim() === "") return { valid: true, value: null };
    const rawDigits = String(phone);
    const justNumbers = rawDigits.replace(/\D/g, "");
    if (justNumbers.length < 10 || justNumbers.length > 15) return { valid: false, error: "Phone number must be 10-15 digits." };
    const formatted = rawDigits.replace(/[()\-+\s]/g, "").slice(0, 20);
    return { valid: true, value: formatted };
    } catch (error) {
    return { valid: false, error: "Internal server error" };
    }
}
    
    /**
    * Strip HTML tags and limit text length for sanitization
    * @param {string} text - Text to sanitize  
    * @param {number} maxLength - Maximum allowed length (default 1000)
    * @returns {string} Sanitized text with HTML stripped and trimmed
    */
export function sanitizeText(text, maxLength = 1000) {
    try {
    const stripped = String(text || "").replace(/<[^>]*>/g, "");
    return stripped.trim().slice(0, maxLength);
     } catch (error) {
    return "";
     }
}
    
    /**
    * Validate required field presence with custom error messages
    * @param {object} data - Object containing fields to validate
    * @param {Array<{key: string, required: boolean, min?: number, max?: number, customError?: string}>} fields - Array of validation rules
    * @returns {{valid: boolean, errors: object<string, string>}} Validation result
    */
    

/**
 * Slice text to maximum length with ellipsis if truncated
 * @param {string} str - Text to slice
 * @param {number} maxLen - Maximum character length (default: 1024)
 * @returns {string} Sliced text with ellipsis if truncated, or original if under max
 */
export function sliceText(str, maxLen = 1024) {
    try {
    const text = String(str || "");
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '\u2026'; // Use unicode ellipsis character
   } catch (error) {
    return "";
   }
}

/**
 * Validate required field presence with custom error messages
 * @param {object} data - Object containing fields to validate
 * @param {Array<{key: string, required: boolean, min?: number, max?: number, customError?: string}>} fields - Array of validation rules
 * @returns {{valid: boolean, errors: object<string, string>}} Validation result with error map or success
 */
export function validateRequiredFields(data, fields) {
  const errors = {};
    try {
    for (const field of fields) {
    if (!field.required && (data[field.key] === null || data[field.key] === undefined)) continue;
    
    if (data[field.key] === null || data[field.key] === undefined || data[field.key] === "") {
    errors[field.key] = field.customError || `${field.key} is required.`;
    continue;
     }
    
    if (field.min && String(data[field.key]).length < field.min) {
    errors[field.key] = field.customError || `${field.key} must be at least ${field.min} characters.`;
     }
    if (field.max && String(data[field.key]).length > field.max) {
    errors[field.key] = field.customError || `${field.key} must be at most ${field.max} characters.`;
     }
     }
  return { valid: Object.keys(errors).length === 0, errors };
   } catch (error) {
  return { valid: false, errors: { general: "Internal server error" } };
   }
}
   
   /**
   * SHA256 hash helper for creating deterministic hashes from strings (IP addresses, tokens)
   * @param {string} input - String to hash
   * @returns {Promise<string>} Hex string representation of SHA256 hash
   */
export async function hashSHA256(input) {
  try {
   const msgBuffer = new TextEncoder().encode(String(input));
   const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
  return '';
  }
}
   
   /**
   * Sanitize SQL identifier (table/column names) to prevent SQL injection
   * @param {string} identifier - Table or column name to sanitize
   * @returns {string} Safe identifier wrapped in backticks
   */
export function sanitizeSqlIdentifier(identifier) {
  try {
   if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) return "*";
   return "`" + identifier + "`";
  } catch (error) {
  return "*";
  }
}
   
   /**
   * Create rate limit key for IP/user-based throttling
   * @param {string} endpoint - API endpoint path for grouping limits
   * @param {string} identifier - User/IP/token to rate limit (will be hashed)
   * @returns {Promise<string>} Hashed rate limit key string
   */
export async function getRateLimitKey(endpoint, identifier) {
   try {
   const hash = await hashSHA256(`${endpoint}|${identifier || 'unknown'}`);
   return `rate_limit:${hash.substring(0, 16)}`;
    } catch (error) {
  return 'rate_limit:default';
   }
}
   
   /**
   * Generate UUID v4 for unique identifiers (submissions, tokens, etc.)
   * @returns {string} UUID v4 string
   */
  /**
     * Generate UUID v4 for unique identifiers (submissions, tokens, etc.)
     * @returns {string} UUID v4 string
     */
    export function generateUUID() {
   try {
    return crypto.randomUUID();
     } catch (error) {
    return '00000000-0000-4000-8000-000000000000';
   }
}
/**
 * Calculate lead score based on email, budget, urgency, and service type
     * @param {{email: string, company?: string, budget?: string, scope?: string, industry?: string, urgency_level?: string, message?: string}} data - Lead data object
export function calculateLeadScore(data) {
   try {
   const email = data.email || "";
   const company = data.company || "";
   const budget = data.budget ? String(data.budget).toLowerCase() : "undisclosed";
   const scopeStr = data.scope || "" ;
   const industry = (data.industry || "general").toLowerCase();
   const urgency_level = (data.urgency_level || "medium").toLowerCase();
   const message = data.message || "";
   
     // Base score starts at 60 (warm baseline)
   let base_score = 60;
   
     // Industry boost: B2B tech/finance/auto dealerships score higher (+15)
   const b2bIndustries = ["technology", "finance", "automotive", "healthcare", "retail"];
   const industryBoost = b2bIndustries.includes(industry) ? 15 : 0;
   
     // Urgency boost: high/urgent adds +20, medium adds +5
   const urgencyBoost = { high: 20, urgent: 20, standard: 10, medium: 5 }[urgency_level] || 0;
   
     // Budget fit: ranges of 10k-50k get +10, 50k+ get +15
   let budgetFitScore = 0;
   const budgetMatch = budget.match(/(\d+)[kmb]?/i);
   if (budgetMatch) {
   const budgetNum = parseFloat(budgetMatch[1]);
   const unit = budget.toLowerCase().match(/[kmb]/)?.[0] || "k";
   const budgetVal = unit === "m" ? budgetNum * 1000 : unit === "b" ? budgetNum * 1000000 : budgetNum;
   if (budgetVal >= 50000) budgetFitScore = 15;
   else if (budgetVal >= 10000) budgetFitScore = 10;
   else if (budgetVal > 0) budgetFitScore = 5;
     }
   
     // Total score capped at 100, minimum 20
   const total_score = Math.min(100, Math.max(20, base_score + industryBoost + urgencyBoost + budgetFitScore));
   
     // Categorize based on score: hot (80+), warm (40-79), cold (<40)
   const category = total_score >= 80 ? "hot" : total_score >= 40 ? "warm" : "cold";
   
     return {
   score: total_score,
   category,
   base_score,
   industry_boost: industryBoost,
   urgency_boost: urgencyBoost,
   budget_fit_score: budgetFitScore,
   total_score
     };
     } catch (error) {
  return { score: 50, category: "cold", error: "Internal server error" };
   }
}

/**
 * Normalize API responses to ensure consistent {success, data} or {success, error} structure
 * Handles edge cases where error field is boolean (true/false) vs string message
 * @param {object} response - Response object with success/error/data fields
 * @returns {object} Normalized response with proper structure
 */
export function balanceSuccessError(response) {
  try {
    if (!response || typeof response !== 'object') return { success: false, error: "Invalid response format" };
    
     const normalized = { ...response };
    
      // If original had string error, keep it; otherwise remove error field entirely from copy
    if (typeof response.error === 'string') {
      normalized.error = response.error;
      } else {
      delete normalized.error;      // Remove boolean/cleaned error flag from normalized object
      }
    
      // Always ensure success field exists
    if (typeof normalized.success !== 'boolean') {
      normalized.success = true;
      }
    
    return normalized;
  } catch (error) {
    return { success: false, error: "Internal server error" };
  }
}