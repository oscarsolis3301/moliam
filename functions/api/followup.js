     1|/**
     2| * MOLIAM Follow-Up Sequence — CloudFlare Pages Functions v3
     3| * GET /api/followup — returns all leads needing follow-up (submitted > 5min ago, no follow-up sent)
     4| * POST /api/followup — marks a lead as followed-up, stores timestamp
     5| * 
     6| * Task 4 Fix: Uses central api-helpers.jsonResp() for consistent {success, data/error} format across all endpoints
     7| */
     8|
     9|import { jsonResp } from './api-helpers.js';
    10|
    11|/** Helper: Ensure consistent error response format - wraps errors with success:false and proper error string */
    12|function ensureErrorResponse(status, message, request = null) {
    13|  return jsonResp(status, { success: false, error: message }, request);
    14|}
    15|
    16|/**
    17| * Handle GET requests to retrieve follow-up queue - list submissions pending follow-up (>5min old, no follow_up_at set)
    18| * @param {object} context - Cloudflare Pages function context with request and env.MOLIAM_DB binding
    19| * @returns {Response} JSON response with array of leads needing follow-up or error message about DB/connection issues
    20| */
    21|export async function onRequestGet(context) {
    22|  const { request, env } = context;
    23|  const db = env.MOLIAM_DB;
    24|  
    25|  if (!db) return ensureErrorResponse(500, "Database not bound", request);
    26|
    27|  try {
    28|    // --- Ensure submissions table has follow_up columns ---
    29|    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending'").run();
    30|    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_at TEXT").run();
    31|
    32|    // Get all submissions pending follow-up (submitted > 5min, no follow_up_at timestamp)
    33|    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    34|    
    35|    const results = await db.prepare("SELECT s.id, s.name, s.email, s.phone, s.company, s.message, s.lead_score, s.category, s.created_at, s.follow_up_status, s.follow_up_at, l.status as lead_status FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id WHERE (julianday(?) - julianday(s.created_at)) * 86400 > 300 AND s.follow_up_at IS NULL ORDER BY s.created_at ASC").bind(fiveMinsAgo).all();
    36|
    37|    return jsonResp(200, {
    38|      success: true,
    39|      count: results.results.length,
    40|      leads: results.results
    41|         ? results.results.map(r => ({
    42|             id: r.id,
    43|             name: r.name,
    44|             email: r.email,
    45|             phone: r.phone,
    46|             company: r.company,
    47|             message: r.message,
    48|             leadScore: r.lead_score,
    49|             category: r.category,
    50|             createdAt: r.created_at,
    51|             followUpStatus: r.follow_up_status,
    52|             submitTime: r.created_at
    53|           }))
    54|         : [],
    55|      fetchAt: new Date().toISOString()
    56|    });
    57|
    58|  } catch (err) {
    60|    return ensureErrorResponse(500, "Database query failed", request);
    61|  }
    62|}
    63|
    64|/**
    65| * Handle POST requests to mark leads as followed-up - stores follow-up timestamp and updates status to completed
    66| * @param {object} context - Cloudflare Pages function context with request and env.MOLIAM_DB binding
    67| * @returns {Response} JSON response with success/status and lead ID that was marked followed-up, or 400/500 errors for validation/DB issues
    68| */
    69|export async function onRequestPost(context) {
    70|  const { request, env } = context;
    71|  let data;
    72|  try {
    73|    data = await request.json();
    74|   } catch {
    75|    return ensureErrorResponse(400, "Invalid JSON body", request);
    76|  }
    77|
    78|  const db = env.MOLIAM_DB;
    79|  if (!db) return ensureErrorResponse(500, "Database not bound", request);
    80|
    81|  const leadId = data.lead_id;
    82|  if (!leadId || typeof leadId !== 'number') {
    83|    return ensureErrorResponse(400, "Valid lead_id (integer) required", request);
    84|    }
    85|
    86|  try {
    87|     // --- Ensure submissions table has follow_up columns ---
    88|    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending'").run();
    89|    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_at TEXT").run();
    90|
    91|    const now = new Date().toISOString();
    92|    
    93|    // Mark this lead as followed up with timestamp
    94|    const result = await db.prepare(
    95|         "UPDATE submissions SET follow_up_status = 'completed', follow_up_at = ? WHERE id = ?"
    96|       ).bind(now, leadId).run();
    97|
    98|    if (result.changes.length === 0 || result.meta.last_row_id !== leadId) {
    99|      return ensureErrorResponse(404, "Lead not found or already followed up", request);
   100|      }
   101|
   102|    // Optional: Update related leads table
   103|    try {
   104|      await db.prepare("UPDATE leads SET follow_up_at = ?, status = 'followed' WHERE submission_id = ?")
   105|          .bind(now, leadId).run();
   106|      } catch {}
   107|
   108|    return jsonResp(200, { success: true, data: { message: "Lead marked as followed up", leadId, followUpAt: now } }, request);
   109|
   110|   } catch (err) {
   112|    return ensureErrorResponse(500, "Database update failed", request);
   113|  }
   114|}
   115|
   116|/**
   117| * CORS preflight handler for Followup API - responds to OPTIONS requests with allowed headers
   118| * @param {Request} request - Cloudflare Pages request object with origin header
   119| * @returns {Response} 204 No Content with CORS headers for moliam.com and moliam.pages.dev
   120| */
   121|export async function onRequestOptions(request) {
   122|  const origin = request.headers.get('Origin') || '*';
   123|   // Restrict to moliam domains for production security, allow * for dev/testing
   124|  const allowedOrigins = ['https://moliam.com', 'https://moliam.pages.dev'];
   125|  const effectiveOrigin = allowedOrigins.includes(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin);
   126|  const headers = new Headers({
   127|     "Access-Control-Allow-Origin": effectiveOrigin,
   128|     "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
   129|     "Access-Control-Allow-Headers": "Content-Type"
   130|   });
   131|  return new Response(null, { status: 204, headers });
   132|}
   133|