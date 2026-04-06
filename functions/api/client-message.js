export async function onRequestPost(context) {
  const req = await context.request.json();
  const { clientId, clientName, message } = req;
  
  const payload = {
    embeds: [{
      color: 0x8B5CF6,
      fields: [
         { name: "Client ID", value: clientId },
         { name: "Client Name", value: clientName || "N/A" },
         { name: "Message", value: message, inline: false }
       ],
      footer: { text: `VisualArk Client Message | ${new Date().toISOString()}` }
     }]
   };

  const response = await fetch(
     "https://discord.com/api/webhooks/1490158275918954716/erp8SH34JHhMSztPXfRoPcxgPUj5B0GMA4n7RSluod5t8Su009bAcRh-rk5XlY4nseqy",
     {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, content: "<@251822830574895104>" })
     }
   );

  return new Response(JSON.stringify({ success: true }), {
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
