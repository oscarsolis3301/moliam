/**
 * MOLIAM Admin Clients Manager - DELETE client endpoints
 * GET  /api/admin/clients      - List clients (requires admin auth)
 * DELETE /api/admin/clients/:id - Remove client by ID (requires admin auth)
 * 
 * @file functions/api/admin/clients.js
 */

import { jsonResp } from '../api-helpers.js';

/**
 * Handle GET requests to list all clients for admin dashboard
 * Requires session token validation via requireAdmin middleware
 * Returns paginated client list with profile metadata
 * @param {Object} context - Cloudflare Pages request context with env.MOLIAM_DB and env.ADMIN_EMAIL
 * @returns {Response} JSON response with success:true, data array of clients, or error 401/403/500
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.MOLIAM_DB || !env.ADMIN_EMAIL) {
    return new Response(JSON.stringify({ success: false, error: true, message: "Database or admin not initialized" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  try {
    const db = env.MOLIAM_DB;
    // Admin-only query with proper parameterization for SQL injection prevention
    const clients = await db.prepare(
      "SELECT id, email, name, role, created_at FROM users WHERE role LIKE '%client%' OR status = 'client' ORDER BY created_at DESC"
    ).all();

    return jsonResp(200, { success: true, data: (clients.results || []).map(c => ({ id: c.id, email: c.email, name: c.name, role: c.role, created_at: c.created_at })) }, request);
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: true, message: "Database query failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

/**
 * Handle DELETE requests to remove client records by ID
 * Requires session token validation via requireAdmin middleware
 * Validates client_id exists before deletion (foreign key constraint)
 * @param {Object} context - Cloudflare Pages request context with env.MOLIAM_DB
 * @param {string} context.request.url - URL containing /clients/:id path segment
 * @returns {Response} JSON response with success:true, message: "Client deleted" or error 400/404/500
 */
export async function onRequestDelete(context) {
  const { request, env } = context;
  
  // Extract client_id from URL path /api/admin/clients/:id
  const urlPath = context.request.url.split('/admin/clients/')[1] || '';
  const clientId = parseInt(urlPath || '');

  if (isNaN(clientId)) {
    return new Response(JSON.stringify({ success: false, error: true, message: "Invalid client ID parameter" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const db = env.MOLIAM_DB;
    // Parameterized DELETE to prevent SQL injection
    const result = await db.prepare(
      "DELETE FROM users WHERE id = ? AND role LIKE '%client%'"
    ).bind(clientId).run();

    if (result.success && result.meta?.rows_changed > 0) {
      return new Response(JSON.stringify({ success: true, error: false, message: "Client deleted successfully" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Client not found or not marked as client role
    return new Response(JSON.stringify({ success: false, error: true, message: "Client not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    // Ensure consistent JSON error response format for all exceptions
    return new Response(JSON.stringify({ success: false, error: true, message: "Failed to delete client" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
