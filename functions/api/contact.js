/**
 * MOLIAM Contact Form — CloudFlare Pages Function
 * POST /api/contact
 *
 * Deps: D1 database bound as MOLIAM_DB in wrangler.toml
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

  // --- Validate ---
  const name = (data.name || "").trim();
  const email = (data.email || "").toLowerCase().trim();
  const phone = data.phone ? String(data.phone).replace(/[^\d()\-+\s]/g, "").trim() : null;
  const company = data.company ? String(data.company).trim() : null;
  const message = (data.message || "").trim();

  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters.");
  if (!/^[^\s@]+@[^\s]+\.[^\s]+$/.test(email)) errors.push("Valid email required.");
  if (message.length < 10) errors.push("Message must be at least 10 characters.");
  if (errors.length) return jsonResp(400, { error: true, message: errors.join(" ") });

  // --- Rate limiting (5 per 6 min window per IP) ---
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
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
            retryAfter: Math.ceil((windowAge + 360000 - Date.now()) / 1000)
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

    // --- Insert submission ---
    const ua = request.headers.get("user-agent") || "";
    const screenRes = data.screenResolution ? String(data.screenResolution).trim() : "";

    const sub = await db.prepare(
      "INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(name, email, phone, company, message, ua, screenRes).run();

    const subId = sub.meta?.last_row_id;

    if (!subId) {
      console.error("Failed to get last_row_id:", JSON.stringify(sub));
      return jsonResp(500, { error: true, message: "Failed to save submission. Please try again." });
    }

    // --- Create lead ---
    await db.prepare(
      "INSERT INTO leads (submission_id, status, created_at) VALUES (?, 'new', datetime('now'))"
    ).bind(subId).run();

    // --- Discord webhook (optional) ---
    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.includes("YOUR_") && !webhookUrl.includes("PLACEHOLDER")) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "MOLIAM Contact",
            embeds: [{
              title: "📩 New Contact Submission",
              color: 0x7c3aed,
              fields: [
                { name: "Name", value: name, inline: true },
                { name: "Email", value: email, inline: true },
                { name: "Phone", value: phone || "—", inline: true },
                { name: "Company", value: company || "—", inline: true },
                { name: "Message", value: sliceText(message, 1024) }
              ],
              timestamp: new Date().toISOString()
            }]
          }),
          signal: AbortSignal.timeout(5000)
        });
      } catch (err) {
        if (err.name !== "TimeoutError") {
          console.warn("Discord webhook failed:", err.message);
        }
      }
    }

    return jsonResp(200, {
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      submissionId: subId
    });

  } catch (err) {
    console.error("D1 error:", err);
    return jsonResp(500, {
      error: true,
      message: "Something went wrong. Please email us directly at hello@moliam.com.",
      requestId: crypto.randomUUID
      ? crypto.randomUUID()
      : undefined
    });
  }
}

async function hashSHA256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sliceText(text, maxLen) {
  if (!text) return "";
  return text.length <= maxLen ? text : text.slice(0, maxLen) + " [truncated]";
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
      "Cache-Control": "no-store, no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
