     1|/**
     2| * GET /api/dashboard -- Enhanced v3
     3| * Returns current user's projects + recent updates
     4| * NEW: action=leads returns submissions with lead_score, category, follow_up_status
     5| * NEW: action=pipeline returns pipeline summary (hot/warm/cold counts and follow-up stats)
     6| */
     7|
     8|import { jsonResp } from './api-helpers.js';
     9|
/**
 * GET /api/dashboard -- Enhanced v3
 * Returns current user's projects + recent updates + optional leads/pipeline data
 * @param {object} context - Cloudflare Pages function context
 * @returns {Response} JSON response with dashboard data or error
 */
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const db = env.MOLIAM_DB;

    if (!db) {
      return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
    }
    18|
    19|// --- Parse token from query params or cookies ---
    20|const url = new URL(request.url);
    21|let token=url.se...en') || '';
    22|
    23|// Try to get token from URL hash fragment if query param not found
    24|if (!token) {
    25|    try {
    26|        const hashIdx = request.url.indexOf('#');
    27|        if (hashIdx > -1) {
    28|            const hash = request.url.substring(hashIdx + 1);
    29|            const query = new URLSearchParams(hash);
    30|            token=query....en') || '';
    31|         }
    32|     } catch (urlErr) {
    33|        console.warn("Token extraction from URL fragment failed:", urlErr.message); 
    34|     }
    35|}
    36|
    37|// Fall back to cookie extraction if no token found in hash
    38|if (!token) {
    39|    const cookies = request.headers.get('Cookie') || '';
    40|    const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
    41|    token=*** ? cookieMatch[1] : null;
    42|}
    43|}
    44|
    45|// --- Session validation with parameterized query - uses ? binding to prevent SQL injection ---
    46|const session = await db.prepare(
    47|                "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND u.is_active = 1 AND s.expires_at > datetime('now')"\n           ).bind(token).first();
    48|    47|
    49|    48|    if (!session) {
    50|    49|      return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
    51|    50|     }
    52|    51|
    53|    52|     const isAdmin = session.role === 'admin' || session.role === 'superadmin';
    54|    53|
    55|    54|     // Get action from query parameters (v3 feature)
    56|    55|    const action = url.searchParams.get('action');
    57|    56|
    58|    57|     /******  ADDITIONAL: Leads Pipeline Data (v3 requirement) ******/
    59|    if (action === 'leads') {
    60|        // Return all submissions with lead_score, category, follow_up_status
    61|        // SECURITY FIX: Use separate parameterized queries for admin vs client to prevent SQL injection
    62|      const result = isAdmin
    63|          ? await db.prepare(`SELECT s.id, s.name, s.email, s.phone, s.company, s.message,
    64|                 s.lead_score, s.category, s.created_at,
    65|                 s.follow_up_status, s.follow_up_at, l.status as lead_status
    66|           FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id ORDER BY s.created_at DESC LIMIT 100`).all()
    67|          : await db.prepare(`SELECT s.id, s.name, s.email, s.company, s.message,
    68|                 s.lead_score, s.category, s.created_at,
    69|                 s.follow_up_status, s.follow_up_at
    70|           FROM submissions s WHERE s.email=? ORDER BY s.created_at DESC LIMIT 50`).bind(session.email).all();
    71|
    72|      return jsonResp(200, {
    73|          success: true,
    74|          action: 'leads',
    75|          data: (result?.results || []),
    76|          fetchAt: new Date().toISOString()
    77|              }, request);
    78|    }
    79|    84|
    80|    if (action === 'pipeline') {
    81|         // Return pipeline summary: count by hot/warm/cold, follow-up stats
    82|         // SECURITY FIX: Use ternary to separate admin vs client queries, bind email parameter for client access
    83|      const coldCount = isAdmin 
    84|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'cold\'').then(r => r.results?.[0]?.c || 0)
    85|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    86|      const warmCount = isAdmin
    87|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'warm\'').then(r => r.results?.[0]?.c || 0)
    88|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    89|      const hotCount = isAdmin
    90|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'hot\'').then(r => r.results?.[0]?.c || 0)
    91|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'hot\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    92|      const followedCount = isAdmin
    93|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'').then(r => r.results?.[0]?.c || 0)
    94|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    95|      const pendingCount = isAdmin
    96|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'').then(r => r.results?.[0]?.c || 0)
    97|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    98|
    99|      return jsonResp(200, {
   100|          success: true,
   101|          action: 'pipeline',
   102|          data: {
   103|              byCategory: { hot: hotCount, warm: warmCount, cold: coldCount },
   104|              byFollowUp: { completed: followedCount, pending: pendingCount },
   105|              totalSubmissions: (hotCount + warmCount + coldCount),
   106|              followUpRate: ((hotCount + warmCount + coldCount) > 0)
   107|                   ? Math.round((followedCount / (hotCount + warmCount + coldCount)) * 100)
   108|                   : 0,
   109|               },
   110|          fetchAt: new Date().toISOString()
   111|                    }, request);
   112|     }
   113|   117|
   114|   118|     /******  ORIGINAL DASHBOARD CONTENTS ******/
   115|   119|
   116|   120|     // Get projects
   117|   121|      let projects;
   118|   122|      if (isAdmin) {
   119|   123|        const result = await db.prepare(
   120|   124|                       `SELECT p.*, u.name as client_name, u.company as client_company
   121|   125|           FROM projects p JOIN users u ON p.user_id = u.id
   122|   126|           ORDER BY p.updated_at DESC`)
   123|   127|                     .all();
   124|   128|        projects = (result?.results || []);
   125|   129|      } else {
   126|   130|        const result = await db.prepare(
   127|   131|                         'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
   128|   132|                       .bind(session.id).all();
   129|   133|        projects = (result?.results || []);
   130|   134|     }
   131|   135|
   132|    // Get project IDs and fetch recent updates
   133|    const projectIds = projects.map(p => p.id);
   134|    let updates = [];
   135|    if (projectIds.length > 0) {
   136|        // SECURITY: Using placeholder generation with .bind() - no SQL injection risk since placeholders are fixed '?' only
   137|        const placeholders = projectIds.map(() => '?').join(',');
   138|        const result = await db.prepare(
   139|                       `SELECT pu.*, p.name as project_name FROM project_updates pu
   140|           JOIN projects p ON pu.project_id = p.id
   141|           WHERE pu.project_id IN (${placeholders})
   142|           ORDER BY pu.created_at DESC LIMIT 20`)
   143|                     .bind(...projectIds).all();
   144|        updates = (result?.results || []);
   145|    }
   146|
   147|    // Stats calculation (no DB access, safe)
   148|   151|      const activeProjects = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
   149|   152|      const totalMonthly = projects.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);
   150|   153|
   151|   154|      let stats;
   152|   155|      if (isAdmin) {
   153|   156|        const clientCount = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first();
   154|   157|        const leadCount = await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").first();
   155|   158|        stats = {
   156|   159|            total_clients: (clientCount?.c || 0),
   157|   160|              active_projects: activeProjects,
   158|   161|              monthly_revenue: totalMonthly,
   159|   162|               new_leads: (leadCount?.c || 0),
   160|   163|                   };
   161|   164|      } else {
   162|   165|        stats = {
   163|   166|                 active_projects: activeProjects,
   164|   167|             total_projects: projects.length,
   165|   168|            monthly_total: totalMonthly,
   166|   169|                 };
   167|   170|     }
   168|   171|
   169|   172|      return jsonResp(200, {
   170|   173|              success: true,
   171|   174|              data: { id: session.id, name: session.name, email: session.email, role: session.role, company: session.company },
   172|   175|              projects,
   173|   176|              updates,
   174|   177|              stats,
   175|   178|                  }, request);
   176|   179|
   177|    } catch (err) {
   178|      console.error('Dashboard error:', err);
   179|      return jsonResp(500, { success: false, message: 'Server error.' }, request);
   180|    }
   181|}
   182|
   183|/**
   184| * CORS preflight handler for dashboard endpoints - allows browsers to properly test access
   185| * Handles OPTIONS requests with moliam.com and moliam.pages.dev origins only (no wildcards)
   186| * @param {object} context - Cloudflare Pages function context
   187| * @returns {Response} 204 No Content with proper Access-Control headers
   188| */
   189|export async function onRequestOptions(context) {
   190|  const allowedOrigins = ['https://moliam.com', 'https://www.moliam.com', 'https://moliam.pages.dev'];
   191|  const origin = context.request.headers.get('Origin');
   192|  
   193|  if (allowedOrigins.includes(origin)) {
   194|    return new Response(null, {
   195|      headers: {
   196|        'Access-Control-Allow-Origin': origin,
   197|        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
   198|        'Access-Control-Allow-Headers': 'Content-Type, Authorization, moliam_session',
   199|        'Access-Control-Max-Age': '86400',
   200|        'Vary': 'Origin'
   201|      }
   202|    });
   203|  }
   204|  
   205|  return new Response(null, { status: 204 });
   206|}
   207|
   208|   186|/**
   209|   187| * Handle dashboard data fetch with pagination and filtering capabilities.
   210|   188| * 
   211|   189| * **Query Parameters:**
   212|   190| * - action: leads | pipeline (optional)
   213|   191| * - page: integer (default: 1)
   214|   192| * - limit: integer (default: 50)
   215|   193| * - filter: string (status, category, date range, etc.)
   216|   194| * 
   217|   195| * **Returns JSON Response with proper error handling:**
   218|   196| * - Success: `{success: true, data: {...}, fetchAt: 'ISO-8601'}`
   219|   197| * - Error: `{error: 'message'}` with appropriate HTTP status code
   220|   198| * 
   221|   199| * **Security Features:**
   222|   200| * - Token validation from URL hash or cookie (session-based auth)
   223|   201| * - Parameterized SQL queries to prevent SQL injection
   224|   202| * - Role-based data access control (client vs admin)
   225|   203| * 
   226|   204| * @param {Object} context - Request context from Cloudflare Pages
   227|   205| * @param {Request} context.request - Incoming request object
   228|   206| * @param {Object} context.env - Environment variables including MOLIAM_DB binding
   229|   207| * @returns {Response} JSON response with dashboard data or error
   230|   208| */
   231|   209|