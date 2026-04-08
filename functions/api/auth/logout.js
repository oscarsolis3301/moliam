/**
 * POST /api/auth/logout
 * Destroys session, clears cookie
 */
import { jsonResp } from '../lib/api-helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const token = getToken(request);

  if (token) {
    try {
      await db.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();
     } catch (err) {
      console.error('Logout DB error:', err);
     }
   }

  return jsonResp(200, { success: true }, request);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://moliam.pages.dev',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    }
  });
}

function getToken(request) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  if (origin.includes('moliam.pages.dev') || origin.includes('moliam.com') || origin.includes('localhost')) {
    return origin;
   }
  return 'https://moliam.pages.dev';
}

