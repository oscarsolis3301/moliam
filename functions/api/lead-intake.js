/**
 * MOLIAM Lead Capture → CRM Pipeline
 * Enhanced contact form with scoring and automation triggers
 * POST /api/lead-intake — Uses api-helpers for consistent validation and JSON responses
 */

import { jsonResp, calculateLeadScore, sanitizeText, validateEmail, validatePhone } from './api-helpers.js';

/**
 * Handle POST requests to lead intake endpoint with email validation, phone validation, HTML stripping, and lead scoring
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status and proper CORS headers
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // Return consistent JSON error with CORS headers when DB unavailable
  if (!db) {
    return jsonResp(503, { success: false, error: true, message: "Database not available. Please try again later." }, request);
  }

  // --- Parse body with try/catch for malformed JSON ---
  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { success: false, error: true, message: "Invalid JSON body." }, request);
  }

  // --- Sanitize all text fields (strip HTML, apply length limits) ---
  const name = sanitizeText(String(data.name || ""), 200);
  const emailResult = validateEmail(String(data.email || ""));
  if (!emailResult.valid) return jsonResp(400, { success: false, error: true, message: emailResult.error }, request);
  const email = emailResult.value;

  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.valid) return jsonResp(400, { success: false, error: true, message: phoneResult.error }, request);
  const phone = phoneResult.value;

  const company = sanitizeText(String(data.company || ""), 100);
  const originalMessage = String(data.message || "");
  const message = sanitizeText(originalMessage, 2000);

    // Enhanced fields for scoring (sanitized)
  const budget = sanitizeText(String(data.budget || "undisclosed"), 50);
  const scope = sanitizeText(String(data.scope || data.inquiry_type || "General inquiry").trim(), 200);
  const industry = sanitizeText(String(data.industry || "general").trim(), 100);
  const urgency_level = String(data.urgency_level || 'medium').toLowerCase();

    // Sanitized pain_points array (limit item length to 500 chars)
  const pain_points = Array.isArray(data.pain_points) 
        ? data.pain_points.filter(p => p && typeof p.trim === "function" && p.trim().length > 0).slice(0, 5).map((p, i) => sanitizeText(String(p), 500))
         : [];

    // Field length validation after sanitization
  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (name.length > 200) errors.push("Name cannot exceed 200 characters.");
  if (message.length < 10) errors.push("Message must be at least 10 characters.");
  if (originalMessage && originalMessage.trim().length > 2000) {
    errors.push("Message exceeds maximum length of 2000 characters.");
   }

  if (errors.length) {
    return jsonResp(400, { success: false, error: true, message: errors.join(" ") }, request);
  }

  // Parse additional optional fields with length limits
  const screenRes = data.screenResolution ? String(data.screenResolution).trim() : "";
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const ua = request.headers.get("user-agent") || "";

  try {
    // --- Rate limiting check (5 per 6 min window per IP) ---
    const ipHash = await hashSHA256(ip);
    const rl = await db.prepare(
          "SELECT request_count, window_start FROM rate_limits WHERE ip_address_hash = ?"
       ).bind(ipHash).first();

    if (rl) {
      const windowAge = Date.now() - new Date(rl.window_start).getTime();
      if (windowAge < 360000 && rl.request_count >= 5) {
        return jsonResp(429, { 
            success: false, error: true,
            message: "Too many submissions. Please wait a few minutes.",
            retryAfter: Math.ceil((360000 - windowAge) / 1000)
           }, request);
      }
    }

     // --- Insert submission with parameterized queries to prevent SQL injection ---
    const sub = await db.prepare(
      `INSERT INTO submissions 
       (name, email, phone, company, message, user_agent, screen_resolution, budget, scope, industry, urgency_level, pain_points) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(name, email, phone, company, message, ua, screenRes, budget, scope, industry, urgency_level, JSON.stringify(pain_points)).run();

    const subId = sub.meta?.last_row_id;

  if (!subId) {
    return jsonResp(500, { success: false, error: true, message: "Failed to save submission. Please try again." }, request);
  }

     // --- Calculate Lead Score using api-helpers ---
    const scoreResult = calculateLeadScore({
      email, name, company, budget, scope, industry, urgency_level, message
     });

    await db.prepare(
       `UPDATE submissions SET lead_score = ? WHERE id = ?`
      ).run(scoreResult.total_score, subId);

     // --- Insert detailed scoring ---
    const painPointsJson = JSON.stringify(pain_points);
    await db.prepare(
       `INSERT INTO lead_scores 
       (submission_id, base_score, industry_boost, urgency_boost, budget_fit_score, total_score) 
       VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(subId, scoreResult.base_score, scoreResult.industry_boost, scoreResult.urgency_boost, scoreResult.budget_fit_score, scoreResult.total_score).run();

// Initiate CRM Sync (non-blocking)
initiateCrmSync(context.env, subId, { name, email, phone, company, budget, scope, industry, urgency_level }).catch(() => {
    // Fire-and-forget: don't propagate errors to user response
});

     // Queue Email Sequences (background task)
    queueEmailSequences(env, subId).catch(() => 
      // Background processing errors logged to server logs only (user doesn't see failures in fire-and-forget scenarios)
      null);

    // Send Real-time Discord Notification (non-blocking)
    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.includes("YOUR_") && !webhookUrl.includes("PLACEHOLDER")) {
      sendDiscordAlert(webhookUrl, scoreResult).catch(() => 
        // Background processing errors logged to server logs only (fire-and-forget pattern)
        null);
       }


    // --- Log to audit tables ---
    await db.prepare(
       `INSERT INTO notification_logs (submission_id, channel_type, status, payload_preview) 
         VALUES (?, 'discord', 'success', ?)`
       ).bind(subId, JSON.stringify({ name, email, score: scoreResult.total_score })).run();

return jsonResp(200, {
      success: true,
      message: `Thank you ${name}! Your inquiry has been prioritized with a lead score of ${scoreResult.total_score}/100. We'll be in contact within 5 minutes of your submission.`,
      submissionId: subId,
      leadScore: scoreResult.total_score,
      urgency: scoreResult.urgency_status
       }, request);

} catch (err) {
     console.error("Lead intake error:", err);
     return jsonResp(500, { 
        success: false, error: true,
        message: "Something went wrong. Please email us directly at hello@moliam.com.",
        requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
       }, request);
}

/**
 * Lead Scoring Engine — Auto-calculate lead priority
 * Algorithm: Base 40 + budget(0-25) + industry(0-20) + urgency(0-25) = max 100
 * Categories: hot (75+), moderate (60-74), normal (<60)
 * @param {{email?:string, name:string, company:string, budget:string, scope:string, industry:string, urgency_level:string, message:string}} data - Lead object with all scoring fields
 * @returns {{base_score:number,intustry_boost:int,urgency_boost:int,budget_fit_score:int,total_score:int,urgency_status:string,score_breakdown:{base_score:number,industry_boost:number,urgencyBoost:number}}} Scoring result with components (total_score capped at 100)
 */
