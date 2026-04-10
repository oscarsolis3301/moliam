/*
 * Calendly API - Public link endpoint
 * GET /api/calendly
 * Returns Calendly demo URL and embed status
 */

import { jsonResp } from './api-helpers.js';

/**
 * Handle GET requests to Calendly API - returns Calendly demo URL and embed status for VisualArk booking system
 * @param {object} context - Cloudflare Pages function context with request
 * @returns {Response} JSON response with success/data structure containing Calendly URL, or error 500 if exception occurred
 */
export async function onRequestGet(context) { 
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

/**
 * CORS preflight handler for Calendly API - responds to OPTIONS requests with allowed headers
 * @param {Request} request - Cloudflare Pages request object (unused, standard signature)
 * @returns {Response} 204 No Content with CORS headers for moliam.com and moliam.pages.dev
 */
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
