export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestPost(context) {
  const env = context.env;
  const db = env.MOLIAM_DB;
  const request = context.request;
  
  try {
    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
      return jsonResp(401, { error: true, message: "Not authenticated." });
    }
    
    const authResult = await db.prepare(
      "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.company, u.phone FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1"
    ).bind(sessionToken).first();
    
    if (!authResult) {
      return jsonResp(401, { error: true, message: "Session invalid." });
    }
    
    if (new Date(authResult.expires_at) < new Date()) {
      await db.prepare("DELETE FROM sessions WHERE token = ?").bind(sessionToken).run();
      return jsonResp(401, { error: true, message: "Session expired." });
    }
    
    const { client_message, client_id, user_name } = await request.json();
    
    if (!client_message || !user_name) {
      return jsonResp(400, { error: true, message: "client_message and user_name required." });
    }
    
    const message_id = crypto.randomUUID();
    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    
    // Send Discord notification
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '<@251822830574895104> Client message received',
          embeds: [{
            title: '💬 New Client Message',
            description: client_message.substring(0, 1000),
            color: 0x8B5CF6,
            fields: [
              { name: 'Client', value: user_name || 'N/A', inline: true },
              { name: 'Email', value: authResult.email || 'N/A', inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        })
      });
    }
    
    // Try to log to client_messages table (may not exist yet — graceful fallback)
    try {
      await db.prepare(
        "INSERT INTO client_messages (id, user_email, message_text, created_at, message_type) VALUES (?, ?, ?, datetime('now'), 'client_to_admin')"
      ).bind(message_id, authResult.email, client_message).run();
    } catch (tableErr) {
      // Table might not exist yet — log to submissions as fallback
      console.warn('client_messages insert failed, using submissions fallback:', tableErr.message);
      try {
        await db.prepare(
          "INSERT INTO submissions (name, email, message, created_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(user_name, authResult.email, '[Client Message] ' + client_message).run();
      } catch (e2) {
        console.warn('Fallback insert also failed:', e2.message);
      }
    }
    
    return jsonResp(201, { success: true, message_id });
    
  } catch (err) {
    console.error('Messaging API error:', err);
    return jsonResp(500, { error: true, message: 'Server error.' });
  }
}

export async function onRequestGet(context) {
  const env = context.env;
  const db = env.MOLIAM_DB;
  const request = context.request;
  
  try {
    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
      return jsonResp(401, { error: true, message: "Not authenticated." });
    }
    
    const authResult = await db.prepare(
      "SELECT s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1"
    ).bind(sessionToken).first();
    
    if (!authResult) {
      return jsonResp(401, { error: true, message: "Session invalid or expired." });
    }
    
    // Try client_messages first, fall back gracefully
    let messages = [];
    try {
      const result = await db.prepare(
        "SELECT id, user_email, message_text, created_at, message_type FROM client_messages WHERE user_email = ? ORDER BY created_at DESC LIMIT 50"
      ).bind(authResult.email).all();
      messages = (result.results || []).map(m => ({
        id: m.id, email: m.user_email, message: m.message_text, created_at: m.created_at
      }));
    } catch (e) {
      // Table doesn't exist yet — return empty
      console.warn('client_messages query failed:', e.message);
    }
    
    return jsonResp(200, { success: true, messages });
    
  } catch (err) {
    console.error('Messaging API error:', err);
    return jsonResp(500, { error: true, message: 'Server error.' });
  }
}

function getSessionToken(request) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
