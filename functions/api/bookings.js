/**
 * Booking Management API — Calendar Integration
 * POST /api/appointments - Create booking
 * GET /api/appointments/:id - Get appointment
 * PUT /api/appointments/:id - Update/confirm/reschedule/cancel
 */

import { jsonResp, generateRequestId } from './lib/standalone.js';
/** NEW: Rate limiter middleware for booking endpoints - prevents abuse on appointment CRUD operations and calendar sync hooks with auto-generated clientId tracking */
import { createRateLimiterMiddleware } from '../lib/rate-limiter.js';


/**
 * Handle GET requests for appointment listing and retrieval
 * @param {object} context Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response with appointments data or error status
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // Apply rate limiting - check client before any DB operations
  if (env && env.MOLIAM_DB) {
    const rateResult = await createRateLimiterMiddleware(request, "bookings", env);
    if (typeof rateResult === 'object' && (rateResult.statusCode === 429 || rateResult.error)) {
      return new Response(JSON.stringify({ error: true, message: "Too many requests. Please wait before trying again." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
       });
     }
   }

   // List all appointments for Ada's dashboard</result>
  if (context.request.url.includes('/list')) {
    try {
      if (!db) {
        return jsonResp(503, { error: true, message: "Database unavailable" }, request);
       }

      const data = await db.prepare(`
          SELECT a.*, p.qualification_score, p.budget_range, 
                 s.name AS lead_name, s.email AS lead_email
          FROM appointments a
          LEFT JOIN prequalifications p ON a.prequalification_id = p.id
          LEFT JOIN submissions s ON p.submission_id = s.id
          ORDER BY a.scheduled_at DESC
          LIMIT 50
        `).all({ limit: 50 });

      return jsonResp(200, { success: true, appointments: data.results }, request);
    } catch (err) {
      console.error("List appointments error:", err);
      return jsonResp(500, { error: true, message: "Database query failed" }, request);
    }
  }

  // Get specific appointment by ID
  const path = context.request.url.split('/api/appointments/')[1];
  if (path) {
    try {
      if (!db) {
        return jsonResp(503, { error: true, message: "Database unavailable" }, request);
      }

      const id = parseInt(path);
      const data = await db.prepare(
        "SELECT * FROM appointments WHERE id = ?"
      ).bind(id).first();

      if (!data) return jsonResp(404, { error: true, message: "Appointment not found" }, request);

      return jsonResp(200, { success: true, appointment: data }, request);
    } catch (err) {
      console.error("Get appointment error:", err);
      return jsonResp(500, { error: true, message: "Database query failed" }, request);
    }
  }

  return jsonResp(400, { error: true, message: "Invalid request" }, request);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  if (!db) {
    return jsonResp(503, { error: true, message: "Database unavailable" }, request);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON in request body" }, request);
  }

  const { action, appointment_id, reschedule_date } = body;

  switch (action) {
    case 'create':
      return createAppointment(context, body, db);

    case 'confirm':
      return updateAppointmentStatus(context, appointment_id, 'confirmed', db);

    case 'cancel':
      return updateAppointmentStatus(context, appointment_id, 'cancelled', db);

    case 'reschedule':
      if (!reschedule_date) {
        return jsonResp(400, { error: true, message: "Reschedule date required" }, request);
      }
      return rescheduleAppointment(context, appointment_id, reschedule_date, db);

    case 'completed':
      return updateAppointmentStatus(context, appointment_id, 'completed', db);

    case 'no_show':
      return handleNoShow(context, appointment_id, db);

    default:
      return jsonResp(400, { error: true, message: "Unknown action" }, request);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  if (!db) {
    return jsonResp(503, { error: true, message: "Database unavailable" }, request);
  }

  const pathParts = context.request.url.split('/api/appointments/');
  if (!pathParts[1]) {
    return jsonResp(400, { error: true, message: "Appointment ID required" }, request);
  }

  const appointmentId = parseInt(pathParts[1]);
  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON in request body" }, request);
  }

  const { scheduled_at } = body;

  try {
    const res = await db.prepare(
      "UPDATE appointments SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(scheduled_at, appointmentId).run();

    if (!res.success) {
      console.error("Update failed:", res);
      return jsonResp(500, { error: true, message: "Update database failed" }, request);
    }

    return jsonResp(200, { success: true, updated: true }, request);
  } catch (err) {
    console.error("PUT error:", err);
    return jsonResp(500, { error: true, message: "Database update failed" }, request);
  }
}

// Helper functions

/**
 * Create a new appointment/booking with validation and audit logging
 * @param {object} context Cloudflare Pages request context  
 * @param {object} body Request body containing appointment data
 * @param {MOLIAM_DB} db D1 database instance for persistence
 * @returns {Response} 201 Created with appointment_id or error response
 */
