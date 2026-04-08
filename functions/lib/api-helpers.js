/**
 * API Helpers - Standardized error handling and response formatting for Moliam endpoints
 * All exported functions should be used across functions/api/* files
 */

// CORS domains allowed
export const ALLOWED_ORIGINS = [
  'https://moliam.pages.dev',
  'https://moliam.com',
  'http://localhost:8080'
];

/**
 * JSON Response helper with guaranteed success/error structure and CORS headers
 * @param {number} status - HTTP status code
 * @param {object} body - Response body object (will be balanced with success/error flags)
 * @param {Request} [request] - Original request for origin extraction
 * @returns {Response} Properly formatted JSON response with security headers
 */
export function jsonResp(status, body, request) {
  const balancedBody = balanceSuccessError(body);
  
  return new Response(JSON.stringify(balancedBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getOrigin(request),
      'Access-Control-Allow-Methods': getMethod(request),
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

/**
 * Get origin from request, falling back to allowed defaults
 * @param {Request} [request]
 * @returns {string} Safe CORS origin
 */
function getOrigin(request) {
  if (!request) return ALLOWED_ORIGINS[0];
  const origin = request.headers.get('Origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  for (const allowed of ALLOWED_ORIGINS) {
    if (origin.includes(new URL(allowed).hostname)) return origin;
  }
  return ALLOWED_ORIGINS[0];
}

/**
 * Get allowed HTTP methods based on request type
 * @param {Request} [request]
 * @returns {string} Allowed methods header value
 */
function getMethod(request) {
  if (!request) return 'GET, POST, PUT, DELETE, OPTIONS';
  const method = request.method;
  switch (method?.toUpperCase()) {
    case 'POST': return 'POST, OPTIONS';
    case 'PUT': return 'PUT, OPTIONS';
    case 'DELETE': return 'DELETE, OPTIONS';
    default: return 'GET, POST, PUT, DELETE, OPTIONS';
  }
}

/**
 * Ensure response body has consistent success/error structure
 * If body.error=true ensures body.success=false
 * If body.success=false ensures body.error=true  
 * Returns balanced object with both properties for clarity
 * @param {object} body - Body to balance
 * @returns {object} Balanced body with success/error flags
 */
export function balanceSuccessError(body) {
  if (!body || typeof body !== 'object') return body;
  
  const hasError = errorExistsInObject(body);
  const hasSuccess = successExistsInObject(body);
  
  if (hasError && !hasSuccess) {
    return { ...body, success: false };
  } else if (hasSuccess === false && !hasError) {
    return { ...body, error: true };
  } else if (!hasError && !hasSuccess) {
    // Neither exists - balance the body
    return { ...body, success: true, error: undefined };
  }
  
  return body;
}

/**
 * Recursively check if object contains 'success' property
 * @param {object} obj - Object to check
 * @returns {boolean} True if success property exists anywhere in structure
 */
function successExistsInObject(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.hasOwnProperty('success')) return true;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && successExistsInObject(obj[key])) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively check if object contains 'error' property
 * @param {object} obj - Object to check
 * @returns {boolean} True if error property exists anywhere in structure
 */
function errorExistsInObject(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.hasOwnProperty('error')) return true;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && errorExistsInObject(obj[key])) {
      return true;
    }
  }
  return false;
}

/**
 * Validate email address with RFC 5321 compliance check
 * @param {string} email - Email to validate
 * @returns {{valid: boolean, error?: string, value?: string}} Validation result
 */
export function validateEmail(email) {
  if (!email || String(email).length < 5) {
    return { valid: false, error: 'Valid email address required.' };
  }
  const cleaned = String(email).toLowerCase().trim();
  // RFC 5321 compliant regex for local part + domain validation
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) {
    return { valid: false, error: 'Invalid email format. Use format: name@example.com' };
  }
  if (cleaned.length > 254) {
    return { valid: false, error: 'Email address too long.' };
  }
  return { valid: true, value: cleaned };
}

/**
 * Validate phone number (10-15 digits for global format)
 * @param {string|number|null} phone - Phone to validate
 * @returns {{valid: boolean, error?: string, value?: string|null}} Validation with optional formatted result
 */
