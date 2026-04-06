/**
 * MOLIAM Contact Form — CloudFlare Pages Function v3
 * POST /api/contact — Enhanced with lead scoring and auto-categorization
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

   // --- Validate ---
  const name = (data.name || "").trim();
  const email = (data.email || "").toLowerCase().trim();
  const phone = data.phone ? String(data.phone).replace(/[^\d()\-+\s]/g, "").trim() : null;
  const company = data.company ? String(data.company).trim() : null;
  const message = (data.message || "").trim();

  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Valid email required.");
  if (message.length < 10) errors.push("Message must be at least 10 characters.");
  if (errors.length) return jsonResp(400, { error: true, message: errors.join(" ") });

   // --- Check D1 availability ---
  if (!db) {
     // D1 not bound — still send webhook and return success
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
    return jsonResp(200, { success: true, message: "Thanks! We'll be in touch within 1 business day.", submissionId: 0 });
  }

  try {
     // --- Rate limiting (best effort) ---
    try {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const ipHash = await hashSHA256(ip);
      const rl = await db.prepare(
         "SELECT request_count, window_start FROM rate_limits WHERE hash_ip = ?"
       ).bind(ipHash).first();

      if (rl) {
        const windowAge = Date.now() - new Date(rl.window_start).getTime();
        if (windowAge < 360000 && rl.request_count >= 5) {
          return jsonResp(429, { error: true, message: "Too many submissions. Please wait a few minutes." });
        }
        if (windowAge < 360000) {
          await db.prepare("UPDATE rate_limits SET request_count = request_count + 1 WHERE hash_ip = ?").bind(ipHash).run();
        } else {
          await db.prepare("UPDATE rate_limits SET request_count = 1, window_start = datetime('now') WHERE hash_ip = ?").bind(ipHash).run();
        }
      } else {
        await db.prepare(
           "INSERT INTO rate_limits (hash_ip, request_count, window_start, last_request_timestamp) VALUES (?, 1, datetime('now'), datetime('now'))"
         ).bind(ipHash).run();
      }
    } catch {
      // Rate limiting table might not exist — skip, don't fail the submission
    }

    // --- Ensure submissions table has lead_score column ---
    try {
      await db.prepare("ALTER TABLE submissions ADD COLUMN lead_score INTEGER DEFAULT 0").run();
    } catch {
      // Column already exists or no need to modify
    }
    
    try {
      await db.prepare("ALTER TABLE submissions ADD COLUMN category TEXT DEFAULT 'cold'").run();
    } catch {
      // Column already exists
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
         "INSERT INTO leads (submission_id, status, score, created_at) VALUES (?, 'new', ?, datetime('now'))"
       ).bind(subId, score).run();
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
    });

  } catch (err) {
     // Even if D1 completely fails, still send webhook and return success to user
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: 0,
    });
  }
}

async function sendWebhook(env, { name, email, phone, company, message, service, score, category, subId, socials }) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

  try {
    const svcRaw = (service || "").toLowerCase();
    const svcLabel = { website: "Website Build", gbp: "GBP Optimization", lsa: "Google LSA", retainer: "Full Retainer", other: "Other" }[svcRaw] || service || "—";

     // Determine priority tag based on lead_score and category
    let priorityTag = "";
    if (category === "hot") {
      priorityTag = "<@1466244456088080569>"; // Ada - hot leads
    } else if (category === "warm") {
      priorityTag = "<@1486921534441259098>"; // Ultra - warm leads  
    } else {
      priorityTag = ""; // cold leads don't need immediate attention tag
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
    if (s.instagram) socialLines.push(`📸 ${s.instagram.startsWith("http") ? `[Instagram](${s.instagram})` : `@${s.instagram.replace("@","")}`}`);
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

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
       "Content-Type": "application/json",
       "Access-Control-Allow-Origin": "*",
     },
   });
}

/**
 * Enhanced Lead Scoring based on service interest (core requirement v3)
 * Service tiers: retainer=100pts (hot), lsa=80pts, gbp=60pts, website=40pts, other=20pts
 * Auto-categorization: hot (80+), warm (40-79), cold (<40)
 */
function calculateLeadScore(service, budget, timeline) {
  let score = 0;
  const svc = (service || "").toLowerCase();

   // SERVICE-BASED SCORING — Core v3 requirement: priority by service type
  if (svc.includes("retainer")) {
    score += 100; // retainer = 100pts (hot)
  } else if (svc.includes("lsa") || svc.includes("google_ads")) {
    score += 80; // lsa = 80pts
  } else if (svc.includes("gbp") || svc.includes("google_business")) {
    score += 60; // gbp = 60pts  
  } else if (svc.includes("website") || svc.includes("web build")) {
    score += 40; // website = 40pts
  } else {
    score += 20; // other = 20pts
  }

   // Budget bonus: adds 5-15 points
  const bgt = (budget || "").toLowerCase();
  if (bgt.includes("10k+") || bgt.includes("10000") || bgt.includes("enterprise")) score += 15;
  else if (bgt.includes("5k") || bgt.includes("5000")) score += 10;
  else if (bgt.includes("2.5k") || bgt.includes("2500")) score += 7;
  else if (bgt.includes("1k") || bgt.includes("1000")) score += 5;

   // Timeline urgency bonus: adds 0-20 points
  const tl = (timeline || "").toLowerCase();
  if (tl.includes("immediate") || tl.includes("asap") || tl.includes("today")) score += 20;
  else if (tl.includes("1-2") || tl.includes("this week") || tl.includes("week")) score += 15;
  else if (tl.includes("month")) score += 10;
  else if (tl.includes("explor") || tl.includes("soon")) score += 5;

   // Auto-categorization based on final score
  let category = "cold";
  if (score >= 80) {
    category = "hot";
  } else if (score >= 40 && score < 80) {
    category = "warm";
  } else {
    category = "cold";
  }

  return { score: Math.max(0, Math.min(100, score)), category };
}