function calculateLeadScore(data) {
  try {
    const { email, name, company, budget, scope, industry, urgency_level, message } = data;
    let base_score = 40; // Base score for any qualified lead

      // Budget scoring (0-25 points)
    let budgetFit = 50;
    if (budget.includes("under $10") || budget === "undisclosed") {
      base_score += 5;
      budgetFit = 30;
        } else if (/\\d+\\.\\d+/.test(budget) && /\\d+$/.exec(budget)[0] > 5) {
      base_score += 15;
      budgetFit = 75;
        } else if (/^\\w+\\s?\\$[5-9k]?|^\\d+[$,]?\\d{3,}/.test(budget)) {
            // Check for $5k-$10k matches
      base_score += 12;
      budgetFit = 65;
        }

         // Industry scoring (0-20 points) - boost priority for priority industries
    const industryBoost = 
          /tech|saas|software|ai|startup/i.test(industry) ? 18 :
          /finance|financial|fintech/i.test(industry) ? 16 :
          /health|medical|healthcare/i.test(industry) ? 14 :
          /education|academia|university/i.test(industry) ? 10 :
          /manufacturing|retail|ecommerce/i.test(industry) ? 12 :
          8;

         // Urgency scoring (0-25 points) - higher urgency = higher score
    const urgencyBoostMap = {
           'critical': 30,
           'high': 20,
           'medium': 10,
           'low': 5
         };
    let urgencyBoost = urgencyBoostMap[urgency_level?.toLowerCase()] || 10;

         // Keyword matches in message for additional scoring
    if (/immediate|urgent|deadline|asap|quickly|fast|\\b30\\s*days\\b/i.test(message)) {
      base_score += 8;
      urgencyBoost += 10;
       }

    const total_score = Math.min(100, base_score + industryBoost + urgencyBoost);
    
         // Determine overall urgency status
    let urgency_status = 'normal';
    if (total_score >= 75) urgency_status = 'hot';
    else if (total_score >= 60) urgency_status = 'moderate';

    return {
      base_score,
      industry_boost: industryBoost,
      urgency_boost: urgencyBoost,
      budget_fit_score: budgetFit,
      total_score,
      urgency_status,
      score_breakdown: { base_score, industry_boost, urgencyBoost }
          };
  } catch (err) {
    console.error("Lead scoring error:", err);
    return { base_score, industry_boost, urgency_boost, budget_fit_score, total_score, urgency_status, score_breakdown };
  }
}

