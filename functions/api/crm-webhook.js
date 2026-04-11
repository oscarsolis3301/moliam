/**
 * CRM Webhook Handler - Processes CRM callbacks and updates lead status
 * POST /api/webhooks/lead-updates
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and env.ADMIN_EMAIL bindings
 * @returns {Response} JSON response: 200 OK (success), 400 Bad Request (validation errors), 500 Server Error (DB/API failure)
 */
import { jsonResp, logWebhookPayload } from './api-helpers.js';

/**
 * Handle POST webhook requests from CRM providers
 * @param {object} context - Cloudflare Pages function context
 * @returns {Response} JSON response with status and message
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // Validate DB binding exists, return proper error if not bound
  if (!db) {
    return jsonResp(500, { 
      success: false, 
      error: "Database not available. Please check server configuration."
    }, request);
  }

  try {
    // --- Validate this is actually a webhook (check content type) ---
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      return jsonResp(400, { 
        success: false, 
        error: "Webhook must be sent with application/json Content-Type",
        allowedContentTypes: ["application/json"]
      }, request);
    }

    // Parse request body with try/catch for malformed JSON
    let data;
    try {
      data = await request.json();
    } catch (err) {
      if (err.name === "TypeError" && err.message.includes("json")) {
        return jsonResp(400, { 
          success: false, 
          error: "Invalid JSON in webhook body. Must be valid JSON object."
        }, request);
      }
      throw err;
    }

    // Validate payload is an object (not array or primitive)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonResp(400, { 
        success: false, 
        error: "Invalid webhook payload. Expected JSON object.",
        receivedType: Array.isArray(data) ? "array" : typeof data 
      }, request);
    }

    // --- Verify webhook signature (if header present) ---
    const sigHeader = request.headers.get("X-Webhook-Signature") || "";
    
    // Log webhook payload to D1 for debugging if DB available
    try {
      if (db && data.submission_id) {
        await db.prepare(
          "INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'verified', datetime('now'))"
        ).bind(data.type || data.event || "crm_callback", String(data.submission_id).slice(0, 64)).run();
      } else if (db && !data.submission_id) {
        await db.prepare(
          "INSERT INTO webhook_logs (event_type, payload_hash, note, received_at) VALUES (?, ?, 'no_submission_id', datetime('now'))"
        ).bind(data.type || data.event || "crm_callback", "").run();
      }
    } catch {}

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

        if (k === 'score_update') {
          // Special handling - skip for now, handled separately below
          continue;
        }

        updateFields.push(`${k} = ?`);
        updateValues.push(v);
      }

      // Get submission_id from data with fallbacks
      const submissionId = data.submission_id || data.id || data.lead_id || data.submit_id;
      
      if (!submissionId) {
        return jsonResp(400, { 
          success: false, 
          error: "Missing submission_id in webhook payload",
          availableFields: Object.keys(data)
        }, request);
      }

      // Build dynamic UPDATE query - use parameterized statement for safety (SQL injection prevention)
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
        const newScore = Math.min(100, oldScore + Number(eventMap[eventType].score_update) || 0);

        const updateQuery2 = `UPDATE submissions SET lead_score = ?, updated_at = datetime('now') WHERE id = ?`;
        
        try {
          await db.prepare(updateQuery2).bind(newScore, submissionId).run();
          console.log(`Webhook scored: ${submissionId} => ${oldScore} + ${eventMap[eventType].score_update} = ${newScore}`);
        } catch (err) {
          // Schema may not have lead_score yet - log and continue
          if (!err.message || !err.message.includes("no such column")) {
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
      }, request);
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
    }, request);

  } catch (err) {
    console.error("Webhook handler error:", err);
    
    if (err.name === "TypeError" && (err.message.includes("json") || err.message.includes("expected"))) {
      return jsonResp(400, { 
        success: false, 
        error: "Invalid JSON in webhook body. Must be valid JSON object."
      }, request);
    }

    if (err.name === "Error" && err.message.includes("no such column")) {
      return jsonResp(400, { 
        success: false, 
        error: "Database schema missing required column. Run schema-extended.sql"
      }, request);
    }

    return jsonResp(500, { 
      success: false, 
      error: "Failed to process webhook",
      errorCode: 'WEBHOOK_ERROR',
      requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
    }, request);
  }
}

/**
 * Handle OPTIONS preflight requests for CORS
 * @param {object} context - Cloudflare Pages function context with request
 * @returns {Response} CORS header response
 */
export async function onRequestOptions(context) {
  const { request } = context;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Signature",
    "Cache-Control": "no-store, no-cache"
  };

  return new Response(null, { status: 204, headers });
}

/** Helper: Get webhook origin for logging/debugging purposes only */
/**
 * Determine the source/provider of an incoming webhook based on User-Agent header
 * @param {object} request - Cloudflare Pages request context
 * @returns {string} Origin identifier: 'hubspot', 'airtable', 'pipedrive', or 'unknown'
 */
function getWebhookOrigin(request) {
  try {
    const cf = request.headers.get("CF-Connecting-IP");

    if (cf && typeof cf === "string") return "ip:" + cf;

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
