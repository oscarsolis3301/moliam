/**
 * GET /api/invoices/[id] - Get single invoice  
 * PUT /api/invoices/[id] - Update invoice status or full record
 */

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.MOLIAM_DB;

  if (!db) return jsonResp(503, { success: false, error: true, message: "Database not available." }, request);

  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { success: false, error: true, message: "Not authenticated." }, request);

  const session = await db.prepare(
      "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
    ).bind(token).first();

  if (!session) return jsonResp(401, { success: false, error: true, message: "Session invalid." }, request);

  const pathSegments = context.request.url.split('/api/invoices/');
  if (pathSegments.length < 2) {
    return jsonResp(400, { success: false, error: true, message: "Invoice ID required." }, request);
  }

  const id = parseInt(pathSegments[1]);
  if (!id || isNaN(id)) {
    return jsonResp(400, { success: false, error: true, message: "Invalid invoice ID." }, request);
  }

  try {
    const invoice = await db.prepare(
       "SELECT * FROM invoices WHERE id = ?"
     ).bind(id).first();

    if (!invoice) {
      return jsonResp(404, { success: false, error: true, message: "Invoice not found." }, request);
    }

    // Clients can only see their own invoices (contact_id = session.id) or admin sees all
    if (session.role === 'client' && invoice.contact_id !== session.id) {
      return jsonResp(403, { success: false, error: true, message: "Access denied to this invoice." }, request);
    }

    return jsonResp(200, { success: true, invoice }, request);

  } catch (err) {
    console.error("Get invoice error:", err);
    return jsonResp(500, { success: false, error: true, message: "Server error." }, request);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.MOLIAM_DB;

  if (!db) return jsonResp(503, { success: false, error: true, message: "Database not available." }, request);

  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { success: false, error: true, message: "Not authenticated." }, request);

  const session = await db.prepare(
      "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
    ).bind(token).first();

  if (!session) return jsonResp(401, { success: false, error: true, message: "Session invalid." }, request);

  const pathSegments = context.request.url.split('/api/invoices/');
  if (pathSegments.length < 2) {
    return jsonResp(400, { success: false, error: true, message: "Invoice ID required." }, request);
  }

  const id = parseInt(pathSegments[1]);
  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { success: false, error: true, message: "Invalid JSON." }, request);
  }

  const currentInvoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first();
  if (!currentInvoice) {
    return jsonResp(404, { success: false, error: true, message: "Invoice not found." }, request);
  }

  // Clients can only update their own invoices or admins
  if (session.role === 'client' && currentInvoice.contact_id !== session.id) {
    return jsonResp(403, { success: false, error: true, message: "Access denied to this invoice." }, request);
  }

  const { status, notes } = data;
  const now = new Date().toISOString();

  try {
    let query = `UPDATE invoices SET updated_at = ?,`;
    const params = [];

    if (status) {
      if (['draft', 'sent', 'paid', 'overdue'].includes(status)) {
        query += `status = ?,`;
        params.push(status);

        // Auto-update timestamps for state transitions
        if (status === 'sent') {
          query += `sent_at = ?,`;
          params.push(now);
        } else if (status === 'paid') {
          query += `sent_at = ?, paid_at = ?`;
          params.push(currentInvoice.sent_at || null, now);
        } else {
          query += `sent_at = null, paid_at = null`;
        }
      } else {
        return jsonResp(400, { success: false, error: true, message: "Invalid status value." }, request);
      }
    }

    if (notes !== undefined) {
      query += ` notes = ?,`;
      params.push(notes || null);
    }

    // Remove trailing comma and add WHERE clause - fix the logic to always handle trailing comma
    if (query.endsWith(',')) {
      query = query.slice(0, -1) + " WHERE id = ?";
    } else {
      query += " WHERE id = ?";
    }
    params.push(id);

    const result = await db.prepare(query).bind(...params).run();

    const updatedInvoice = await db.prepare(
        "SELECT * FROM invoices WHERE id = ?"
      ).bind(id).first();

    return jsonResp(200, { success: true, invoice: updatedInvoice }, request);

  } catch (err) {
    console.error("Update invoice error:", err);
    return jsonResp(500, { success: false, error: true, message: "Server error." }, request);
  }
}

/**
 * Extract session token from Cookie header
 * @param {object} request - Cloudflare Pages request object  
 * @returns {string|null} Session token or null if not found
 */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Helper: consistent JSON response wrapper for all API responses
 * @param {number} status - HTTP status code
 * @param {object} body - Response body object
 * @param {object} request - Cloudflare Pages request object (unused, kept for interface consistency)
 * @returns {Response} JSON response with proper headers including CORS for moliam.com domains
 */
function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Headers": "Content-Type"
     }
   });
}

export async function onRequestOptions() {
  return new Response(null, { 
    status: 204, 
    headers: { 
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Headers": "Content-Type" 
     }
   });
}
