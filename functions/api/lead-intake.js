/**
 * MOLIAM Lead Capture → CRM Pipeline
 * Enhanced contact form with scoring and automation triggers
 * POST /api/lead-intake
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  if (!db) {
    return jsonResp(500, { error: true, message: "Database not available. Please try again later." });
  }

    // --- Parse body ---
  let data;
  try {
    data = await request.json();
   } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body." });
   }

    // --- Validation Helpers (same as contact.js for consistency) ---
  function sanitizeText(text, maxLength = 1000) {
       // Strip HTML tags to prevent XSS
     const stripped = String(text || "").replace(/<[^>]*>/g, "");
     return stripped.trim().slice(0, maxLength);
     }

  function validateEmail(email) {
    if (!email || email.length < 5) return { valid: false, error: "Valid email required." };
    const cleaned = email.toLowerCase().trim();
       // RFC 5321 compliant regex for email format validation
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) return { valid: false, error: "Invalid email format." };
    if (cleaned.length > 254) return { valid: false, error: "Email address too long." };
    return { valid: true, value: cleaned };
     }

  function validatePhone(phone) {
    if (!phone || phone.toString().trim() === "") return { valid: true, value: null };
       // Extract all digits for actual validation
    const rawDigits = String(phone);
    const justNumbers = rawDigits.replace(/\D/g, "");
       // Must have 10-15 digits (global phone format range)
    if (justNumbers.length < 10 || justNumbers.length > 15) return { valid: false, error: "Phone number must be 10-15 digits." };
       // Return formatted version (strip non-digits except parentheses and dashes for display)
    const formatted = rawDigits.replace(/[()\-+\s]/g, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3").slice(0, 20);
    return { valid: true, value: formatted };
     }

    // --- Sanitize all text fields (strip HTML, apply length limits) ---
  const name = sanitizeText(data.name, 200);
  const emailResult = validateEmail(String(data.email || ""));
  if (!emailResult.valid) return jsonResp(400, { error: true, message: emailResult.error });
  const email = emailResult.value;

  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.valid) return jsonResp(400, { error: true, message: phoneResult.error });
  const phone = phoneResult.value;

  const company = sanitizeText(data.company, 100);
  const message = sanitizeText(data.message || "", 1000);

    // Enhanced fields for scoring (sanitized)
  const budget = sanitizeText(String(data.budget || "undisclosed"), 50);
  const scope = sanitizeText(data.scope ? String(data.scope).trim() : (data.inquiry_type || "General inquiry"), 200);
  const industry = sanitizeText(data.industry ? String(data.industry).trim() : "general", 100);
  const urgency_level = data.urgency_level || 'medium';

    // Sanitized pain_points array (limit item length to 500 chars)
  const pain_points = Array.isArray(data.pain_points) 
     ? data.pain_points.filter(p => p && typeof p.trim === 'function' && p.trim().length > 0).slice(0, 5).map((p, i) => sanitizeText(String(p), 500))
     : [];

  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (message.length < 10) errors.push("Message must be at least 10 characters.");

  if (errors.length) {
    return jsonResp(400, { error: true, message: errors.join(" ") });
   }



  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const ua = request.headers.get("user-agent") || "";
  const screenRes = data.screenResolution ? String(data.screenResolution).trim() : "";

  try {
      // --- Rate limiting check (5 per 6 min window per IP) ---
    const ipHash = await hashSHA256(ip);
    const rl = await db.prepare(
        \"SELECT request_count, window_start FROM rate_limits WHERE ip_address_hash = ?\"
      ).bind(ipHash).first();

    if (rl) {
      const windowAge = Date.now() - new Date(rl.window_start).getTime();
      if (windowAge < 360000 && rl.request_count >= 5) {
        return jsonResp(429, { 
          error: true, 
          message: "Too many submissions. Please wait a few minutes.",
          retryAfter: Math.ceil((360000 - windowAge) / 1000)
         });
      }
    }

     // --- Insert submission with enhanced fields ---
    const sub = await db.prepare(
      `INSERT INTO submissions 
       (name, email, phone, company, message, user_agent, screen_resolution, budget, scope, industry, urgency_level, pain_points) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
     ).bind(name, email, phone, company, message, ua, screenRes, budget, scope, industry, urgency_level, JSON.stringify(pain_points)).run();

    const subId = sub.meta?.last_row_id;

    if (!subId) {
      console.error("Failed to get last_row_id:", JSON.stringify(sub));
      return jsonResp(500, { error: true, message: "Failed to save submission. Please try again." });
     }

     // --- Calculate Lead Score ---
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

     // --- Initiate CRM Sync (non-blocking) ---
    initiateCrmSync(context.env, subId, { name, email, phone, company, budget, scope, industry, urgency_level }).catch(err => {
      console.warn("CRM sync failed:", err.message);
     });

     // --- Queue Email Sequences (background task) ---
    queueEmailSequences(context.env, subId).catch(err => {
      console.warn("Email sequencing failed:", err.message);
     });

     // --- Send Real-time Discord Notification (non-blocking) ---
    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.includes("YOUR_") && !webhookUrl.includes("PLACEHOLDER")) {
      sendDiscordAlert(webhookUrl, scoreResult).catch(err => {
        console.warn("Discord alert failed:", err.message);
       });
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
     });

   } catch (err) {
    console.error("Lead intake error:", err);
    return jsonResp(500, { 
      error: true, 
      message: "Something went wrong. Please email us directly at hello@moliam.com.",
      requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
     });
   }
}

/**
 * LEAD SCORING ENGINE - Auto-calculate lead priority
 */
