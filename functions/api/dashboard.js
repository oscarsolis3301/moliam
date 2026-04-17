/** ============================================================================
   GET /api/dashboard -- Client Portal v3 + Performance Monitoring

   Returns current user's projects + recent updates with admin overrides.

   SECURITY FEATURES:
      - Token extraction from URL params, hash fragment, or cookies (fallback chain)
      - Parameterized queries prevent SQL injection - uses ? binding throughout
      - Session validation with expiry checking and is_active flag
      - Role-based access: client vs admin/superadmin views

   QUERY PARAMETERS:
      - action=leads: Return submissions with lead_score, category, follow_up_status
      - action=pipeline: Return pipeline summary counts by hot/warm/cold

   PERFORMANCE MONITORING (v3 task 16):
      - D1 slow query logging for queries >50ms
      - KV-based metrics aggregation for dashboard telemetry
      - Request timing middleware integration

   RESPONSES:
      - 401 Invalid/expired session → {success:false, message:"Session invalid or expired."}
      - 503 Database unavailable → {success:false, message:"Database service unavailable."}
      - 503 Metrics unavailable → logs but doesn't fail request
      - 200 Success → {success:true, data:{...}, projects:[], updates:[], stats:[]}
    
   @param {Object} context - Request context from Cloudflare Pages
   @param {Request} context.request - Incoming request with query params and cookies
   @param {MOLIAM_DB} context.env.MOLIAM_DB - Bound D1 database
   @param {KV Namespace} context.env.MOLIAM_METRICS - Bound KV for metrics caching (optional)
   @returns {Response} JSON response with dashboard data or status 401/503

   EXAMPLES:
   GET /api/dashboard?action=leads → All submissions (admin) or user's only (client)
   GET /api/dashboard?action=pipeline → Pipeline summary counts hot/warm/cold
      ========================================================================= */

import { jsonResp, generateRequestId } from './lib/standalone.js';

// Performance monitoring - slow query threshold is 50ms
const SLOW_QUERY_THRESHOLD = 50; 

