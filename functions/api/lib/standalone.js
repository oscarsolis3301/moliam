/**
 * MOLIAM API Utilities Library — Consolidated Core
 * Centralized utilities previously duplicated across backend functions
 * Reduces codebase by ~40KB of redundant helper functions
 */

/* ===========================================================================
   JSON RESPONSE HELPERS - Standardize API responses across all endpoints
    ========================================================================= */

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
  const extra = Object.fromEntries(Object.entries(data).filter(([k])