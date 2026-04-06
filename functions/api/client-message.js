export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const req = await request.json();
    const { clientId, clientName, message } = req;

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ success: false, error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const payload = {
      content: "<@251822830574895104>",
      embeds: [{
        color: 0x8B5CF6,
        title: "📩 Client Message",
        fields: [
          { name: "Client ID", value: String(clientId || "Unknown"), inline: true },
          { name: "Client Name", value: String(clientName || "N/A"), inline: true },
          { name: "Message", value: String(message).slice(0, 1024), inline: false }
        ],
        footer: { text: `Moliam Client Message | ${new Date().toISOString()}` }
      }]
    };

    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      console.warn("DISCORD_WEBHOOK_URL not configured or invalid");
      return new Response(JSON.stringify({ success: true, message: "Message received (webhook not configured)" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
