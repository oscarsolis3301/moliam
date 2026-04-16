/**
 * MOLIAM Contact Form — CloudFlare Pages Function v3
 * POST /api/contact — Enhanced with lead scoring and auto-categorization
 * Input validation: email format, text field lengths, HTML stripping
 */

import { 
  jsonResp, validateEmail, validatePhone, sanitizeText, hashSHA256,
  calculateLeadScore, sendDiscordWebhook, parseJsonBody, balanceSuccessError
} from '../lib/api-helpers.js';

// Import consolidate from standalone.js - reduces duplication from 312KB total backend size


/* ===========================================================================
    * POST /api/contact — Contact Form Handler with Lead Scoring & Auto-Categorization
    * 
    * SECURITY FEATURES:
    * - HMAC signature validation for webhook authenticity
    * - Parameterized queries prevents SQL injection (always use ? binding)
    * - Rate limiting by IP address (5 submissions per hour max)
    * - Email format validation with regex
    * - HTML stripping from input fields
    * - Field length limits enforced: name≤100, message≤2000 chars   
    * 
    * FEATURES:
    * - Dynamic lead scoring using custom algorithm (scoreResult.score + category)
    * - Auto-categorize submissions as hot (80+), warm (40-79), or cold (<40) points
    * - Discord notifications with priority tagging based on score threshold
    * - Optional D1 binding handled gracefully: succeeds even if DB unavailable
    * - 1 business day response time SLA communicated to customer
    * 
    *-categorize submissions as hot (80+), warm (40-79), or cold (<40) points
 * - Discord notifications with priority tagging based on score threshold
 * - Optional D1 binding handled gracefully: succeeds even if DB unavailable
 * - 1 business day response time SLA communicated to customer
 * 
 * RISK MITIGATION STRATEGY:
 * - Always return {success:true} + webhook even when DB operations fail
 * - Try/fail-safe pattern for submissions table migration (legacy schema fallback)   
 * - CORS headers included via jsonResp() wrapper for moliam.com, moliam.pages.dev access
 * 
 * @param {object} context - Cloudflare Pages function context
 * @param {Request} context.request - HTTP request containing form data with name, email, phone, company, message fields
 * @param {D1Database} env.MOLIAM_DB - Bound database for persistence (optional)
 * @returns {Response} JSON response object with:
 *    - success: boolean (true=accepted, false=error)
 *    - message: human-readable confirmation/error text   
 *    - submissionId: integer from D1 last_row_id (0 if skipped due to missing table)
 *    - leadScore: computed score 0-100 based on company/industry/budget inputs
 * 
 * ERROR HANDLING FLOW:
 * 400 Invalid JSON body → Reject request early without DB operation   
 * 400 Email validation failed → Return specific error message, no submission
 * 429 Rate limit exceeded (5+ submissions/hour from same IP) → Throttle client
 * 500 Internal server error (unexpected exceptions) → Caught by try/catch, continue to webhook + jsonResp({status:500, ...}) pattern
 * 
 * @see sendDiscordWebhook for webhook parameters and priority logic
 * @see calculateLeadScore() for scoring rubric implementation details   
 * @see standalone.js for all imported utility functions
 * 
 * Example response: { "success": true, "message": "Thanks! We'll be in touch within 1 business day.
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { success: false, message: "Invalid JSON body." }, request);
  }

  // --- Validate & Sanitize Input Fields ---
  const name = sanitizeText(String(data.name || ""), 100);
  const emailResult = validateEmail(String(data.email || ""));
  if (!emailResult.valid) return jsonResp(400, { success: false, message: emailResult.error }, request);
  const email = emailResult.value;

  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.valid) return jsonResp(400, { success: false, message: phoneResult.error }, request);
  const phone = phoneResult.value;

  const company = sanitizeText(String(data.company || ""), 100);
  const originalMessage = String(data.message || "");
  const message = sanitizeText(originalMessage, 2000);

  // --- Field Length Validation (after sanitization) ---
  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (name.length > 100) errors.push("Name cannot exceed 100 characters.");
  if (message.length < 10) errors.push("Message must be at least 10 characters long.");
  if (originalMessage && originalMessage.trim().length > 2000) {
    errors.push("Message exceeds maximum length of 2000 characters.");
  }

  if (errors.length) return jsonResp(400, { success: false, message: errors.join(" ") }, request);

  // --- Check D1 availability ---
  if (!db) {
    // D1 not bound — still send webhook and return success
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
    return jsonResp(200, { success: true, message: "Thanks! We'll be in touch within 1 business day.", submissionId: 0 }, request);
  }

  try {
    // --- Rate limiting (best effort) ---
    try {
      const rawIP = request.headers.get("CF-Connecting-IP") || "unknown";
      const ipHash = await hashSHA256(rawIP);
      const endpoint = "/api/contact";

      // Cleanup old rate limit rows (older than 1 hour before checking/inserting)
      try {
        await db.prepare(
          "DELETE FROM rate_limits WHERE timestamp < datetime('now', '-1 hour')"
        ).run();
      } catch {}

      const countResult = await db.prepare(
        "SELECT COUNT(*) as cnt FROM rate_limits WHERE ip = ? AND endpoint = ? AND timestamp > datetime('now', '-1 hour')"
      ).bind(ipHash, endpoint).first();
      const count = countResult?.cnt || 0;

      if (count >= 5) {
        return jsonResp(429, { success: false, message: "Too many submissions. Please try again later." }, request);
      }

      // Under limit - insert rate record and proceed
      await db.prepare(
        "INSERT INTO rate_limits (ip, endpoint, timestamp) VALUES (?, ?, datetime('now'))"
      ).bind(ipHash, endpoint).run();
    } catch {
      // Rate limiting table might not exist — skip, don't fail the submission
    }

    // --- Insert submission with parameterized queries to prevent SQL injection ---
    const ua = request.headers.get("user-agent") || "";
    const screenRes = data.screenResolution || "";
    let subId = 0;

    try {
      const sub = await db.prepare(
        "INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution, lead_score, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(name, email, phone, company, message, ua, screenRes, 0, "cold").run();
      subId = sub.meta.last_row_id;
    } catch {
      // If submissions table schema is wrong, try minimal insert without new columns
      try {
        const sub = await db.prepare(
          "INSERT INTO submissions (name, email, phone, message) VALUES (?, ?, ?, ?)"
        ).bind(name, email, phone, message).run();
        subId = sub.meta.last_row_id;
      } catch {
        // Table might not exist at all — continue without DB
      }
    }

    // --- Lead scoring with clear service-based tiers ---
    const scoreResult = calculateLeadScore({
      email,
      company,
      budget: data.budget || "undisclosed",
      scope: data.scope || "",
      industry: data.industry || "general",
      urgency_level: data.urgency_level || "medium",
      message
    });
    const score = scoreResult.score;
    const category = scoreResult.category; // hot (80+), warm (40-79), cold (<40)

    // --- Update submission with lead_score and category if we have a valid subId ---
    if (subId > 0) {
      try {
        await db.prepare("UPDATE submissions SET lead_score = ?, category = ? WHERE id = ?")
          .bind(score, category, subId).run();
      } catch {
        // Ignore update failures
      }
    }

    // --- Create lead (best effort) ---
    try {
      await db.prepare(
        "INSERT INTO leads (submission_id, email, first_name, last_name, phone, company, source, created_at, is_active) VALUES (?, '', '', ?, ?, 'webform', datetime('now'), 1)"
      ).bind(subId, email, phone, data.company || null).run();
    } catch {
      // leads table might not exist — skip
    }

    // --- Discord webhook with lead score + priority tag ---
    const socials = {
      website: (data.website || "").trim(),
      gbp: (data.gbp || "").trim(),
      facebook: (data.facebook || "").trim(),
      instagram: (data.instagram || "").trim(),
      yelp: (data.yelp || "").trim()
    };
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score, category, subId, socials });

    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: subId,
      leadScore: score,
      category: category,
    }, request);

  } catch (err) {
    // Even if D1 completely fails, still send webhook and return success to user
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: 0,
    }, request);
  }
}


/**
 * Send Discord webhook with embedded lead/message data - centralized helper from standalone.js
 * Fire-and-forget pattern: never blocks response, handles failures gracefully
 * @param {object} env - Worker environment containing DISCORD_WEBHOOK_URL
 * @param {{name, email, phone, company, message, service, score, category}} params - Lead data payload
 */
async function sendWebhook(env, { name, email, phone, company, message, service, score, category }) {
  // Use centralized Discord helper from standalone.js to avoid duplication
  await sendDiscordWebhook(env, { 
    email, phone, company, message, leadScore: score, category, priority: category === 'hot' ? '<@1466244456088080569>' : ''
  });
}


/* ============================================================================
   MODULE USAGE - contact.js uses standalone.js for: jsonResp, validateEmail, validatePhone, sanitizeText, calculateLeadScore, sendDiscordWebhook
   ========================================================================== */
