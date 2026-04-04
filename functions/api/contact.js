/**
 * MOLIAM Contact Form — CloudFlare Pages Function
 * POST /api/contact
 *
 * Deps: D1 database bound as MOLIAM_DB in wrangler.toml
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // --- Parse body ---
  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body." });
  }

/* ─── PHASE 2: LEAD SCORING + ENHANCED FIELDS ─── */
const name = (data.name || "").trim();
  const email = (data.email || "").toLowerCase().trim();
  const phone = data.phone ? String(data.phone).replace(/[^\d()\-+\s]/g, "").trim() : null;
  const company = data.company ? String(data.company).trim() : null;
  const message = (data.message || "").trim();

// Service interest (new field)
  const service = (data.service || "").trim().toLowerCase();
  const budgetRange = (data.budget || "").trim().toLowerCase();

// Score calculation: 0–100 scale based on service type + budget range (lead prioritization)
  function calculateLeadScore(service, budget) {
    if (!service || service === "other") return 0;

    const servicePoints = {
        website: 40,      // Higher value - full build @ $600+start
    gbp: 30,           // Recurring revenue @$300/mo (lower than lsa)
    lsa: 50,            // Google LSA @ $500 setup + $400/mo (highest value)
      retainer: 60,      // Full service @ $1500/mo (premium tier)
        };

let baseScore = servicePoints[service] || 20;

// Budget multiplier (0.5 to 1.5 range)
const budgetMultiplier = {
    'under-500': 0.5,
    '500–1000': 0.75,
    '1000–2000': 1.2,
    '2000-plus': 1.5,
      }[budget] || 1.0;

// Score = base × budget multiplier, capped to 0–100
const rawScore = Math.round(baseScore * budgetMultiplier);
return Math.max(0, Math.min(100, rawScore));
}

const leadScore = calculateLeadScore(service, budgetRange);

  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Valid email required.");
  if (message.length < 10) errors.push("Message must be at least 10 characters.");
  if (errors.length) return jsonResp(400, { error: true, message: errors.join(" ") });

// --- Rate limiting (5 per 6 min window per IP) ---
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashSHA256(ip);

  try {
    const rl = await db.prepare(
      "SELECT request_count, window_start FROM rate_limits WHERE hash_ip = ?"
    ).bind(ipHash).first();

    if (rl) {
      const windowAge = Date.now() - new Date(rl.window_start).getTime();
      if (windowAge < 360000) {
        if (rl.request_count >= 5) {
          return jsonResp(429, {
            error: true,
            message: "Too many submissions. Please wait a few minutes.",
          });
        }
        await db.prepare(
          "UPDATE rate_limits SET request_count = request_count + 1 WHERE hash_ip = ?"
        ).bind(ipHash).run();
      } else {
        await db.prepare(
          "UPDATE rate_limits SET request_count = 1, window_start = datetime('now') WHERE hash_ip = ?"
        ).bind(ipHash).run();
      }
    } else {
      await db.prepare(
        "INSERT INTO rate_limits (hash_ip, request_count, window_start, last_request_timestamp) VALUES (?, 1, datetime('now'), datetime('now'))"
      ).bind(ipHash).run();
    }

// --- Insert submission to D1 (enhanced with service/budget/score) ---
    const ua = request.headers.get("user-agent") || "";
  const screenRes = data.screenResolution || "";

const sub = await db.prepare(
      "INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution, service, budget_range, lead_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(name, email, phone, company, message, ua, screenRes, service, budgetRange, leadScore).run();

const subId = sub.meta.last_row_id;

// --- Track lead scoring metrics in analytics table ---
  await db.prepare(
      "INSERT INTO lead_analytics (submission_id, service_interest, budget_range, lead_score, score_category) VALUES (?, ?, ?, ?, ?)"
    ).bind(subId, service, budgetRange, leadScore, leadScore >= 60 ? "hot" : leadScore >= 40 ? "warm" : "cold").run();

// --- Create lead record with scoring ---
    await db.prepare(
      "INSERT INTO leads (submission_id, status, created_at, lead_score) VALUES (?, 'new', datetime('now'), ?)"
    ).bind(subId, leadScore).run();

// --- Discord webhook with lead score (optional) ---
    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
  if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.includes("YOUR_")) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "MOLIAM Contact",
          embeds: [{
            title: "📩 New Lead Submission - Score: " + leadScore,
            color: leadScore >= 60 ? 0xef4444 : leadScore >= 40 ? 0xf59e0b : 0x10b981, // red/orange/green by score
            fields: [
               { name: "Name", value: name, inline: true },
               { name: "Email", value: email, inline: true },
               { name: "Phone", value: phone || "—", inline: true },
               { name: "Company", value: company || "—", inline: true },
               { name: "Service Interest", value: service || "Not specified" },
               { name: "Budget Range", value: budgetRange || "Not specified" },
               { name: "Lead Score", value: leadScore + "/100 " + (leadScore >= 60 ? "(HOT)" : leadScore >= 40 ? "(WARM)" : "(COLD)"), inline: true },
               { name: "Message", value: message.slice(0, 1024) },
             ],
            timestamp: new Date().toISOString(),
           }],
         }),
       });
      console.log(`Lead scored ${leadScore}/100 - ${name} -> Company: ${company || "N/A"}`);
    } catch (error) {
      // Discord failure is non-fatal, log to Cloudflare logger
      console.warn("Discord webhook failed:", error.message);
    }
  }

// Return score in response for client-side analytics display
  return jsonResp(200, {
    success: true,
    message: "Thanks! We'll be in touch within 1 business day.",
    submissionId: subId,
    leadScore: leadScore,
    scoreCategory: leadScore >= 60 ? "hot" : leadScore >= 40 ? "warm" : "cold"
  });

  } catch (err) {
    console.error("D1 error:", err);
    return jsonResp(500, {
      error: true,
      message: "Something went wrong. Please email us directly.",
    });
  }
}

async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
