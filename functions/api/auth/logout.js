     1|/**
     2| * POST /api/auth/logout
     3| * Destroys session, clears cookie for authenticated user
     4| * @param {object} context - Cloudflare Pages function context with request and env
     5| * @returns {Response} JSON response with success status or authentication error
     6| */
     7|
     8|import { jsonResp } from './api-helpers.js';
     9|
    10|export async function onRequestPost(context) {
    11|  const { request, env } = context;
    12|  const db = env.MOLIAM_DB;
    13|  
    14|  // Get token from session cookie for deletion
    15|  const cookies = request.headers.get('Cookie') || '';
    16|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    17|  const token=*** ? match[1] : null;
    18|  
    19|  if (token && db) {
    20|    try {
    21|      // Delete session from database using parameterized query with ? binding - no SQL injection
    22|      await db.prepare('DELETE FROM sessions WHERE token=?').bi...n();
    23|    } catch (err) {
    25|    }
    26|   }
    27|  
    28|  // Clear cookie by expiring it with HttpOnly attribute
    29|  const headers = new Headers({
    30|    'Set-Cookie': `moliam_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    31|    'Content-Type': 'application/json'
    32|  });
    33|  
    34|  return jsonResp(200, { success: true }, headers);
    35|}
    36|
    37|/**
    38| * Handle CORS preflight for Logout API endpoints via OPTIONS method - returns 204 No Content
    39| * @param {Request} request - Cloudflare Pages Request object (unused, standard signature)
    40| * @returns {Response} 204 No Content with proper Access-Control headers
    41| */
    42|export async function onRequestOptions() {
    43|  return new Response(null, {
    44|    status: 204,
    45|    headers: {
    46|	'Access-Control-Allow-Origin': 'https://moliam.pages.dev',
    47|	'Access-Control-Allow-Methods': 'POST, OPTIONS',
    48|	'Access-Control-Allow-Headers': 'Content-Type',
    49|	'Access-Control-Allow-Credentials': 'true'
    50|      }
    51|    });
    52|}
    53|