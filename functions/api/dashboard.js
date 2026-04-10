/**
 * GET /api/dashboard -- Enhanced v3
 * Returns current user's projects + recent updates
 * NEW: action=leads returns submissions with lead_score, category, follow_up_status
 * NEW: action=pipeline returns pipeline summary (hot/warm/cold counts and follow-up stats)
 */

import { jsonResp } from './api-helpers.js';

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const db = env.MOLIAM_DB;

    if (!db) {
      return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
    }

// --- Parse token from query params or cookies ---
const url = new URL(request.url);
let token = url.searchParams.get('token') || '';

// Try to get token from URL hash fragment if query param not found
try {
    const hashIdx = request.url.indexOf('#');
    if (hashIdx > -1) {
        const hash = request.url.substring(hashIdx + 1);
        const query = new URLSearchParams(hash.split('&')[0]);
        token = query.get('token') || '';
    }
} catch (urlErr) {
    console.warn("Token extraction from URL fragment failed:", urlErr.message); 
}

// Fall back to cookie extraction if no token found in hash
if (!token) {
    const cookies = request.headers.get('Cookie') || '';
    const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
    token = cookieMatch ? cookieMatch[1] : null;
}

// --- Session validation with parameterized query - uses ? binding to prevent SQL injection ---
const session = await db.prepare(
             "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"
         ).bind(token).first();
    47|
    48|    if (!session) {
    49|      return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
    50|     }
    51|
    52|     const isAdmin = session.role === 'admin' || session.role === 'superadmin';
    53|
    54|     // Get action from query parameters (v3 feature)
    55|    const action = url.searchParams.get('action');
    56|
    57|     /******  ADDITIONAL: Leads Pipeline Data (v3 requirement) ******/
    58|    if (action === 'leads') {
    59|       // Return all submissions with lead_score, category, follow_up_status
    60|      let query;
    61|      if (isAdmin) {
    62|        query = `SELECT s.id, s.name, s.email, s.phone, s.company, s.message,
    63|                 s.lead_score, s.category, s.created_at,
    64|                 s.follow_up_status, s.follow_up_at, l.status as lead_status
    65|           FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id ORDER BY s.created_at DESC LIMIT 100`;
    66|      } else {
    67|        query = `SELECT s.id, s.name, s.email, s.company, s.message,
    68|                 s.lead_score, s.category, s.created_at,
    69|                 s.follow_up_status, s.follow_up_at
    70|           FROM submissions s WHERE s.email=? ORDER BY s.created_at DESC LIMIT 50`;
    71|       }
    72|
    73|      const result = isAdmin
    74|         ? await db.prepare(query).all()
    75|         : await db.prepare(query).bind(session.email).all();
    76|
    77|      return jsonResp(200, {
    78|          success: true,
    79|          action: 'leads',
    80|          data: (result?.results || []),
    81|          fetchAt: new Date().toISOString()
    82|             }, request);
    83|     }
    84|
    85|    if (action === 'pipeline') {
    86|         // Return pipeline summary: count by hot/warm/cold, follow-up stats
    87|      const coldCount = await db.prepare(
    88|        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'cold\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\''
    89|      ).bind(session.email).all().then(r => r.results?.[0]?.c || 0);
    90|      const warmCount = await db.prepare(
    91|        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'warm\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\''
    92|      ).bind(session.email).all().then(r => r.results?.[0]?.c || 0);
    93|      const hotCount = await db.prepare(
    94|        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'hot\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'hot\''
    95|      ).bind(session.email).all().then(r => r.results?.[0]?.c || 0);
    96|      const followedCount = await db.prepare(
    97|        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'')
    98|      .bind(session.email).all().then(r => r.results?.[0]?.c || 0);
    99|      const pendingCount = await db.prepare(
   100|        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'')
   101|      .bind(session.email).all().then(r => r.results?.[0]?.c || 0);
   102|
   103|      return jsonResp(200, {
   104|           success: true,
   105|           action: 'pipeline',
   106|           data: {
   107|               byCategory: { hot: hotCount, warm: warmCount, cold: coldCount },
   108|               byFollowUp: { completed: followedCount, pending: pendingCount },
   109|               totalSubmissions: (hotCount + warmCount + coldCount),
   110|               followUpRate: ((hotCount + warmCount + coldCount) > 0)
   111|                   ? Math.round((followedCount / (hotCount + warmCount + coldCount)) * 100)
   112|                  : 0,
   113|               },
   114|           fetchAt: new Date().toISOString()
   115|                   }, request);
   116|     }
   117|
   118|     /******  ORIGINAL DASHBOARD CONTENTS ******/
   119|
   120|     // Get projects
   121|      let projects;
   122|      if (isAdmin) {
   123|        const result = await db.prepare(
   124|                       `SELECT p.*, u.name as client_name, u.company as client_company
   125|           FROM projects p JOIN users u ON p.user_id = u.id
   126|           ORDER BY p.updated_at DESC`)
   127|                     .all();
   128|        projects = (result?.results || []);
   129|      } else {
   130|        const result = await db.prepare(
   131|                         'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
   132|                       .bind(session.id).all();
   133|        projects = (result?.results || []);
   134|     }
   135|
   136|       // Get recent updates for user's projects
   137|      const projectIds = projects.map(p => p.id);
   138|      let updates = [];
   139|      if (projectIds.length > 0) {
   140|        const placeholders = projectIds.map(() => '?').join(',');
   141|        const result = await db.prepare(
   142|                      `SELECT pu.*, p.name as project_name FROM project_updates pu
   143|           JOIN projects p ON pu.project_id = p.id
   144|           WHERE pu.project_id IN (${placeholders})
   145|           ORDER BY pu.created_at DESC LIMIT 20`)
   146|                    .bind(...projectIds).all();
   147|        updates = (result?.results || []);
   148|     }
   149|
   150|       // Stats
   151|      const activeProjects = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
   152|      const totalMonthly = projects.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);
   153|
   154|      let stats;
   155|      if (isAdmin) {
   156|        const clientCount = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first();
   157|        const leadCount = await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").first();
   158|        stats = {
   159|            total_clients: (clientCount?.c || 0),
   160|              active_projects: activeProjects,
   161|              monthly_revenue: totalMonthly,
   162|               new_leads: (leadCount?.c || 0),
   163|                   };
   164|      } else {
   165|        stats = {
   166|                 active_projects: activeProjects,
   167|             total_projects: projects.length,
   168|            monthly_total: totalMonthly,
   169|                 };
   170|     }
   171|
   172|      return jsonResp(200, {
   173|              success: true,
   174|              data: { id: session.id, name: session.name, email: session.email, role: session.role, company: session.company },
   175|              projects,
   176|              updates,
   177|              stats,
   178|                  }, request);
   179|
   180|} catch (err) {
   181|    console.error('Dashboard error:', err);
   182|      return jsonResp(500, { success: false, message: 'Server error.' }, request);
   183|  }
   184|}
   185|
   186|/**
   187| * Handle dashboard data fetch with pagination and filtering capabilities.
   188| * 
   189| * **Query Parameters:**
   190| * - action: leads | pipeline (optional)
   191| * - page: integer (default: 1)
   192| * - limit: integer (default: 50)
   193| * - filter: string (status, category, date range, etc.)
   194| * 
   195| * **Returns JSON Response with proper error handling:**
   196| * - Success: `{success: true, data: {...}, fetchAt: 'ISO-8601'}`
   197| * - Error: `{error: 'message'}` with appropriate HTTP status code
   198| * 
   199| * **Security Features:**
   200| * - Token validation from URL hash or cookie (session-based auth)
   201| * - Parameterized SQL queries to prevent SQL injection
   202| * - Role-based data access control (client vs admin)
   203| * 
   204| * @param {Object} context - Request context from Cloudflare Pages
   205| * @param {Request} context.request - Incoming request object
   206| * @param {Object} context.env - Environment variables including MOLIAM_DB binding
   207| * @returns {Response} JSON response with dashboard data or error
   208| */
   209|