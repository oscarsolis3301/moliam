/**
 * Calendly Webhook Receiver — CloudFlare Pages Function
 * POST /api/calendly-webhook
 *
 * Catches Calendly booking events, stores in D1 appointments table,
 * notifies Discord. Uses Web Crypto API (CF Workers runtime).
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // --- Read raw body for signature verification ---
  const rawBody = await request.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body" });
  }

  // --- Verify Calendly HMAC signature ---
  const sigHeader = request.headers.get("Calendly-Webhook-Signature") || "";
  const webhookSecret = env.CALENDLY_WEBHOOK_SECRET || "";

  if (webhookSecret) {
    const valid = await verifySignature(rawBody, sigHeader, webhookSecret);
    if (!valid) {
      return jsonResp(401, { error: true, message: "Invalid webhook signature" });
    }
  }

  // --- Extract event type and payload ---
  const event = data.event; // "invitee.created" or "invitee.canceled"
  const payload = data.payload || {};

  if (!event || !payload) {
    return jsonResp(400, { error: true, message: "Missing event or payload" });
  }

  // --- Map Calendly fields to our schema ---
  const scheduledEvent = payload.scheduled_event || {};
  const clientName = payload.name || scheduledEvent.name || "Unknown";
  const clientEmail = payload.email || "";
  const appointmentDatetime = scheduledEvent.start_time || new Date().toISOString();
  const calendarEventId = scheduledEvent.uri || null;
  const calendarLink = scheduledEvent.location?.join_url || null;
  const scheduledWith = "Roman";
  const bookingSource = "web";

  // --- Format time for Discord (PT) ---
  const ptTime = new Date(appointmentDatetime).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  });

  try {
    if (event === "invitee.created") {
      // --- Insert appointment into D1 ---
      if (db) {
        try {
          await db.prepare(
            `INSERT INTO appointments
             (calendar_event_id, calendar_link, booking_source, scheduled_with,
              appointment_datetime, status, client_timezone, created_at)
             VALUES (?, ?, ?, ?, ?, 'confirmed', 'America/Los_Angeles', datetime('now'))`
          ).bind(
            calendarEventId, calendarLink, bookingSource, scheduledWith,
            appointmentDatetime
          ).run();
        } catch (dbErr) {
          console.warn("D1 insert failed (continuing):", dbErr.message);
        }
      }

      // --- Discord notification ---
      await sendDiscordWebhook(env, {
        title: "📅 New Calendly Booking",
        color: 0x00cc88,
        fields: [
          { name: "Name", value: clientName, inline: true },
          { name: "Email", value: clientEmail || "—", inline: true },
          { name: "When", value: ptTime, inline: true },
        ],
      });

    } else if (event === "invitee.canceled") {
      // --- Update appointment status ---
      if (db && calendarEventId) {
        try {
          await db.prepare(
            "UPDATE appointments SET status = 'cancelled', updated_at = datetime('now') WHERE calendar_event_id = ?"
          ).bind(calendarEventId).run();
        } catch (dbErr) {
          console.warn("D1 cancel update failed (continuing):", dbErr.message);
        }
      }

      // --- Discord notification ---
      await sendDiscordWebhook(env, {
        title: "❌ Calendly Cancellation",
        color: 0xef4444,
        fields: [
          { name: "Name", value: clientName, inline: true },
          { name: "Email", value: clientEmail || "—", inline: true },
          { name: "Was Scheduled", value: ptTime, inline: true },
        ],
      });
    }

    return jsonResp(200, { received: true });

  } catch (err) {
    console.error("Calendly webhook error:", err.message);
    // Graceful fallback — always return 200 so Calendly doesn't retry
return jsonResp(200, { received: true });
   }
}

// CORS preflight handler for webhook endpoint
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Calendly-Webhook-Signature"
      }
    });
}

// --- HMAC-SHA256 signature verification (Web Crypto API) ---
async function verifySignature(body, sigHeader, secret) {
  try {
    // Calendly signature format: "t=<timestamp>,v1=<signature>"
    const parts = {};
    for (const part of sigHeader.split(",")) {
      const [key, val] = part.split("=", 2);
      parts[key.trim()] = val?.trim() || "";
    }

    const timestamp = parts.t;
    const receivedSig = parts.v1;
    if (!timestamp || !receivedSig) return false;

    // Compute expected signature: HMAC-SHA256(secret, timestamp.body)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${timestamp}.${body}`)
    );

    const expectedSig = Array.from(new Uint8Array(signed))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (expectedSig.length !== receivedSig.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      mismatch |= expectedSig.charCodeAt(i) ^ receivedSig.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

// --- Discord webhook helper ---
async function sendDiscordWebhook(env, embed) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Moliam Bookings",
        embeds: [{
          ...embed,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch (whErr) {
    console.warn("Discord webhook failed:", whErr.message);
  }
}

// --- JSON response helper ---
function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
