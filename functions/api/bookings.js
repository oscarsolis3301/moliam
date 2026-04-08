/**
 * Booking Management API — Calendar Integration
 * POST /api/appointments - Create booking
 * GET /api/appointments/:id - Get appointment
 * PUT /api/appointments/:id - Update/confirm/reschedule/cancel
 */

import { jsonResp, balanceSuccessError, sanitizeText } from './api-helpers.js';

/**
 * Handle GET requests to Booking API - list all appointments or get single by ID
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response: 200 OK (list/data), 400 Bad Request (invalid format), 500 Server Error (DB failure)
 */
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    if (!env.MOLIAM_DB) {
      return jsonResp(503, { error: true, success: false, message: 'Database service unavailable.' }, request);
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
             }, request);
      } catch (err) {
        console.error('List bookings error:', err);
        return jsonResp(500, { error: true, success: false, message: 'Failed to retrieve appointments.' }, request);
      }
    }

    // Get specific appointment by ID
    const path = context.request.url.split('/api/appointments/')[1];
    if (path) {
      try {
        const id = parseInt(path);
        if (isNaN(id)) {
          return jsonResp(400, { error: true, success: false, message: 'Invalid appointment ID format.' }, request);
              }
              
        const data = await db.prepare(
                   "SELECT * FROM appointments WHERE id = ?"
                 ).bind(id).first();

           if (!data) {
              return jsonResp(404, { error: true, success: false, message: 'Appointment not found.' }, request);
          }
          
        return jsonResp(200, { 
            success: true, 
            data: data,
             }, request);
        } catch (err) {
           console.error('Get appointment error:', err);
           return jsonResp(500, { error: true, success: false, message: 'Failed to retrieve appointment.' }, request);
       }
    }

return jsonResp(400, { error: true, success: false, message: 'Invalid request. Use /list or /id endpoint.' }, request);
} catch (err) {
       console.error('GET bookings error:', err);
       return jsonResp(500, { error: true, success: false, message: 'Database query failed.' }, request);
   }
}

/**
 * Handle CORS preflight requests for Booking API
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} 204 No Content with proper Access-Control headers for moliam.com and moliam.pages.dev domains
 */
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
        "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

