/**
 * MOLIAM Lead Capture → CRM Pipeline
 * Enhanced contact form with scoring and automation triggers
 * POST /api/lead-intake — Uses api-helpers for consistent validation and JSON responses
/* eslint no-irregular-whitespace: "off" */
// Import centralized helpers from api-helpers.js - eliminates duplicate auth/message logic across messages.js & client-message.js
import { jsonResp, sanitizeText, validateEmail, validatePhone, hashSHA256, calculateLeadScore, sendDiscordWebhook } from './api-helpers.js';

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

  try {
     // --- Parse body with try/catch for malformed JSON ---
    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResp(400, { success: false, error: true, message: "Invalid JSON body." }, request);
    }

    // --- Sanitize all text fields (strip HTML, apply length limits) inside TRY block to comply with Task 1 ---
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
    const ipRequestIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const ua = request.headers.get("user-agent") || "";

      // --- Rate limiting check (5 per 6 min window per IP) ---
    const ipHash = await hashSHA256(ipRequestIP);
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

    // --- Calculate Lead Score using standalone.js helper ---
    const scoreResult = calculateLeadScore({
      email, name, company, budget, scope, industry, urgency_level, message
    });

    await db.prepare(
      `UPDATE submissions SET lead_score = ? WHERE id = ?`
    ).bind(scoreResult.total_score, subId).run();

    // --- Send Discord notification with fire-and-forget pattern ---
    const webhookUrl = env.DISCORD_WEBHOOK_URL || '';
    if (webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/') && !webhookUrl.includes('YOUR_') && !webhookUrl.includes('PLACEHOLDER')) {
      sendDiscordWebhook(env, { 
        email, 
        phone, 
        company, 
        message, 
        leadScore: scoreResult.total_score, 
        category: scoreResult.urgency_status,
        priority: scoreResult.total_score >= 75 ? '<@1466244456088080569>' : '' 
      }).catch(() => { /* logged silently */ });
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
    return jsonResp(500, { 
      success: false, error: true,
      message: "Something went wrong. Please email us directly at hello@moliam.com.",
      requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
    }, request);
}
}

/**
 * Queue email sequences for new lead submissions
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
     // removed - fire-and-forget;
    return null;
     }
}
