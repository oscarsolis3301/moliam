/**
 * MOLIAM Client Dashboard API — CloudFlare Pages Function
 * GET  /api/dashboard?token=xxx&action=stats|messages|activity
 * POST /api/dashboard?token=xxx&action=message
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://moliam.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function authenticateToken(db, token) {
  if (!token) return null;
  return await db.prepare('SELECT * FROM client_profiles WHERE token = ?').bind(token).first();
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');

  const profile = await authenticateToken(db, token);
  if (!profile) {
    return jsonResp(401, { error: 'Invalid or missing token' });
  }

  switch (action) {
    case 'stats': {
      const leadsCount = await db.prepare(
        'SELECT COUNT(*) as count FROM client_activity WHERE client_id = ?'
      ).bind(profile.id).first();

      const messagesCount = await db.prepare(
        'SELECT COUNT(*) as count FROM client_messages WHERE client_id = ?'
      ).bind(profile.id).first();

      return jsonResp(200, {
        company: profile.company_name,
        contact: profile.contact_name,
        email: profile.email,
        plan: profile.plan,
        leads_count: leadsCount?.count || 0,
        messages_count: messagesCount?.count || 0,
        rating: 5.0,
        reviews: 24,
      });
    }

    case 'messages': {
      const messages = await db.prepare(
        'SELECT * FROM client_messages WHERE client_id = ? ORDER BY created_at DESC'
      ).bind(profile.id).all();
      return jsonResp(200, messages.results || []);
    }

    case 'activity': {
      const activity = await db.prepare(
        'SELECT * FROM client_activity WHERE client_id = ? ORDER BY created_at DESC LIMIT 20'
      ).bind(profile.id).all();
      return jsonResp(200, activity.results || []);
    }

    default:
      return jsonResp(400, { error: 'Invalid action. Use: stats, messages, activity' });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');

  const profile = await authenticateToken(db, token);
  if (!profile) {
    return jsonResp(401, { error: 'Invalid or missing token' });
  }

  if (action === 'message') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResp(400, { error: 'Invalid JSON body' });
    }

    const sender = (body.sender || profile.contact_name || 'Client').trim();
    const message = (body.message || '').trim();

    if (!message) {
      return jsonResp(400, { error: 'Message cannot be empty' });
    }

    await db.prepare(
      "INSERT INTO client_messages (client_id, sender, message, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(profile.id, sender, message).run();

    // Discord webhook notification (non-fatal)
    const webhookUrl = env.DISCORD_WEBHOOK_URL || '';
    if (webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Moliam Dashboard',
            embeds: [{
              title: '💬 New Client Message',
              color: 0x3B82F6,
              fields: [
                { name: 'Company', value: profile.company_name, inline: true },
                { name: 'From', value: sender, inline: true },
                { name: 'Message', value: message.slice(0, 1024) },
              ],
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch {
        // Discord failure is non-fatal
      }
    }

    return jsonResp(200, { success: true });
  }

  return jsonResp(400, { error: 'Invalid action. Use: message' });
}
