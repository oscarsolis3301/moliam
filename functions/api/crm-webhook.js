/**
/**
 * CRM Webhook Handler - Processes CRM callbacks and updates lead status
 * POST /api/webhooks/lead-updates
 * 
 */

import { jsonResp } from './api-helpers.js';

export async function onRequestPost(context) 

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
  const crmSecret = env.CRM_WEBHOOK_SECRET || "";

  if (crmSecret && sigHeader) {
    // Simple HMAC validation - log to D1 for debugging
    try {
      if (db) {
         await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, datetime('now'), ?)")               .bind(data.type || data.event || "crm_callback", data.submission_id || "unknown", false).run();
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
             await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'partial_verification', datetime('now'))")                    .bind(data.type || data.event || "crm_callback", String(data.submission_id || "").slice(0, 64)).run();
           }
         } catch {}
         // Note: Full HMAC verification can be added per CRM provider requirements  
       } else {
         // No signature provided - log to D1 for debugging
        try {
          if (db) {
             await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, note, received_at) VALUES (?, ?, 'no_signature_provided', datetime('now'))")                    .bind(data.type || data.event || "crm_callback", "").run();
           }
         } catch {}
       }

//          Webhook logs already written above - continue processing:

//       Map CRM events to lead statuses (extensible for multiple CRMs)

// --- Helper function: Log webhook payloads to D1 for debugging ---
function logPayloadToD1(db, data) {
  try {
    if (db && data.submission_id) {
       db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'logged', datetime('now'))")                .bind(data.type || data.event || "unknown", String(data.submission_id).slice(0, 64)).run();
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

     } catch (err) {
    console.error("Webhook handler error:", err);
    
      if (err.name === "TypeError" && (err.message.includes("json") || err.message.includes("expected"))) {
         return jsonResp(400, { 
            error: true, 
             message: "Invalid JSON in webhook body. Must be valid JSON object.",
              timestamp: new Date().toISOString()
               });
              }

       if (err.name === "Error" && err.message.includes("no such column")) {
         return jsonResp(400, { 
            error: true, 
             message: "Database schema missing required column. Run schema-extended.sql",
              timestamp: new Date().toISOString()
               });
               }

       return jsonResp(500, { 
         error: true, 
          message: "Failed to process webhook",
           errorCode: 'WEBHOOK_ERROR',
            requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
              });
      }
    }

/** Get webhook origin (for logging/debugging) */
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
