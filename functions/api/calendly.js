/** API Helpers import */
import { jsonResp, balanceSuccessError } from '../lib/api-helpers.js';

export async function onRequestGet(context) { 
  try {
    const result = balanceSuccessError({ 
      success: true, 
      url: "https://calendly.com/visualark/demo", 
      embed: true 
     });
    return jsonResp(200, result, context.request);
   } catch (error) {
    console.error("ERROR [calendly.js GET]:", error.message);
    const response = balanceSuccessError({ 
      success: false, 
      error: "Internal server error" 
     });
    return jsonResp(500, response, context.request);
   }
}

export async function onRequestOptions() { 
  try {
    return new Response(null, { 
      status: 204, 
      headers: { 
        "Access-Control-Allow-Origin": "https://moliam.pages.dev",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type" 
       } 
     });
   } catch (error) {
    console.error("ERROR [calendly.js OPTIONS]:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error", status: 500 }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://moliam.pages.dev"
       }
     });
   }
}
