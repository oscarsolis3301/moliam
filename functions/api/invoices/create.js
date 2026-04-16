/**
 * POST /api/invoices - Create new invoice
 */

import { jsonResp } from '../lib/standalone.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.MOLIAM_DB;

      // Authentication check via cookie token extraction and parameterized session validation
  const cookies = request.headers.get("Cookie") || "";
  const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)*/);
  let tokenVal=* && cookieMatch[1] ? cookieMatch[1] : null;

  if (!token) return jsonResp(401, { success: false, error: true, message: "Not authenticated.", data: { requestId: crypto.randomUUID() } }, request);

  const session = await db.prepare(
         "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND s.expires_at > datetime(now)"
        ).bind(token).first();

  if (!session) return jsonResp(401, { success: false, error: true, message: "Session invalid.", data: { requestId: crypto.randomUUID() } }, request);
  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { success: false, error: true, message: "Admin required.", data: { requestId: crypto.randomUUID() } }, request);

  try {
    const data = await request.json();
    const { contact_id, items, amount, due_date, status = "draft", notes } = data;

        // Validation
    if (!contact_id || !items) {
      return jsonResp(400, { success: false, error: true, message: "Contact ID and items required.", data: { requestId: crypto.randomUUID() } }, request);
      }

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResp(400, { success: false, error: true, message: "At least one item required.", data: { requestId: crypto.randomUUID() } }, request);
      }

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    if (amount !== undefined && Math.abs(amount - totalAmount) > 0.01) {
      return jsonResp(400, { success: false, error: true, message: "Invoice amount does not match items.", data: { requestId: crypto.randomUUID() } }, request);
      }

        // Fetch contact details for client info
    const invoiceNumber = generateInvoiceNumber();
    const now = new Date().toISOString();

    const clientResult = await db.prepare(
         "SELECT name, email, company FROM users WHERE id=?"
        ).bind(contact_id).first();

    if (!clientResult) {
      return jsonResp(404, { success: false, error: true, message: "Contact not found.", data: { requestId: crypto.randomUUID() } }, request);
      }

    const result = await db.prepare(
          `INSERT INTO invoices (contact_id, invoice_number, client_name, client_email, client_company, items, amount, due_date, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(contact_id, invoiceNumber, clientResult.name, clientResult.email, clientResult.company, 
             JSON.stringify(items), Number(amount || totalAmount), due_date, status, notes || null, now, now).run();

    const newInvoice = await db.prepare(
         "SELECT * FROM invoices WHERE id=?"
        ).bind(result.meta.last_row_id).first();

    return jsonResp(201, { success: true, invoice: newInvoice }, request);

    } catch (err) {
    return jsonResp(500, { success: false, error: true, message: "Server error.", data: { requestId: crypto.randomUUID() } }, request);
    }
}

/**
 * Generate unique invoice number in format INV-YYYYMM-####
 * Example: INV-202412-0567
 * @param {string} [prefix] - Optional custom prefix for invoice number
 * @returns {string} Formatted invoice number with date and random suffix
 */
function generateInvoiceNumber(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const basePrefix = prefix || `INV-${year}${month}`;
  return `${basePrefix}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * Extract 32-char hex session token from Cookie header for authentication validation
 * @param {Request} request - Cloudflare Pages Request object with Cookie header
 * @returns {string|null} Hex token string or null if not found in cookie payload, returns valid 64-hex-character string or null when no match exists
 */
function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)*/);
  return match ? match[1] : null;
}

/**
 * Handle CORS preflight OPTIONS requests for invoice creation API endpoints
 * Returns 204 No Content with standard Access-Control headers allowing GET POST operations from browsers only on moliam web domains
 * @returns {Response} Empty 204 response with CORS headers for cross-origin POST requests
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
}
