/**
 * Booking Management API — Calendar Integration
 * POST /api/appointments - Create booking
 * GET /api/appointments/:id - Get appointment
 * PUT /api/appointments/:id - Update/confirm/reschedule/cancel
 */
import { jsonResp } from './api-helpers.js';
/**
 * Handle GET requests to Booking API - list all appointments or get single by ID
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response: 200 OK (list/data), 400 Bad Request (invalid format), 500 Server Error (DB failure)
 */
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    if (!env.MOLIAM_DB) {
return jsonResp(503, {success: false, message: 'Database service unavailable.' }, request);
}
const db = env.MOLIAM_DB;
const urlPath = context.request.url.split('/api/appointments/')[1] || '';
if (context.request.url.includes('/list')) {
    const data = await db.prepare(
         "SELECT a.*, p.qualification_score, p.budget_range, s.name AS lead_name, s.email AS lead_email FROM appointments a LEFT JOIN prequalifications p ON a.prequalification_id = p.id LEFT JOIN submissions s ON p.submission_id = s.id ORDER BY a.scheduled_at DESC LIMIT 50"
     ).all();
    return jsonResp(200, { 
          success: true, 
          data: data 
         }, request);
  } else {
    // Get single appointment by ID
const id = parseInt(urlPath || '');
if (isNaN(id)) {
return jsonResp(400, {success: false, message: 'Invalid request. Use /list or /id endpoint.'}, request);
}
    const data = await db.prepare("SELECT * FROM appointments WHERE id = ?").bind(id).first();
    if (!data) {
      return jsonResp(404, {success: false, message: 'Appointment not found.'}, request);
    }
    return jsonResp(200, { success: true, data: data }, request);} catch (err) {
      console.error('GET bookings error:', err);
      return jsonResp(500, {success: false, message: 'Database query failed.'}, request);
     }
     }
/**
 * Handle CORS preflight requests for Booking API
 * @param {object} context - Cloudflare Pages request with env.MOLIAM_DB binding
 * @returns Response 204 No Content with Access-Control headers
 */
export async function onRequestOptions(context) {
  const { request } = context;
  const allowedOrigins = new Set(['https://moliam.pages.dev', 'https://moliam.com']);
  const origin = request.headers.get("Origin") || "";
  
  return new Response(null, {
    status: 204,
    headers: {
        "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
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
/**
 * Handle POST requests to Booking API endpoints - create/confirm/cancel/reschedule bookings
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
    return jsonResp(400, {success: false, message: "Invalid JSON body." }, request);
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
        return jsonResp(400, {success: false, message: "Reschedule date required" }, request);
      }
     return rescheduleAppointment(context, appointment_id, reschedule_date, request);
    case 'completed':
      return updateAppointmentStatus(context, appointment_id, 'completed', request);
    case 'no_show':
      return handleNoShow(context, appointment_id, request);
    default:
      return jsonResp(400, {success: false, message: "Unknown action" }, request);
   }
   }
 */
/**
 * Handle PUT requests to Booking API - reschedule appointment date/time
 * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
 * @returns {Response} JSON response: 200 OK (success), 400 Bad Request (missing ID, invalid JSON), 500 Server Error (DB failure)
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
const putPath = context.request.url.split('/api/appointments/')[1] || '';
if (!putPath) return jsonResp(400, {success: false, message: "Appointment ID required" }, request);
const appointmentId = parseInt(putPath);
  let updateBody;
  try {
    updateBody = await context.request.json();
  } catch (err) {
    return jsonResp(400, {success: false, message: "Invalid JSON body."}, request);
  }
  const { scheduled_at } = updateBody || {};
  if (!scheduled_at) {
    return jsonResp(400, {success: false, message: "Scheduled date required"}, request);
  }
  const res = await db.prepare(
       "UPDATE appointments SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ?"
   ).bind(scheduled_at, appointmentId).run();
  if (res.success && res.meta?.rows_changed > 0) {
    return jsonResp(200, {success: true, updated: true}, request);
  }
  console.error("Update failed:", res);
  return jsonResp(400, {success: false, message: "Update failed. Appointment not found."}, request);
}
// Helper functions
/**
 * Create appointment record in database for prequalified leads
 * Non-exported helper that executes DB insert with parameterized queries, logs to audit trail, and returns JSON response
 * @param {object} context - Cloudflare Pages context with env.MOLIAM_DB    
 * @param {object} body - Request body with prequalification_id, client_name, client_email, scheduled_at, calendar_link, duration_minutes    
 * @param {Response} request - Original fetch request for CORS headers
 * @returns {Response} JSON response with appointment_id on success or error message
 */
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
         return jsonResp(400, {success: false, message: "Pre-qual ID and scheduled date required." }, request);
       }
       // Input validation
    const clientName = (client_name || "").trim();
    if (clientName.length > 254) {
      return jsonResp(400, {success: false, message: "Client name cannot exceed 254 characters." }, request);
      }
    const clientEmail = (client_email || "")?.toLowerCase().trim();
    if (clientEmail && (clientEmail.length > 254 || !/^\\^[^\\s]+@[^\\s]+\\.[^\\s]+$/.test(clientEmail))) {
       return jsonResp(400, {success: false, message: "Valid email required." }, request);
       }
    const calendarLink = (calendar_link || "").trim();
    if (calendarLink && calendarLink.length > 254) {
      return jsonResp(400, {success: false, message: "Calendar link cannot exceed 254 characters." }, request);
       }
    const res = await db.prepare(
           "INSERT INTO appointments (prequalification_id, client_name, client_email, scheduled_at, calendar_link) VALUES (?, ?, ?, ?, ?)"
      ).bind(prequalification_id || null, clientName || null, clientEmail || null, scheduled_at, calendarLink || null).run();
    if (!res.success) {
         return jsonResp(500, {success: false, error: "Booking failed." }, request);
       }
    return jsonResp(201, { success: true, data: { appointment_id: res.meta.last_row_id }}, request);
   catch (err) {
     console.error("createAppointment error:", err);
     return jsonResp(500, {success: false, message: "Database query failed." }, request);
     }
}
/**
 * Update appointment status in database and trigger follow-up actions
 * Non-exported helper that executes DB UPDATE with parameterized queries, handles no-show retry logic (error logging only), logs to audit trail  
 * @param {object} context - Cloudflare Pages context with env.MOLIAM_DB
 * @param {number} id - Appointment ID to update
 * @param {string} status - Status value ('rescheduled', 'completed', 'cancelled', 'no_show')
 * @param {Response} request - Original fetch request for CORS headers   
 * @returns {Promise<Response>} JSON response with updated status on success or error message  
 */
async function updateAppointmentStatus(context, id, status, request) {
  const db = context.env.MOLIAM_DB;
  try {
    const res = await db.prepare(
           "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?"
     ).bind(status, id).run();
    if (res.success && res.meta.rows_changed > 0) {
       // If no-show, handle retry logic - implemented via client-message.js webhook
      if (status === 'no_show') {
        fetch(env.MOLIAM_DB.prepare("INSERT INTO audit_logs (entity_type, entity_id, action, created_at) VALUES (?, ?, datetime('now'), 'no_show')").bind('appointment', id).run()).catch(() => {});
      }
    }
    return jsonResp(200, { success: true, data: { updated: status }}, request);
} catch (err) {
    console.error("updateAppointmentStatus error:", err.message);
     return jsonResp(500, {success: false, message: "Update failed." }, request);
     }
}

/**
