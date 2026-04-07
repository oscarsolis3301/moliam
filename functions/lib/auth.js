/**
 * Authentication helpers for Moliam API
 * Web Crypto API based - no Node crypto dependencies
 */

/**
 * Hash password using SHA-256 with salt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hex encoded hash
 */
export async function hashPassword(password) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate cryptographically secure random token
 * @returns {Promise<string>} 64-char hex token string
 */
export async function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compare two hashes safely (constant time)
 * @param {string} hashA - First hash
 * @param {string} hashB - Second hash
 * @returns {boolean} True if equal
 */
export function equalTimeCompare(hashA, hashB) {
  const bufferA = Buffer.from(hashA, 'hex');
  const bufferB = Buffer.from(hashB, 'hex');
  
  if (bufferA.length !== bufferB.length) return false;
  
  let result = 0;
  for (let i = 0; i < bufferA.length; i++) {
    result |= bufferA[i] ^ bufferB[i];
  }
  return result === 0;
}

/**
 * Get allowed origin from request for CORS
 * @param {Request} request - Fetch API request object
 * @returns {string} Allowed origin URL
 */
export function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) {
    return origin;
  }
  return "https://moliam.pages.dev";
}

/**
 * Create CORS response for preflight requests
 * @param {number} status - HTTP status code
 * @returns {Response} Empty response with CORS headers
 */
export function corsResponse(status = 204) {
  return new Response(null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}

/**
 * Create JSON response with proper headers
 * @param {number} status - HTTP status code
 * @param {object} body - Response body object
 * @returns {Response} JSON response
 */
export function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}
