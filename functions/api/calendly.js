
/**
 * Calendly API - Public link endpoint
 * GET /api/calendly
 * Returns Calendly demo URL and embed status
 */

import { jsonResp } from './lib/standalone.js';
import { createRateLimiterMiddleware } from './lib/rate-limiter.js';

const rateLimit = createRateLimiterMiddleware('calendly-public', 100, 200); // Public endpoint: 100/min, 200 burst

/** Wrapper: Calendly GET handler with rate limiter middleware for public calendar link access */
async function calendlyRateLimitedGet(context) {
  const rlResponse = await rateLimit(context.request, context.env);
  if (rlResponse) return rlResponse;
  // Continue to handler after passing rate limit check
  return null;
}

/**
 * Handle GET requests to Calendly API - returns Calendly demo URL and embed status for VisualArk booking system
 * @param {object} context - Cloudflare Pages function context with request
 * @returns {Response} JSON response with success/data structure containing Calendly URL, or error 500 if exception occurred
 */
export async function onRequestGet(context) { 
  const rlResult = await calendlyRateLimitedGet(context);
  if (rlResult) return rlResult; // Rate limited - skip handler and return 429
  
  try {
    const result = { 
      success: true,
      data: { 
          url: "https://calendly.com/visualark/demo", 
          embed: true 
          },
      error: false 
        };
    return jsonResp(200, result, context.request);
  } catch (error) {
    console.error("ERROR [calendly.js GET]:", error.message);
    const response = { 
      success: false, 
      error: error.message || "Internal server error", 
      data: null 
        };
    return jsonResp(500, response, context.request);
  }
}

export async function onRequestOptions() { 
  return new Response(null, { 
      status: 204, 
      headers: { 
         "Access-Control-Allow-Origin": "*",
         "Access-Control-Allow-Methods": "GET, OPTIONS",
         "Access-Control-Allow-Headers": "Content-Type" 
        } 
      });
}