/**
 * Handle POST requests to Booking API endpoints - create/confirm/cancel/reschedule bookings
 * POST /api/appointments?action=create - Create new appointment from prequalification
 * POST /api/appointments?action=confirm&appointment_id=X - Mark confirmed
 * POST /api/appointments?action=cancel&appointment_id=X - Cancel appointment (reschedule or deny)
 * POST /api/appointments?action=reschedule&appointment_id=X&reschedule_date=newDate - Reschedule to new time
 * POST /api/appointments?action=completed&appointment_id=X - Mark as completed  
 * POST /api/appointments?action=no_show&appointment_id=X - Record no-show, add retry queue
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response: 201 Created (new), 200 OK (updates), 400 Bad Request (validation errors), 500 Server Error (DB failure)
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
  
  let body;
  try {
    body = await context.request.json();
  } catch (err) {
    return jsonResp(400, { error: true, success: false, message: "Invalid JSON body." }, request);
  }

  const { action, appointment_id, reschedule_date } = body;

  switch (action) {
    case 'create':
      return createAppointment(context, body, request);

    case 'confirm':
      return updateAppointmentStatus(context, appointment_id, 'confirmed', request);

    case 'cancel':
      return updateAppointmentStatus(context, appointment_id, 'cancelled', request);

    case 'reschedule':
      if (!reschedule_date) {
        return jsonResp(400, { error: true, success: false, message: "Reschedule date required" }, request);
      }
     return rescheduleAppointment(context, appointment_id, reschedule_date, request);

    case 'completed':
      return updateAppointmentStatus(context, appointment_id, 'completed', request);

    case 'no_show':
      return handleNoShow(context, appointment_id, request);

    default:
      return jsonResp(400, { error: true, success: false, message: "Unknown action" }, request);
  }
}

/**
 * Handle PUT requests to Booking API - reschedule appointment date/time
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response: 200 OK (success), 400 Bad Request (missing ID, invalid JSON), 500 Server Error (DB failure)
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const path = context.request.url.split('/api/appointments/')[1];
  if (!path) return jsonResp(400, { error: true, success: false, message: "Appointment ID required" }, request);

      const appointmentId = parseInt(path);
  let updateBody;
  try {
    updateBody = await context.request.json();
   catch (err) {
     return jsonResp(400, { error: true, success: false, message: "Invalid JSON body." }, request);
      }
  }

  const { scheduled_at, client_timezone } = updateBody;

        if (!scheduled_at) {
           return jsonResp(400, { error: true, success: false, message: "Scheduled date required" }, request);
         }

      const res = await db.prepare(
             "UPDATE appointments SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ?"
           ).bind(scheduled_at, appointmentId).run();

  if (res.success && res.meta?.rows_changed > 0) {
    return jsonResp(200, { error: false, success: true, updated: true }, request);
     }

  console.error("Update failed:", res);
  return jsonResp(400, { error: true, success: false, message: "Update failed. Appointment not found." }, request);
}

// Helper functions
async function createAppointment(context, body, request) {
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
         return jsonResp(400, { error: true, success: false, message: "Pre-qual ID and scheduled date required." }, request);
       }

      // Input validation
    const clientName = (client_name || "").trim();
    if (clientName.length > 254) {
      return jsonResp(400, { error: true, success: false, message: "Client name cannot exceed 254 characters." }, request);
      }
    const clientEmail = (client_email || "")?.toLowerCase().trim();
    if (clientEmail && (clientEmail.length > 254 || !/^[^\\s]+@[^\\s]+\\.[^\\s]+$/.test(clientEmail))) {
       return jsonResp(400, { error: true, success: false, message: "Valid email required." }, request);
       }
    const calendarLink = (calendar_link || "").trim();
    if (calendarLink && calendarLink.length > 254) {
      return jsonResp(400, { error: true, success: false, message: "Calendar link cannot exceed 254 characters." }, request);
       }

    const res = await db.prepare(
        "INSERT INTO appointments (prequalification_id, client_name, client_email, scheduled_at, calendar_link) VALUES (?, ?, ?, ?, ?)"
  
).bind(prequalification_id || null, clientName || null, clientEmail || null, scheduled_at, calendarLink || null).run();

    if (!res.success) {
         return jsonResp(500, { error: true, success: false, message: "Booking failed." }, request);
       }

        // Log to audit
    await logAudit(res.meta.last_row_id, 'booked');

    return jsonResp(201, { error: true, success: true, appointment_id: res.meta.last_row_id }, request);
   catch (err) {
     console.error("createAppointment error:", err);
     return jsonResp(500, { error: true, success: false, message: "Database query failed." }, request);
    }
}

async function updateAppointmentStatus(context, id, status, request) {
  const db = context.env.MOLIAM_DB;

  try {
    const res = await db.prepare(
          "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(status, id).run();

    if (res.success && res.meta.rows_changed > 0) {
      await logAudit(id, status);

          // If no-show, handle retry logic
      if (status === 'no_show') {
        await handleNoShow(context, id, request);
         }
      else if (status === 'completed') {
         await logAudit(id, 'completed');
           }
    }

    return jsonResp(200, { error: true, success: true, updated: status }, request);
   } catch (err) {
    console.error("updateAppointmentStatus error:", err.message);
     return jsonResp(500, { error: true, success: false, message: "Update failed." }, request);
   }
}

/**
 * Log audit actions for bookings to console - STALE - no real implementation exists
 * @param {number} appointmentId - Appointment ID to log
 * @param {string} action - Audit action description ('booked', 'rescheduled', etc.)
 * @deprecated Not implemented - placeholder function awaiting future D1 integration
 */
async function logAudit(appointmentId, action) {
  console.log(`[audit] appointment=${appointmentId} action=${action}`);
}

/**
 * Send reschedule confirmation email via MailChannels
 * @param {object} appointment - Appointment object with client_email and scheduled_with fields
 * @returns {Promise<null>} Null on success (errors logged to console only)
 */
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

/**
 * Send auto-retry notification email for no-show appointments
 * @param {object} appointment - Appointment object with client info
 */
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
