/** Extract session token from cookies */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

/** Authenticate user and get session data */
async function authenticate(db, token) {
  if (!token || !db) return null;
  
  const session = await db.prepare(
      "SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active=1"
    ).bind(token).first();
    
  return session || null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
  
       // -- GET token from cookies
          const token = getSessionToken(request);
          if (token === null || token === undefined) {
            return new Response(JSON.stringify({ error: "Authentication required" }), {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://moliam.pages.dev",
                "X-Frame-Options": "DENY"
              }
            });
          }

       // -- Validate session exists and fetch user data
  if (db) {
    const user = await authenticate(db, token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "https://moliam.pages.dev",
          "X-Frame-Options": "DENY"
        }
      });
    }
  }

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


       // --- Discord webhook with timeout and error handling ---
      try {
        const webhookUrl = env.DISCORD_WEBHOOK_URL;
        if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

          try {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: controller.signal
            });
           } catch (fetchErr) {
             if (fetchErr.name === 'AbortError') {
               console.warn("Discord webhook timeout after 5s, continuing...");
             } else {
               console.warn("Discord webhook fetch failed:", fetchErr.message);
             }
           } finally {
            clearTimeout(timeoutId);
           }
         }
       } catch (webhookError) {
         // Webhook failure is never fatal - log and continue
         console.warn("Discord webhook exception:", webhookError.message);
       }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Cache-Control": "no-cache"
         }
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
