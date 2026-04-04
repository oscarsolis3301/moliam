import { D1_CLIENT } from '../constants.js';

export default {
  async onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const token = url.searchParams.get('token');

    // Auth check
    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 401 });
    }

    // Lookup client by token
    const profileResult = await env.CLIENT_DB.prepare(
      'SELECT * FROM client_profiles WHERE token = ?'
    ).bind(token).first();

    if (!profileResult) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Handle different actions
    switch (action) {
      case 'stats': {
        const leadsCount = await env.CLIENT_DB.prepare(
          `SELECT COUNT(*) as count FROM client_activity WHERE client_id = ?`
        ).bind(profileResult.id).first();
        
        const messagesCount = await env.CLIENT_DB.prepare(
          `SELECT COUNT(*) as count FROM client_messages WHERE client_id = ?`
        ).bind(profileResult.id).first();

        const stats = {
          company: profileResult.company_name,
          plan: profileResult.plan,
          leads_count: leadsCount?.count || 0,
          messages_count: messagesCount?.count || 0,
          rating: 5.0,
          reviews: 24
        };

        return Response.json(stats);
      }

      case 'messages': {
        const messages = await env.CLIENT_DB.prepare(
          `SELECT * FROM client_messages WHERE client_id = ? ORDER BY created_at DESC`
        ).bind(profileResult.id).all();
        return Response.json(messages.results);
      }

      case 'activity': {
        const activity = await env.CLIENT_DB.prepare(
          `SELECT * FROM client_activity WHERE client_id = ? ORDER BY created_at DESC LIMIT 20`
        ).bind(profileResult.id).all();
        return Response.json(activity.results);
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  },

  async onRequestPost({ request, env }) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Auth check
    const token = url.searchParams.get('token');
    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 401 });
    }

    const profileResult = await env.CLIENT_DB.prepare(
      'SELECT * FROM client_profiles WHERE token = ?'
    ).bind(token).first();

    if (!profileResult) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (action === 'message') {
      const body = await request.json();
      const sender = body.sender || 'Unknown';
      const message = body.message || '';

      // Save message to D1
      await env.CLIENT_DB.prepare(`
        INSERT INTO client_messages (client_id, sender, message)
        VALUES (?, ?, ?)
      `).bind(profileResult.id, sender, message).run();

      // Send Discord webhook notification
      try {
        if (env.DISCORD_WEBHOOK_URL) {
          await fetch(env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `New message from ${sender} (${profileResult.company_name}): ${message}`
            })
          });
        }
      } catch (e) {
        // Silently fail webhook
      }

      return Response.json({ success: true, message_id: profileResult.id });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
};
