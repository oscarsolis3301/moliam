/**
 * Client Message API — CloudFlare Pages Function
 * POST /api/client-message — send client message to Discord webhook with purple embed
 * 
 * Body: { clientId, clientName, message }
 * Webhook URL: env.DISCORD_WEBHOOK_URL (set in CF dashboard)
 * Embed color: 0x8B5CF6 (purple)
 * Tags: <@251822830574895104>
 */

// --- POST: send client message to Discord webhook ---
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body" });
  }

  const clientId = body.clientId;
  const clientName = body.clientName || "Unknown Client";
  const messageText = (body.message || "").trim();

  if (!clientId) {
    return jsonResp(400, { error: true, message: "clientId is required" });
  }

  if (!messageText) {
    return jsonResp(400, { error: true, message: "message is required" });
  }

  try {
    await sendDiscordWebhook(env, clientId, clientName, messageText);
    
    return jsonResp(200, { success: true, message: "Message delivered to Discord" });

  } catch (err) {
    console.error("Client message error:", err.message);
    return jsonResp(500, { error: true, message: "Failed to deliver message" });
  }
}

// --- Send to Discord webhook with purple embed and tag ---
async function sendDiscordWebhook(env, clientId, clientName, messageText) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  
  const preview = messageText.length > 100 ? messageText.slice(0, 100) + "…" : messageText;
  const username = `${clientName} (Client ${clientId})`;

  // Calculate purple color: 0x8B5CF6 = 9138724 in decimal
  const EMBED_COLOR = 9138724;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username,
      content: `<@251822830574895104>\n`,
      embeds: [{
        title: `Client ${clientId} Message`,
        color: EMBED_COLOR,
        description: `\`${preview}\``,
        fields: [
          {
            name: "Client Name",
            value: clientName,
            inline: true
          },
          {
            name: "Client ID",
            value: clientId.toString(),
            inline: true
          }
        ],
        footer: {
          text: `Delivered via Moliam API`
        },
        timestamp: new Date().toISOString()
      }]
    })
  });

  console.log(`[ClientMessage] Message from client ${clientId} (${clientName}) delivered to Discord webhook (purple embed 0x8B5CF6)`);
}

// --- CORS preflight ---
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

// --- JSON response helper ---
export function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
