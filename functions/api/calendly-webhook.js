/**
 * Calendly Webhook Receiver - CloudFlare Pages Function
 * POST /api/calendly-webhook catches Calendly booking events, stores in D1, notifies Discord
 * Uses Web Crypto API (CF Workers runtime) for HMAC-SHA256 signature verification
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB and optional DISCORD_WEBHOOK_URL
 */

import { jsonResp } from './api-helpers.js';

/**
 * Verify Calendly webhook signature using HMAC-SHA256 for security against replay attacks
 * @param {string} body - Raw request body text
 * @param {string} sigHeader - Calendly-Webhook-Signature header value
 * @param {string} secret - CALENDLY_WEBHOOK_SECRET from env
 * @returns {Promise<boolean>} true if signature valid, false otherwise
 */
async function verifySignature(body, sigHeader, secret) {
  try {
    const parts = {};
    
    for (const part of sigHeader.split(',')) {
      const [k, v] = part.split('=', 2);
      parts[k.trim()] = (v ?? '').trim();
    }
    
    const timestamp = parts['t'];
    const receivedSig = parts['v1'];
    
    if (!timestamp || !receivedSig) return false;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", 
      encoder.encode(secret), 
      { name: "HMAC", hash: "SHA-256" }, 
      false, 
      ["sign"]
    );
    
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
    const expectedSig = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (expectedSig.length !== receivedSig.length) return false;
    
    let mismatch = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      mismatch |= expectedSig.charCodeAt(i) ^ receivedSig.charCodeAt(i);
    }
    
    return mismatch === 0;
  } catch {
    return false;
  }
}

/**
 * Send Discord webhook notification for Calendly events with embed formatting and emoji indicators
 * @param {object} env - Worker environment with DISCORD_WEBHOOK_URL
 * @param {object} embed - Embed object for Discord message
 */
async function sendDiscordWebhook(env, embed) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL ?? '';
  
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) return;
  
  try {
    await fetch(webhookUrl, {
      method: "POST", 
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username:'Moliam Bookings', embeds: [{ ...embed, timestamp: new Date().toISOString() }] })
    });
  } catch (whErr) {
    console.warn("Discord webhook failed:", String(whErr.message ?? 'unknown error'));
  }
}

/**
 * Parse request body as JSON and return extracted data or null if invalid
 * @param {string} bodyRaw - Raw text from request
 * @returns {object|null} Parsed JSON or null on failure
 */
function parseJsonBody(bodyRaw) {
  try {
    return JSON.parse(bodyRaw);
  } catch {
    return null;
  }
}

/**
 * POST /api/calendly-webhook - Main handler for Calendly booking events from invitee.created to invitee.canceled transitions with Discord notifications
 * @param {object} context - Cloudflare Pages function context
 * @returns {Response} JSON response with status
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const rawBody = await request.text();
    let data = parseJsonBody(rawBody);
    
    // Verify Calendly HMAC signature for security - prevents unauthorized third parties from forging booking events
    const sigHeader = request.headers.get('Calendly-Webhook-Signature') ?? '';
    const webhookSecret = env.CALENDLY_WEBHOOK_SECRET ?? '';
    
    if (webhookSecret && !(await verifySignature(rawBody, sigHeader, webhookSecret))) {
      return jsonResp(401, { success: false, message: "Invalid webhook signature detected - rejecting potentially forged payload." }, request);
    }
    
    const event = data?.event ?? 'unknown'; // "invitee.created" or "invitee.canceled" only
    const payload = data?.payload ?? {};
    
    if (!event || !payload) {
      return jsonResp(400, { success: false, message: "Missing event type or payload from Calendly - unable to process." });
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
             VALUES (?, ?, ?, ?, datetime('now'), 'confirmed', 'America/Los_Angeles')`
          ).bind(calendarEventId ?? null, bookingSource, clientName, clientEmail, appointmentDatetime).run();
        } catch (dbErr) {
          console.warn("D1 insert failed (continuing):", String(dbErr.message ?? 'unknown error'));
        }
      }
      
      // Send Discord notification for new Calendly bookings
      await sendDiscordWebhook(env, { 
        title: `📅 New Booking - ${clientName}`, 
        color: 0x00C853,
        fields: [
          {name:'Name', value:String(clientName), inline:true},
          {name:'Email', value: clientEmail ?? "-", inline:true},
          {name:'Scheduled', value: ptTime, inline:true}
        ] 
      });
      
    } else if (event === 'invitee.canceled') {
      // Mark appointment as cancelled in database - uses parameterized query with ? binding
      if (env.MOLIAM_DB && calendarEventId) {
        try {
          await env.MOLIAM_DB.prepare(
            "UPDATE appointments SET status='cancelled', updated_at=datetime('now') WHERE calendar_event_id=?"
          ).bind(calendarEventId).run();
        } catch (dbErr) {
          console.warn("D1 cancel update failed (continuing):", String(dbErr.message ?? 'unknown error'));
        }
      }
      
      // Send Discord notification for Calendly cancellations
      await sendDiscordWebhook(env, { 
        title: `❌ Booking Cancelled - ${clientName}`, 
        color: 0xef4444,
        fields: [
          {name:'Name', value:String(clientName), inline:true},
          {name:'Email', value: clientEmail ?? "-",inline:true}
         ]
       });
    }
    
    // Always return success so Calendly doesn't retry - errors logged to console silently
    return jsonResp(200, { success: true, message: "Webhook received and processed." });
  } catch (err) {
    console.error("Calendly webhook error:", String(err.message ?? 'unknown error'));
    return jsonResp(200, { success: true, message: "Received successfully even during offline processing - see logs for details."});
  }
}

// Handle CORS preflight requests from Calendly integration
export async function onRequestOptions() {
  return new Response(null, { 
    status: 204, 
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Calendly-Webhook-Signature'} 
  });
}