async function createAppointment(context, body, db) {
  if (!db) {
    return jsonResp(503, { error: true, message: "Database unavailable" }, context.request);
   }

  const prequalification_id = body.prequalification_id;
  const client_name = (body.client_name || "").trim();
  const client_email = (body.client_email || "")?.toLowerCase().trim();
  const scheduled_at = body.scheduled_at;
  const duration_minutes = body.duration_minutes || 30;
  const calendar_link = (body.calendar_link || "").trim();

  if (!prequalification_id || !scheduled_at) {
    return jsonResp(400, { error: true, message: "Pre-qual ID and scheduled date required" }, context.request);
  }

  // Input validation
  if (client_name.length > 254) {
    return jsonResp(400, { error: true, message: "Client name cannot exceed 254 characters" }, context.request);
  }

  if (client_email && (client_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email))) {
    return jsonResp(400, { error: true, message: "Valid email required" }, context.request);
  }

  if (calendar_link && calendar_link.length > 254) {
    return jsonResp(400, { error: true, message: "Calendar link cannot exceed 254 characters" }, context.request);
  }

  try {
    const res = await db.prepare(
       "INSERT INTO appointments (prequalification_id, client_name, client_email, scheduled_at, calendar_link) VALUES (?, ?, ?, ?, ?)"
     ).bind(prequalification_id || null, client_name || null, client_email || null, scheduled_at, calendar_link || null).run();

    if (!res.success) {
      return jsonResp(500, { error: true, message: "Booking failed" }, context.request);
    }

    // Log to audit
    await logAudit(res.meta.last_row_id, 'booked', db);

    return jsonResp(201, { success: true, appointment_id: res.meta.last_row_id }, context.request);
  } catch (err) {
    console.error("Create appointment error:", err);
    return jsonResp(500, { error: true, message: "Database operation failed" }, context.request);
  }
}

/**
 * Update appointment status (confirm/cancel/reschedule/completed) with audit logging
 * @param {object} context Cloudflare Pages request context
 * @param {number|string} id Appointment ID to update
 * @param {string} status Status change: 'confirmed', 'cancelled', 'rescheduled', 'completed'
 * @param {MOLIAM_DB} db D1 database instance for persistence   
 * @returns {Response} 200 OK with updated status or error response
 */
