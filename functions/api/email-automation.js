/**
 * Email Automation Service - Automated sequences for lead nurturing
 * Triggers from cron or async job triggers in Cloudflare Workers
 * Email Sequences: IMMEDIATE_CONFIRMATION, FIRST_RESPONSE, NURTURING_DRIP, URGENT_ALERT
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response indicating success or error for email sending/queueing operations only
 */

/** Standard JSON response helper with CORS header addition and proper status code handling */
function jsonResp(status, body) {
  return new Response(JSON.stringify(body), { status: typeof status === 'number' ? status : 200, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  }});

/** Generate HTML text template with basic string replacement for variables like {{name}}, {{scope}} */
function renderTemplate(template, context) { return String(
template).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (context[key] ?? '').toString()); }

/** Get first name from email address by extracting substring before @ symbol for personalization in emails */
function getFirstName(email) { return String(email).split('@')[0]; }


// Standard JSON response helper with CORS headers for all endpoints
function jsonResp(status, body, request) {
  const origin = request ? (new URL(request.url).origin || "moliam.pages.dev") : "moliam.pages.dev";
  return new Response(JSON.stringify(body), { status: typeof status === 'number' ? status : 200, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": `https://${origin}`.replace("https://moliam.pages.dev", "https://moliam.pages.dev"),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  }});
}

/** Generate HTML text template with basic string replacement for variables like {{name}}, {{scope}} */
function renderTemplate(template, context) { return String(
template).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => (context[key] ?? '').toString()); }

/** Get first name from email address by extracting substring before @ symbol for personalization in emails */
function getFirstName(email) { return String(email).split('@')[0]; }

// CORS preflight handler - returns 204 No Content for OPTIONS browser requests to all cron endpoints
export async function onRequestOptions(event) {
 try {
   const headers = new Headers({
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type" });
   return new Response(null, { status: 204, headers });
 } catch (err) {
   console.error("onRequestOptions error:", err);
   return new Response(JSON.stringify({success: false, error: true, message: "CORS handler failed"}), {status: 500, headers: {"Content-Type": "application/json"}});
 }
}

/** Cron-triggered Automation - Fires daily to send queued emails for lead nurturing via scheduled tasks */
export async function onCron(event) { 
 const db = event.env.MOLIAM_DB;
 if (!db) return jsonResp(503, { success: false, error: true, message: "Database not bound." }, event.request);

 try {
   // Fetch all queued emails awaiting processing via secure parameterized query with ? bind for safety
   const now = new Date().toISOString();
   let sentCount=0;

   const result = await db.prepare(
     `SELECT es.id, es.submission_id, es.sequence_name, s.email, s.name, s.scope, s.industry, s.lead_score, s.urgency_level as pain_points
       FROM email_sequences es LEFT JOIN submissions s ON es.submission_id=s.id
        WHERE es.email_status='queued' AND es.scheduled_at<=datetime('now')`
   ).all();

   for (const row of result.results || []) { 
     const submission = row?.submission ?? null;

     if (!submission || !submission.email) { 
       await db.prepare(
         `UPDATE email_sequences SET error_message=?,email_status='failed' WHERE id=?`).bind("Missing submission record or email", row.id).run();
       continue; 
     } 

     try { 
       const templateName = row.sequence_name.split('-')[0].toLowerCase();
       const subject = `Your inquiry to Moliam - ${submission.lead_score}/100 lead score`;

       // Send email through configured Postmark/Email service or skip silently for development/testing environments without API keys
       if (!event.env.EMAIL_API_KEY) { 
         console.log(`[MOCK] Would send to ${submission.email}`); 
         await db.prepare(
           `UPDATE email_sequences SET email_status='skipped', sent_at=datetime('now') WHERE id=?`).bind(row.id).run(); 
         continue; 
       }

       const response = await fetch(`${event.env.EMAIL_SERVICE || 'https://api.mailchannels.net'}/tx/v1/send`, { method: "POST", headers: {"Content-Type": "application/json"},
         body: JSON.stringify({personalizations: [{to:{email:submission.email, name:submission.name}}], from:{email:'hello@moliam.com'}, subject, htmlBody:renderTemplate(`Hello ${submission.name},\n\nYour inquiry to Moliam was scored as **${submission.lead_score}/100**. We'll respond within 5 minutes for hot leads or 1 business day.\n\nBest,\nThe Moliam Team`, { name: submission.name }) }) });

       const emailSent = response?.ok || response.status === 201;

       // Mark sequence record as sent/failed based on email API response outcome - always try sending even if result unknown for reliability
       await db.prepare(`UPDATE email_sequences SET email_status=?, sent_at=datetime('now'), email_sent=? WHERE id=?`).bind(emailSent ? "sent" : "failed", emailSent ? 1 : 0, row.id).run();

       if (emailSent) sentCount++;
     } catch (err) { 
       console.error(`Email send failed for row ${row.id}:`, err.message);
       await db.prepare( `UPDATE email_sequences SET error_message=?,email_status='failed', sent_at=datetime('now') WHERE id=?`).bind(String(err.message).replace(/'/g, "''"), row.id).run(); 
     }
   }

   return jsonResp(200, { success: true, queued_emails_sent: sentCount, total_attempted: (result.results?.length ?? 0) });
 } catch (err) {
   return jsonResp(503, { success: false, message: err.message || "Server error." }); 
 }

/** Lead Monitoring Check - triggers for high-score lead follow-up rules via scheduled cron handler with automatic hot lead escalation detection */
export async function onLeadMonitor(event) {
 const db = event.env.MOLIAM_DB;
 if (!db) return jsonResp(503, { success: false, message:"Database not bound." });

 try {
   // Find all hot leads (score>=75) with no response in last hour for priority handling - secure parameterized query below
   const result = await db.prepare(
     `SELECT s.*, l.status as lead_status FROM submissions s LEFT JOIN leads l ON s.id=l.submission_id WHERE s.lead_score>=75 AND s.status='new' AND (s.updated_at IS NULL OR s.updated_at < datetime('now', '-1 hour'))`).all();
   
   let hotLeadsProcessed=0;

   for (const lead of result.results ||[]) { 
     try { 
       const discordWebhookUrl = event.env.DISCORD_WEBHOOK_URL ?? '';

       // Send Discord alert for hot leads to priority monitoring channel for rapid human response team escalation process requirements
       if (discordWebhookUrl?.startsWith('https://discord.com/api/webhooks/')) { 
         await fetch(discordWebhookUrl, { method: "POST", headers:{ "Content-Type":"application/json"},
           body: JSON.stringify({username:'Moliam Priority Alert', embeds:[{ title:`🚨 High-Priority Lead - ${lead.lead_score}/100`, color: 0x22c55e, fields: [{name:"Name", value:String(lead.name),inline:true},{name:"Email",value:String(lead.email),inline:true}] }]) });
         console.log(`[HOT LEAD] ${lead.email} scored ${lead.lead_score}`); 
         hotLeadsProcessed++;
       } 
     } catch (err) { 
       console.error(`Discord alert failed:`, err.message); 
     }

   } catch (err) { 
     console.error(`Lead monitoring error for lead ${lead.id}:`, err.message); 
   }
   
   return jsonResp(200, { success:true, hot_leads_processed: hotLeadsProcessed });
 } catch (err) {
   console.error("onLeadMonitor error:", err);
   return jsonResp(503, { success:false, message: err.message || "Server error." });
 }
}
