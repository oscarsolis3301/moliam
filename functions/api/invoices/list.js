1|/**
     2| * GET /api/invoices - List invoices with filtering and pagination
     3| * Filters: contact_id, status, page, limit
     4| * @param {object} context - Cloudflare Pages function context with request and env
     5| * @returns {Response} JSON response with invoice list and pagination metadata
     6| */
     7|
     8|import { jsonResp } from ./api-helpers.js;
     9|
    10|export async function onRequestGet(context) {
    11|  const { env, request } = context;
    12|  const db = env.MOLIAM_DB;
    13|  
    14|  // Get session token for authentication - uses parameterized query with ? binding
    15|  const token=***
    16|  if (!token) return jsonResp(401, { error: true, message: "Not authenticated." }, request);
    17|  
    18|  if (!db) return jsonResp(404, { success: false, message: "Database not available." }, request);
    19|  
    20|  const session = await db.prepare(
    21|    "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND s.expires_at > datetime(now)"
    22|   ).bind(token).first();
    23|  
    24|  if (!session) return jsonResp(401, { error: true, message: "Session invalid." }, request);
    25|  
    26|  const url = new URL(request.url);
    27|  const contact_id = url.searchParams.get(contact_id);
    28|  const status = url.searchParams.get(status);
    29|  const page = parseInt(url.searchParams.get(page) || 1);
    30|  const limit = parseInt(url.searchParams.get(limit) || 20);
    31|  
    32|  try {
    33|    let query = "SELECT * FROM invoices WHERE 1=1";
    34|    const params = [];
    35|    
    36|    // Filter by contact_id if provided - uses parameterized binding with ? placeholder
    37|    if (contact_id) {
    38|      query += " AND contact_id = ?";
    39|      params.push(contact_id);
    40|     }
    41|    
    42|     // Filter by status with validation enum check
    43|    if (status && [draft, sent, paid, overdue].includes(status)) {
    44|      query += " AND status = ?";
    45|      params.push(status);
    46|     }
    47|    
    48|     // Admins see all, clients see only theirs - uses parameterized binding for SQL injection prevention
    49|    if (session.role === client) {
    50|      query += " AND contact_id = ?";
    51|      params.push(session.id);
    52|     }
    53|    
    54|    const offset = (page - 1) * limit;
    55|    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    56|    params.push(limit, offset);
    57|    
    58|    const invoicesResult = await db.prepare(query).bind(...params).all();
    59|      
    60|     // Get total count for pagination using parameterized query - no SQL injection possible
    61|    let countQuery = "SELECT COUNT(*) as total FROM invoices WHERE 1=1";
    62|    const countParams = [];
    63|    
    64|    if (contact_id) { 
    65|      countQuery += " AND contact_id = ?";
    66|      countParams.push(contact_id);
    67|     }
    68|     if (status && [draft, sent, paid, overdue].includes(status)) {
    69|      countQuery += " AND status = ?";
    70|      countParams.push(status);
    71|     }
    72|     if (session.role === client) {
    73|      countQuery += " AND contact_id = ?";
    74|      countParams.push(session.id);
    75|     }
    76|     
    77|    const totalCount = (await db.prepare(countQuery).bind(...countParams).first()).total;
    78|    
    79|    return jsonResp(200, {
    80|       success: true,
    81|       invoices: invoicesResult.results,
    82|       pagination: { page, limit, total: parseInt(totalCount), pages: Math.ceil(totalCount / limit) }
    83|      }, request);
    84|    
    85|    } catch (err) {
    87|    return jsonResp(500, { error: true, message: "Server error." }, request);
    88|   }
    89|}
    90|
    91|// Reuse existing auth helpers - local helper for session token extraction from cookies
    92|function getSessionToken(request) {
    93|  const cookies = request.headers.get("Cookie") || "";
    94|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    95|  return match ? match[1] : null;
    96|}
    97|
    98|// Handle CORS preflight for OPTIONS requests - returns 204 with moliam.com/pages.dev header
    99|export async function onRequestOptions() {
   100|  return new Response(null, { 
   101|    status: 204, 
   102|    headers: {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type"} 
   103|   });
   104|}
   105|