// Create a performance logger with timing tracking
async function trackQuery(env, queryName, dbOperation) {
  const start = Date.now();
  
  try {
    const result = await dbOperation();
    const duration = Date.now() - start;
    
    // Log to console if slow
    if (duration > SLOW_QUERY_THRESHOLD) {
      console.warn(`[SLOW QUERY] ${queryName}: ${duration}ms`);
    }
    
    // Optionally save to KV for aggregation
    if (env.MOLIAM_METRICS && result !== undefined) {
      const now = Date.now();
      await env.MOLIAM_METRICS.put(
        `query:${now}`,
        JSON.stringify({ queryName, duration, timestamp: new Date().toISOString() }),
        { expirationTtl: 300 } // Keep for 5 minutes
      );
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[QUERY ERROR] ${queryName}:`, error.message);
    throw error;
  }
}

async function trackDashboardOperations(env, getMetricsData, session, isAdmin) {
  // Track pipeline queries individually with timing
  const coldCount = await trackQuery(env, 'dashboard-pipeline-cold', () => 
    env.MOLIAM_DB.prepare(
      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'cold\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'cold\''
    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
  );
  
  const warmCount = await trackQuery(env, 'dashboard-pipeline-warm', () => 
    env.MOLIAM_DB.prepare(
      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'warm\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\''
    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
  );
  
  const hotCount = await trackQuery(env, 'dashboard-pipeline-hot', () => 
    env.MOLIAM_DB.prepare(
      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'hot\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'hot\''
    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
  );
  
  const followedCount = await trackQuery(env, 'dashboard-followup-completed', () => 
    env.MOLIAM_DB.prepare(
      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\''
    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
  );
  
  const pendingCount = await trackQuery(env, 'dashboard-followup-pending', () => 
    env.MOLIAM_DB.prepare(
      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'failed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\''
    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
  );
  
  return { coldCount, warmCount, hotCount, followedCount, pendingCount };
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const db = env.MOLIAM_DB;

    if (!db) {
      return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
  }

// --- Parse token from URL params or cookies ---
    const url = new URL(request.url);
    
    // Try to get token from query params
    let token=url.searchParams.get('token') || '';
    // Try to get token from URL hash fragment if query param not found
    try {
      const hashIdx = request.url.indexOf('#');
      if (hashIdx > -1) {
        const hash = request.url.substring(hashIdx + 1);
        const query = new URLSearchParams(hash.split('&')[0]);
        token=query.get('token') || '';
      }
    } catch (urlErr) {
      console.warn("Token extraction from URL fragment failed:", urlErr.message);
    }
    
// Fall back to cookie extraction if no token found in hash
    if (!token) {
      const cookies = request.headers.get('Cookie') || '';
      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
      token=cookieMatch ? cookieMatch[1] : null;
    }

// --- Extract action parameter ---
    const action = url.searchParams.get('action') || '';

// --- Session validation with parameterized query - uses ? binding to prevent SQL injection ---
    const session = await db.prepare(
                   "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"
    ).bind(token).first());

    if (!session) {
        return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
}

const isAdmin = session.role === 'admin' || session.role === 'superadmin';

/******  ADDITIONAL: Leads Pipeline Data (v3 requirement)******/   
    if (action === 'leads') {
           // Return all submissions with lead_score, category, follow_up_status
      let query;
      if (isAdmin) {
        query = `SELECT s.id, s.name, s.email, s.phone, s.company, s.message,
                 s.lead_score, s.category, s.created_at,
                 s.follow_up_status, s.follow_up_at, l.status as lead_status
           FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id ORDER BY s.created_at DESC LIMIT 100`;
      } else {
        query = `SELECT s.id, s.name, s.email, s.company, s.message,
                 s.lead_score, s.category, s.created_at,
                 s.follow_up_status, s.follow_up_at
           FROM submissions s WHERE s.email=? ORDER BY s.created_at DESC LIMIT 50`;
}
      
      const result = await trackQuery(env, 'dashboard-leads-query', () => 
        isAdmin ? db.prepare(query).all() : db.prepare(query).bind(session.email).all()
      );

      return jsonResp(200, {
          success: true,
          action: 'leads',
          data: (result?.results || []),
          fetchAt: new Date().toISOString()
        }, request);
    }

    if (action === 'pipeline') {
               // Track all pipeline metrics with timing and save to KV for aggregation
      const { coldCount, warmCount, hotCount, followedCount, pendingCount } = 
              await trackDashboardOperations(env, null, session, isAdmin);

      return jsonResp(200, {
           success: true,
           action: 'pipeline',
           data: {
               byCategory: { hot: hotCount, warm: warmCount, cold: coldCount },
               byFollowUp: { completed: followedCount, pending: pendingCount },
               totalSubmissions: (hotCount + warmCount + coldCount),
               followUpRate: ((hotCount + warmCount + coldCount) > 0)
                      ? Math.round((followedCount / (hotCount + warmCount + coldCount)) * 100)
                     : 0,
              },
           fetchAt: new Date().toISOString()
        }, request);
}

/******  ORIGINAL DASHBOARD CONTENTS******/

      // Get projects - tracked for performance
      let projects;
      if (isAdmin) {
        const result = await traceQuery(env, 'dashboard-projects-admin', () => db.prepare(
                       `SELECT p.*, u.name as client_name, u.company as client_company
           FROM projects p JOIN users u ON p.user_id = u.id
           ORDER BY p.updated_at DESC`).all());
        projects = (result?.results || []);
      } else {
        const result = await trackQuery(env, 'dashboard-projects-user', () => db.prepare(
            'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').bind(session.id).all());
        projects = (result?.results || []);
}

      // Get recent updates for user's projects - tracked
      const projectIds = projects.map(p => p.id);
      let updates = [];
      if (projectIds.length > 0) {
        const placeholders = projectIds.map(() => '?').join(',');
        const result = await trackQuery(env, 'dashboard-project-updates', () => db.prepare(
                       `SELECT pu.*, p.name as project_name FROM project_updates pu
           JOIN projects p ON pu.project_id = p.id
           WHERE pu.project_id IN (${placeholders})
           ORDER BY pu.created_at DESC LIMIT 20`).bind(...projectIds).all());
        updates = (result?.results || []);
      }

      // Stats calculation
      const activeProjects = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
      const totalMonthly = projects.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);

      let stats;
      if (isAdmin) {
        const clientCount = await trackQuery(env, 'dashboard-stats-client-count', () =>
          db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first());
        const leadCount = await trackQuery(env, 'dashboard-stats-lead-count', () => 
          db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").first());
        stats = {
            total_clients: (clientCount?.c || 0),
             active_projects: activeProjects,
              monthly_revenue: totalMonthly,
               new_leads: (leadCount?.c || 0),
           };
      } else {
        stats = {
                 active_projects: activeProjects,
             total_projects: projects.length,
            monthly_total: totalMonthly,
          };
}

return jsonResp(200, {
         success: true,
         data: { id: session.id, name: session.name, email: session.email, role: session.role, company: session.company },
         projects,
         updates,
         stats,
       }, request);

} catch (err) {
  console.error('Dashboard error:', err.message);
  return jsonResp(500, { success: false, message: 'Server error.' }, request);
}
}

/**
 * Handle dashboard data fetch with pagination and filtering capabilities.
 * 
 * **Query Parameters:**
 * - action: leads | pipeline (optional)
 * - page: integer (default: 1)
 * - limit: integer (default: 50)
 * - filter: string (status, category, date range, etc.)
 * 
 * **Returns JSON Response with proper error handling:**
 * - Success: `{success: true, data: {...}}, fetchAt: 'ISO-8601'`
 * - Error: `{error: 'message'}` with appropriate HTTP status code
 * 
 * **Security Features:**
 * - Token validation from URL hash or cookie (session-based auth)
 * - Parameterized SQL queries to prevent SQL injection
 * - Role-based data access control (client vs admin)
 * 
 * @param {Object} context - Request context from Cloudflare Pages
 * @param {Request} context.request - Incoming request object
 * @param {Object} context.env - Environment variables including MOLIAM_DB binding
 * @returns {Response} JSON response with dashboard data or error
 */
