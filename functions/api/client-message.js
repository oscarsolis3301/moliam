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

  // Validate Content-Type header (optional but recommended for API)
  const contentType = request.headers.get("Content-Type");
  if (!contentType || !contentType.includes("application/json")) {
    return jsonResp(415, { error: true, message: "Content-Type must be application/json" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body" });
  }

  // Input sanitization helper - strip XSS vectors and normalize strings
  const sanitizeString = (val) => {
    if (typeof val !== 'string') return null;
    return val
      .replace(/[<>]/g, '')       // Remove angle brackets (basic HTML/XSS prevention)
      .replace(/["'\n\r]/g, '')   // Remove quotes and control chars
      .replace(/<script\b[^>]*>.*?<\/script>/gi, '')  // Extra <script> tag scrubbing
      .replace(/\bjavascript:/i, '').trim();               // Strip javascript: URLs
  };

  const clientId = sanitizeString(body.clientId?.toString());
  if (!clientId || !/^\d+$/.test(clientId)) {
    return jsonResp(400, { error: true, message: "Invalid clientId format" });
  }

  const clientName = sanitizeString(body.clientName) || sanitizeString("Unknown Client");
  
  const messageText = sanitizeString(body.message);
  if (!messageText || messageText.trim().length === 0) {
    return jsonResp(400, { error: true, message: "message is required" });
  }

  if (messageText.length > 2000) {
    return jsonResp(413, { error: true, message: "Message exceeds maximum length (2000 characters)" });
  }

  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !(typeof webhookUrl === 'string' && webhookUrl.trim().length > 0)) {
    return jsonResp(500, { error: true, message: "Discord webhook URL not configured" });
  }

  try {
    await sendDiscordWebhook(webhookUrl, clientId, clientName, messageText);
    
    return jsonResp(200, { success: true, message: "Message delivered to Discord" });

   } catch (err) {
    console.error("Client message error:", err.message);
    return jsonResp(500, { error: true, message: "Failed to deliver message" });
   }
}

// --- Send to Discord webhook with purple embed and tag ---
async function sendDiscordWebhook(webhookUrl, clientId, clientName, messageText) {
  
  const preview = messageText.length > 100 ? messageText.slice(0, 100) + "…" : messageText;
  const username = `${clientName} (Client ${clientId})`;

  // Calculate purple color: 0x8B5CF6 = 9138724 in decimal
  const EMBED_COLOR = 9138724;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
      "X-RateLimit-Reset": Date.now().toString()
    },
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