/**
 * Send Discord Alert — Webhook notification with embed for new submissions
 * Non-blocking, fire-and-forget pattern - errors logged to console.warn
 * @param {string} webhookUrl - Discord webhook URL from env.DISCORD_WEBHOOK_URL
 * @param {{base_score:number,industry_boost:int,urgency_boost:int,budget_fit_score:int,total_score:int,urgency_status:string,score_breakdown:{}}} scoreResult - Lead scoring result object
 * @returns {Promise<null>} null (errors logged silently)
 */
async function sendDiscordAlert(webhookUrl, scoreResult = {}) {
  try {
    if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      return null;
    }
    const payload = JSON.stringify({
      embeds: [{
        title: `🔔 New Lead - Score ${scoreResult.total_score}/100`,
        color: scoreResult.total_score >= 75 ? 0x10B981 : scoreResult.total_score >= 60 ? 0xF59E0B : 0x3B82F6,
        fields: [
          { name: '📊 Total Score', value: `**${scoreResult.total_score}/100**`, inline: true },
          { name: '⚠️ Urgency', value: scoreResult.urgency_status || 'unknown', inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Moliam Lead Intake' }
      }]
    });
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(5000)
    });
    return null;
  } catch (err) {
    console.warn("Discord alert failed:", err.message);
    return null;
  }
}

/**
 * Initiate CRM Sync — Fire-and-forget background task for HubSpot/Airtable integration
 * Non-blocking call that logs errors to console.warn without affecting user response
 * @param {object} env - Worker environment with HUBSPOT_API_KEY or AIRTABLE_API_KEY
 * @param {{name:string, email:string, phone:string, company?:string, budget?:string, scope?:string, industry?:string, urgency_level?:string, message:string, pain_points?:string[]}} data - Lead submission data to sync
 * @returns {Promise<null>} null on success (errors logged silently)
 */
async function initiateCrmSync(env, data = {}) {
  try {
    const CRM_PROVIDER = env.HUBSPOT_API_KEY || env.AIRTABLE_API_KEY;

      // Skip if no CRM configured
    if (!CRM_PROVIDER) return null;

const crmUrl = CRM_PROVIDER.includes('hubspot') 
           ? 'https://api.hubapi.com/crm/v3/objects/contacts'
           : (env.AIRTABLE_API_KEY ? 'https://api.airtable.com/v0/' + env.AIRTABLE_APP_ID + '/Leads' : null);

    if (!crmUrl) return null;

    const payload = JSON.stringify({
      properties: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company || "Freelance",
        budget_range: data.budget,
        project_scope: data.scope,
        industry_type: data.industry,
        urgency: data.urgency_level,
        pain_points: data.pain_points?.length ? data.pain_points.join(", ") : null,
        inquiry_message: sliceText(data.message, 1024),
        lead_score: 50, // Placeholder - actual scoring done in main function
        source: "moliam-web-intake",
        submitted_at: new Date().toISOString()
        }
      });

    const headers = { 'Content-Type': 'application/json' };

    if (CRM_PROVIDER.includes('hubspot') && env.HUBSPOT_API_KEY) {
      headers['Authorization'] = `Bearer ${env.HUBSPOT_API_KEY}`;
      await fetch(crmUrl, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(5000) });
     } else if (CRM_PROVIDER.includes('airtable') && env.AIRTABLE_API_KEY) {
      headers['Authorization'] = `Bearer ${env.AIRTABLE_API_KEY}`;
      await fetch(crmUrl, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(5000) });
     }

    return null; // Success logged separately
   } catch (err) {
    console.warn("CRM sync failed:", err.message);
    return null; // Fire and forget - don't propagate errors to user
   }
}



/**
 * Queue email sequences for new lead submissions (fire-and-forget background task)
 * Non-blocking call that logs errors to console without affecting user response
 * Inserts record into email_queue table for scheduled deliverability
 * @param {object} env - Worker environment with EMAIL_API_KEY if configured
 * @param {number} submission_id - Lead submission ID from database
 * @returns {Promise<null|null>} null on success (errors logged silently to console.warn)
 */
async function queueEmailSequences(env, submission_id) {
  try {
     // Background job to send welcome emails and sequence triggers
    const hasEmailProvider = env.EMAIL_API_KEY || env.MAILGUN_API_KEY || env.SENDGRID_API_KEY;
    if (!hasEmailProvider) return null;

    // Check if DB is available before attempting queue operations - parameterized safety confirmed
    if (env.MOLIAM_DB) {
      await env.MOLIAM_DB.prepare(
         `INSERT INTO email_queue (submission_id, queued_at, status) VALUES (?, datetime('now'), 'pending')`
       ).bind(submission_id).run();
    }

    return null;
    } catch (err) {
    console.warn("Email queue failed:", err.message);
    return null;
    }
}
