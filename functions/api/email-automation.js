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
MOLIAMA — AI Operations HQ
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
async function sendEmail(emailService, to, from, subject, htmlBody, template_name) {
  try {
    if (!env || !Object.keys(env).length > 0) {
      return { success: true, message: "Email queued (mocked)", template: template_name };
     }

    const authKey = 
       emailService === 'postmark' ? env.POSTMARK_API_KEY :
       emailService === 'mailersend' ? env.MAILERSEND_API_KEY :
       env.SENDGRID_API_KEY;

    if (!authKey) {
      return { success: true, message: "Email queued (no provider configured)", template: template_name };
     }

    const endpoint = 
       emailService === 'postmark' ? 'https://api.postmarkapp.com/email' :
       emailService === 'mailersend' ? 'https://api.mailersend.com/api/v1/email/send' :
       emailService === 'sendgrid' ? 'https://api.sendgrid.com/v3/mail/send' :
       null;

    if (!endpoint) return { success: false, error: "Invalid email service" };

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

    return { success: response.ok || response.status === 201, message: "Email sent" };
   } catch (err) {
    console.warn("Email send failed:", err.message);
    return { success: false, error: "Email delivery failed", template: template_name };
   }
}

/**
 * Cron-triggered Automation - Fires daily to send queued emails
 */
export async function onCron(event) {
  const db = event.env.MOLIAM_DB;
  
  if (!db) {
    return Response.json({ error: true, message: "Database not available" }, { status: 500 });
   }

    // Send all queued emails for their scheduled time
    const now = new Date().toISOString();
    const result = await db.prepare(
       `SELECT es.id, es.submission_id, es.sequence_name, s.email, s.name, s.scope, s.industry, s.lead_score, s.urgency_level as pain_points
         FROM email_sequences es
         LEFT JOIN submissions s ON es.submission_id = s.id
         WHERE es.email_status = 'queued'
            AND es.scheduled_at <= datetime('now')`
      ).all();

  let sentCount = 0;

  for (const row of result.results || []) {
    const submission = row.submission;

    if (!submission || !submission.email) {
      await db.prepare(
          `UPDATE email_sequences SET error_message = ?, email_status = 'failed' WHERE id = ?`
        ).bind("Missing submission record or email", row.id).run();
      continue;
     }

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

       const { success } = await sendEmail('postmark', submission.email, 'ada@moliam.com', subject, emailBody, templateName);

      if (success) {
         sentCount++;
        if (submission.lead_score >= 75 && /^urgent/i.test(templateName)) {
           console.log(`[HOT LEAD ALERT] ${submission.email} scored ${submission.lead_score}`);
          }
       }

       // Update sequence status
      await db.prepare(
          `UPDATE email_sequences SET email_status = ?, sent_at = datetime('now'), error_message = ? WHERE id = ?`
        ).bind(success ? 'sent' : 'failed', success ? null : "Delivery attempt failed", row.id).run();
     } catch (err) {
       console.error(`Email template error for ${row.submission_id}:`, err.message);
       await db.prepare(
           `UPDATE email_sequences SET email_status = 'failed', error_message = ?, sent_at = datetime('now') WHERE id = ?`
         ).bind(err.message, row.id).run();
      }
   }

  return Response.json({ 
    queued_emails_sent: sentCount, 
    total_attempted: result.results?.length || 0, 
    success_rate: sendCount / (result.results?.length || 1),

     // Logging for monitoring
     timestamp: now 
   });
}

/**
 * Lead Monitoring Check - Triggers for high-score lead follow-up rules
 */
export async function onLeadMonitor(event) {
  const db = event.env.MOLIAM_DB;
  
  if (!db) {
    return Response.json({ error: true, message: "Database not available" }, { status: 500 });
   }

    // Find all hot leads (score >= 75) with no response in last 1 hour
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

      if (existingSent && existingSent.cnt > 0) continue; // Already sent urgent email for this lead

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

       await sendEmail('postmark', lead.email, 'ada@moliam.com', subject, emailBody, templateName);

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
                 ],
               timestamp: new Date().toISOString()
              }
             ]
           });

        await fetch(event.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            body: discordPayload,
            headers: { 'Content-Type': 'application/json' }
           }).catch(err => console.warn("Discord hot lead alert failed:", err.message));
      }

       console.log(`Hot lead triggered: ${lead.email} - Score: ${lead.lead_score}`);
     } catch (err) {
       console.error(`Hot lead processing failed for ${lead.id}:`, err.message);
      }
   }

  return Response.json({ 
    hot_leads_processed: result.results?.length || 0
  });
}

/**
 * Slack Integration - Optional alternative for notifications
 */