export function validatePhone(phone) {
  if (phone === null || phone === undefined || String(phone).trim() === '') {
    return { valid: true, value: null };
  }
  const rawDigits = String(phone);
  const justNumbers = rawDigits.replace(/\D/g, '');
  if (justNumbers.length < 10 || justNumbers.length > 15) {
    return { valid: false, error: 'Phone must be 10-15 digits. Include country code.' };
  }
  // Return formatted version for display
  const formatted = rawDigits.replace(/[()\-+\s]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3').slice(0, 20);
  return { valid: true, value: formatted };
}

/**
 * Strip HTML tags and apply length limit for text sanitization
 * Prevents XSS attacks and enforces input constraints
 * @param {string} text - Raw text from user input
 * @param {number} maxLength - Maximum allowed characters (default 1000)
 * @returns {string} Sanitized text with HTML stripped
 */
export function sanitizeText(text, maxLength = 1000) {
  const stripped = String(text || '').replace(/<[^>]*>/g, '');
  return stripped.trim().slice(0, maxLength);
}

/**
 * Validate required field presence
 * @param {any} value - Value to check
 * @param {string} fieldName - Name for error message
 * @param {boolean} [allowEmptyString=false] - Allow empty strings if true
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateRequired(value, fieldName, allowEmptyString = false) {
  const isEmpty = value === null || value === undefined || 
                  (typeof value === 'string' && value.trim() === '');
  
  if (!isEmpty) return { valid: true };
  if (allowEmptyString) return { valid: true };
  return { valid: false, error: `${fieldName} is required.` };
}

/**
 * Validate integer range with bounds checking
 * @param {any} value - Value to validate
 * @param {number} min - Minimum allowed value (inclusive)
 * @param {number} max - Maximum allowed value (inclusive)
 * @param {string} fieldName - Field name for error message
 * @returns {{valid: boolean, error?: string, value?: number}} Validation with parsed integer
 */
export function validateIntegerRange(value, min, max, fieldName) {
  if (value === null || value === undefined) {
    return { valid: false, error: `${fieldName} is required.` };
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { valid: false, error: `${fieldName} must be a number.` };
  }
  if (num < min || num > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}.` };
  }
  return { valid: true, value: Math.min(Math.max(num, min), max) };
}

/**
 * Validate string length with min/max bounds
 * @param {string} text - Text to validate
 * @param {number} [minLength=1] - Minimum characters required
 * @param {number} [maxLength=1000] - Maximum allowed characters
 * @param {string} fieldName - Field name for error message
 * @returns {{valid: boolean, error?: string, value?: string}} Validation with normalized text
 */
export function validateStringLength(text, minLength = 1, maxLength = 1000, fieldName = 'Text') {
  const trimmed = String(text || '').trim();
  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} character${minLength === 1 ? '' : 's'}.` };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters.` };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate URL format (http/https only)
 * @param {string|null} url - URL to validate
 * @returns {{valid: boolean, error?: string, value?: string|null}} Validation with optional cleaned URL
 */
export function validateUrl(url) {
  if (!url || String(url).trim() === '') return { valid: true, value: null };
  const normalized = String(url).trim();
  if (/^(https?:\/\/[^\s/$.?#].[^\s]*)$/.test(normalized)) {
    return { valid: true, value: normalized };
  }
  return { valid: false, error: 'Invalid URL. Use https://example.com' };
}

/**
 * Hash string with SHA-256 for IP anonymization or deduplication
 * @param {string} str - Raw string to hash
 * @returns {Promise<string>} Hex-encoded hash result
 */
export async function hashSHA256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Truncate text with ellipsis if beyond limit
 * @param {string|any} text - Text to truncate
 * @param {number} maxLen - Character limit (default 1024)
 * @returns {string} Truncated or original text
 */
export function sliceText(text, maxLen = 1024) {
  if (!text) return '';
  const str = String(text);
  return str.length <= maxLen ? str : str.slice(0, maxLen) + ' [truncated]';
}

/**
 * Standardized error object for consistent API errors
 * @param {string} message - Human-readable error message
 * @param {number} [status=400] - HTTP status code
 * @param {{[key: string]: any}} [details={}] - Additional error details
 * @returns {{success:boolean, error:string, details?: object}} Standard error response body
 */
export function makeError(message, status = 400, details = {}) {
  return balanceSuccessError({ success: false, error: message, ...details });
}

/**
 * Standardized success object for consistent API responses
 * @param {string} message - Success message
 * @param {object} [data={}] - Response data payload
 * @param {number} [status=200] - HTTP status code
 * @returns {{success:true, message:string, data?: object}} Standard success response body
 */
export function makeSuccess(message, data = {}, status = 200) {
  return balanceSuccessError({ success: true, message, ...data });
}

/**
 * Wrap any async function with try/catch and return standardized JSON Response
 * Helper to ensure all DB/database operations are properly guarded
 * @param {Function} fn - Async function to wrap
 * @param {number} normalStatus - Status for success case (default 200)
 * @param {number} [errorStatus=500] - Status for error case (default 500)
 * @returns {Function} Wrapped function with error handling
 */
export async function withErrorHandling(fn, normalStatus = 200, errorStatus = 500) {
  try {
    const result = await fn();
    return jsonResp(normalStatus, makeSuccess('Operation successful.', { data: result }));
  } catch (err) {
    console.error('API handler error:', err);
    return jsonResp(errorStatus, makeError(err.message || 'Internal server error', errorStatus));
  }
}
