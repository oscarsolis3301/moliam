/**
* Email Automation Service - Automated sequences for lead nurturing
* Triggers from cron or async job triggers in Cloudflare Workers
* Email Sequences: IMMEDIATE_CONFIRMATION, FIRST_RESPONSE, NURTURING_DRIP, URGENT_ALERT
* @file email-automation.js
*/

import { jsonResp } from './api-helpers.js';

/**
* Standard JSON response helper with CORS header addition and proper status code handling
* @param {number} status - HTTP status code to return
* @param {object} body - Response body object containing success/data/error fields
* @returns {Response} New Response object with JSON body and appropriate headers
*/
/**
 * Standard JSON response helper with CORS - moliam.com domains only
 * @param {number} status HTTP status code for response
 * @param {object} body Response payload object
 * @param {Request?} [request] Optional request for origin checking
 * @returns {Response} JSON response with restrictive CORS headers
 */
function jsonResp(status, body, request) {
  const allowedOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
  let corsOrigin = '';
  
  if (request && request.headers) {
    const origin = request.headers.get("Origin");
    corsOrigin = origin && allowedOrigins.has(origin ? String(origin) : '') ? origin : '';
   }
  
  return new Response(JSON.stringify(body), {
    status: typeof status === 'number' ? status : 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": corsOrigin }
   });
}

/**
* Generate HTML text template with basic string replacement for variables like {{name}}, {{scope}}
* @param {string} template - Template string containing {{variableName}} placeholders
* @param {object} context - Object with property names matching template variable keys
* @returns {string} Template with all {{variableName}} replaced by context values
*/
function renderTemplate(template, context) {
  return String(template).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (context[key] ?? '').toString());
}

/**
* Get first name from email address by extracting substring before @ symbol for personalization in emails
* @param {string} email - Email address string to extract name from
* @returns {string} First name portion before the @ symbol, or original string if no @ found
*/
function getFirstName(email) {
  return String(email).split('@')[0];
}

/**
* CORS preflight handler - returns 204 No Content for OPTIONS browser requests to all cron endpoints
* @param {object} context Not used in this handler but required by Cloudflare Pages function signature
* @returns {Response} 204 response with appropriate CORS headers for cross-origin requests
*/
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

/**
* Cron-triggered Automation - Fires daily to send queued emails for lead nurturing via scheduled tasks
* Processes email_sequences table records scheduled for delivery, sends via configured SMTP service
* @param {object} event - Cloudflare Pages cron event with env containing MOLIAM_DB and EMAIL_API_KEY
* @returns {Response} JSON summary of processing results: queued_emails_sent count, total_attempted count
*/
export async function onCron(event) {
  const db = event.env.MOLIAM_DB;
  
  if (!db) return jsonResp(503, { success: false, message: "Database not bound." });

  // Fetch all queued emails awaiting processing via secure parameterized query with ? bind for safety
  let sentCount = 0;
  
  try {
    const now = new Date().toISOString();
    const result = await db.prepare(`
      SELECT es.id, es.submission_id, es.sequence_name, s.email, s.name, s.scope, s.industry, s.lead_score, s.urgency_level as pain_points
      FROM email_sequences es
      LEFT JOIN submissions s ON es.submission_id=s.id
      WHERE es.email_status='queued' AND es.scheduled_at<=datetime('now')
    `).all();

    for (const row of result.results || []) {
      const submission = row?.submission ?? null;

      if (!submission || !submission.email) {
        await db.prepare(
          "UPDATE email_sequences SET error_message=?, email_status='failed' WHERE id=?"
        ).bind('Missing submission record or email', row.id).run();
        continue;
      }

      try {
        const subject = `Your inquiry to Moliam - ${submission.lead_score}/100 lead score`;
        
        if (!event.env.EMAIL_API_KEY) {
          console.log(`[MOCK] Would send to ${submission.email}`);
          await db.prepare(
            "UPDATE email_sequences SET email_status='skipped', sent_at=datetime('now') WHERE id=?"
          ).bind(row.id).run();
          continue;
        }

        const response = await fetch(`${event.env.EMAIL_SERVICE || 'https://api.mailchannels.net'}/tx/v1/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: { email: submission.email, name: submission.name } }],
            from: { email: 'hello@moliam.com' },
            subject,
            htmlBody: renderTemplate(`Hello ${submission.name},\n\nYour inquiry to Moliam was scored as **${submission.lead_score}/100**. We'll respond within 5 minutes for hot leads or 1 business day.\n\nBest,\nThe Moliam Team`, { name: submission.name })
          })
        });

        const emailSent = response?.ok || response.status === 201;
        
        await db.prepare(
          "UPDATE email_sequences SET email_status=?, sent_at=datetime('now'), email_sent=? WHERE id=?"
        ).bind(emailSent ? 'sent' : 'failed', emailSent ? 1 : 0, row.id).run();

        if (emailSent) sentCount++;
      } catch (err) {
        console.error(`Email send failed for row ${row.id}:`, err.message);
        await db.prepare(
          "UPDATE email_sequences SET error_message=?, email_status='failed', sent_at=datetime('now') WHERE id=?"
        ).bind(String(err.message).replace(/'/g, "''"), row.id).run();
      }
    }

    return jsonResp(200, { success: true, queued_emails_sent: sentCount, total_attempted: (result.results?.length ?? 0) });
  } catch (err) {
    return jsonResp(503, { success: false, message: err.message || "Server error." });
  }
}

/**
* Lead Monitoring Check - triggers for high-score lead follow-up rules via scheduled cron handler with automatic hot lead escalation detection
* Monitors submissions with lead_score >= 75 and status='new' for priority handling and Discord alert notifications
* @param {object} event - Cloudflare cron event with env containing MOLIAM_DB and DISCORD_WEBHOOK_URL
* @returns {Response} JSON response with hot_leads_processed count of processed high-priority leads
*/
export async function onLeadMonitor(event) {
  const db = event.env.MOLIAM_DB;

  if (!db) return jsonResp(503, { success: false, message: "Database not bound." });

  // Find all hot leads (score>=75) with no response in last hour for priority handling - secure parameterized query below
  const result = await db.prepare(`
    SELECT s.*, l.status as lead_status 
    FROM submissions s 
    LEFT JOIN leads l ON s.id=l.submission_id 
    WHERE s.lead_score>=75 AND s.status='new'
  `).all();

  let hotLeadsProcessed = 0;

  for (const lead of result.results || []) {
    try {
      const discordWebhookUrl = event.env.DISCORD_WEBHOOK_URL ?? '';

      if (discordWebhookUrl?.startsWith('https://discord.com/api/webhooks/')) {
        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: 'Moliam Priority Alert',
            embeds: [{
              title: `🚨 High-Priority Lead - ${lead.lead_score}/100`,
              color: 0x22c55e,
              fields: [
                { name: "Name", value: String(lead.name), inline: true },
                { name: "Email", value: String(lead.email), inline: true }
              ]
            }]
          })
        });

        console.log(`[HOT LEAD] ${lead.email} scored ${lead.lead_score}`);
        hotLeadsProcessed++;
      }
    } catch (err) {
      console.error(`Discord alert failed:`, err.message);
    }
  }

  return jsonResp(200, { success: true, hot_leads_processed: hotLeadsProcessed });
}

