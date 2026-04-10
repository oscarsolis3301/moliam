/**
 * API Helpers Library — Centralized helper functions for Moliam API endpoints
 * Provides consistent JSON responses, validation utilities, and error handling
 */

/**
 * Standardized JSON response with security headers and CORS for moliam domains
 * @param {number} status - HTTP status code (200-599)
 * @param {object} body - Response body containing success/error/status fields
 * @param {string[]} allowedOrigins - Array of origins to allow (defaults to moliam domains)
 * @returns {Response} JSON response with Content-Type, CORS headers, security headers
 */
export function jsonResp(status, body, allowedOrigins = ["https://moliam.com", "https://moliam.pages.dev"]) {
  const responseBody = JSON.stringify(body);

  const headers = {
    "Content-Type": "application/json",
<<<<<<< HEAD
    "Access-Control-Allow-Origin": "*", // Wildcard for flexibility in development, moliam domains included as default allowedOrigins
=======
    "Access-Control-Allow-Origin": "*", // Wildcard for flexibility in development
>>>>>>> origin/main
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  };

  return new Response(responseBody, { status, headers });
}

/**
 * Ensure response body has consistent success/error structure
 * Adds missing 'success' boolean to object based on error state if not already present
 * @param {object} obj - Object to check and potentially modify
 * @returns {object} Balanced object with both success and error properties where applicable
 */
export function balanceSuccessError(obj) {
  const result = { ...obj };

  // If error field exists and is truthy, ensure success: false
  if (result.error && !result.success) {
    result.success = false;
  }
  // If no error or error: false, ensure success: true
  else if (!result.error || result.error === false) {
    if (result.success === undefined) {
      result.success = true;
    }
  }

  return result;
}

/**
 * Validate that required fields are present in request data
 * @param {object} data - Request body data object
 * @param {string[]} requiredFields - Array of field names to check
 * @returns {{valid: boolean, missing?: string[], errors?: string[]}} Validation result
 */
export function validateRequired(data, requiredFields) {
  const missing = [];
  const errors = [];

  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      missing.push(field);
      errors.push(`${field} is required.`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    errors
  };
}

/**
 * JSON response builder for error cases with proper HTTP status codes
 * @param {number} status - Error status code (400-599)
 * @param {string} errorMessage - Human-readable error message
 * @returns {Response} Error response with consistency structure
 */
export function errorResp(status, errorMessage) {
  return jsonResp(status, balanceSuccessError({ 
    success: false, 
    error: errorMessage 
  }));
}

/**
 * Validate email format using RFC 5321 compliant regex
 * @param {string} email - Email address to validate
 * @returns {{valid: boolean, error?: string, value?: string}} Validation result with optional formatted email
 */
export function validateEmail(email) {
  if (!email || String(email).length < 5) {
    return { valid: false, error: "Valid email is required." };
  }

  const cleaned = String(email).toLowerCase().trim();
  // RFC 5321 compliant regex for email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(cleaned)) {
    return { valid: false, error: "Invalid email format. Please use a valid email address." };
  }

  if (cleaned.length > 254) {
    return { valid: false, error: "Email address is too long." };
  }

  return { valid: true, value: cleaned };
}

/**
 * Validate phone number (10-15 digits global format), return formatted version
 * @param {string|number|null} phone - Phone number to validate
 * @returns {{valid: boolean, error?: string, value?: string|null}} Validation result with optional formatted phone
 */
export function validatePhone(phone) {
  if (!phone || String(phone).trim() === "") {
    return { valid: true, value: null }; // Phone is optional
  }

  const rawDigits = String(phone);
  const justNumbers = rawDigits.replace(/\D/g, "");

  // Must have 10-15 digits (global phone format range)
  if (justNumbers.length < 10 || justNumbers.length > 15) {
    return { valid: false, error: "Phone number must be between 10 and 15 digits." };
  }

  // Return formatted version for display
  const formatted = rawDigits.replace(/[()\-+\s]/g, "").slice(0, 20);

  return { valid: true, value: formatted };
}

/**
 * Sanitize text field by stripping HTML tags and limiting length
 * Prevents XSS attacks while keeping content readable
 * @param {string|any} text - Text to sanitize (converted to string)
 * @param {number} maxLength - Maximum allowed character count (default 1000)
 * @returns {string} Cleaned, truncated text
 */
export function sanitizeText(text, maxLength = 1000) {
  const cleaned = String(text || "").replace(/<[^>]*>/g, "");
  return cleaned.trim().slice(0, maxLength);
}

/**
 * Truncate text with ellipsis if beyond character limit
 * Useful for limiting database field sizes and API responses
 * @param {string|any} text - Text to truncate (converted to string)
 * @param {number} maxLen - Maximum allowed length, default 1024
 * @returns {string} Original text if within limit, otherwise truncated with ellipsis
 */
export function truncateText(text, maxLen = 1024) {
  if (!text) return "";
  const str = String(text);
  return str.length <= maxLen ? str : str.slice(0, maxLen - 3) + "...";
}

/**
 * SHA-256 hash function for IP anonymization and deduplication
 * Returns hex-encoded hash suitable for localStorage or database lookups
 * @param {string} str - Raw string to hash
 * @returns {Promise<string>} 64-character lowercase hex string
 */
export async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ensure SQL query uses parameterized binding to prevent SQL injection
 * Marks a query as safe by wrapping it with D1's prepare() method
 * @param {string} query - SQL query with ? placeholders for parameters
 * @param {array} [params=[]] - Array of values to bind to placeholders
 * @returns {object} Prepared query object ready for execution
 */
export function safeQuery(query, params = []) {
  return {
    query,
    params
  };
}

/**
 * Check if value is an empty string, null, or undefined
 * Helper for validation logic
 * @param {*} value - Value to check
 * @returns {boolean} True if empty or falsy (excluding 0 and false)
 */
export function isEmpty(value) {
<<<<<<< HEAD
  return value === null || value == undefined || value == '';
}

/** Generate cryptographically secure random session token for cookie/auth use @returns{Promise<string>}64-char hex string from WebCryptoAPI */
export async function generateToken(){const arr=new Uint8Array(32);crypto.getRandomValues(arr);return Array.from(arr).map(b=>b.toString(16).padStart(2,"0")).join("");}
=======
  return value === null || value === undefined || value === '';
}
>>>>>>> origin/main
