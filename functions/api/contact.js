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

// Lead scoring: 0-100 scale based on signals from Ada's spec
// Signals: phone(+15), company(+10), service(retainer+30, LSA+25, GBP+20, website+15), 
// budget(5k+ +25, 2.5-5k +20, <1k +10), timeline(immediate +20, 1-2wk +15, this month +10, exploring +5),
// detailed message >50 chars (+10)
function calculateLeadScore(data) {
  let score = 0;
  
   // Phone provided: +15
  if (data.phone && String(data.phone).trim().length > 0) {
    score += 15;
   }
  
   // Company name: +10
  if (data.company && String(data.company).trim().length > 0) {
    score += 10;
   }
  
   // Service interest points
  const service = (data.service || "").toLowerCase();
  const servicePoints = {
    retainer: 30,       // Full service @ $1500/mo (premium tier)
    lsa: 25,            // Google LSA @ $500 setup + $400/mo
    gbp: 20,            // Recurring revenue @ $300/mo
    website: 15,        // Full build @ $600+ start
   };
  score += servicePoints[service] || 0;
  
   // Budget range points
  const budgetRange = (data.budget_range || "").toLowerCase();
  if (budgetRange.includes('2000-plus') || budgetRange.includes('5k+') || budgetRange.includes('5000+')) {
    score += 25;      // $5k+ budget
   } else if (budgetRange.includes('1000-2000') || budgetRange.includes('2.5-5k') || budgetRange.includes('2500-5000')) {
    score += 20;      // $2.5-5k budget
   } else if (budgetRange.includes('under-500') || budgetRange.includes('<1k') || budgetRange.includes('500-1000')) {
    score += 10;      // <$1k budget
   }
  
   // Timeline points: +20 immediate, +15 1-2wk, +10 this month, +5 exploring
  const timeline = (data.timeline || "").toLowerCase();
  if (timeline.includes('immediate') || timeline.includes('within 1 week') || timeline.includes('this week')) {
    score += 20;
   } else if (timeline.includes('1-2 weeks') || timeline.includes('7-14 days')) {
    score += 15;
   } else if (timeline.includes('this month') || timeline.includes('2-4 weeks')) {
    score += 10;
   } else if (timeline.includes('exploring') || timeline.includes('just looking')) {
    score += 5;
   }
  
   // Detailed message (>50 chars): +10
  const message = (data.message || "").trim();
  if (message.length > 50) {
    score += 10;
   }
  
   // Cap at 100
  return Math.min(100, score);
}

// Call with full data object including phone, company, service, budget_range, timeline, message
const leadScore = calculateLeadScore(data);

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
