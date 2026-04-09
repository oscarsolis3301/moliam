/**
 * CRM Webhook Handler - Processes CRM callbacks and updates lead status
 * POST /api/webhooks/lead-updates
 * @module crm-webhook
 */

import { jsonResp } from './api-helpers.js';

/** Handle POST requests for CRM webhook callbacks and lead status updates
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status and updated submission info
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // --- Validate DB binding exists ---
  if (!db) {
    return jsonResp(500, { 
      error: true, 
      message: "Database not available. Please check server configuration.",
      requestId: crypto.randomUUID()
    });
  }

  // Read and validate JSON body first BEFORE any processing
  let data;
  
  try {
    const contentType = request.headers.get("Content-Type") || "";
    
    if (!contentType.includes("application/json")) {
      return jsonResp(400, { 
        error: true, 
        message: "Webhook must be sent with application/json Content-Type",
        allowedContentTypes: ["application/json"]
      });
    }

    data = await request.json();

  // Handle JSON parsing errors
  } catch (parseError) {
    console.error("JSON parse error in crm-webhook:", parseError);
    
    try {
      if (db) {
        await db.prepare(
          "INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'json_parse_error', datetime('now'))"
        ).bind("crm_callback", String(parseError.message).slice(0, 64)).run();
      }
    } catch {}

    return jsonResp(400, { 
      error: true, 
      message: "Invalid JSON in webhook body. Must be valid JSON object.",
      timestamp: new Date().toISOString()
    });
  }

  // Validate data is an object and not raw array/empty
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return jsonResp(400, { 
      error: true, 
      message: "Invalid webhook payload. Expected JSON object.",
      receivedType: Array.isArray(data) ? "array" : typeof data 
    });
  }

  const sigHeader = request.headers.get("X-Webhook-Signature") || "";
  const crmSecret = env.WEBHOOK_SECRET || "";

      // Log payload to D1 for debugging (with validated data now)
  try {
    if (db) {
      await db.prepare(
        "INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'logged', datetime('now'))"
      ).bind(
        data.type || data.event || "crm_callback", 
        String(data.submission_id || "").slice(0, 64)
      ).run();
    }
  } catch (logError) {
    // Silently ignore logging errors
  }

  // Map CRM events to lead statuses (extensible for multiple CRMs)
  const eventMap = {
    'submitted': { status: 'new', score_update: 5 },
    'read': { status: 'contacted' },
    'email_sent': { stage: 'nurturing', opened_at: new Date().toISOString() },
    'email_opened': { opened_at: new Date().toISOString(), engagement_score: '+2' },
    'meeting_scheduled': { status: 'converting', meeting_type: 'discovery_call' },
    'deal_won': { status: 'won', win_rate: 100, converted_to_client: true },
    'lead_lost': { status: 'lost', loss_reason: data.reason || "No longer interested" }
  };

  // Route based on event type - expand this mapping per CRM provider requirements
  const eventType = data.type || data.event || data.eventType || "generic";
  
  if (eventType && Object.keys(eventMap).includes(eventType)) {
    const updateFields = [];
    const updateValues = [];

    for (const [k, v] of Object.entries(eventMap[eventType])) {
      if (typeof k !== 'string' || typeof v === 'undefined') continue;

      // Handle score updates separately - skip here
      if (eventMap[eventType].score_update !== undefined && k !== 'score_update') {
        updateFields.push(`${k} = ?`);
        updateValues.push(v);
      }
    }

    // Get submission_id from data with fallbacks
    const submissionId = data.submission_id || data.id || data.lead_id || data.submit_id;
    
    if (!submissionId) {
      return jsonResp(400, { 
        error: true, 
        message: "Missing submission_id in webhook payload",
        availableFields: Object.keys(data)
      });
    }

    // Build dynamic UPDATE query - use parameterized statement for safety
    const updateQuery = `UPDATE submissions SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(submissionId);

    const updateResult = await db.prepare(updateQuery).bind(...updateValues).run();

    if (!updateResult.success || !updateResult.meta) {
      console.warn("Webhook update returned unexpected result:", JSON.stringify(updateResult));
    }

    // Update lead_scores table when score changes
    if (eventMap[eventType].score_update !== undefined && submissionId) {
      const currentScore = await db.prepare(
        "SELECT COALESCE(lead_score, 0) as base_score FROM submissions WHERE id = ?"
      ).bind(submissionId).first();

      const oldScore = currentScore?.base_score || 0;
      const scoreChange = Number(eventMap[eventType].score_update);
      const newScore = Math.min(100, oldScore + (isNaN(scoreChange) ? 0 : scoreChange));

      try {
        await db.prepare(
          "UPDATE submissions SET lead_score = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(newScore, submissionId).run();
        
        console.log(`Webhook scored: ${submissionId} => ${oldScore} + ${scoreChange || 0} = ${newScore}`);
      } catch (err) {
        // Schema may not have lead_score yet - log and continue
        if (err.name !== "TypeError" && !err.message?.includes("no such column")) {
          throw err;
        }
        console.warn(`lead_score column missing in schema: ${err.message}`);
      }
    }

    return jsonResp(200, { 
      success: true, 
      message: "Lead status updated successfully",
      eventType,
      submissionId,
      timestamp: new Date().toISOString()
    });
  }

  // Handle unknown event types (don't break - log and allow processing)
  console.log(`[CRM Webhook] Unhandled event type: ${eventType}`, JSON.stringify(data));

  return jsonResp(200, { 
    success: true, 
    message: "Unhandled event type received - logged for review",
    eventType,
    submissionId: data.submission_id || data.id || null,
    webhookSource: getWebhookOrigin(request) || 'unknown',
    timestamp: new Date().toISOString()
  });
}

/** Get webhook origin (for logging/debugging)
 * @param {Request} request - Cloudflare Request object  
 * @returns {string|string|null} Origin string or null
 */
function getWebhookOrigin(request) {
  try {
    const cf = request.headers.get("CF-Connecting-IP");
    
    if (cf && typeof cf === "string") return `ip:${cf}`;

    const userAgent = request.headers.get("User-Agent");
    
    if (userAgent && typeof userAgent === "string") {
      if (userAgent.includes("HubSpot")) return "hubspot";
      if (userAgent.includes("Airtable")) return "airtable";
      if (userAgent.includes("Pipedrive")) return "pipedrive";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Create JSON response with proper headers
 * @param {number} status - HTTP status code
 * @param {object} body - Response body object
 * @returns {Response} JSON response
 */
function jsonResp(status, body) {
  const responseBody = JSON.stringify(body);
  
  return new Response(responseBody, {
    status,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Signature",
      "Cache-Control": "no-store, no-cache"
    }
  });
}
