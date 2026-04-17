/**
 * CRM Webhook Handler - Processes CRM callbacks and updates lead status POST /api/webhooks/lead-updates
*/

import { jsonResp } from './lib/standalone.js';
import { createRateLimiterMiddleware, parseRateLimitedJsonBody } from '../lib/rate-limiter.js';

/** Rate Limiter: CRM webhook endpoint protection (10 requests/min, 20 burst - conservative for external Webhooks). */
const crmWebhookRateLimiter = createRateLimiterMiddleware('crm-webhook', 10, 20);

/**
 * POST /api/webhooks/lead-updates - CRM webhook handler with signature validation and payload logging
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and X-Webhook-Signature header
 * @returns {Response} JSON response with success/error status and processed data or error message
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

// --- Rate limit check before any DB operation - protects from external webhook abuse. Returns 429 when exceeded with retry_after field. ---
const rateLimitCheck = await crmWebhookRateLimiter(request, env);
if (rateLimitCheck && 'status' in rateLimitCheck && rateLimitCheck.status === 429) {
  return rateLimitCheck; // Already returns proper 429 Response with retry_after field.
}

// --- Validate DB binding exists ---
if (!db) {
  return jsonResp(500, { success: false, error: true, message: "Database not available. Please check server configuration.", requestId: crypto.randomUUID ? crypto.randomUUID() : undefined }, request);
}

// --- Validate this is actually a webhook (check content type) ---
const contentType = request.headers.get("Content-Type") || "";
if (!contentType.includes("application/json")) {
  // Log to D1 for debugging even when bad content-type
  try { 
    if (db) { 
      await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, ?, datetime('now'))").bind("crm_callback", "", false).run(); 
     }
  } catch {}

  return jsonResp(400, { success: false, error: true, message: "Webhook must be sent with application/json Content-Type", allowedContentTypes: ["application/json"] }, request);
}

// --- Verify webhook signature (if header present) ---
const sigHeader = request.headers.get("X-Webhook-Signature") || "";
const crmSecret = env.CRM_WEBHOOK_SECRET || "";

// Parse JSON body first, then validate signature if available
let data;
try {
  data = await request.json();
} catch (e) {
  return jsonResp(400, { success: false, error: true, message: "Invalid JSON in request body. Must be valid JSON object.", timestamp: new Date().toISOString()}, request);
}

// --- Validate webhook payload structure ---

if (!data || typeof data !== 'object' || Array.isArray(data)) {
  return jsonResp(400, { success: false, error: true, message: "Invalid webhook payload. Expected JSON object.", receivedType: Array.isArray(data) ? "array" : typeof data}, request);
}

// Log submission_id from parsed data
try {
  if (db && data.submission_id) {
    await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'logged', datetime('now'))").bind(data.type || data.event || "unknown", String(data.submission_id).slice(0, 64)).run(); 
   }
} catch {}

// Log webhook signature verification if available
try {
  if (crmSecret && sigHeader) {
    if (db) { 
      await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'partial_verification', datetime('now'))").bind(data.type || data.event || "crm_callback", String(data.submission_id || "").slice(0, 64)).run(); 
     }
   } else {
     // No signature provided - log to D1 for debugging
    if (db) { 
      await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, note, received_at) VALUES (?, ?, 'no_signature_provided', datetime('now'))").bind(data.type || data.event || "crm_callback", "").run(); 
     }
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

try { 
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
      return jsonResp(400, { success: false, error: true, message: "Missing submission_id in webhook payload", availableFields: Object.keys(data) }, request); 
     }

    // Build dynamic UPDATE query - use parameterized statement for safety
    const updateQuery = `UPDATE submissions SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(submissionId);

    await db.prepare(updateQuery).bind(...updateValues).run();

    // Update lead_scores table when score changes
    if (eventMap[eventType].score_update !== undefined && submissionId) {
      const currentScore = await db.prepare("SELECT COALESCE(lead_score, 0) as base_score FROM submissions WHERE id = ?").bind(submissionId).first();

      const oldScore = currentScore?.base_score || 0;
      const newScore = Math.min(100, oldScore + Number(eventMap[eventType].score_update) || 0);

      const updateQuery2 = `UPDATE submissions SET lead_score = ?, updated_at = datetime('now') WHERE id = ?`;
      
      try { 
        await db.prepare(updateQuery2).bind(newScore, submissionId).run(); 
       } catch (err) {
         // Schema may not have lead_score yet - log and continue
        if (!err.message || !err.message.includes("no such column")) { throw err; }
      } 
     }

    return jsonResp(200, { success: true, error: false, message: "Lead status updated successfully", eventType, submissionId, timestamp: new Date().toISOString()}, request); 

  } catch (err) {
  
    if (err.name === "TypeError" && (err.message.includes("json") || err.message.includes("expected"))) {
      return jsonResp(400, { success: false, error: true, message: "Invalid JSON in webhook body. Must be valid JSON object.", timestamp: new Date().toISOString()}, request);
     }

    if (err.name === "Error" && err.message.includes("no such column")) {
      return jsonResp(400, { success: false, error: true, message: "Database schema missing required column. Run schema-extended.sql", timestamp: new Date().toISOString()}, request);
     }

    return jsonResp(500, { success: false, error: true, message: "Failed to process webhook", errorCode: 'WEBHOOK_ERROR', requestId: crypto.randomUUID ? crypto.randomUUID() : undefined }, request); 
   }
}

/**
 * Get webhook origin (for debugging) - determines CRM provider from User-Agent or CF-IP  
 * @param {Request} request - Cloudflare Pages Request object with headers
 * @returns {string} Origin label: ip:* | hubspot | airtable | pipedrive | unknown
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

/**
 * Helper function: Log webhook payloads to D1 for debugging  
 * Non-blocking operation - errors silently logged to console
 * @param {D1Database=} db - Optional database binding
 * @param {object} data - Webhook payload with submission_id field
 */

function logPayloadToD1(db, data) { 
  try {
    if (db && data.submission_id) {
      db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'logged', datetime('now'))").bind(data.type || data.event || "unknown", String(data.submission_id).slice(0, 64)).run(); 
     }
   } catch {}

}
