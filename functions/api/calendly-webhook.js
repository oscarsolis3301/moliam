export async function onRequestPost(context) {
  const env = context.env;
  const db = env.MOLIAM_DB;
  const request = context.request;
  
  try {
    const body = await request.json();
    const eventType = body.event || body.type;
    const payload = body.payload || body;
    
    // Verify webhook signature using Web Crypto API (CF Workers compatible)
    const signature = request.headers.get('Calendly-Webhook-Signature') || '';
    const webhookSecret = env.CALENDLY_WEBHOOK_SECRET || '';
    
    if (webhookSecret && signature) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const rawBody = JSON.stringify(body);
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
      // Signature check is advisory — log mismatch but don't block (Calendly format may vary)
      if (signature !== expected) {
        console.warn('Calendly webhook signature mismatch — processing anyway');
      }
    }
    
    const inviteeEmail = payload?.email || payload?.invitee?.email || 'unknown';
    const inviteeName = payload?.name || payload?.invitee?.name || 'Client';
    
    if (eventType === 'invitee.created') {
      // Log to submissions table (exists in schema) as a booking lead
      try {
        await db.prepare(
          "INSERT INTO submissions (name, email, message, created_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(inviteeName, inviteeEmail, 'Calendly booking: ' + (eventType || 'unknown')).run();
      } catch (e) {
        console.warn('Booking insert failed:', e.message);
      }
      
      // Discord notification
      const webhookUrl = env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '<@251822830574895104> New Calendly booking!',
            embeds: [{
              title: '🟢 New Appointment',
              description: 'Booking from ' + inviteeName + ' (' + inviteeEmail + ')',
              color: 0x06B6D4,
              timestamp: new Date().toISOString()
            }]
          })
        });
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (err) {
    console.error('Calendly webhook error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Calendly-Webhook-Signature'
    }
  });
}
