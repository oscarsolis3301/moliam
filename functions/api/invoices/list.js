/**
 * GET /api/invoices - List invoices (filter by contact_id, status, pagination)
 */

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.MOLIAM_DB;

  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { error: true, message: "Not authenticated." }, request);

  const session = await db.prepare(
    "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND s.expires_at > datetime('now')"
  ).bind(token).first();

  if (!session) return jsonResp(401, { error: true, message: "Session invalid." }, request);

  const url = new URL(request.url);
  const contact_id = url.searchParams.get('contact_id');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  try {
    let query = "SELECT * FROM invoices WHERE 1=1";
    const params = [];

    if (contact_id) {
      query += " AND contact_id = ?";
      params.push(contact_id);
    }

    if (status && ['draft', 'sent', 'paid', 'overdue'].includes(status)) {
      query += " AND status = ?";
      params.push(status);
    }

    // Admins see all, clients see only theirs
    if (session.role === 'client') {
      query += " AND contact_id = ?";
      params.push(session.id);
    }

    const offset = (page - 1) * limit;
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const invoicesResult = await db.prepare(query).bind(...params).all();
    
    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM invoices WHERE 1=1";
    const countParams = [];
    if (contact_id) { countQuery += " AND contact_id = ?"; countParams.push(contact_id); }
    if (status && ['draft', 'sent', 'paid', 'overdue'].includes(status)) {
      countQuery += " AND status = ?"; countParams.push(status);
    }
    if (session.role === 'client') {
      countQuery += " AND contact_id = ?"; countParams.push(session.id);
    }
    const totalCount = (await db.prepare(countQuery).bind(...countParams).first()).total;

    return jsonResp(200, {
      success: true,
      invoices: invoicesResult.results,
      pagination: { page, limit, total: parseInt(totalCount), pages: Math.ceil(totalCount / limit) }
      }, request);

   } catch (err) {
    console.error("List invoices error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

// Reuse existing auth helpers - inline for simplicity
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
}
