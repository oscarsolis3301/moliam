/**
 * MOLIAM Contact Form — CloudFlare Pages Function (Production-Grade v2.1)
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

  /* ─── XSS SAFETY: HTML Entity Escaping Helper ─── */
  function escapeHTML(str) {
    return String(str)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
  }

  /* ─── FIELD EXTRACTION ─── */
  const nameRaw = (data.name || "").trim();
  const name = escapeHTML(nameRaw); // XSS-safe storage
  const email = (data.email || "").toLowerCase().trim();
  const phone = data.phone ? String(data.phone).replace(/[^\d()\-+\s]/g, "").trim() : null;
  const companyRaw = (data.company || "").trim();
  const messageRaw = (data.message || "").trim();
  const message = escapeHTML(messageRaw); // XSS-safe storage
  const service = (data.service || "").trim().toLowerCase();
  const budgetRange = (data.budget || "").trim().toLowerCase();

  /* ─── LEAD SCORING: 0-100 ─── */
  function calculateLeadScore(d) {
    let score = 0;
    if (d.phone && String(d.phone).trim().length > 0) score += 15;
    if (d.company && String(d.company).trim().length > 0) score += 10;

    const svc = (d.service || "").toLowerCase();
    const svcPoints = { retainer: 30, lsa: 25, gbp: 20, website: 15 };
    score += svcPoints[svc] || 0;

    const br = (d.budget_range || d.budget || "").toLowerCase();
    if (br.includes("2000-plus") || br.includes("5k+") || br.includes("5000+")) score += 25;
    else if (br.includes("1000-2000") || br.includes("2.5-5k") || br.includes("2500-5000")) score += 20;
    else if (br.includes("under-500") || br.includes("<1k") || br.includes("500-1000")) score += 10;

    const tl = (d.timeline || "").toLowerCase();
    if (tl.includes("immediate") || tl.includes("within 1 week") || tl.includes("this week")) score += 20;
    else if (tl.includes("1-2 weeks") || tl.includes("7-14 days")) score += 15;
    else if (tl.includes("this month") || tl.includes("2-4 weeks")) score += 10;
    else if (tl.includes("exploring") || tl.includes("just looking")) score += 5;

    if ((d.message || "").trim().length > 50) score += 10;
    return Math.min(100, score);
  }

  const leadScore = calculateLeadScore(data);

  // --- Validation ---
  const errors = [];
  if (nameRaw.length < 2) errors.push("Name must be at least 2 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Valid email required.");
  if (messageRaw.length < 10) errors.push("Message must be at least 10 characters.");
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

    // --- Insert submission to D1 ---
    const ua = request.headers.get("user-agent") || "";
    const screenRes = data.screenResolution || "";

    // Core insert — uses only columns guaranteed to exist
    let sub;
    try {
      sub = await db.prepare(
         "INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution, service, budget_range) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
       ).bind(name, email, phone, company, message, ua, screenRes, service, budgetRange).run();
    } catch (colErr) {
      // Fallback: original schema without service/budget_range columns
      sub = await db.prepare(
         "INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution) VALUES (?, ?, ?, ?, ?, ?, ?)"
       ).bind(name, email, phone, company, message, ua, screenRes).run();
    }

    const subId = sub.meta.last_row_id;

    // --- Lead analytics (optional — table may not exist yet) ---
    try {
      await db.prepare(
         "INSERT INTO lead_analytics (submission_id, service_interest, budget_range, score, score_category) VALUES (?, ?, ?, ?, ?)"
       ).bind(subId, service, budgetRange, leadScore, leadScore >= 50 ? "hot" : leadScore >= 30 ? "warm" : "cold").run();
    } catch (e) {
      console.warn(JSON.stringify({ level: "warn", event: "lead_analytics_unavailable", submissionId: subId, error: e.message }));
    }

    // --- Lead record (optional — score column may not exist yet) ---
    try {
      await db.prepare(
         "INSERT INTO leads (submission_id, status, score, created_at) VALUES (?, 'new', ?, datetime('now'))"
       ).bind(subId, leadScore).run();
    } catch (e) {
      // Fallback: insert without score column
      try {
        await db.prepare(
           "INSERT INTO leads (submission_id, status, created_at) VALUES (?, 'new', datetime('now'))"
         ).bind(subId).run();
      } catch (e2) {
        console.warn(JSON.stringify({ level: "warn", event: "leads_insert_failed", submissionId: subId, error: e2.message }));
      }
    }

    // --- Discord webhook notification (env-configured) ---
    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.includes("YOUR_")) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "MOLIAM Contact",
            embeds: [{
              title: `📩 New Lead — Score: ${leadScore}`,
              color: leadScore >= 60 ? 0xef4444 : leadScore >= 40 ? 0xf59e0b : 0x10b981,
              fields: [
                 { name: "Name", value: escapeHTML(nameRaw), inline: true },
                 { name: "Email", value: email, inline: true },
                 { name: "Phone", value: phone || "—", inline: true },
                 { name: "Company", value: escapeHTML(companyRaw || ""), inline: true },
                 { name: "Service Interest", value: service || "Not specified" },
                 { name: "Budget Range", value: budgetRange || "Not specified" },
                 { name: "Lead Score", value: `${leadScore}/100 ${leadScore >= 60 ? "(HOT)" : leadScore >= 40 ? "(WARM)" : "(COLD)"}`, inline: true },
                 { name: "Message", value: escapeHTML(messageRaw.slice(0, 1024)), inline: false },
               ],
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch (whErr) {
        console.warn(JSON.stringify({ level: "warn", event: "webhook_failed", submissionId: subId, leadScore, error: whErr.message }));
      }
    }

    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: subId,
      leadScore: leadScore,
      scoreCategory: leadScore >= 60 ? "hot" : leadScore >= 40 ? "warm" : "cold",
    });

  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "d1_error", message: err.message }));
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