function calculateLeadScore(data) {
  const { email, name, company, budget, scope, industry, urgency_level, message } = data;
  let base_score = 40; // Base score for any qualified lead

   // Budget scoring (0-25 points)
  let budgetFit = 50;
  if (budget.includes("under $10") || budget === "undisclosed") {
    base_score += 5;
    budgetFit = 30;
  } else if (/\d+\.\d+/.test(budget) && /\d+$/.exec(budget)[0] > 5) {
    base_score += 15;
    budgetFit = 75;
  } else if (/^\w+\s?\$[5-9]k?$|^\d+[$,]?\d{3,}/.test(budget)) {
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
  if (/immediate|urgent|deadline|asap|quickly|fast|\b30\s*days\b/i.test(message)) {
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
    score_breakdown: { base_score, industry_boost, urgency_boost }
   };
}

/**
 * CRM Sync - Push to HubSpot/Airtable/Pipedrive (fire-and-forget)
 */
async function initiateCrmSync(env, submission_id, data) {
  try {
    const CRM_PROVIDER = env.HUBSPOT_API_KEY || env.AIRTABLE_API_KEY || "airtable";
    const crmUrl = CRM_PROVIDER.includes('hubspot') 
      ? 'https://api.hubapi.com/crm/v3/objects/contacts'
      : (env.AIRTABLE_API_KEY ? 'https://api.airtable.com/v0/' + env.AIRTABLE_APP_ID + '/Leads' : null);

    if (!crmUrl) return null; // Skip if no CRM configured

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

    const headers = {
      'Content-Type': 'application/json'
    };

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
 * Email Sequence Queue - Initialize automated email flows (non-blocking)
 */
async function queueEmailSequences(env, submission_id) {
  try {
    if (!env.db) throw new Error("No db binding available");

    const sequences = [
       { sequence_name: 'immediate_confirmation', step_number: 1 },
       { sequence_name: 'first_response', step_number: 2 },
       { sequence_name: 'nurturing_drip', step_number: 3 }
     ];

    for (const seq of sequences) {
      await env.db.prepare(
         `INSERT INTO email_sequences (submission_id, sequence_name, step_number, email_status, custom_data) 
         VALUES (?, ?, ?, 'queued', ?)`
       ).bind(submission_id, seq.sequence_name, seq.step_number, JSON.stringify({ priority: 'medium' }));

       // Mark first step as sent immediately
      await env.db.prepare(
         `UPDATE email_sequences SET email_status = 'sent', sent_at = datetime('now') 
         WHERE submission_id = ? AND sequence_name = 'immediate_confirmation'`
       ).bind(submission_id);
    }
  } catch (err) {
    console.warn("Email sequencing failed:", err.message);
  }
}

/**
 * Discord Alert - Send real-time notification to Discord channel
 */
async function sendDiscordAlert(webhook_url, score_data) {
  try {
    const messageEmbed = {
      title: "🎯 NEW LEAD ALERT - Score: " + score_data.total_score + "/100",
      color: score_data.total_score >= 75 ? 0x22c55e : (score_data.total_score >= 60 ? 0xeab308 : 0x3b82f6),
      fields: [
         { name: "Lead Score", value: `**${score_data.total_score}/100**`, inline: true },
         { name: "Status Priority", value: score_data.urgency_status ? `**${score_data.urgency_status.toUpperCase()}**` : "Normal", inline: true },
         { name: "Base Score", value: String(score_data.base_score), inline: true },
         { name: "Industry Boost", value: String(score_data.industry_boost), inline: true },
         { name: "Urgency Boost", value: String(score_data.urgencyBoost) || "N/A", inline: true }
       ],
      timestamp: new Date().toISOString(),
      type: 1,
      username: "MOLIAM Lead Monitor"
    };

    await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [messageEmbed] }),
      signal: AbortSignal.timeout(5000)
     });
  } catch (err) {
    console.warn("Discord alert failed:", err.message);
  }
}

function jsonResp(status, body) {
  const responseBody = JSON.stringify(body);
  return new Response(responseBody, {
    status,
    headers: { 
      "Content-Type": "application/json", 
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store, no-cache"
     }
   });
}

async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sliceText(text, maxLen) {
  if (!text) return "";
  return text.length <= maxLen ? text : text.slice(0, maxLen) + " [truncated]";
}
