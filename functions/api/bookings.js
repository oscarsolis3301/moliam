/**
 * Booking Management API — Calendar Integration
 * POST /api/appointments - Create booking
 * GET /api/appointments/:id - Get appointment
 * PUT /api/appointments/:id - Update/confirm/reschedule/cancel
 */

import { jsonResp, balanceSuccessError } from '../lib/api-helpers.js';

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    if (!env.MOLIAM_DB) {
      return jsonResp(503, { error: true, success: false, message: 'Database service unavailable.' });
    }
    
    const db = env.MOLIAM_DB;        
    // List all appointments for dashboard
        if (context.request.url.includes('/list')) {
        try {
          const data = await db.prepare(`
              SELECT a.*, p.qualification_score, p.budget_range, 
                     s.name AS lead_name, s.email AS lead_email
              FROM appointments a
              LEFT JOIN prequalifications p ON a.prequalification_id = p.id
               LEFT JOIN submissions s ON p.submission_id = s.id
              ORDER BY a.scheduled_at DESC
              LIMIT 50
                   ).all();

          return jsonResp(200, { 
            success: true, 
            data: data 
              });
        } catch (err) {
          console.error('List bookings error:', err);
          return jsonResp(500, { error: true, success: false, message: 'Failed to retrieve appointments.' });
        }
    }

         // Get specific appointment by ID
        const path = context.request.url.split('/api/appointments/')[1];
        if (path) {
          try {
            const id = parseInt(path);
            if (isNaN(id)) {
              return jsonResp(400, { error: true, success: false, message: 'Invalid appointment ID format.' });
                 }
                  
            const data = await db.prepare(
                  "SELECT * FROM appointments WHERE id = ?"
                ).bind(id).first();

            if (!data) {
              return jsonResp(404, { error: true, success: false, message: 'Appointment not found.' });
                 }
          
            return jsonResp(200, { 
              success: true, 
              data: data 
                });
          } catch (err) {
            console.error('Get appointment error:', err);
            return jsonResp(500, { error: true, success: false, message: 'Failed to retrieve appointment.' });
          }
        }

      return jsonResp(400, { error: true, success: false, message: 'Invalid request. Use /list or /id endpoint.' });
   } catch (err) {
         console.error('GET bookings error:', err);
         return jsonResp(500, { error: true, success: false, message: 'Database query failed.' });
   }
}
     }

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
  
  let body;
  try {
    body = await context.request.json();
   catch (err) {
     return new Response(JSON.stringify({ success: false, error: true, message: "Invalid JSON body." }), { 
         status: 400, 
         headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
       });
   }

  const { action, appointment_id, reschedule_date } = body;

  switch (action) {
    case 'create':
      return createAppointment(context, body);

    case 'confirm':
      return updateAppointmentStatus(context, appointment_id, 'confirmed');

    case 'cancel':
      return updateAppointmentStatus(context, appointment_id, 'cancelled');

    case 'reschedule':
      if (!reschedule_date) {
        return new Response(JSON.stringify({ success: false, error: true, message: "Reschedule date required" }), { 
            status: 400, 
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
          });
     }
     return rescheduleAppointment(context, appointment_id, reschedule_date);

    case 'completed':
      return updateAppointmentStatus(context, appointment_id, 'completed');

    case 'no_show':
      return handleNoShow(context, appointment_id);

    default:
      return new Response(JSON.stringify({ success: false, error: true, message: "Unknown action" }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
        });
     }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const path = context.request.url.split('/api/appointments/')[1];
  if (!path) return new Response(JSON.stringify({ error: true, message: "Appointment ID required" }), { status: 400 });

  const appointmentId = parseInt(path);
  let body;
  try {
    body = await context.request.json();
   catch (err) {
     return new Response(JSON.stringify({ success: false, error: true, message: "Invalid JSON body." }), { 
         status: 400, 
         headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
        });
   }

  const { scheduled_at, client_timezone } = body;

  const res = await db.prepare(
      "UPDATE appointments SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(scheduled_at, appointmentId).run();

  if (!res.success) {
    console.error("Update failed:", res);
    return new Response(JSON.stringify({ success: false, error: true, message: "Update database failed." }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
       });
  }

  if (res.success) {
    return new Response(JSON.stringify({ success: true, updated: true }), { status: 200 });
   }

  return new Response(JSON.stringify({ success: false, error: true, message: "Update failed." }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
     });
}

// Helper functions
async function createAppointment(context, body) {
  try {
    const db = context.env.MOLIAM_DB;

    const { 
      prequalification_id,
      client_name, 
      client_email,
      scheduled_at,
      duration_minutes = 30,
      calendar_link 
      } = body;

    if (!prequalification_id || !scheduled_at) {
         return new Response(JSON.stringify({ success: false, error: true, message: "Pre-qual ID and scheduled date required." }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
      }

     // Input validation
    const clientName = (client_name || "").trim();
    if (clientName.length > 254) {
      return new Response(JSON.stringify({ success: false, error: true, message: "Client name cannot exceed 254 characters." }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
     }
    const clientEmail = (client_email || "")?.toLowerCase().trim();
    if (clientEmail && (clientEmail.length > 254 || !/^[^\s]+@[^\s]+\.[^\s]+$/.test(clientEmail))) {
       return new Response(JSON.stringify({ success: false, error: true, message: "Valid email required." }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
      }
    const calendarLink = (calendar_link || "").trim();
    if (calendarLink && calendarLink.length > 254) {
      return new Response(JSON.stringify({ success: false, error: true, message: "Calendar link cannot exceed 254 characters." }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
      }

    const res = await db.prepare(
       "INSERT INTO appointments (prequalification_id, client_name, client_email, scheduled_at, calendar_link) VALUES (?, ?, ?, ?, ?)"
     
).bind(prequalification_id || null, clientName || null, clientEmail || null, scheduled_at, calendarLink || null).run();

    if (!res.success) {
         return new Response(JSON.stringify({ success: false, error: true, message: "Booking failed." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
      }

       // Log to audit
    await logAudit(res.meta.last_row_id, 'booked');

    return new Response(JSON.stringify({ success: true, appointment_id: res.meta.last_row_id }), { status: 201 });
   catch (err) {
     console.error("createAppointment error:", err);
     return new Response(JSON.stringify({ success: false, error: true, message: "Database query failed." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
   }
}

async function updateAppointmentStatus(context, id, status) {
  try {
    const db = context.env.MOLIAM_DB;

    const res = await db.prepare(
        "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(status, id).run();

    if (res.success && res.meta.rows_changed > 0) {
      await logAudit(id, status);

        // If no-show, handle retry logic
      if (status === 'no_show') {
        await handleNoShow(context, id);
       }
       else if (status === 'completed') {
         await logAudit(id, 'completed');
         }
      }

    return new Response(JSON.stringify({ success: true, updated: status }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
       });
   catch (err) {
     console.error("updateAppointmentStatus error:", err);
     return new Response(JSON.stringify({ success: false, error: true, message: "Update failed." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    }
}

async function rescheduleAppointment(context, id, newDate) {
  try {
    const db = context.env.MOLIAM_DB;

    const res = await db.prepare(
         "UPDATE appointments SET scheduled_at = ?, status = 'rescheduled', updated_at = datetime('now'), reschedule_attempts = reschedule_attempts + 1 WHERE id = ?"
       ).bind(newDate, id).run();

    if (!res.success) {
      console.error("Rescheduling failed:", res);
      return new Response(JSON.stringify({ success: false, error: true, message: "Database update failed." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
     }

    await logAudit(id, 'rescheduled');

      // Send reschedule confirmation email
    const appointment = await db.prepare("SELECT * FROM appointments WHERE id = ?").bind(id).first();
    if (appointment && appointment.client_email) {
      await sendRescheduleEmail(appointment);
       }

    return new Response(JSON.stringify({ success: true, updated_date: newDate }), { status: 200 });
   catch (err) {
     console.error("rescheduleAppointment error:", err);
     return new Response(JSON.stringify({ success: false, error: true, message: "Rescheduling failed." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    }
}

async function handleNoShow(context, id) {
  try {
    const db = context.env.MOLIAM_DB;

       // Increment no-show count and check against max retries
    const appointment = await db.prepare("SELECT * FROM appointments WHERE id = ?").bind(id).first();
    
    if (!appointment) return new Response(JSON.stringify({ success: false, error: true, message: "Appointment not found." }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });

    const rescheduleAttempts = (appointment.reschedule_attempts || 0);
    
        if (rescheduleAttempts >= 2) {
            // Auto-denial after max attempts
        try {
          const updateRes = await db.prepare(
              "UPDATE prequalifications SET calendar_access_granted = 0, update_time = datetime('now') WHERE id = ?"
            ).bind(appointment.prequalification_id).run();

          if (!updateRes.success) {
            console.error("Auto-denial DB update failed:", updateRes);
           }
         } catch (dbErr) {
          console.error("Auto-denial exception:", dbErr);
          }

        await logAudit(id, 'auto_denied');
           return new Response(JSON.stringify({ success: true, message: "Lead auto-denied after multiple no-shows." }), { status: 200 });
        }

       // Auto-reschedule into retry queue
    const now = new Date();
    const nextRetry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // Retry in 3 days

    await db.prepare(
        "INSERT INTO reschedule_queue (appointment_id, retry_count, next_retry_at, max_retries, status) VALUES (?, 1, ?, 2, 'active')"
      ).bind(id, nextRetry.toISOString()).run();

         // Send rescheduling email
    if (appointment.client_email) {
      await sendAutoRetryNotice(appointment);
        }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Lead added to reschedule queue.",
      retry_count: rescheduleAttempts + 1
     }), { status: 200 });
   catch (err) {
     console.error("handleNoShow error:", err);
     return new Response(JSON.stringify({ success: false, error: true, message: "Query failed." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
   }
}

async function logAudit(appointmentId, action) {
  // NOTE: This function cannot access D1 without context being passed in.
  // Callers should pass context as first arg. For now, this is a no-op
  // to prevent runtime crashes. TODO: refactor to accept context param.
  console.log(`[audit] appointment=${appointmentId} action=${action}`);
}

async function sendRescheduleEmail(appointment) {
  try {
    const subject = "Your appointment has been rescheduled";

    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: appointment.client_email, name: appointment.scheduled_with }] }],
        from: { email: "hello@moliam.com" },
        subject,
        content: [{ type: "text/html", value: `<h3>Your demo call has been rescheduled to a new time.</h3>` }]
      })
     });
   } catch (e) {
    console.error("Reschedule email error:", e);
  }
}

async function sendAutoRetryNotice(appointment) {
  try {
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: appointment.client_email }] }],
        from: { email: "hello@moliam.com" },
        subject: "Let's Reschedule Your Demo",
        content: [{ 
          type: "text/html", 
          value: "<p>We missed you, no worries! Reply to schedule new time or use your calendar link.</p>"
         }]
       })
     });
   } catch (e) {
    console.error("Retry email error:", e);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    } 
  });
}

// Wrapper for Responses without json() helper to add security headers consistently
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    } 
  });
}
