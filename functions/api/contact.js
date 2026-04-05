/**
 * MOLIAM Contact Form — CloudFlare Pages Function
 * POST /api/contact
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
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, subId: 0 });
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

    // --- Insert submission ---
    const ua = request.headers.get("user-agent") || "";
    const screenRes = data.screenResolution || "";
    let subId = 0;

    try {
      const sub = await db.prepare(
        "INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(name, email, phone, company, message, ua, screenRes).run();
      subId = sub.meta.last_row_id;
    } catch {
      // If submissions table schema is wrong, try minimal insert
      try {
        const sub = await db.prepare(
          "INSERT INTO submissions (name, email, phone, message) VALUES (?, ?, ?, ?)"
        ).bind(name, email, phone, message).run();
        subId = sub.meta.last_row_id;
      } catch {
        // Table might not exist at all — continue without DB
      }
    }

    // --- Lead scoring ---
    const score = calculateLeadScore({ phone, company, service: data.service, budget: data.budget, timeline: data.timeline, message });

    // --- Create lead (best effort) ---
    try {
      await db.prepare(
        "INSERT INTO leads (submission_id, status, score, created_at) VALUES (?, 'new', ?, datetime('now'))"
      ).bind(subId, score).run();
    } catch {
      // leads table might not exist — skip
    }

    // --- Discord webhook ---
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score, subId });

    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: subId,
    });

  } catch (err) {
    // Even if D1 completely fails, still send webhook and return success to user
    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, subId: 0 });
    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: 0,
    });
  }
}

async function sendWebhook(env, { name, email, phone, company, message, service, score, subId }) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1490158275918954716/erp8SH34JHhMSztPXfRoPcxgPUj5B0GMA4n7RSluod5t8Su009bAcRh-rk5XlY4nseqy";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

  try {
    const svcRaw = (service || "").toLowerCase();
    const svcLabel = { website: "Website Build", gbp: "GBP Optimization", lsa: "Google LSA", retainer: "Full Retainer", other: "Other" }[svcRaw] || service || "—";
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Moliam Lead",
        avatar_url: "https://moliam.com/moliam-star.jpg",
        content: "<@251822830574895104> New lead submitted!",
        embeds: [{
          title: "🔔 New Lead — " + name,
          color: score >= 50 ? 0x10B981 : score >= 25 ? 0xF59E0B : 0x3B82F6,
          fields: [
            { name: "📧 Email", value: email, inline: true },
            { name: "📱 Phone", value: phone || "—", inline: true },
            { name: "🏢 Company", value: company || "—", inline: true },
            { name: "🎯 Service", value: svcLabel, inline: true },
            { name: "📊 Lead Score", value: `**${score}**/100`, inline: true },
            { name: "💬 Message", value: (message || "—").length > 300 ? message.slice(0, 297) + "…" : (message || "—") },
          ],
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

function calculateLeadScore({ phone, company, service, budget, timeline, message }) {
  let score = 0;
  if (phone && phone.replace(/\D/g, "").length >= 7) score += 15;
  if (company && company.length >= 2) score += 10;
  const svc = (service || "").toLowerCase();
  if (svc.includes("retainer")) score += 30;
  else if (svc.includes("lsa")) score += 25;
  else if (svc.includes("gbp")) score += 20;
  else if (svc.includes("website") || svc.includes("web")) score += 15;
  const bgt = (budget || "").toLowerCase();
  if (bgt.includes("5k") || bgt.includes("5000") || bgt.includes("10k")) score += 25;
  else if (bgt.includes("2.5k") || bgt.includes("2500")) score += 20;
  else if (bgt.includes("1k") || bgt.includes("1000")) score += 10;
  const tl = (timeline || "").toLowerCase();
  if (tl.includes("immediate") || tl.includes("asap")) score += 20;
  else if (tl.includes("1-2") || tl.includes("week")) score += 15;
  else if (tl.includes("month")) score += 10;
  else if (tl.includes("explor")) score += 5;
  if (message && message.length > 50) score += 10;
  return Math.max(0, Math.min(100, score));
}
