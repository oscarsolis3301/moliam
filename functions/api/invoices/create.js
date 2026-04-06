/**
 * POST /api/invoices - Create new invoice
 */

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.MOLIAM_DB;

   // Authentication check (same as clients.js)
  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { error: true, message: "Not authenticated." }, request);

  const session = await db.prepare(
      "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND s.expires_at > datetime('now')"
    ).bind(token).first();

  if (!session) return jsonResp(401, { error: true, message: "Session invalid." }, request);
  if (session.role !== 'admin' && session.role !== 'superadmin') return jsonResp(403, { error: true, message: "Admin required." }, request);

  try {
    const data = await request.json();
    const { contact_id, items, amount, due_date, status = 'draft', notes } = data;

     // Validation
    if (!contact_id || !items) {
      return jsonResp(400, { error: true, message: "Contact ID and items required." }, request);
     }

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResp(400, { error: true, message: "At least one item required." }, request);
     }

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    if (amount !== undefined && Math.abs(amount - totalAmount) > 0.01) {
      return jsonResp(400, { error: true, message: "Invoice amount does not match items." }, request);
     }

     // Fetch contact details for client info
    const invoiceNumber = generateInvoiceNumber();
    const now = new Date().toISOString();

    const clientResult = await db.prepare(
        "SELECT name, email, company FROM users WHERE id = ?"
      ).bind(contact_id).first();

    if (!clientResult) {
      return jsonResp(404, { error: true, message: "Contact not found." }, request);
     }

    const result = await db.prepare(
        `INSERT INTO invoices (contact_id, invoice_number, client_name, client_email, client_company, items, amount, due_date, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(contact_id, invoiceNumber, clientResult.name, clientResult.email, clientResult.company, 
            JSON.stringify(items), Number(amount || totalAmount), due_date, status, notes || null, now, now).run();

    const newInvoice = await db.prepare(
        "SELECT * FROM invoices WHERE id = ?"
      ).bind(result.meta.last_row_id).first();

    return jsonResp(201, { success: true, invoice: newInvoice }, request);

  } catch (err) {
    console.error("Create invoice error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${year}${month}`;
  return `${prefix}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
       "Content-Type": "application/json",
       "Access-Control-Allow-Origin": request ? (request.headers.get("Origin") || "https://moliam.pages.dev") : "https://moliam.pages.dev",
       "Access-Control-Allow-Credentials": "true"
     }
   });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
}
