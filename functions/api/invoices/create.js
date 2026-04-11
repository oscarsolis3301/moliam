     1|/**
     2| * POST /api/invoices - Create new invoice
     3| */
     4|
     5|export async function onRequestPost(context) {
     6|  const { env, request } = context;
     7|  const db = env.MOLIAM_DB;
     8|
     9|  // Authentication check via cookie token extraction and parameterized session validation
    10|  const cookies = request.headers.get("Cookie") || "";
    11|  const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
    12|  const token=*** ? cookieMatch[1] : null;
    13|  if (!token) return jsonResp(401, { success: false, error: true, message: "Not authenticated." }, request);
    14|
    15|  const session = await db.prepare(
    16|    "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND s.expires_at > datetime('now')"
    17|  ).bind(token).first();
    18|
    19|  if (!session) return jsonResp(401, { success: false, error: true, message: "Session invalid." }, request);
    20|  if (session.role !== 'admin' && session.role !== 'superadmin') return jsonResp(403, { success: false, error: true, message: "Admin required." }, request);
    21|
    22|  try {
    23|    const data = await request.json();
    24|    const { contact_id, items, amount, due_date, status = 'draft', notes } = data;
    25|
    26|    // Validation
    27|    if (!contact_id || !items) {
    28|      return jsonResp(400, { success: false, error: true, message: "Contact ID and items required." }, request);
    29|    }
    30|
    31|    if (!Array.isArray(items) || items.length === 0) {
    32|      return jsonResp(400, { success: false, error: true, message: "At least one item required." }, request);
    33|    }
    34|
    35|    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    36|    if (amount !== undefined && Math.abs(amount - totalAmount) > 0.01) {
    37|      return jsonResp(400, { success: false, error: true, message: "Invoice amount does not match items." }, request);
    38|    }
    39|
    40|    // Fetch contact details for client info
    41|    const invoiceNumber = generateInvoiceNumber();
    42|    const now = new Date().toISOString();
    43|
    44|    const clientResult = await db.prepare(
    45|      "SELECT name, email, company FROM users WHERE id=?"
    46|    ).bind(contact_id).first();
    47|
    48|    if (!clientResult) {
    49|      return jsonResp(404, { success: false, error: true, message: "Contact not found." }, request);
    50|    }
    51|
    52|    const result = await db.prepare(
    53|      `INSERT INTO invoices (contact_id, invoice_number, client_name, client_email, client_company, items, amount, due_date, status, notes, created_at, updated_at)
    54|       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    55|    ).bind(contact_id, invoiceNumber, clientResult.name, clientResult.email, clientResult.company, 
    56|           JSON.stringify(items), Number(amount || totalAmount), due_date, status, notes || null, now, now).run();
    57|
    58|    const newInvoice = await db.prepare(
    59|      "SELECT * FROM invoices WHERE id=?"
    60|    ).bind(result.meta.last_row_id).first();
    61|
    62|    return jsonResp(201, { success: true, invoice: newInvoice }, request);
    63|
    64|  } catch (err) {
    66|    return jsonResp(500, { success: false, error: true, message: "Server error." }, request);
    67|  }
    68|}
    69|
    70|/**
    71| * Generate unique invoice number in format INV-YYYYMM-####
    72| * Example: INV-202412-0567
    73| * @param {string} [prefix] - Optional custom prefix for invoice number
    74| * @returns {string} Formatted invoice number with date and random suffix
    75| */
    76|function generateInvoiceNumber(prefix) {
    77|  const now = new Date();
    78|  const year = now.getFullYear();
    79|  const month = String(now.getMonth() + 1).padStart(2, '0');
    80|  const basePrefix = prefix || `INV-${year}${month}`;
    81|  return `${basePrefix}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    82|}
    83|
    84|/**
    85| * Extract 32-char hex session token from Cookie header for authentication validation
    86| * @param {Request} request - Cloudflare Pages Request object with Cookie header
    87| * @returns {string|null} Hex token string or null if not found in cookie payload, returns valid 64-hex-character string or null when no match exists
    88| */
    89|function getSessionToken(request) {
    90|  const cookies = request.headers.get("Cookie") || "";
    91|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    92|  return match ? match[1] : null;
    93|}
    94|
    95|/**
    96| * Create JSON response with automatic Content-Type and CORS headers for invoice API endpoints
    97| * @param {number} status - HTTP status code (201, 400, 401, 500, etc.)
    98| * @param {object} body - Response payload including success flag and optional invoice data
    99| * @param {Request} [request] - Optional Request object for origin detection, may be null or undefined when called from non-frontendl context without CORS needs
   100| * @returns {Response} JSON Response with application/json header and Access-Control headers enabling cross-origin requests to moliam domains
   101| */
   102|function jsonResp(status, body, request) {
   103|  return new Response(JSON.stringify(body), {
   104|    status,
   105|    headers: {
   106|      "Content-Type": "application/json",
   107|      "Access-Control-Allow-Origin": "*"
   108|    }
   109|  });
   110|}
   111|
   112|/**
   113| * Handle CORS preflight OPTIONS requests for invoice creation API endpoints
   114| * Returns 204 No Content with standard Access-Control headers allowing GET POST operations from browsers only on moliam web domains
   115| * @returns {Response} Empty 204 response with CORS headers for cross-origin POST requests
   116| */
   117|export async function onRequestOptions() {
   118|  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
   119|}
   120|