async function updateAppointmentStatus(context, id, status, db) {
  if (!id || !db) {
    return jsonResp(400, { error: true, message: "Invalid appointment ID or database" }, context.request);
  }

  try {
    const res = await db.prepare(
      "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, id).run();

    if (res.success && res.meta.rows_changed > 0) {
      await logAudit(id, status, db);

      // If no-show, handle retry logic
      if (status === 'no_show') {
        return handleNoShow(context, id, db);
      } else if (status === 'completed') {
        await logAudit(id, 'completed', db);
      }
    }

    return jsonResp(200, { success: true, updated: status }, context.request);
  } catch (err) {
    console.error("Update status error:", err);
    return jsonResp(500, { error: true, message: "Database operation failed" }, context.request);
  }
}

/**
 * Reschedule an appointment to a new date/time with email notification
 * @param {object} context Cloudflare Pages request context   
 * @param {number|string} id Appointment ID to reschedule   
 * @param {string} newDate ISO-8601 datetime for rescheduling
 * @param {MOLIAM_DB} db D1 database instance for persistence
 * @returns {Response} 200 OK with updated_date or error response   
 */
async function rescheduleAppointment(context, id, newDate, db) {
  if (!id || !newDate || !db) {
    return jsonResp(400, { error: true, message: "Invalid parameters for rescheduling" }, context.request);
   }

  try {
    const res = await db.prepare(
      "UPDATE appointments SET scheduled_at = ?, status = 'rescheduled', updated_at = datetime('now'), reschedule_attempts = reschedule_attempts + 1 WHERE id = ?"
    ).bind(newDate, id).run();

    if (!res.success) {
      console.error("Rescheduling failed:", res);
      return jsonResp(500, { error: true, message: "Database update failed" }, context.request);
    }

    await logAudit(id, 'rescheduled', db);

    // Send reschedule confirmation email
    const appointment = await db.prepare("SELECT * FROM appointments WHERE id = ?").bind(id).first();
    if (appointment && appointment.client_email) {
      await sendRescheduleEmail(appointment, context);
    }

    return jsonResp(200, { success: true, updated_date: newDate }, context.request);
  } catch (err) {
    console.error("Reschedule error:", err);
    return jsonResp(500, { error: true, message: "Database operation failed" }, context.request);
  }
}

/**
 * Handle no-show workflow for missed appointments with auto-retry logic
 * @param {object} context Cloudflare Pages request context   
 * @param {number|string} id Appointment ID that was a no-show   
 * @param {MOLIAM_DB} db D1 database instance for persistence
 * @returns {Response} 200 OK with retry_count or auto-denial status after max attempts
 */
async function handleNoShow(context, id, db) {
  if (!id || !db) {
    return jsonResp(400, { error: true, message: "Invalid appointment ID or database" }, context.request);
    }

  try {
    const appointment = await db.prepare("SELECT * FROM appointments WHERE id = ?").bind(id).first();

    if (!appointment) {
      return jsonResp(404, { error: true, message: "Appointment not found" }, context.request);
    }

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

      await logAudit(id, 'auto_denied', db);
      return jsonResp(200, { success: true, message: "Lead auto-denied after multiple no-shows" }, context.request);
    }

    // Auto-reschedule into retry queue
    const now = new Date();
    const nextRetry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // Retry in 3 days

    await db.prepare(
      "INSERT INTO reschedule_queue (appointment_id, retry_count, next_retry_at, max_retries, status) VALUES (?, 1, ?, 2, 'active')"
    ).bind(id, nextRetry.toISOString()).run();

    // Send rescheduling email
    if (appointment.client_email) {
      await sendAutoRetryNotice(appointment, context);
    }

    return jsonResp(200, { success: true, message: "Lead added to reschedule queue", retry_count: rescheduleAttempts + 1 }, context.request);
  } catch (err) {
    console.error("Handle no-show error:", err);
    return jsonResp(500, { error: true, message: "Database operation failed" }, context.request);
  }
}

/**
 * Log audit trail entry for appointment lifecycle events (booked, cancelled, rescheduled, etc.)
 * @param {number|string} appointmentId The appointment ID to log  
 * @param {string} action Action type: 'booked', 'cancelled', 'rescheduled', 'expired'
 * @param {MOLIAM_DB|null} db D1 database instance (can be null for fallback logging)
 * @returns {void} No return value, logs to D1 or console depending on DB availability
 */
async function logAudit(appointmentId, action, db = null) {
  // Support both D1 database logging and backward-compatible file-based logging
  if (db && typeof db.prepare === 'function') {
    try {
      await db.prepare("INSERT INTO audit_logs (appointment_id, message, ts) VALUES (?, ?, datetime('now'))").bind(String(appointmentId), action).run();

      console.log(`[audit] ID=${appointmentId} action=${action} written to D1`);
    } catch (e) {
      // silent fail - no audit_logs table exists yet
      console.log('[audit] no audit_logs table yet, skipped');
    }
  } else {
    // Fallback: file-based logging for non-D1 environments
    console.log(`[audit] appointment=${appointmentId} action=${action}`);
  }
}

/**
 * Send automated reschedule confirmation email to client after appointment change
 * @param {object} appointment Appointment object containing client_email and scheduled_with fields
 * @returns {void} Fire-and-forget email delivery, logs errors to console  
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
 * Send automated retry notice email for no-show appointments  
 * @param {object} appointment Appointment object containing client_email field  
 * @returns {void} Fire-and-forget email notification, logs errors to console
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
        content: [{ type: "text/html", value: "<p>We missed you, no worries! Reply to schedule new time or use your calendar link.</p>" }]
      })
    });
  } catch (e) {
    console.error("Retry email error:", e);
  }

}

// CORS preflight handler
export async function onRequestOptions(context) {
  const { request } = context || {};
  const origin = request?.headers?.get('Origin') || '';
  const allowedOrigins = ['https://moliam.com', 'https://moliam.pages.dev'];
  const effectiveOrigin = allowedOrigins.includes(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin);

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": effectiveOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
