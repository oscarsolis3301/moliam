/**
 * Email Automation Service - Automated sequences for lead nurturing
 * Triggers from cron or async job triggers in Cloudflare Workers
 * 
 * Email Sequences:
 * 1. IMMEDIATE CONFIRMATION → sent instantly upon lead capture ✓
 * 2. FIRST RESPONSE → after 15 minutes if no reply
 * 3. NURTURING DRIP → daily follow-up emails for 7 days
 * 4. URGENT LEAD ALERT → for leads scoring 75+ with no response in 1 hour
 */

import { jsonResp } from './lib/api-helpers.js';

// Email templates (using handlebars-style variables, sent via Postmark/MailerSend)
const EMAIL_TEMPLATES = {
       // Template 1: Immediate Confirmation (triggers instantly on lead capture)
      'immediate_confirmation': `
Hello {{name}},

Thank you for reaching out to MOLIAM! We've received your inquiry regarding "{{scope}}" and your estimated budget of {{budget}}.

Your inquiry has been automatically scored at **{{lead_score}}/100** based on:
- Industry fit: {{industry}} 
- Urgency level: {{urgency_level}}
- Message keywords detected: urgency, immediate, deadline

**What happens next?**
Our team will review your lead and respond within 5 minutes for hot leads (score 75+) or 1 business day.

Reply to this email with any additional questions, or schedule a call directly: https://moliam.com/schedule

Best regards,
The MOLIAM Team

---
MOLIAMA - AI Operations HQ
hello@moliam.com | +1 (555) 019-2834
        `,

       // Template 2: First Response (triggers 15 min after submission if no reply)
      'first_response': `Hi {{name}},

I'm Ada, MOLIAM's AI Operations Lead. I noticed you mentioned "{{pain_points}}" when you submitted your inquiry.

Quick question: Is there a specific deadline or event driving this project timeline? The sooner we clarify that, the faster I can get our engineering team to draft a solution scope for you.

Best regards,
Ada <ada@moliam.com>`,

       // Template 3: Nurturing Drip (daily follow-up, day 1-7)
      'nurturing_drip': `{{name}},

Following up on your recent inquiry about {{scope}}. Our AI operations team has successfully delivered similar projects for {{industry}} companies including [Client A], [Client B], and [Client C].

**Key capabilities we provide:**
- Full-stack web development with React/Vue/Svelte
- AI-powered analytics and automation tools
- Database design and optimization (PostgreSQL/MongoDB)
- Real-time dashboards and API integrations

Would you have 15 minutes this week to discuss your project scope? I'm available Mon-Fri 9am-5pm EST.

Talk soon,
Ada | MOLIAM Team`,

       // Template 4: URGENT LEAD - For high-score leads (75+) followed up after 1 hour no response
      'urgent_alert': `URGENT: {{name}}, we need to connect ASAP about your project "{{scope}}". 

Our scoring system detected that you're looking for quick turnaround on this {{industry}} initiative. We have engineering availability this week only for projects prioritized as high-urgency.

Call me directly: Ada (+1 555-019-2834) or email back immediately.

Best,
Ada @ moliam.com`
        };

/**
 * Email Sender - Integration with Postmark/MailerSend/Mailgun (stub for production)
 */
async function sendEmail(emailService, to, from, subject, htmlBody, env, template_name) {
  try {
        if (!env || Object.keys(env).length === 0) {
            return jsonResp(200, { success: true, message: "Email queued (mocked)", template: template_name });}

      const authKey = emailService === 'postmark' ? env.POSTMARK_API_KEY :
         emailService === 'mailersend' ? env.MAILERSEND_API_KEY :
         env.SENDGRID_API_KEY;

       if (!authKey) {
            return jsonResp(200, { success: true, message: "Email queued (no provider configured)", template: template_name });}

      const endpoint = 
           emailService === 'postmark' ? 'https://api.postmarkapp.com/email' :
           emailService === 'mailersend' ? 'https://api.mailersend.com/api/v1/email/send' :
           emailService === 'sendgrid' ? 'https://api.sendgrid.com/v3/mail/send' :
           null;

       if (!endpoint) return jsonResp(400, { success: false, error: "Invalid email service" });

      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
            ...(emailService === 'postmark' ? { 'X-Postmark-Server-Token': authKey } : {}),
            ...(emailService === 'sendgrid' ? { 'Authorization': `Bearer ${authKey}` } : {})
            },
          body: JSON.stringify({
              From: from,
              To: to,
              Subject: subject,
              Html: renderTemplate(htmlBody, { name: getFirstName(to), lead_score: 75 })
                  }),
          signal: AbortSignal.timeout(10000) // 10s timeout for email service
            });

        return jsonResp(200, { success: response.ok || response.status === 201, message: "Email sent" });} catch (err) {
         console.warn("Email send failed:", err.message);
       return jsonResp(500, { success: false, error: "Email delivery failed", template: template_name });
      }
}

/**
 * Cron-triggered Automation - Fires daily to send queued emails
 */
