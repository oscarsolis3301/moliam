/**
 * POST /api/auth/logout
 * Destroys session, clears cookie for authenticated user
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success status or authentication error
 */

import { jsonResp } from './api-helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;
  
  // Get token from session cookie for deletion
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  const token = match ? match[1] : null;
  
  if (token && db) {
    try {
      // Delete session from database using parameterized query with ? binding - no SQL injection
      await db.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();
    } catch (err) {
      console.error('Logout DB error:', err);
    }
   }
  
  // Clear cookie by expiring it with HttpOnly attribute
  const headers = new Headers({
    'Set-Cookie': `moliam_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    'Content-Type': 'application/json'
  });
  
  return jsonResp(200, { success: true }, headers);
}

// Handle CORS preflight for OPTIONS requests - returns 204 No Content with proper headers
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://moliam.pages.dev',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true'
     }
   });
}
