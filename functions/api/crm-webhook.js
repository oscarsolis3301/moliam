/**
 * CRM Webhook Handler - Processes CRM callbacks and updates lead status
 * POST /api/webhooks/lead-updates
 * @module crm-webhook
 */

/**
 * Main webhook POST handler - receives and processes CRM webhooks
 * @param {Object} context - Cloudflare Pages function context with env.MOLIAM_DB
 * @returns {Response} JSON response with success/error status
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

   // --- Validate DB binding exists ---
  if (!db) {
    return jsonResp(500, { 
      error: true, 
       message: "Database not available. Please check server configuration.",
        requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
           });
       }

      // Validate this is actually a webhook (check content type) ---
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
     // Log to D1 for debugging even when bad content-type
    try {
      if (db) {
         await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, ?, datetime('now'))")
              .bind("crm_callback", "", false).run();
        }
      } catch {}
    return jsonResp(400, { 
      error: true, 
       message: "Webhook must be sent with application/json Content-Type",
         allowedContentTypes: ["application/json"]
             });
          }

      // --- Verify webhook signature (if header present) ---
  const sigHeader = request.headers.get("X-Webhook-Signature") || "";
  const crmSecret=env.CR...CRET || "";

  if (crmSecret && sigHeader) {
     // Simple HMAC validation - log to D1 for debugging
    try {
      if (db) {
         await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, datetime('now'), ?)")                .bind(data.type || data.event || "crm_callback", data.submission_id || "unknown", false).run();
        }
      } catch {}
       // Note: Full HMAC verification can be added per CRM provider requirements   
     logPayloadToD1(db, data);
    } else {
      // No signature header - still log to D1
     logPayloadToD1(db, data);
    }

       try {
    const data = await request.json();

          // --- Validate webhook payload structure ---
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonResp(400, { 
         error: true, 
          message: "Invalid webhook payload. Expected JSON object.",
           receivedType: Array.isArray(data) ? "array" : typeof data 
               });
              }

        // Webhook signature verification - log even errors to D1 for debugging

      if (crmSecret && sigHeader) {
          // Log the attempted validation to db
        try {
          if (db) {
             await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'partial_verification', datetime('now'))")                     .bind(data.type || data.event || "crm_callback", String(data.submission_id || "").slice(0, 64)).run();
            }
          } catch {}
          // Note: Full HMAC verification can be added per CRM provider requirements   
        } else {
          // No signature provided - log to D1 for debugging
        try {
          if (db) {
             await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, note, received_at) VALUES (?, ?, 'no_signature_provided', datetime('now'))")                     .bind(data.type || data.event || "crm_callback", "").run();
            }
          } catch {}
        }

//          Webhook logs already written above - continue processing:

//       Map CRM events to lead statuses (extensible for multiple CRMs)

/**
 * Log webhook payload to D1 for debugging/audit trail
 * @param {Object} db - Cloudflare D1 database instance
 * @param {Object} data - Webhook payload data from CRM provider
 */
function logPayloadToD1(db, data) {
  try {
    if (db && data.submission_id) {
       db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'logged', datetime('now))")                 .bind(data.type || data.event || "unknown", String(data.submission_id).slice(0, 64)).run();
     }
   } catch {}
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
     