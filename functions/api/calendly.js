
/**
 * Calendly API - Public link endpoint
 * GET /api/calendly
 * Returns Calendly demo URL and embed status
 */

import { jsonResp } from '../lib/api-helpers.js';

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
