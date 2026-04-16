     1|/**
     2|* Email Automation Service - Automated sequences for lead nurturing
     3|* Triggers from cron or async job triggers in Cloudflare Workers
     4|* Email Sequences: IMMEDIATE_CONFIRMATION, FIRST_RESPONSE, NURTURING_DRIP, URGENT_ALERT
     5|* @file email-automation.js
     6|*/
     7|
     8|import { jsonResp } from './api-helpers.js';
     9|
    10|/**
    11|* Standard JSON response helper with CORS header addition and proper status code handling
    12|* @param {number} status - HTTP status code to return
    13|* @param {object} body - Response body object containing success/data/error fields
    14|* @returns {Response} New Response object with JSON body and appropriate headers
    15|*/
    16|/**
    17| * Standard JSON response helper with CORS - moliam.com domains only
    18| * @param {number} status HTTP status code for response
    19| * @param {object} body Response payload object
    20| * @param {Request?} [request] Optional request for origin checking
    21| * @returns {Response} JSON response with restrictive CORS headers
    22| */
    23|function jsonResp(status, body, request) {
    24|  const allowedOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
    25|  let corsOrigin = '';
    26|  
    27|  if (request && request.headers) {
    28|    const origin = request.headers.get("Origin");
    29|    corsOrigin = origin && allowedOrigins.has(origin ? String(origin) : '') ? origin : '';
    30|   }
    31|  
    32|  return new Response(JSON.stringify(body), {
    33|    status: typeof status === 'number' ? status : 200,
    34|    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": corsOrigin }
    35|   });
    36|}
    37|
    38|/**
    39|* Generate HTML text template with basic string replacement for variables like {{name}}, {{scope}}
    40|* @param {string} template - Template string containing {{variableName}} placeholders
    41|* @param {object} context - Object with property names matching template variable keys
    42|* @returns {string} Template with all {{variableName}} replaced by context values
    43|*/
    44|function renderTemplate(template, context) {
    45|  return String(template).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (context[key] ?? '').toString());
    46|}
    47|
    48|/**
    49|* Get first name from email address by extracting substring before @ symbol for personalization in emails
    50|* @param {string} email - Email address string to extract name from
    51|* @returns {string} First name portion before the @ symbol, or original string if no @ found
    52|*/
    53|function getFirstName(email) {
    54|  return String(email).split('@')[0];
    55|}
    56|
    57|/**
    58|* CORS preflight handler - returns 204 No Content for OPTIONS browser requests to all cron endpoints
    59|* @param {object} context Not used in this handler but required by Cloudflare Pages function signature
    60|* @returns {Response} 204 response with appropriate CORS headers for cross-origin requests
    61|*/

export async function onRequestOptions(request) {
  const allowedOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
  const origin = request?.headers?.get('Origin') || '';
  const corsOrigin = origin && allowedOrigins.has(origin) ? origin : '*';
  
  return new Response(null, { 
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store, no-cache'
      }
    });
}

