const WEBHOOK_URL = "https://discord.com/api/webhooks/1490158275918954716/erp8SH34JHhMSztPXfRoPcxgPUj5B0GMA4n7RSluod5t8Su009bAcRh-rk5XlY4nseqy";

export async function onRequestPost(context) {
  const request = context.request;
  const body = await request.json();
  const { clientId, clientName, message } = body;

  const embed = {
    color: 0x8B5CF6,
    title: "💬 Client message from " + (clientName || "Unknown"),
    fields: [
      { name: "Client ID", value: String(clientId || "N/A"), inline: true },
      { name: "Message", value: message ? String(message).substring(0, 1024) : "N/A" }
    ],
    timestamp: new Date().toISOString()
  };

  const payload = { embeds: [embed] };

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}
