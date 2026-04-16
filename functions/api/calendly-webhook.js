/**
 * Calendly Webhook Receiver - CloudFlare Pages Function
 * POST /api/calendly-webhook catches Calendly booking events, stores in D1, notifies Discord
 * Uses Web Crypto API (CF Workers runtime) for HMAC-SHA256 signature verification
 */

import { jsonResp, verifySignature } from './lib/standalone.js';

/**
 * Verify Calendly webhook signature using HMAC-SHA256 for security against replay attacks
 * @param {string} body - Raw request body text
 * @param {string} sigHeader - Calendly-Webhook-Signature header value
 * @param {string} secret - CALENDLY_WEBHOOK_SECRET from env
 */

/**
 * POST /api/calendly-webhook - Main handler for Calendly booking events 
 * from invitee.created to invitee.canceled transitions with Discord notifications
 * @param {object} context - Cloudflare Pages function context
 * @returns {Response} JSON response with status
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const rawBody = await request.text();
    
       // Verify Calendly HMAC signature for security - prevents unauthorized third parties from forging booking events
    const sigHeader = request.headers.get('Calendly-Webhook-Signature') ?? '';
    const webhookSecret = env.CALENDLY_WEBHOOK_SECRET ?? '';
    
    if (webhookSecret && !(await verifySignature(rawBody, sigHeader, webhookSecret))) {
      return jsonResp(401, { success: false, message: "Invalid webhook signature detected - rejecting potentially forged payload.", error: true }, request);
       }
    
     // Parse JSON body from request and extract event data
    let data;
    try {
      data = JSON.parse(rawBody);
     } catch (err) {
      return jsonResp(400, { success: false, message: "Missing event type or payload from Calendly - unable to process.", error: true });
       }
    
    const event = data?.event ?? 'unknown'; // "invitee.created" or "invitee.canceled" only
    const payload = data?.payload ?? {};
    
    if (!event || !payload) {
      return jsonResp(400, { success: false, message: "Missing event type or payload from Calendly - unable to process.", error: true });
       }
    
    const scheduledEvent = payload.scheduled_event ?? {};
    const clientName = payload.name ?? scheduledEvent.name ?? 'Unknown';
    const clientEmail = payload.email ?? '';
    const appointmentDatetime = scheduledEvent.start_time ?? new Date().toISOString();
    const calendarEventId = scheduledEvent.uri ?? null;
    const bookingSource = "web";
    
     // Format timezone-adjusted datetime for display (America/Los_Angeles as default)
    const ptTime = new Date(appointmentDatetime).toLocaleString('en-US', { 
      timeZone: 'America/Los_Angeles', 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
       });
    
    if (event === 'invitee.created') {
         // Insert appointment record with auto-generated timestamp - uses ? binding for SQL injection prevention
      if (env.MOLIAM_DB) {
        try {
          await env.MOLIAM_DB.prepare(
               `INSERT INTO appointments (calendar_event_id, booking_source, client_name, client_email, appointment_datetime, status, client_timezone) 
              VALUES (?, ?, ?, ?, datetime('now'), 'confirmed', 'America/Los_Angeles')`)
             .bind(calendarEventId ?? null, bookingSource, clientName, clientEmail, appointmentDatetime).run();
         } catch (dbErr) {
          console.warn("D1 insert failed (continuing):", String(dbErr.message ?? 'unknown error'));
         }
       }
        
        // Send Discord notification for new Calendly bookings
      const webhookUrl = env.DISCORD_WEBHOOK_URL ?? '';
      if (webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
          try {
           await fetch(webhookUrl, {
             method: "POST", 
             headers: {'Content-Type':'application/json'},
             body: JSON.stringify({ username:'Moliam Bookings', embeds: [{ 
               title: `📅 New Booking - ${clientName}`, 
               color: 0x00C853,
               fields: [
                   {name:'Name', value:String(clientName), inline:true},
                   {name:'Email', value: clientEmail ?? "-",inline:true},
                   {name:'Scheduled', value: ptTime, inline:true}
                 ]
               }])}
             );
           } catch (warnErr) {
           console.warn("Discord webhook failed:", String(warnErr.message));
          }
       }
        
      } else if (event === 'invitee.canceled') {
        // Mark appointment as cancelled in database - uses parameterized query with ? binding
      if (env.MOLIAM_DB && calendarEventId) {
        try {
          await env.MOLIAM_DB.prepare(
               "UPDATE appointments SET status='cancelled', updated_at=datetime('now') WHERE calendar_event_id=?")
             .bind(calendarEventId).run();
         } catch (dbErr) {
          console.warn("D1 cancel update failed (continuing):", String(dbErr.message ?? 'unknown error'));
         }
       }
        
        // Send Discord notification for Calendly cancellations
      const webhookUrl = env.DISCORD_WEBHOOK_URL ?? '';
      if (webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
          try {
           await fetch(webhookUrl, {
             method: "POST", 
             headers: {'Content-Type':'application/json'},
             body: JSON.stringify({ username:'Moliam Bookings', embeds: [{ 
               title: `❌ Booking Cancelled - ${clientName}`, 
               color: 0xef4444,
               fields: [
                   {name:'Name', value:String(clientName), inline:true},
                   {name:'Email', value: clientEmail ?? "-",inline:true}
                 ]
               }])}
             );
           } catch (warnErr) {
           console.warn("Discord webhook failed:", String(warnErr.message));
          }
       }
     }
    
     // Always return success so Calendly doesn't retry - errors logged to console silently
    return jsonResp(200, { success: true, message: "Webhook received and processed." }, request);
    } catch (err) {
    console.error("Calendly webhook error:", String(err.message ?? 'unknown error'));
    return jsonResp(200, { success: true, message: "Received successfully even during offline processing - see logs for details.", error: false}, request);
   }
}

// Handle CORS preflight requests from Calendly integration    
export async function onRequestOptions() {
  return new Response(null, { 
    status: 204, 
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Calendly-Webhook-Signature'} 
   });
}