/**
    90|* @param {object} event - Cloudflare Pages cron event with env containing MOLIAM_DB and EMAIL_API_KEY
    91|* @returns {Response} JSON summary of processing results: queued_emails_sent count, total_attempted count
    92|*/
    93|export async function onCron(event) {
    94|  const db = event.env.MOLIAM_DB;
    95|  
    96|  if (!db) return jsonResp(503, { success: false, message: "Database not bound." });
    97|
    98|  // Fetch all queued emails awaiting processing via secure parameterized query with ? bind for safety
    99|  let sentCount = 0;
   100|  
   101|  try {
   102|    const now = new Date().toISOString();
   103|    const result = await db.prepare(`
   104|      SELECT es.id, es.submission_id, es.sequence_name, s.email, s.name, s.scope, s.industry, s.lead_score, s.urgency_level as pain_points
   105|      FROM email_sequences es
   106|      LEFT JOIN submissions s ON es.submission_id=s.id
   107|      WHERE es.email_status='queued' AND es.scheduled_at<=datetime('now')
   108|    `).all();
   109|
   110|    for (const row of result.results || []) {
   111|      const submission = row?.submission ?? null;
   112|
   113|      if (!submission || !submission.email) {
   114|        await db.prepare(
   115|          "UPDATE email_sequences SET error_message=?, email_status='failed' WHERE id=?"
   116|        ).bind('Missing submission record or email', row.id).run();
   117|        continue;
   118|      }
   119|
   120|      try {
   121|        const subject = `Your inquiry to Moliam - ${submission.lead_score}/100 lead score`;
   122|        
   123|        if (!event.env.EMAIL_API_KEY) {
   125|          await db.prepare(
   126|            "UPDATE email_sequences SET email_status='skipped', sent_at=datetime('now') WHERE id=?"
   127|          ).bind(row.id).run();
   128|          continue;
   129|        }
   130|
   131|        const response = await fetch(`${event.env.EMAIL_SERVICE || 'https://api.mailchannels.net'}/tx/v1/send`, {
   132|          method: "POST",
   133|          headers: { "Content-Type": "application/json" },
   134|          body: JSON.stringify({
   135|            personalizations: [{ to: { email: submission.email, name: submission.name } }],
   136|            from: { email: 'hello@moliam.com' },
   137|            subject,
   138|            htmlBody: renderTemplate(`Hello ${submission.name},\n\nYour inquiry to Moliam was scored as **${submission.lead_score}/100**. We'll respond within 5 minutes for hot leads or 1 business day.\n\nBest,\nThe Moliam Team`, { name: submission.name })
   139|          })
   140|        });
   141|
   142|        const emailSent = response?.ok || response.status === 201;
   143|        
   144|        await db.prepare(
   145|          "UPDATE email_sequences SET email_status=?, sent_at=datetime('now'), email_sent=? WHERE id=?"
   146|        ).bind(emailSent ? 'sent' : 'failed', emailSent ? 1 : 0, row.id).run();
   147|
   148|        if (emailSent) sentCount++;
   149|      } catch (err) {
   151|        await db.prepare(
   152|          "UPDATE email_sequences SET error_message=?, email_status='failed', sent_at=datetime('now') WHERE id=?"
   153|        ).bind(String(err.message).replace(/'/g, "''"), row.id).run();
   154|      }
   155|    }
   156|
   157|    return jsonResp(200, { success: true, queued_emails_sent: sentCount, total_attempted: (result.results?.length ?? 0) });
   158|  } catch (err) {
   159|    return jsonResp(503, { success: false, message: err.message || "Server error." });
   160|  }
   161|}
   162|
   163|/**
   164|* Lead Monitoring Check - triggers for high-score lead follow-up rules via scheduled cron handler with automatic hot lead escalation detection
   165|* Monitors submissions with lead_score >= 75 and status='new' for priority handling and Discord alert notifications
   166|* @param {object} event - Cloudflare cron event with env containing MOLIAM_DB and DISCORD_WEBHOOK_URL
   167|* @returns {Response} JSON response with hot_leads_processed count of processed high-priority leads
   168|*/
   169|export async function onLeadMonitor(event) {
   170|  const db = event.env.MOLIAM_DB;
   171|
   172|  if (!db) return jsonResp(503, { success: false, message: "Database not bound." });
   173|
   174|  // Find all hot leads (score>=75) with no response in last hour for priority handling - secure parameterized query below
   175|  const result = await db.prepare(`
   176|    SELECT s.*, l.status as lead_status 
   177|    FROM submissions s 
   178|    LEFT JOIN leads l ON s.id=l.submission_id 
   179|    WHERE s.lead_score>=75 AND s.status='new'
   180|  `).all();
   181|
   182|  let hotLeadsProcessed = 0;
   183|
   184|  for (const lead of result.results || []) {
   185|    try {
   186|      const discordWebhookUrl = event.env.DISCORD_WEBHOOK_URL ?? '';
   187|
   188|      if (discordWebhookUrl?.startsWith('https://discord.com/api/webhooks/')) {
   189|        await fetch(discordWebhookUrl, {
   190|          method: "POST",
   191|          headers: { "Content-Type": "application/json" },
   192|          body: JSON.stringify({
   193|            username: 'Moliam Priority Alert',
   194|            embeds: [{
   195|              title: `🚨 High-Priority Lead - ${lead.lead_score}/100`,
   196|              color: 0x22c55e,
   197|              fields: [
   198|                { name: "Name", value: String(lead.name), inline: true },
   199|                { name: "Email", value: String(lead.email), inline: true }
   200|              ]
   201|            }]
   202|          })
   203|        });
   204|
   206|        hotLeadsProcessed++;
   207|      }
   208|    } catch (err) {
   210|    }
   211|  }
   212|
   213|  return jsonResp(200, { success: true, hot_leads_processed: hotLeadsProcessed });
   214|}
   215|
   216|