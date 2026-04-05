import Hmac from 'crypto';

export async function onRequestPost(context) {
  const env = context.env;
  const { client_data } = await context.request.json();
  
  const signature = context.request.headers.get('x-c-stripe-signature');
  const webhookSecret = env.stripe_webhook_secret || '';
  
  const expectedSignature = Hmac.createHmac(
    'sha256', 
    webhookSecret
  ).update(JSON.stringify(client_data)).digest('hex');
  
  if (signature !== expectedSignature) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  const appointmentId = client_data?.id || crypto.randomUUID();
  const type = client_data.type; // 'invitee.created' or 'invitee.canceled'
  const scheduledWith = 'Roman'; // Always hardcode Roman per board
  
  try {
    if (type === 'invitee.created') {
      await env.db.exec(
        'INSERT INTO appointments (id, client_id, appointment_datetime, scheduled_with)' +
        'VALUES (?, ?, DATETIME("now"), ?)',
        [appointmentId, client_data.client_id, scheduledWith]
      );
      
      const embed = [{
        title: "🟢 New Appointment",
        description: `Booking from ${client_data.name || 'Client'}`,
        fields: [
          { name: 'Type', value: type },
          { name: 'ID', value: appointmentId }
        ],
        timestamp: new Date().toISOString()
      }];
      
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `<@1490158275918954716> New Calendly booking`, embeds: embed })
      });
      
    } else if (type === 'invitee.canceled') {
      await env.db.exec(
        'UPDATE appointments SET booked = 0 WHERE id = ?',
        [appointmentId]
      );
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
