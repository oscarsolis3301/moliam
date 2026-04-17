/**
 * Client Messaging API - CloudFlare Pages Function
 */
import { jsonResp, generateRequestId, sanitizeText, validateEmail, authenticate, sanitizeMessage, sanitizeAdminMessage } from './lib/standalone.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  try {
    const session = await authenticate(request, db);
    if (!session) {
      return jsonResp(401, { success: false, message: "Not authenticated." }, request);
    }
    if (!db) {
      return jsonResp(503, { success: false, message: "Database unavailable" }, request);
    }

    let stmt;
    if (session?.role === "admin") {
      const url = new URL(request.url);
      const clientIdParam = url.searchParams.get("client_id");
      if (clientIdParam) {
        stmt = db.prepare(
          "SELECT cm.id, cm.client_id, cm.sender, cm.message, cm.created_at FROM client_messages cm WHERE cm.client_id = ? ORDER BY cm.created_at DESC"
        ).bind(parseInt(clientIdParam));
      } else {
        stmt = db.prepare(
          "SELECT cm.id, cm.client_id, cm.sender, cm.message, cm.created_at FROM client_messages cm WHERE cm.client_id != '0' ORDER BY cm.created_at DESC LIMIT 100"
        );
      }
    } else {
      const clientId = session.id;
      stmt = db.prepare(
        "SELECT id, sender, message, created_at FROM client_messages WHERE client_id=? ORDER BY created_at DESC LIMIT 100"
      ).bind(clientId);
    }

    const results = await stmt.all();
    return jsonResp(200, { success: true, messages: (results?.results || []) }, request);
  } catch (err) {
    return jsonResp(500, { success: false, message: "Internal server error. Please try again." }, request);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  let data;
  try {
    data = await request.json();
    if (typeof data !== 'object' || data === null) {
      return jsonResp(400, { success: false, message: "Request body must be a valid object" }, request);
    }
  } catch {
    return jsonResp(400, { success: false, message: "Invalid JSON in request body" }, request);
  }

  if (!data || !data.sender || !data.message) {
    return jsonResp(400, { success: false, message: "Missing required fields: sender and message are required" }, request);
  }

  if (!db) {
    try {
      const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
      if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Message submission failed - database unavailable", username: "Moliam Messages" })
        });
      }
    } catch (e) { console.error("Discord webhook error:", e); }
    return jsonResp(503, { success: false, message: "Database unavailable. Try again later." }, request);
  }

  try {
    const client_id = parseInt(data.client_id) || 12;
    const senderRaw = data.sender ?? "";
    let sender = sanitizeMessage(senderRaw)?.value ?? "Unknown";

    const emailField = data.email ?? "";
    if (emailField && /\S+\S+/.test(emailField)) {
      const rawName = emailField.split('<')[0].split('@')[0].trim();
      sender = (rawName || "Unknown");
    } else {
      sender = sanitizeMessage(senderRaw)?.value ?? "Unknown";
    }

    const msgResult = (sanitizeMessage(data.message) || { valid: false });
    if (!msgResult?.valid) {
      return jsonResp(400, { success: false, message: "Invalid or empty message" }, request);
    }
    const cleanMessage = msgResult.value || "";

    await db.prepare(
      `INSERT INTO client_messages (client_id, sender, message, created_at) VALUES (?, ?, ?, datetime('now'))`
    ).bind(client_id, sender, cleanMessage).run();

    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      try {
        await db.prepare(
          `INSERT INTO system_logs (action, details) VALUES ('message_received', ?)`
        ).bind(JSON.stringify({ client_id, sender })).run();
      } catch (e) {}
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `New message from ${sender}:\n${cleanMessage}\nClient ID: ${client_id}`,
          username: "Moliam Messages"
        })
      });
    }

    return jsonResp(200, { success: true, error: false, client_id }, request);
  } catch (err) {
    return jsonResp(500, { success: false, message: "Internal server error. Please try again." }, request);
  }
}

export async function onRequestOptions(context) {
  const { request } = context || {};
  const origin = request?.headers?.get('Origin') || '';
  const allowedOrigins = ['https://moliam.com', 'https://moliam.pages.dev'];
  const effectiveOrigin = allowedOrigins.includes(origin) ? origin : '*';
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": effectiveOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
