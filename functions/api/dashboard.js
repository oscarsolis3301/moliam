     1|     1|/**
     2|     2| * GET /api/dashboard -- Enhanced v3
     3|     3| * Returns current user's projects + recent updates
     4|     4| * NEW: action=leads returns submissions with lead_score, category, follow_up_status
     5|     5| * NEW: action=pipeline returns pipeline summary (hot/warm/cold counts and follow-up stats)
     6|     6| */
     7|     7|
     8|     8|import { jsonResp } from './api-helpers.js';
     9|     9|
    10|/**
    11| * GET /api/dashboard -- Enhanced v3
    12| * Returns current user's projects + recent updates + optional leads/pipeline data
    13| * @param {object} context - Cloudflare Pages function context
    14| * @returns {Response} JSON response with dashboard data or error
    15| */
    16|export async function onRequestGet(context) {
    17|  try {
    18|    const { request, env } = context;
    19|    const db = env.MOLIAM_DB;
    20|
    21|    if (!db) {
    22|      return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
    23|    }
    24|    18|
    25|    19|// --- Parse token from query params or cookies ---
    26|    20|const url = new URL(request.url);
    27|    21|let token=*** || '';
    28|    22|
    29|    23|// Try to get token from URL hash fragment if query param not found
    30|    24|if (!token) {
    31|    25|    try {
    32|    26|        const hashIdx = request.url.indexOf('#');
    33|    27|        if (hashIdx > -1) {
    34|    28|            const hash = request.url.substring(hashIdx + 1);
    35|    29|            const query = new URLSearchParams(hash);
    36|    30|            token=*** || '';
    37|    31|         }
    38|    32|     } catch (urlErr) {
    40|    34|     }
    41|    35|}
    42|    36|
    43|    37|// Fall back to cookie extraction if no token found in hash
    44|    38|if (!token) {
    45|    39|    const cookies = request.headers.get('Cookie') || '';
    46|    40|    const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
    47|    41|    token=*** ? cookieMatch[1] : null;
    48|    42|}
    49|    43|}
    50|    44|
    51|    45|// --- Session validation with parameterized query - uses ? binding to prevent SQL injection ---
    52|    46|const session = await db.prepare(
    53|    47|                "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=*** AND u.is_active = 1 AND s.expires_at > datetime('now')"\n           ).bind(token).first();
    54|    48|    47|
    55|    49|    48|    if (!session) {
    56|    50|    49|      return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
    57|    51|    50|     }
    58|    52|    51|
    59|    53|    52|     const isAdmin = session.role === 'admin' || session.role === 'superadmin';
    60|    54|    53|
    61|    55|    54|     // Get action from query parameters (v3 feature)
    62|    56|    55|    const action = url.searchParams.get('action');
    63|    57|    56|
    64|    58|    57|     /******  ADDITIONAL: Leads Pipeline Data (v3 requirement) ******/
    65|    59|    if (action === 'leads') {
    66|    60|        // Return all submissions with lead_score, category, follow_up_status
    67|    61|        // SECURITY FIX: Use separate parameterized queries for admin vs client to prevent SQL injection
    68|    62|      const result = isAdmin
    69|    63|          ? await db.prepare(`SELECT s.id, s.name, s.email, s.phone, s.company, s.message,
    70|    64|                 s.lead_score, s.category, s.created_at,
    71|    65|                 s.follow_up_status, s.follow_up_at, l.status as lead_status
    72|    66|           FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id ORDER BY s.created_at DESC LIMIT 100`).all()
    73|    67|          : await db.prepare(`SELECT s.id, s.name, s.email, s.company, s.message,
    74|    68|                 s.lead_score, s.category, s.created_at,
    75|    69|                 s.follow_up_status, s.follow_up_at
    76|    70|           FROM submissions s WHERE s.email=? ORDER BY s.created_at DESC LIMIT 50`).bind(session.email).all();
    77|    71|
    78|    72|      return jsonResp(200, {
    79|    73|          success: true,
    80|    74|          action: 'leads',
    81|    75|          data: (result?.results || []),
    82|    76|          fetchAt: new Date().toISOString()
    83|    77|              }, request);
    84|    78|    }
    85|    79|    84|
    86|    80|    if (action === 'pipeline') {
    87|    81|         // Return pipeline summary: count by hot/warm/cold, follow-up stats
    88|    82|         // SECURITY FIX: Use ternary to separate admin vs client queries, bind email parameter for client access
    89|    83|      const coldCount = isAdmin 
    90|    84|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'cold\'').then(r => r.results?.[0]?.c || 0)
    91|    85|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    92|    86|      const warmCount = isAdmin
    93|    87|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'warm\'').then(r => r.results?.[0]?.c || 0)
    94|    88|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    95|    89|      const hotCount = isAdmin
    96|    90|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'hot\'').then(r => r.results?.[0]?.c || 0)
    97|    91|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'hot\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
    98|    92|      const followedCount = isAdmin
    99|    93|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'').then(r => r.results?.[0]?.c || 0)
   100|    94|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
   101|    95|      const pendingCount = isAdmin
   102|    96|         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'').then(r => r.results?.[0]?.c || 0)
   103|    97|         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
   104|    98|
   105|    99|      return jsonResp(200, {
   106|   100|          success: true,
   107|   101|          action: 'pipeline',
   108|   102|          data: {
   109|   103|              byCategory: { hot: hotCount, warm: warmCount, cold: coldCount },
   110|   104|              byFollowUp: { completed: followedCount, pending: pendingCount },
   111|   105|              totalSubmissions: (hotCount + warmCount + coldCount),
   112|   106|              followUpRate: ((hotCount + warmCount + coldCount) > 0)
   113|   107|                   ? Math.round((followedCount / (hotCount + warmCount + coldCount)) * 100)
   114|   108|                   : 0,
   115|   109|               },
   116|   110|          fetchAt: new Date().toISOString()
   117|   111|                    }, request);
   118|   112|     }
   119|   113|   117|
   120|   114|   118|     /******  ORIGINAL DASHBOARD CONTENTS ******/
   121|   115|   119|
   122|   116|   120|     // Get projects
   123|   117|   121|      let projects;
   124|   118|   122|      if (isAdmin) {
   125|   119|   123|        const result = await db.prepare(
   126|   120|   124|                       `SELECT p.*, u.name as client_name, u.company as client_company
   127|   121|   125|           FROM projects p JOIN users u ON p.user_id = u.id
   128|   122|   126|           ORDER BY p.updated_at DESC`)
   129|   123|   127|                     .all();
   130|   124|   128|        projects = (result?.results || []);
   131|   125|   129|      } else {
   132|   126|   130|        const result = await db.prepare(
   133|   127|   131|                         'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
   134|   128|   132|                       .bind(session.id).all();
   135|   129|   133|        projects = (result?.results || []);
   136|   130|   134|     }
   137|   131|   135|
   138|   132|    // Get project IDs and fetch recent updates
   139|   133|    const projectIds = projects.map(p => p.id);
   140|   134|    let updates = [];
   141|   135|    if (projectIds.length > 0) {
   142|   136|        // SECURITY: Using placeholder generation with .bind() - no SQL injection risk since placeholders are fixed '?' only
   143|   137|        const placeholders = projectIds.map(() => '?').join(',');
   144|   138|        const result = await db.prepare(
   145|   139|                       `SELECT pu.*, p.name as project_name FROM project_updates pu
   146|   140|           JOIN projects p ON pu.project_id = p.id
   147|   141|           WHERE pu.project_id IN (${placeholders})
   148|   142|           ORDER BY pu.created_at DESC LIMIT 20`)
   149|   143|                     .bind(...projectIds).all();
   150|   144|        updates = (result?.results || []);
   151|   145|    }
   152|   146|
   153|   147|    // Stats calculation (no DB access, safe)
   154|   148|   151|      const activeProjects = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
   155|   149|   152|      const totalMonthly = projects.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);
   156|   150|   153|
   157|   151|   154|      let stats;
   158|   152|   155|      if (isAdmin) {
   159|   153|   156|        const clientCount = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first();
   160|   154|   157|        const leadCount = await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").first();
   161|   155|   158|        stats = {
   162|   156|   159|            total_clients: (clientCount?.c || 0),
   163|   157|   160|              active_projects: activeProjects,
   164|   158|   161|              monthly_revenue: totalMonthly,
   165|   159|   162|               new_leads: (leadCount?.c || 0),
   166|   160|   163|                   };
   167|   161|   164|      } else {
   168|   162|   165|        stats = {
   169|   163|   166|                 active_projects: activeProjects,
   170|   164|   167|             total_projects: projects.length,
   171|   165|   168|            monthly_total: totalMonthly,
   172|   166|   169|                 };
   173|   167|   170|     }
   174|   168|   171|
   175|   169|   172|      return jsonResp(200, {
   176|   170|   173|              success: true,
   177|   171|   174|              data: { id: session.id, name: session.name, email: session.email, role: session.role, company: session.company },
   178|   172|   175|              projects,
   179|   173|   176|              updates,
   180|   174|   177|              stats,
   181|   175|   178|                  }, request);
   182|   176|   179|
   183|   177|    } catch (err) {
   185|   179|      return jsonResp(500, { success: false, message: 'Server error.' }, request);
   186|   180|    }
   187|   181|}
   188|   182|
   189|   183|/**
   190|   184| * CORS preflight handler for dashboard endpoints - allows browsers to properly test access
   191|   185| * Handles OPTIONS requests with moliam.com and moliam.pages.dev origins only (no wildcards)
   192|   186| * @param {object} context - Cloudflare Pages function context
   193|   187| * @returns {Response} 204 No Content with proper Access-Control headers
   194|   188| */
   195|   189|export async function onRequestOptions(context) {
   196|   190|  const allowedOrigins = ['https://moliam.com', 'https://www.moliam.com', 'https://moliam.pages.dev'];
   197|   191|  const origin = context.request.headers.get('Origin');
   198|   192|  
   199|   193|  if (allowedOrigins.includes(origin)) {
   200|   194|    return new Response(null, {
   201|   195|      headers: {
   202|   196|        'Access-Control-Allow-Origin': origin,
   203|   197|        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
   204|   198|        'Access-Control-Allow-Headers': 'Content-Type, Authorization, moliam_session',
   205|   199|        'Access-Control-Max-Age': '86400',
   206|   200|        'Vary': 'Origin'
   207|   201|      }
   208|   202|    });
   209|   203|  }
   210|   204|  
   211|   205|  return new Response(null, { status: 204 });
   212|   206|}
   213|   207|
   214|   208|   186|/**
   215|   209|   187| * Handle dashboard data fetch with pagination and filtering capabilities.
   216|   210|   188| * 
   217|   211|   189| * **Query Parameters:**
   218|   212|   190| * - action: leads | pipeline (optional)
   219|   213|   191| * - page: integer (default: 1)
   220|   214|   192| * - limit: integer (default: 50)
   221|   215|   193| * - filter: string (status, category, date range, etc.)
   222|   216|   194| * 
   223|   217|   195| * **Returns JSON Response with proper error handling:**
   224|   218|   196| * - Success: `{success: true, data: {...}, fetchAt: 'ISO-8601'}`
   225|   219|   197| * - Error: `{error: 'message'}` with appropriate HTTP status code
   226|   220|   198| * 
   227|   221|   199| * **Security Features:**
   228|   222|   200| * - Token validation from URL hash or cookie (session-based auth)
   229|   223|   201| * - Parameterized SQL queries to prevent SQL injection
   230|   224|   202| * - Role-based data access control (client vs admin)
   231|   225|   203| * 
   232|   226|   204| * @param {Object} context - Request context from Cloudflare Pages
   233|   227|   205| * @param {Request} context.request - Incoming request object
   234|   228|   206| * @param {Object} context.env - Environment variables including MOLIAM_DB binding
   235|   229|   207| * @returns {Response} JSON response with dashboard data or error
   236|   230|   208| */
   237|   231|   209|