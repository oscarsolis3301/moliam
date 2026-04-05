import { getSessionToken } from './auth/me.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Age': '86400'
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
    
    const authResult = await db.prepare(`
      SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.company, u.phone FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1
    `).bind(sessionToken).first();
    
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
    
    if (!webhookUrl) {
      return jsonResp(500, { error: true, message: "Webhook URL not configured." });
    }
    
    // Send Discord notification to admin only for client→admin messages
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '<@2518228305748954716> 💬 Client message in progress...',
        embeds: [{
          title: "💬 New Client Message",
          description: client_message,
          color: 0x8B5CF6,
          fields: [
            { name: "Client", value: user_name || "N/A", inline: true },
            { name: "ID", value: authResult.email.substring(0, 20) + '...', inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });
    
    // Log to client_messages table
    await db.prepare(`
      INSERT INTO client_messages (id, user_email, message_text, created_at, message_type) 
      VALUES (?, ?, ?, DATETIME("now"), "client_to_admin")
    `).bind(message_id, authResult.email, client_message).run();
    
    return jsonResp(201, { success: true, message_id });
    
  } catch (err) {
    console.error("Messaging API error:", err);
    return jsonResp(500, { error: true, message: "Server error." });
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
    
    const authResult = await db.prepare(`
      SELECT s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1
    `).bind(sessionToken).first();
    
    if (!authResult) {
      return jsonResp(401, { error: true, message: "Session invalid or expired." });
    }
    
    const messages = await db.prepare(`
      SELECT id, user_email, message_text, created_at, message_type 
      FROM client_messages 
      WHERE user_email = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `).bind(authResult.email).all();
    
    return jsonResp(200, { success: true, messages: messages.map(m => ({ id: m.id, email: m.user_email, message: m.message_text, created_at: m.created_at })) });
    
  } catch (err) {
    console.error("Messaging API error:", err);
    return jsonResp(500, { error: true, message: "Server error." });
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
