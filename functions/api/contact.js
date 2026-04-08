/**
 * MOLIAM Contact Form — CloudFlare Pages Function v3
 * POST /api/contact — Enhanced with lead scoring and auto-categorization
 * Input validation: email format, text field lengths, HTML stripping
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { success: false, error: true, message: "Invalid JSON body." }, undefined, request);
     }

       // --- Validation Helpers ---

/**
 * Strip HTML tags and limit text length for sanitization
 * @param {string} text - Text to sanitize  
 * @param {number} maxLength - Maximum allowed length (default 1000)
 * @returns {string} Sanitized text with HTML stripped
 */
  function sanitizeText(text, maxLength = 1000) {
         // Strip HTML tags to prevent XSS
     const stripped = String(text || "").replace(/<[^>]*>/g, "");
     return stripped.trim().slice(0, maxLength);
       }

/**
 * Validate email format with RFC 5321 regex and length checks  
 * @param {string} email - Email address to validate
 * @returns {{valid: boolean, error?: string, value?: string}} Validation result
 */
  function validateEmail(email) {
    if (!email || email.length < 5) return { valid: false, error: "Valid email required." };
    const cleaned = email.toLowerCase().trim();
        // RFC 5321 compliant regex for email format validation
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) return { valid: false, error: "Invalid email format." };
    if (cleaned.length > 254) return { valid: false, error: "Email address too long." };
    return { valid: true, value: cleaned };
       }

/**
 * Validate phone number (10-15 digits global format), return formatted version  
 * @param {string} phone - Phone number as string  
 * @returns {{valid: boolean, error?: string, value?: string|null}} Validation result with optional formatted phone
 */
  function validatePhone(phone) {
    if (!phone || phone.toString().trim() === "") return { valid: true, value: null };
        // Extract all digits for actual validation
    const rawDigits = String(phone);
    const justNumbers = rawDigits.replace(/\D/g, "");
        // Must have 10-15 digits (global phone format range)
    if (justNumbers.length < 10 || justNumbers.length > 15) return { valid: false, error: "Phone number must be 10-15 digits." };
        // Return formatted version (strip non-digits except parentheses and dashes for display)
    const formatted = rawDigits.replace(/[()\-\\+\s]/g, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3").slice(0, 20);
    return { valid: true, value: formatted };
       }

        // --- Parse & Sanitize Body Fields ---
  const name = sanitizeText(String(data.name || ""), 100);
  const emailResult = validateEmail(String(data.email || ""));
  if (!emailResult.valid) return jsonResp(400, { success: false, error: true, message: emailResult.error }, undefined, request);
  const email = emailResult.value;

  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.valid) return jsonResp(400, { success: false, error: true, message: phoneResult.error }, undefined, request);
  const phone = phoneResult.value;

  const company = sanitizeText(String(data.company || ""), 100);
  const message = sanitizeText(String(data.message || ""), 2000);

        // --- Field Length Validation (after sanitization) ---
  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (message.length < 10) errors.push("Message must be at least 10 characters long.");

  if (errors.length) return jsonResp(400, { success: false, error: true, message: errors.join(" ") }, undefined, request);


  // --- Check D1 availability ---
  if (!db) {
      // D1 not bound — still send webhook and return success
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
    return jsonResp(200, { success: true, message: "Thanks! We'll be in touch within 1 business day.", submissionId: 0 }, undefined, request);
   }

  try {
       // --- Rate limiting (best effort) ---
    try {
      const rawIP = request.headers.get("CF-Connecting-IP") || "unknown";
      const ipHash = await hashSHA256(rawIP);
      const endpoint = "/api/contact";

       // Cleanup old rate limit rows (older than 1 hour before checking/inserting
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
        return jsonResp(429, { success: false, error: true, message: "Too many submissions. Please try again later." }, undefined, request);
       }

       // Under limit - insert rate record and proceed
      await db.prepare(
               "INSERT INTO rate_limits (ip, endpoint, timestamp) VALUES (?, ?, datetime('now'))"
             ).bind(ipHash, endpoint).run();
     } catch {
       // Rate limiting table might not exist — skip, don't fail the submission
     }


       // --- Insert submission ---
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
    const scoreResult = calculateLeadScore(data.service, data.budget, data.timeline);
    const score = scoreResult.score;
    const category = scoreResult.category;  // hot (80+), warm (40-79), cold (<40)

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
               "INSERT INTO leads (submission_id, email, first_name, last_name, phone, company, source, created_at, is_active) VALUES (?, ?, '', '', ?, ?, 'webform', datetime('now'), 1)"
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
      yelp: (data.yelp || "").trim(),
     };
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score, category, subId, socials });

    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: subId,
      leadScore: score,
      category: category,
     }, undefined, request);

   } catch (err) {
      // Even if D1 completely fails, still send webhook and return success to user
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: 0,
     }, undefined, request);
   }
}

async function sendWebhook(env, { name, email, phone, company, message, service, score, category, subId, socials }) {
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
      priorityTag = "<@1466244456088080569>";  // Ada - hot leads
     } else if (category === "warm") {
      priorityTag = "<@1486921534441259098>";  // Ultra - warm leads   
     } else {
      priorityTag = "";  // cold leads don't need immediate attention tag
     }

       // Build fields array with lead score and category
    const fields = [
        { name: "📧 Email", value: email, inline: true },
        { name: "📱 Phone", value: phone || "—", inline: true },
        { name: "🏢 Company", value: company || "—", inline: true },
        { name: "🎯 Service", value: svcLabel, inline: true },
        { name: "📊 Lead Score", value: `**${score}/100**`, inline: true },
        { name: "🏷️ Category", value: `**${category.toUpperCase()}**`, inline: true },
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
          timestamp: new Date().toISOString(),
        }],
       }),
     });
   } catch {
      // Webhook failure is never fatal
  }
}

async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * JSON Response helper with security headers and CORS for moliam domains  
 * @param {number} status - HTTP status code
 * @param {object} body - Response body object (should have success/error boolean)  
 * @param {string} extraHeaders - Optional additional header key-value pairs  
 * @param {object} request - Original request for origin extraction  
 * @returns {Response} Properly formatted response with headers
 */
function jsonResp(status, body, extraHeaders, request) {
  const headers = {
       "Content-Type": "application/json",
       "Access-Control-Allow-Origin": "*",
       "Access-Control-Allow-Methods": "POST, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
       "Access-Control-Allow-Credentials": "true",
       "X-Content-Type-Options": "nosniff",
       "X-Frame-Options": "DENY",
     };

  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  return new Response(JSON.stringify(body), { status, headers });

}

/**
 * Ensure response body has consistent success/error structure  
 * @param {object} body - Body object to balance
 * @returns {object} Balanced body with success property
 */
function balanceSuccessBody(body) {
  if (body.error === true && !successExistsInObject(body)) {
    return { ...body, success: false };
   } else if (body.success === false && !errorExistsInObject(body)) {
    return { ...body, error: true };
   }
  return body;
}

/**
 * Recursively check if object contains 'success' property  
 * @param {object} obj - Object to check
 * @returns {boolean} True if success property exists
 */
function successExistsInObject(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (obj.hasOwnProperty('success')) return true;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && successExistsInObject(obj[key])) {
      return true;
     }
   }
  return false;
}

/**
 * Recursively check if object contains 'error' property  
 * @param {object} obj - Object to check  
 * @returns {boolean} True if error property exists
 */
function errorExistsInObject(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (obj.hasOwnProperty('error')) return true;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && errorExistsInObject(obj[key])) {
      return true;
     }
   }
  return false;
}
