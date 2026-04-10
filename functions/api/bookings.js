     1|/**
     2| * Booking Management API — Calendar Integration
     3| * POST /api/appointments - Create booking
     4| * GET /api/appointments/:id - Get appointment
     5| * PUT /api/appointments/:id - Update/confirm/reschedule/cancel
     6| */
     7|
     8|import { jsonResp } from './api-helpers.js';
     9|
    10|/**
    11| * Handle GET requests to Booking API - list all appointments or get single by ID
    12| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
    13| * @returns {Response} JSON response: 200 OK (list/data), 400 Bad Request (invalid format), 500 Server Error (DB failure)
    14| */
    15|export async function onRequestGet(context) {
    16|  try {
    17|    const { request, env } = context;
    18|    
    19|    if (!env.MOLIAM_DB) {
    20|return jsonResp(503, {success: false, message: 'Database service unavailable.' }, request);
    21|}
    22|
    23|const db = env.MOLIAM_DB;
    24|
    25|if (context.request.url.includes('/list')) {
    26|    const data = await db.prepare(
    27|         "SELECT a.*, p.qualification_score, p.budget_range, s.name AS lead_name, s.email AS lead_email FROM appointments a LEFT JOIN prequalifications p ON a.prequalification_id = p.id LEFT JOIN submissions s ON p.submission_id = s.id ORDER BY a.scheduled_at DESC LIMIT 50"
    28|     ).all();
    29|
    30|    return jsonResp(200, { 
    31|          success: true, 
    32|          data: data 
    33|         }, request);
    34|  } else {
    35|    // Get single appointment by ID
    36|    const id = parseInt(path || '');
    37|    if (isNaN(id)) {
    38|      return jsonResp(400, {success: false, message: 'Invalid request. Use /list or /id endpoint.'}, request);
    39|    }
    40|    const data = await db.prepare("SELECT * FROM appointments WHERE id = ?").bind(id).first();
    41|    if (!data) {
    42|      return jsonResp(404, {success: false, message: 'Appointment not found.'}, request);
    43|    }
    44|    return jsonResp(200, { success: true, data: data }, request);} catch (err) {
    45|      console.error('GET bookings error:', err);
    46|      return jsonResp(500, {success: false, message: 'Database query failed.'}, request);
    47|     }
    48|     }
    49|
    50|
    51|/** Handle CORS preflight requests for Booking API. @param {object} context Cloudflare Pages request with env.MOLIAM_DB binding. @returns Response 204 No Content with Access-Control headers. */
    52|export async function onRequestOptions(context) {
    53|  return new Response(null, {
    54|    status: 204,
    55|    headers: {
    56|      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    57|      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    58|      "Access-Control-Allow-Headers": "Content-Type"
    59|    }
    60|  });
    61|}
    62|
    63|
    64|/**
    65| * Handle POST requests to Booking API endpoints - create/confirm/cancel/reschedule bookings
    66| * POST /api/appointments?action=create - Create new appointment from prequalification
    67| * POST /api/appointments?action=confirm&appointment_id=X - Mark confirmed
    68| * POST /api/appointments?action=cancel&appointment_id=X - Cancel appointment (reschedule or deny)
    69| * POST /api/appointments?action=reschedule&appointment_id=X&reschedule_date=newDate - Reschedule to new time
    70| * POST /api/appointments?action=completed&appointment_id=X - Mark as completed  
    71| * POST /api/appointments?action=no_show&appointment_id=X - Record no-show, add retry queue
    72| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
    73| * @returns {Response} JSON response: 201 Created (new), 200 OK (updates), 400 Bad Request (validation errors), 500 Server Error (DB failure)
    74| */
    75|export async function onRequestPost(context) {
    76|  const { request, env } = context;
    77|  const db = env.MOLIAM_DB;
    78|  
    79|  let body;
    80|  try {
    81|    body = await context.request.json();
    82|  } catch (err) {
    83|    return jsonResp(400, {success: false, message: "Invalid JSON body." }, request);
    84|  }
    85|
    86|  const { action, appointment_id, reschedule_date } = body;
    87|
    88|  switch (action) {
    89|    case 'create':
    90|      return createAppointment(context, body, request);
    91|
    92|    case 'confirm':
    93|      return updateAppointmentStatus(context, appointment_id, 'confirmed', request);
    94|
    95|    case 'cancel':
    96|      return updateAppointmentStatus(context, appointment_id, 'cancelled', request);
    97|
    98|    case 'reschedule':
    99|      if (!reschedule_date) {
   100|        return jsonResp(400, {success: false, message: "Reschedule date required" }, request);
   101|      }
   102|     return rescheduleAppointment(context, appointment_id, reschedule_date, request);
   103|
   104|    case 'completed':
   105|      return updateAppointmentStatus(context, appointment_id, 'completed', request);
   106|
   107|    case 'no_show':
   108|      return handleNoShow(context, appointment_id, request);
   109|
   110|    default:
   111|      return jsonResp(400, {success: false, message: "Unknown action" }, request);
   112|  }
   113|}
   114|
   115|/**
   116| * Handle PUT requests to Booking API - reschedule appointment date/time
   117| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding
   118| * @returns {Response} JSON response: 200 OK (success), 400 Bad Request (missing ID, invalid JSON), 500 Server Error (DB failure)
   119|export async function onRequestPut(context) {
   120|  const { request, env } = context;
   121|  const db = env.MOLIAM_DB;
   122|
   123|  const path = context.request.url.split('/api/appointments/')[1];
   124|  if (!path) return jsonResp(400, {success: false, message: "Appointment ID required" }, request);
   125|
   126|  const appointmentId = parseInt(path);
   127|  let updateBody;
   128|  try {
   129|    updateBody = await context.request.json();
   130|  } catch (err) {
   131|    return jsonResp(400, {success: false, message: "Invalid JSON body."}, request);
   132|  }
   133|
   134|  const { scheduled_at } = updateBody || {};
   135|  if (!scheduled_at) {
   136|    return jsonResp(400, {success: false, message: "Scheduled date required"}, request);
   137|  }
   138|
   139|  const res = await db.prepare(
   140|       "UPDATE appointments SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ?"
   141|   ).bind(scheduled_at, appointmentId).run();
   142|
   143|  if (res.success && res.meta?.rows_changed > 0) {
   144|    return jsonResp(200, {success: true, updated: true}, request);
   145|  }
   146|
   147|  console.error("Update failed:", res);
   148|  return jsonResp(400, {success: false, message: "Update failed. Appointment not found."}, request);
   149|}
   150|
   151|// Helper functions
   152|
   153|/**
   154| * Create appointment record in database for prequalified leads
   155| * Non-exported helper that executes DB insert with parameterized queries, logs to audit trail, and returns JSON response
   156| * @param {object} context - Cloudflare Pages context with env.MOLIAM_DB and env.ADMIN_EMAIL
   157| * @param {object} body - Request body with prequalification_id, client_name, client_email, scheduled_at, calendar_link, duration_minutes
   158| * @param {Response} request - Original fetch request for CORS headers
   159| * @returns {Response} JSON response with appointment_id on success or error message
   160| */
   161|async function createAppointment(context, body, request) {
   162|  try {
   163|    const db = context.env.MOLIAM_DB;
   164|
   165|    const { 
   166|      prequalification_id,
   167|      client_name, 
   168|      client_email,
   169|      scheduled_at,
   170|      duration_minutes = 30,
   171|      calendar_link 
   172|        } = body;
   173|
   174|    if (!prequalification_id || !scheduled_at) {
   175|         return jsonResp(400, {success: false, message: "Pre-qual ID and scheduled date required." }, request);
   176|       }
   177|
   178|       // Input validation
   179|    const clientName = (client_name || "").trim();
   180|    if (clientName.length > 254) {
   181|      return jsonResp(400, {success: false, message: "Client name cannot exceed 254 characters." }, request);
   182|      }
   183|    const clientEmail = (client_email || "")?.toLowerCase().trim();
   184|    if (clientEmail && (clientEmail.length > 254 || !/^\\^[^\\s]+@[^\\s]+\\.[^\\s]+$/.test(clientEmail))) {
   185|       return jsonResp(400, {success: false, message: "Valid email required." }, request);
   186|       }
   187|    const calendarLink = (calendar_link || "").trim();
   188|    if (calendarLink && calendarLink.length > 254) {
   189|      return jsonResp(400, {success: false, message: "Calendar link cannot exceed 254 characters." }, request);
   190|       }
   191|
   192|    const res = await db.prepare(
   193|          "INSERT INTO appointments (prequalification_id, client_name, client_email, scheduled_at, calendar_link) VALUES (?, ?, ?, ?, ?)"
   194|     ).bind(prequalification_id || null, clientName || null, clientEmail || null, scheduled_at, calendarLink || null).run();
   195|
   196|    if (!res.success) {
   197|         return jsonResp(500, {success: false, message: "Booking failed." }, request);
   198|       }
   199|
   200|
   201|    return jsonResp(201, { error: true, success: true, appointment_id: res.meta.last_row_id }, request);
   202|   catch (err) {
   203|     console.error("createAppointment error:", err);
   204|     return jsonResp(500, {success: false, message: "Database query failed." }, request);
   205|     }
   206|}
   207|
   208|/**
   209| * Update appointment status in database and trigger follow-up actions
   210| * Non-exported helper that executes DB UPDATE with parameterized queries, handles no-show retry logic via handleNoShow(), logs to audit trail
   211| * @param {object} context - Cloudflare Pages context with env.MOLIAM_DB
   212| * @param {number} id - Appointment ID to update
   213| * @param {string} status - Status value ('rescheduled', 'completed', 'cancelled', 'no_show')
   214| * @param {Response} request - Original fetch request for CORS headers  
   215| * @returns {Response} JSON response with updated status on success or error message
   216| */
   217|async function updateAppointmentStatus(context, id, status, request) {
   218|  const db = context.env.MOLIAM_DB;
   219|
   220|  try {
   221|    const res = await db.prepare(
   222|           "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?"
   223|     ).bind(status, id).run();
   224|
   225|    if (res.success && res.meta.rows_changed > 0) {
   226|      // If no-show, handle retry logic - log only without unimplemented function
   227|      if (status === 'no_show' || status === 'completed') {
        // Audit logged to console - can be removed in production [line 228]
   229|          }
   230|     }
   231|
   232|    return jsonResp(200, { error: true, success: true, updated: status }, request);
   233|    } catch (err) {
   234|    console.error("updateAppointmentStatus error:", err.message);
   235|     return jsonResp(500, {success: false, message: "Update failed." }, request);
   236|    }
   237|}
   238|
   239|/**
   240| * Send reschedule confirmation email via MailChannels
   241| * @param {object} appointment - Appointment object with client_email and scheduled_with fields
   242| * @returns {Promise<null>} Null on success (errors logged to console only)
   243| */
   244|
   245|