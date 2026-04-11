     1|/**
     2| * GET /api/auth/me
     3| * Returns current user from session cookie, validates token and auth status
     4| * @param {object} context - Cloudflare Pages function context with request and env
     5| * @returns {Response} JSON response with authenticated user data or 401 error
     6| */
     7|
     8|import { jsonResp } from './api-helpers.js';
     9|
    10|export async function onRequestGet(context) {
    11|  const { request, env } = context;
    12|  const db = env.MOLIAM_DB;
    13|  
    14|    // Get session token from cookies for authentication - uses parameterized query with ? binding
    15|  const cookies = request.headers.get("Cookie") || "";
    16|  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
    17|  const token=*** ? match[1] : null;
    18|  
    19|  if (!token) {
    20|    return jsonResp(401, { success: false, message: "Not authenticated." }, request);
    21|   }
    22|  
    23|  try {
    24|       // Get user session with proper ? parameterized binding - no SQL injection possible here
    25|    const session = await db.prepare(
    26|         "SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.company, u.phone, u.avatar_url FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND u.is_active=1"
    27|       ).bind(token).first();
    28|    
    29|    if (!session) {
    30|      return jsonResp(401, { success: false, message: "Session invalid." }, request);
    31|    }
    32|    
    33|     // Check session expiry - delete stale tokens to prevent orphan data accumulation
    34|    if (new Date(session.expires_at) < new Date()) {
    35|      await db.prepare("DELETE FROM sessions WHERE token=?").bi...n();
    36|      return jsonResp(401, { success: false, message: "Session expired." }, request);
    37|     }
    38|    
    39|     // Normalize superadmin -> admin for frontend routing and display
    40|    const displayRole = session.role === 'superadmin' ? 'admin' : session.role;
    41|    
    42|    return jsonResp(200, {
    43|       success: true,
    44|       user: {
    45|          id: session.user_id,
    46|          email: session.email,
    47|          name: session.name,
    48|          role: displayRole,
    49|          company: session.company,
    50|          phone: session.phone,
    51|          avatar_url: session.avatar_url,
    52|        }
    53|      }, request);
    54|    
    55|   } catch (err) {
    57|    return jsonResp(500, { success: false, message: "Server error." }, request);
    58|   }
    59|}
    60|
    61|/**
    62| * Handle CORS preflight requests for Me API endpoint - standard OPTIONS response
    63| * @param {Request} request - Cloudflare Pages request object (unused, standard signature)
    64| * @returns {Response} 204 No Content with CORS headers for moliam domains
    65| */
    66|export async function onRequestOptions() {
    67|  return new Response(null, {
    68|    status: 204,
    69|    headers: {
    70|	"Access-Control-Allow-Origin": "https://moliam.pages.dev",
    71|	"Access-Control-Allow-Methods": "GET, OPTIONS",
    72|	"Access-Control-Allow-Headers": "Content-Type",
    73|	"Access-Control-Allow-Credentials": "true",
    74|      }
    75|     });
    76|}
    77|
    78|// Helper: get allowed origin from request headers for dynamic CORS configuration
    79|function getAllowedOrigin(request) {
    80|  const origin = request.headers.get("Origin") || "";
    81|  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) {
    82|    return origin;
    83|   }
    84|  return "https://moliam.pages.dev";
    85|}
    86|