export async function onCron(event) {
  const db = event.env.MOLIAM_DB;
  
  if (!db) {
       return jsonResp(503, { error: true, message: "Database not available" });}

       // Send all queued emails for their scheduled time
    const now = new Date().toISOString();
     let sentCount = 0;

      try {
        const result = await db.prepare(
           `SELECT es.id, es.submission_id, es.sequence_name, s.email, s.name, s.scope, s.industry, s.lead_score, s.urgency_level as pain_points
             FROM email_sequences es
             LEFT JOIN submissions s ON es.submission_id = s.id
             WHERE es.email_status = 'queued'
                AND es.scheduled_at <= datetime('now')`
           ).all();

        for (const row of result.results || []) {
         const submission = row.submission;

          if (!submission || !submission.email) {
            await db.prepare(
                   `UPDATE email_sequences SET error_message = ?, email_status = 'failed' WHERE id = ?`
                 ).bind("Missing submission record or email", row.id).run();
              continue;}

         try {
             // Select appropriate template based on sequence and urgency
           const templateName = getTemplateForSequence(row.sequence_name, submission);
               const subject = getSubject(templateName);
               const emailBody = renderTemplate(EMAIL_TEMPLATES[templateName], {
                  name: submission.name || "there",
                  scope: submission.scope || "your inquiry",
                  industry: submission.industry || "your industry",
                  budget: submission.budget || "undisclosed",
                  urgency_level: submission.urgency_level,
                  lead_score: submission.lead_score || 50,
                  pain_points: submission.pain_points
                });

              const emailResult = await sendEmail('postmark', submission.email, 'ada@moliam.com', subject, emailBody, event.env, templateName);

             if (emailResult.success) {
                 sentCount++;
               if (submission.lead_score >= 75 && /^urgent/i.test(templateName)) {
                   console.log(`[HOT LEAD ALERT] ${submission.email} scored ${submission.lead_score}`);
                   }
              }

              // Update sequence status
             await db.prepare(
                     `UPDATE email_sequences SET email_status = ?, sent_at = datetime('now'), error_message = ? WHERE id = ?`
                   ).bind(emailResult.success ? 'sent' : 'failed', emailResult.success === false ? "Delivery attempt failed" : null, row.id).run();
           } catch (err) {
             console.error(`Email template error for ${row.submission_id}:`, err.message);
             await db.prepare(
                  `UPDATE email_sequences SET email_status = 'failed', error_message = ?, sent_at = datetime('now') WHERE id = ?`
                ).bind(err.message, row.id).run();
               }
          }

     return jsonResp(200, { 
         queued_emails_sent: sentCount, 
         total_attempted: result.results?.length || 0, 
             // Logging for monitoring
         timestamp: now 
         });} catch (err) {
        return jsonResp(500, { error: true, message: err.message });}
}

/**
 * Lead Monitoring Check - Triggers for high-score lead follow-up rules
 */
export async function onLeadMonitor(event) {
  const db = event.env.MOLIAM_DB;
  
  if (!db) {
     return jsonResp(503, { error: true, message: "Database not available" });}

       // Find all hot leads (score >= 75) with no response in last hour
    const result = await db.prepare(
           `SELECT s.*, l.status as lead_status
             FROM submissions s
             LEFT JOIN leads l ON s.id = l.submission_id
             WHERE s.lead_score >= 75 
                AND s.status = 'new' 
                AND (s.updated_at IS NULL OR s.updated_at < datetime('now', '-1 hour'))`
           ).all();

    for (const lead of result.results || []) {
      try {
            // Trigger urgent follow-up email - only if not already sent
         const existingSent = await db.prepare(
                 `SELECT COUNT(*) as cnt FROM email_sequences es 
                   WHERE es.submission_id = ? AND es.email_status IN ('sent', 'delivered', 'opened') 
                   AND es.sequence_name LIKE '%urgent%'`
               ).bind(lead.id).first();

         if (existingSent && existingSent.cnt > 0) continue;    // Already sent urgent email for this lead

            // Mark as pending
         await db.prepare(
                 `UPDATE submissions SET status = 'urgent_followup', updated_at = datetime('now') WHERE id = ?`
               ).bind(lead.id).run();

           const templateName = 'urgent_alert';
               const subject = getSubject(templateName);
               const emailBody = renderTemplate(EMAIL_TEMPLATES.urgent_alert, {
                  name: lead.name,
                  scope: lead.scope || "your project",
                  industry: lead.industry || "your industry"
                       });

             await sendEmail('postmark', lead.email, 'ada@moliam.com', subject, emailBody, event.env, templateName);

               // Send Discord alert for hot lead if webhook exists
           if (event.env.DISCORD_WEBHOOK_URL) {
                const discordPayload = JSON.stringify({
                     username: 'MOLIAM Hot Lead Alert',
                      embeds: [{
                        title: `🚨 URGENT HOT LEAD - Score ${lead.lead_score}/100`,
                        color: 0x22c55e,
                        fields: [
                             { name: 'Name', value: lead.name },
                             { name: 'Email', value: lead.email },
                             { name: 'Budget', value: lead.budget || "Not disclosed" },
                             { name: 'Industry', value: (lead.industry || 'Unknown').toUpperCase() }
                            ]},
                        timestamp: new Date().toISOString()
                       }
                      )];

             await fetch(event.env.DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    body: discordPayload,
                    headers: { 'Content-Type': 'application/json' }
                   }).catch(err => console.warn("Discord hot lead alert failed:", err.message));
              }

            console.log(`Hot lead triggered: ${lead.email} - Score: ${lead.lead_score}`);
           } catch (err) {
             console.error(`Hot lead processing failed for ${lead.id}:`, err.message);}
  }

  return jsonResp(200, { 
      hot_leads_processed: result.results?.length || 0} );} catch (err) {
    return jsonResp(503, { error: true, message: err.message });}
}


async function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { 
      status, 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      });}
