     1|/**
     2| * GET /api/invoices/[id] - Get single invoice  
     3| * PUT /api/invoices/[id] - Update invoice status or full record
     4| */
     5|
     6|export async function onRequestGet(context) {
     7|  const { env, request } = context;
     8|  const db = env.MOLIAM_DB;
     9|
    10|  if (!db) return jsonResp(503, { success: false, error: true, message: "Database not available." }, request);
    11|
    12|  const token=getSes...st);
    13|  if (!token) return jsonResp(401, { success: false, error: true, message: "Not authenticated." }, request);
    14|
    15|  const session = await db.prepare(
    16|      "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND s.expires_at > datetime('now')"
    17|    ).bind(token).first();
    18|
    19|  if (!session) return jsonResp(401, { success: false, error: true, message: "Session invalid." }, request);
    20|
    21|  const pathSegments = context.request.url.split('/api/invoices/');
    22|  if (pathSegments.length < 2) {
    23|    return jsonResp(400, { success: false, error: true, message: "Invoice ID required." }, request);
    24|  }
    25|
    26|  const id = parseInt(pathSegments[1]);
    27|  if (!id || isNaN(id)) {
    28|    return jsonResp(400, { success: false, error: true, message: "Invalid invoice ID." }, request);
    29|  }
    30|
    31|  try {
    32|    const invoice = await db.prepare(
    33|       "SELECT * FROM invoices WHERE id = ?"
    34|     ).bind(id).first();
    35|
    36|    if (!invoice) {
    37|      return jsonResp(404, { success: false, error: true, message: "Invoice not found." }, request);
    38|    }
    39|
    40|    // Clients can only see their own invoices (contact_id = session.id) or admin sees all
    41|    if (session.role === 'client' && invoice.contact_id !== session.id) {
    42|      return jsonResp(403, { success: false, error: true, message: "Access denied to this invoice." }, request);
    43|    }
    44|
    45|    return jsonResp(200, { success: true, invoice }, request);
    46|
    47|  } catch (err) {
    49|    return jsonResp(500, { success: false, error: true, message: "Server error." }, request);
    50|  }
    51|}
    52|
    53|export async function onRequestPut(context) {
    54|  const { env, request } = context;
    55|  const db = env.MOLIAM_DB;
    56|
    57|  if (!db) return jsonResp(503, { success: false, error: true, message: "Database not available." }, request);
    58|
    59|  const token=getSes...st);
    60|  if (!token) return jsonResp(401, { success: false, error: true, message: "Not authenticated." }, request);
    61|
    62|  const session = await db.prepare(
    63|      "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND s.expires_at > datetime('now')"
    64|    ).bind(token).first();
    65|
    66|  if (!session) return jsonResp(401, { success: false, error: true, message: "Session invalid." }, request);
    67|
    68|  const pathSegments = context.request.url.split('/api/invoices/');
    69|  if (pathSegments.length < 2) {
    70|    return jsonResp(400, { success: false, error: true, message: "Invoice ID required." }, request);
    71|  }
    72|
    73|  const id = parseInt(pathSegments[1]);
    74|  let data;
    75|  try {
    76|    data = await request.json();
    77|  } catch {
    78|    return jsonResp(400, { success: false, error: true, message: "Invalid JSON." }, request);
    79|  }
    80|
    81|  const currentInvoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first();
    82|  if (!currentInvoice) {
    83|    return jsonResp(404, { success: false, error: true, message: "Invoice not found." }, request);
    84|  }
    85|
    86|  // Clients can only update their own invoices or admins
    87|  if (session.role === 'client' && currentInvoice.contact_id !== session.id) {
    88|    return jsonResp(403, { success: false, error: true, message: "Access denied to this invoice." }, request);
    89|  }
    90|
    91|  const { status, notes } = data;
    92|  const now = new Date().toISOString();
    93|
    94|  try {
    95|    let query = `UPDATE invoices SET updated_at = ?,`;
    96|    const params = [];
    97|
    98|    if (status) {
    99|      if (['draft', 'sent', 'paid', 'overdue'].includes(status)) {
   100|        query += `status = ?,`;
   101|        params.push(status);
   102|
   103|        // Auto-update timestamps for state transitions
   104|        if (status === 'sent') {
   105|          query += `sent_at = ?,`;
   106|          params.push(now);
   107|        } else if (status === 'paid') {
   108|          query += `sent_at = ?, paid_at = ?`;
   109|          params.push(currentInvoice.sent_at || null, now);
   110|        } else {
   111|          query += `sent_at = null, paid_at = null`;
   112|        }
   113|      } else {
   114|        return jsonResp(400, { success: false, error: true, message: "Invalid status value." }, request);
   115|      }
   116|    }
   117|
   118|    if (notes !== undefined) {
   119|      query += ` notes = ?,`;
   120|      params.push(notes || null);
   121|    }
   122|
   123|    // Remove trailing comma and add WHERE clause - fix the logic to always handle trailing comma
   124|    if (query.endsWith(',')) {
   125|      query = query.slice(0, -1) + " WHERE id = ?";
   126|    } else {
   127|      query += " WHERE id = ?";
   128|    }
   129|    params.push(id);
   130|
   131|    const result = await db.prepare(query).bind(...params).run();
   132|
   133|    const updatedInvoice = await db.prepare(
   134|        "SELECT * FROM invoices WHERE id = ?"
   135|      ).bind(id).first();
   136|
   137|    return jsonResp(200, { success: true, invoice: updatedInvoice }, request);
   138|
   139|  } catch (err) {
   141|    return jsonResp(500, { success: false, error: true, message: "Server error." }, request);
   142|  }
   143|}
   144|
   145|/**
   146| * Extract session token from Cookie header
   147| * @param {object} request - Cloudflare Pages request object  
   148| * @returns {string|null} Session token or null if not found
   149| */
   150|function getSessionToken(request) {
   151|  const cookies = request.headers.get("Cookie") || "";
   152|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
   153|  return match ? match[1] : null;
   154|}
   155|
   156|/**
   157| * Helper: consistent JSON response wrapper for all API responses
   158| * @param {number} status - HTTP status code
   159| * @param {object} body - Response body object
   160| * @param {object} request - Cloudflare Pages request object (unused, kept for interface consistency)
   161| * @returns {Response} JSON response with proper headers including CORS for moliam.com domains
   162| */
   163|function jsonResp(status, body, request) {
   164|  return new Response(JSON.stringify(body), {
   165|    status,
   166|    headers: { 
   167|      "Content-Type": "application/json",
   168|      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
   169|      "Access-Control-Allow-Headers": "Content-Type"
   170|     }
   171|   });
   172|}
   173|
   174|export async function onRequestOptions() {
   175|  return new Response(null, { 
   176|    status: 204, 
   177|    headers: { 
   178|      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
   179|      "Access-Control-Allow-Headers": "Content-Type" 
   180|     }
   181|   });
   182|}
   183|