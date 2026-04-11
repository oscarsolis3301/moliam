/**
 * MOLIAM Contact Form — CloudFlare Pages Function v3
 * POST /api/contact — Enhanced with lead scoring and auto-categorization
 * Input validation: email format, text field lengths, HTML stripping
 */

import { jsonResp, validateEmail, validatePhone, sanitizeText, calculateLeadScore } from './api-helpers.js';

/** Helper: consistent JSON error wrapper for all API responses - returns proper {success, error, message|data} format */
function ensureError(status, message, request) {
  return jsonResp(status, { success: false, error: message }, request);
}

/**
 * Handle POST requests to contact form endpoint
 * @param {object} context - Cloudflare Pages function context with {request, env}, includes MOLIAM_DB binding
 * @returns {Response} JSON response with success/error status containing submissionId, leadScore, category
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
 * Send Discord webhook notification for new lead submissions
 * Skips test/debug emails and handles webhook failures gracefully (non-blocking)
 * @param {object} env - Cloudflare worker environment with DISCORD_WEBHOOK_URL
 * @param {{name: string, email: string, phone: string|null, company: string, message: string, service?: string, score: number, category: string, subId: number}} params - Lead data to send to webhook
 */
async function sendWebhook(env, { name, email, phone, company, message, service, score, category, subId }) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

  // Skip test/debug submissions — only real leads get webhooks
  const skipEmails = ["test@test.com", "test@moliam.com", "debug@moliam.com", "preview@moliam.com", "roman@moliam.com"];
  if (skipEmails.includes(email) || email.endsWith("@example.com")) return;

  try {
    const svcRaw = (service || "").toLowerCase();
    const svcLabel = { website: "Website Build", gbp: "GBP Optimization", lsa: "Google LSA", retainer: "Full Retainer", other: "Other" }[svcRaw] || service || "—";

    // Determine priority tag based on lead_score and category
    let priorityTag = "";
    if (category === "hot") {
      priorityTag = "<@1466244456088080569>";     // Ada - hot leads
    } else if (category === "warm") {
      priorityTag = "<@1486921534441259098>";     // Ultra - warm leaves      
    } else {
      priorityTag = "";     // cold leads don't need immediate attention tag
    }

    // Build fields array with lead score and category
    const fields = [
      { name: "📧 Email", value: email, inline: true },
      { name: "📱 Phone", value: phone || "—", inline: true },
      { name: "🏢 Company", value: company || "—", inline: true },
      { name: "🎯 Service", value: svcLabel, inline: true },
      { name: "📊 Lead Score", value: `**${score}/100**`, inline: true },
      { name: "🏷️ Category", value: `**${category.toUpperCase()}**`, inline: true }
    ];

    // Add social media fields if provided
    const s = socials || {};
    const socialLines = [];
    if (s.website) socialLines.push(`🌐 [Website](${s.website})`);
    if (s.gbp) socialLines.push(`📍 [Google Business](${s.gbp})`);
    if (s.facebook) socialLines.push(`📘 [Facebook](${s.facebook})`);
    if (s.instagram) socialLines.push(`📸 ${s.instagram.startsWith('http') ? `[Instagram](${s.instagram})` : `@${s.instagram.replace('@','')}`}`);
    if (s.yelp) socialLines.push(`⭐ [Yelp](${s.yelp})`);

    if (socialLines.length > 0) {
      fields.push({ name: "🔗 Online Presence", value: socialLines.join("\n") });
    }

    fields.push({ name: "💬 Message", value: (message || "—").length > 300 ? message.slice(0, 297) + "…" : (message || "—") });

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         username: "Moliam Lead",
         avatar_url: "https://moliam.com/logo.png",
         content: priorityTag + (priorityTag ? " New high-priority lead! " : " New lead submitted!"),
         embeds: [{
           title: "🔔" + (category === "hot" ? " HOT LEAD —" : category === "warm" ? " Warm Lead —" : " New Lead —") + name,
           color: category === "hot" ? 0x10B981 : category === "warm" ? 0xF59E0B : 0x3B82F6,
           fields,
           footer: { text: `Lead #${subId} • moliam.com` },
           timestamp: new Date().toISOString()
         }]
       })
    } catch {
      // Webhook failure is never fatal
    }
}

/**
 * Generate SHA256 hash of string for IP/user identification and rate limiting.
 * Uses Web Crypto API (subtle digest) for SHA-256 computation.
 * Returns hex string (lowercase, 64 chars) for use in database queries and caching.
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hex representation of SHA-256 hash (lowercase, 64 characters)
 */
async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
