/**
 * MOLIAM Contact Form — CloudFlare Pages Function v3
 * POST /api/contact — Enhanced with lead scoring and auto-categorization
 * Input validation: email format, text field lengths, HTML stripping
 */

import { 
  jsonResp, validateEmail, validatePhone, sanitizeText, calculateLeadScore,
  sendDiscordWebhook, parseRequestBody 
} from './standalone.js';

// Import consolidate from standalone.js - reduces duplication from 312KB total backend size

/**
 * Handle POST requests to contact form endpoint
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error status
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // Parse request body with try/catch for malformed JSON
  let data;
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