async function sendSlackAlert(webhook_url, lead_data) {
  try {
     const slackResponse = await fetch(webhook_url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           blocks: [{
             type: 'header',
             text: { type: 'plain_text', text: `📩 NEW LEAD SCORING ALERT`, emoji: true }
            }, {
             type: 'section',
             fields: [
                { type: 'mrkdwn', text: `*Name:* ${lead_data.name}\n*Email:* ${lead_data.email}\n*Lead Score:* ${lead_data.lead_score}/100\n*Priority:* ${lead_data.hot ? '🔥 HOT' : 'Normal'}` }
              ]
             }
           ]
         }),
       signal: AbortSignal.timeout(5000)
      });

     return { success: slackResponse.ok, message: "Slack notification sent" };
   } catch (err) {
    console.warn("Slack alert failed:", err.message);
    return { success: false, error: "Failed to send Slack notification" };
  }
}

/**
 * Template helper functions
 */
function renderTemplate(html, ctx) {
  let result = html || "";
  
  for (const [k, v] of Object.entries(ctx)) {
    const placeholder = `{{${k}}}`;
    const value = v !== undefined && v !== null ? String(v) : '';
    result = result.replace(new RegExp(escapeRegExp(placeholder), 'g'), value);
  }
  
  return result;
}

function getFirstName(email) {
  if (!email || !email.split('@')) return "there";
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

// Get subject based on template name - fixed lookup
function getSubject(templateName) {
  const subjects = {
      'immediate_confirmation': `Thank you for reaching out, {{name}}!`,
       'first_response': `Quick question about your inquiry - Ada @ moliam.com`,
       'nurturing_drip': `Following up on your MOLIAM project scope: {{scope}}`,
       'urgent_alert': `URGENT: Connect ASAP - Moliam AI Ops`
    };

  return subjects[templateName] || (templateName ? `MOLIAM Team Update: ${templateName}` : "MOLIAM Update");
}

function getTemplateForSequence(sequence_name, submission) {
   if (!submission) return 'immediate_confirmation';

  const score = submission.lead_score || 0;
  const hot = score >= 75;
  const medium = score >= 60 && score < 75;
  const normal = hot !== true && medium !== true;

   if (sequence_name === 'immediate_confirmation' || hot) {
      if (/urgent/i.test(String(sequence_name))) return 'urgent_alert';
       // If this is a hot lead, use urgent template for all sequences after the first
      if (/first_response|nurturing/i.test(String(sequence_name)) && hot) return 'urgent_alert';
       return sequence_name || 'immediate_confirmation';
     }

  if (hot && /^urgent/i.test(String(sequence_name))) return 'urgent_alert';
   if (hot && /^[a-z]+\s*\w*/i.test(String(sequence_name))) return 'nurturing_drip';
   
   if (medium && !hot) {
      if (/first_response/.test(String(sequence_name))) return 'first_response';
       return sequence_name || 'nurturing_drip';
     }

  return sequence_name || 'nurturing_drip';
}

/**
 * Helper functions stubs for compatibility
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function sendEmail(emailService, to, from, subject, htmlBody, template_name) {
   // Placeholder - actual implementation depends on selected email service
    const authKey = 
       env === undefined ? undefined :
       emailService === 'postmark' ? env.POSTMARK_API_KEY :
       emailService === 'sendgrid' ? env.SENDGRID_API_KEY :
       null;

    if (!env || !objToEntries(env).length) {
       return { success: true, message: "Email queued (mocked)" }; // Mock mode for dev
     }

    const endpoint = 
       emailService === 'postmark' ? 'https://api.postmarkapp.com/email' : 
       emailService === 'sendgrid' ? 'https://api.sendgrid.com/v3/mail/send' : 
       emailService === 'mailersend' ? 'https://api.mailersend.com/api/v1/email/send' : 
       null;

    if (!endpoint) {
      return { success: false, error: "Invalid email service" };
     }

    try {
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
             ...headersForService(emailService, authKey)
          },
          body: JSON.stringify({
            From: from,
            To: to,
            Subject: subject,
            Html: renderTemplate(htmlBody, { name: getFirstName(to), lead_score: 75 })
           }),
          signal: AbortSignal.timeout(10000)
         });

       return { 
         success: response.ok || response.status === 201, 
         message: "Email sent", 
         template: template_name,
         status: response.status 
        };
     } catch (err) {
       console.warn("Email send failed:", err.message);
       return { success: false, error: "Email delivery failed", template: template_name };
     }
   }

function headersForService(service, key) {
  if (service === 'postmark') {
    return { 'X-Postmark-Server-Token': removePrefix(key, 'postmark:') };
  }
   if (service === 'sendgrid') {
     return { 'Authorization': `Bearer ${removePrefix(key, 'sendgrid:')}` };
     }

  return key ? { 'Authorization': `Bearer ${key}` } : {};
}

function removePrefix(str, prefix) {
  if (!str || !prefix) return "";
  const idx = str.indexOf(prefix);
  return idx === 0 ? str.slice(prefix.length) : str;
}

function objToEntries(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj);
}

async function sendEmail(emailService, to, from, subject, htmlBody, template_name) {
  // Stub - see main implementation above
  return { success: true, message: "Mocked for dev" };
}

async function jsonResp(status, body) {
  return new Response(JSON.stringify(body), { 
    status, 
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
   });
}
