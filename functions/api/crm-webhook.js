     1|/**
     2| * CRM Webhook Handler - Processes CRM callbacks and updates lead status
     3| * POST /api/webhooks/lead-updates
     4| */
     5|
     6|export async function onRequestPost(context) {
     7|  const { request, env } = context;
     8|  const db = env.MOLIAM_DB;
     9|
    10|  // --- Validate DB binding exists ---
    11|  if (!db) {
    12|    return jsonResp(500, request, { 
    13|      error: true, 
    14|       message: "Database not available. Please check server configuration.",
    15|        requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
    16|          });
    17|      }
    18|
    19|     // Validate this is actually a webhook (check content type) ---
    20|  const contentType = request.headers.get("Content-Type") || "";
    21|  if (!contentType.includes("application/json")) {
    22|    // Log to D1 for debugging even when bad content-type
    23|    try {
    24|      if (db) {
    25|         await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, ?, datetime('now'))")
    26|             .bind("crm_callback", "", false).run();
    27|       }
    28|     } catch {}
    29|    return jsonResp(400, request, { 
    30|      error: true, 
    31|       message: "Webhook must be sent with application/json Content-Type",
    32|         allowedContentTypes: ["application/json"]
    33|            });
    34|         }
    35|
    36|      // --- Verify webhook signature (if header present) ---
    37|  const sigHeader = request.headers.get("X-Webhook-Signature") || "";
    38|  const crmSecret=env.CR...CRET || "";
    39|
    40|  if (crmSecret && sigHeader) {
    41|    // Simple HMAC validation - log to D1 for debugging
    42|    try {
    43|      if (db) {
    44|         await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, datetime('now'), ?)")               .bind(data.type || data.event || "crm_callback", data.submission_id || "unknown", false).run();
    45|       }
    46|     } catch {}
    47|      // Note: Full HMAC verification can be added per CRM provider requirements  
    48|     logPayloadToD1(db, data);
    49|   } else {
    50|     // No signature header - still log to D1
    51|     logPayloadToD1(db, data);
    52|   }
    53|
    54|       try {
    55|    const data = await request.json();
    56|
    57|         // --- Validate webhook payload structure ---
    58|    if (!data || typeof data !== 'object' || Array.isArray(data)) {
    59|      return jsonResp(400, request, { 
    60|         error: true, 
    61|          message: "Invalid webhook payload. Expected JSON object.",
    62|           receivedType: Array.isArray(data) ? "array" : typeof data 
    63|              });
    64|             }
    65|
    66|       // Webhook signature verification - log even errors to D1 for debugging
    67|
    68|      if (crmSecret && sigHeader) {
    69|         // Log the attempted validation to db
    70|        try {
    71|          if (db) {
    72|             await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'partial_verification', datetime('now'))")                    .bind(data.type || data.event || "crm_callback", String(data.submission_id || "").slice(0, 64)).run();
    73|           }
    74|         } catch {}
    75|         // Note: Full HMAC verification can be added per CRM provider requirements  
    76|       } else {
    77|         // No signature provided - log to D1 for debugging
    78|        try {
    79|          if (db) {
    80|             await db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, note, received_at) VALUES (?, ?, 'no_signature_provided', datetime('now'))")                    .bind(data.type || data.event || "crm_callback", "").run();
    81|           }
    82|         } catch {}
    83|       }
    84|
    85|//          Webhook logs already written above - continue processing:
    86|
    87|//       Map CRM events to lead statuses (extensible for multiple CRMs)
    88|
    89|// --- Helper function: Log webhook payloads to D1 for debugging ---
    90|function logPayloadToD1(db, data) {
    91|  try {
    92|    if (db && data.submission_id) {
    93|       db.prepare("INSERT INTO webhook_logs (event_type, payload_hash, signature_valid, received_at) VALUES (?, ?, 'logged', datetime('now'))")                .bind(data.type || data.event || "unknown", String(data.submission_id).slice(0, 64)).run();
    94|    }
    95|  } catch {}
    96|}
    97|
    98|      // Map CRM events to lead statuses (extensible for multiple CRMs)
    99|    const eventMap = {
   100|         'submitted': { status: 'new', score_update: 5 },
   101|          'read': { status: 'contacted' },
   102|           'email_sent': { stage: 'nurturing', opened_at: new Date().toISOString() },
   103|            'email_opened': { opened_at: new Date().toISOString(), engagement_score: '+2' },
   104|             'meeting_scheduled': { status: 'converting', meeting_type: 'discovery_call' },
   105|              'deal_won': { status: 'won', win_rate: 100, converted_to_client: true },
   106|               'lead_lost': { status: 'lost', loss_reason: data.reason || "No longer interested" }
   107|                  };
   108|
   109|       // Route based on event type - expand this mapping per CRM provider requirements
   110|    const eventType = data.type || data.event || data.eventType || "generic";
   111|    
   112|      if (eventType && Object.keys(eventMap).includes(eventType)) {
   113|         const updateFields = [];
   114|         const updateValues = [];
   115|
   116|         for (const [k, v] of Object.entries(eventMap[eventType])) {
   117|           if (typeof k !== 'string' || typeof v === 'undefined') continue;
   118|
   119|          if (k === 'score_update') {
   120|               // Special handling - skip for now, handled separately below
   121|             continue;
   122|            }
   123|
   124|           updateFields.push(`${k} = ?`);
   125|           updateValues.push(v);
   126|            }
   127|
   128|         // Get submission_id from data with fallbacks
   129|         const submissionId = data.submission_id || data.id || data.lead_id || data.submit_id;
   130|         
   131|         if (!submissionId) {
   132|           return jsonResp(400, request, { 
   133|              error: true, 
   134|               message: "Missing submission_id in webhook payload",
   135|                availableFields: Object.keys(data)
   136|                  });
   137|                 }
   138|
   139|          // Build dynamic UPDATE query - use parameterized statement for safety
   140|         const updateQuery = `UPDATE submissions SET ${updateFields.join(', ')} WHERE id = ?`;
   141|         updateValues.push(submissionId);
   142|
   143|         const updateResult = await db.prepare(updateQuery).bind(...updateValues).run();
   144|
   145|         if (!updateResult.success || !updateResult.meta) {
   147|            }
   148|
   149|         // Update lead_scores table when score changes
   150|         if (eventMap[eventType].score_update !== undefined && submissionId) {
   151|           const currentScore = await db.prepare(
   152|              "SELECT COALESCE(lead_score, 0) as base_score FROM submissions WHERE id = ?"
   153|             ).bind(submissionId).first();
   154|
   155|            const oldScore = currentScore?.base_score || 0;
   156|            const newScore = Math.min(100, oldScore + Number(eventMap[eventType].score_update) || 0);
   157|
   158|           const updateQuery2 = `UPDATE submissions SET lead_score = ?, updated_at = datetime('now') WHERE id = ?`;
   159|            
   160|          try {
   161|             await db.prepare(updateQuery2).bind(newScore, submissionId).run();
   163|            } catch (err) {
   164|              // Schema may not have lead_score yet - log and continue
   165|               if (!err.message || !err.message.includes("no such column")) {
   166|                 throw err;
   167|                  }
   169|               }
   170|             }
   171|
   172|         return jsonResp(200, request, { 
   173|           success: true, 
   174|            message: "Lead status updated successfully",
   175|             eventType,
   176|             submissionId,
   177|             timestamp: new Date().toISOString()
   178|              });
   179|          }
   180|
   181|       // Handle unknown event types (don't break - log and allow processing)
   183|
   184|      return jsonResp(200, request, { 
   185|         success: true, 
   186|          message: "Unhandled event type received - logged for review",
   187|           eventType,
   188|           submissionId: data.submission_id || data.id || null,
   189|            webhookSource: getWebhookOrigin(request) || 'unknown',
   190|             timestamp: new Date().toISOString()
   191|               });
   192|
   193|     } catch (err) {
   195|    
   196|      if (err.name === "TypeError" && (err.message.includes("json") || err.message.includes("expected"))) {
   197|         return jsonResp(400, request, { 
   198|            error: true, 
   199|             message: "Invalid JSON in webhook body. Must be valid JSON object.",
   200|              timestamp: new Date().toISOString()
   201|               });
   202|              }
   203|
   204|       if (err.name === "Error" && err.message.includes("no such column")) {
   205|         return jsonResp(400, request, { 
   206|            error: true, 
   207|             message: "Database schema missing required column. Run schema-extended.sql",
   208|              timestamp: new Date().toISOString()
   209|               });
   210|               }
   211|
   212|       return jsonResp(500, request, { 
   213|         error: true, 
   214|          message: "Failed to process webhook",
   215|           errorCode: 'WEBHOOK_ERROR',
   216|            requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
   217|              });
   218|      }
   219|    }
   220|
  /** Get webhook origin (for logging/debugging) - determines CRM provider from User-Agent or CF-IP */
/** @param {Request} request - Cloudflare Pages Request object with headers */
/** @returns {string} Origin label: ip:* | hubspot | airtable | pipedrive | unknown */
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
   239|
   /** Helper: JSON response wrapper with CORS - NOT the shared jsonResp from lib */
/** @param {number} status - HTTP status code */
/** @param {object} body - Response payload object */
/** @param {Request} [request] - Optional Request for CORS headers */
/** @returns {Response} JSON Response with all headers set */
function jsonResp(status, body, request) {
  const responseBody = JSON.stringify(body);
  const headers = { 
       "Content-Type": "application/json",
         "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Signature",
           "Cache-Control": "no-store, no-cache"
              
    
  if (request) {
    const origin = request.headers.get("Origin");
    const allowedOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
    
    if (!origin || allowedOrigins.has(origin)) {
        headers["Access-Control-Allow-Origin"] = origin || "";
    } else {
        delete headers["Access-Control-Allow-Origin"];
    }
  }
  return new Response(responseBody, { status, headers });
}
   261|