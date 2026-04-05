/**
 * Client Messaging API — CloudFlare Pages Function
 * GET  /api/messages — list messages for authenticated user
 * POST /api/messages — send a message
 *
 * Auth: session cookie (same pattern as auth/me.js)
 * Schema: client_messages (client_id, sender, message, created_at)
 * NOTE: client_messages FK references client_profiles(id) but we treat
 *       client_id as users.id — FK won't enforce. Needs unification in Phase 3B.
 */

// --- GET: list messages ---
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const user = await authenticate(request, db);
  if (!user) {
    return jsonResp(401, { error: true, message: "Not authenticated" });
  }

  try {
    let messages;

    if (user.role === "admin") {
      // Admin: optionally filter by client_id query param
      const url = new URL(request.url);
      const clientId = url.searchParams.get("client_id");

      if (clientId) {
        messages = await db.prepare(
          "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 50"
        ).bind(parseInt(clientId)).all();
      } else {
        // No filter: return all recent messages
        messages = await db.prepare(
          "SELECT id, client_id, sender, message, created_at FROM client_messages ORDER BY created_at DESC LIMIT 50"
        ).all();
      }
    } else {
      // Client: only their own messages
      messages = await db.prepare(
        "SELECT id, client_id, sender, message, created_at FROM client_messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 50"
      ).bind(user.id).all();
    }

    return jsonResp(200, { success: true, messages: messages.results || [] });

  } catch (err) {
    console.error("Messages GET error:", err.message);
    return jsonResp(500, { error: true, message: "Failed to retrieve messages" });
  }
}

// --- POST: send a message ---
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const user = await authenticate(request, db);
  if (!user) {
    return jsonResp(401, { error: true, message: "Not authenticated" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body" });
  }

  const messageText = (body.message || "").trim();
  if (!messageText) {
    return jsonResp(400, { error: true, message: "Message text is required" });
  }

  // client_id: required for admin, auto-set for clients
  let clientId;
  if (user.role === "admin") {
    clientId = body.client_id;
    if (!clientId) {
      return jsonResp(400, { error: true, message: "client_id is required for admin messages" });
    }
  } else {
    clientId = user.id;
  }

  // sender = authenticated user's name (not from request body — prevents spoofing)
  const sender = user.name;

  try {
    // Insert into client_messages
    const result = await db.prepare(
      "INSERT INTO client_messages (client_id, sender, message) VALUES (?, ?, ?)"
    ).bind(clientId, sender, messageText).run();

    const messageId = result.meta.last_row_id;

    // Discord webhook: only for client → admin messages (not admin replies)
    if (user.role === "client") {
      await sendDiscordWebhook(env, sender, messageText);
    }

    return jsonResp(200, { success: true, message_id: messageId });

  } catch (err) {
    console.error("Messages POST error:", err.message);
    return jsonResp(500, { error: true, message: "Failed to send message" });
  }
}

// --- CORS preflight ---
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

// --- Authenticate via session cookie ---
// Copied from auth/me.js pattern (not imported — me.js doesn't export it)
async function authenticate(request, db) {
  if (!db) return null;

  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  if (!match) return null;

  const token = match[1];

  try {
    const session = await db.prepare(
      "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1"
    ).bind(token).first();

    if (!session) return null;

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      return null;
    }

    return {
      id: session.user_id,
      email: session.email,
      name: session.name,
      role: session.role,
    };
  } catch {
    return null;
  }
}

// --- Discord webhook (client → admin only) ---
async function sendDiscordWebhook(env, senderName, messageText) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;

  try {
    const preview = messageText.length > 100 ? messageText.slice(0, 100) + "…" : messageText;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Moliam Messages",
        content: `📩 New message from ${senderName}: ${preview}`,
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
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
