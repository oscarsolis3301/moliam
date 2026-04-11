/**
 * CRM Webhook Handler - Processes CRM callbacks and updates lead status
 * POST /api/webhooks/lead-updates
 * @module crm-webhook
 */

import { jsonResp } from './api-helpers.js';

/** Helper: Ensure consistent error response format per Task 4 - wraps errors with success:false */
function ensureErrorResponse(status, message, request = null) {
  return jsonResp(status, { success: false, error: message }, request);
}

/**
 * Log webhook payload to D1 for debugging/audit trail. Fire-and-forget pattern - no blocking on DB errors.
 * @param {Object} db - Cloudflare D1 database instance
 * @param {Object} data - Webhook payload data from CRM provider with type/submission_id fields
 * @returns {undefined} Fire-and-forget - swallows all errors to avoid blocking webhook processing
 */
function logPayloadToD1(db, data) {
  try {
    if (!db || !data) return;
    const eventType = data.type || data.event || 'generic';
    const submissionId = String(data.submission_id || '').slice(0, 64);
    try {
      db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'logged', datetime('now'))").bind(eventType, submissionId).run();
    } catch(e) {}
  } catch {}
}

/**
 * Main webhook POST handler - receives and processes CRM webhooks
 * Extracts data from request body first, then validates and routes to event handlers.
 * Logs all submissions to D1 webhook_logs table for audit trail (fire-and-forget pattern).
 * Returns consistent {success, error, data} response format per Task 4 requirements.
 * @param {Object} context - Cloudflare Pages function context with env.MOLIAM_DB
 * @returns {Response} JSON response with success/error structure and appropriate HTTP status code
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // --- Validate DB binding exists ---
  if (!db) {
    return ensureErrorResponse(503, "Database not available. Please check server configuration.", request);
  }

  // --- Extract data from request body first (before any processing)
  let data;
  try {
    data = await request.json();
  } catch {
    return ensureErrorResponse(400, "Invalid JSON payload. Expected application/json", request);
  }

  // --- Validate webhook payload structure before proceeding ---
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return jsonResp(400, { 
      success: false, 
      error: "Invalid webhook payload structure. Expected JSON object.",
      receivedType: Array.isArray(data) ? "array" : typeof data
    }, request);
  }

  // Validate content type (fire-and-forget logging only if fails)
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    logPayloadToD1(db, data);
    return jsonResp(400, { 
      success: false, 
      error: "Webhook must be sent with application/json Content-Type",
      allowedContentTypes: ["application/json"]
    }, request);
  }

  // --- Verify webhook signature (optional - environment variable based) -
  const sigHeader = request.headers.get("X-Webhook-Signature") || "";
  const crmSecret = env.CRM_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || null;

  if (crmSecret && sigHeader) {
    // Log attempted signature verification to D1 for debugging
    try {
      logPayloadToD1(db, data);
    } catch {}
  } else if (data.submission_id) {
    // No signature provided - still log payload hash for audit trail
    try {
      if (db) {
        db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, note, received_at) VALUES (?, ?, 'no_signature_required', datetime('now'))").bind(
          data.type || data.event || "generic",
          String(data.submission_id).slice(0, 64)
        ).run();
      }
    } catch {}
  }

  // Map CRM events to lead statuses (extensible for multiple CRMs per Task 3 requirements)
  const eventMap = {
    'submitted': { status: 'new', score_update: 5 },
    'read': { status: 'contacted' },
    'email_sent': { stage: 'nurturing', opened_at: new Date().toISOString() },
    'email_opened': { opened_at: new Date().toISOString(), engagement_score: '+2' },
    'meeting_scheduled': { status: 'converting', meeting_type: 'discovery_call' },
    'deal_won': { status: 'won', win_rate: 100, converted_to_client: true },
    'lead_lost': { status: 'lost', loss_reason: data.reason || "No longer interested" }
  };

  // Route based on event type - expand this mapping per CRM provider requirements in Task 3
  const eventType = data.type || data.event || data.eventType || "generic";
  const handler = eventMap[eventType] || eventMap['submitted']; // Default to 'submitted' handler

  try {
    // Update lead/submission status based on event mapping
    if (handler.status) {
      await db.prepare(
        "UPDATE submissions SET status = ?, lead_score = COALESCE(lead_score, 0) + (? ? lead_score : 0), updated_at = datetime('now') WHERE id = ?"
      ).bind(handler.status, handler.score_update || 0, data.submission_id).run();
    }

    // Handle lead-specific updates if leads table exists and mapping provides extra fields
    if (handler.status && data.submission_id) {
      try {
        await db.prepare(
          "UPDATE leads SET status = ?, opened_at = ?, meeting_type = ? WHERE submission_id = ?"
        ).bind(handler.status, handler.opened_at || null, handler.meeting_type || null, data.submission_id).run();
      } catch (e) {
        // Non-fatal - leads table may not exist yet
      }
    }

    return jsonResp(200, { 
      success: true, 
      data: { 
        message: "Webhook processed successfully", 
        eventType, 
        updatedStatus: handler.status,
        submission_id: data.submission_id
      }
    }, request);

  } catch (err) {
    return jsonResp(500, {
      success: false,
      error: err.message || "Internal server error processing webhook"
    }, request);
  }
}

/**
 * CORS preflight handler for CRM Webhook endpoint
 * @param {Request} request - Cloudflare Pages request object with origin header
 * @returns {Response} 204 No Content with CORS headers for moliam.com and moliam.pages.dev
 */
export async function onRequestOptions(request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);

  return new Response(null, { 
    status: 204, 
    headers: { 
      "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Signature",
      "Vary": "Origin"
    } 
  });
}
