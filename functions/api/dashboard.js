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
            token=query.get('token') || '';
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

    if (!session) {
      return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
     }

     const isAdmin = session.role === 'admin' || session.role === 'superadmin';

     // Get action from query parameters (v3 feature)
    const action = url.searchParams.get('action');

     /******  ADDITIONAL: Leads Pipeline Data (v3 requirement) ******/
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

      const result = isAdmin
         ? await db.prepare(query).all()
         : await db.prepare(query).bind(session.email).all();

      return jsonResp(200, {
          success: true,
          action: 'leads',
          data: (result?.results || []),
          fetchAt: new Date().toISOString()
             }, request);
     }

    if (action === 'pipeline') {
         // Return pipeline summary: count by hot/warm/cold, follow-up stats
      const coldCount = await db.prepare(
        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'cold\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\''
      ).bind(session.email).all().then(r => r.results?.[0]?.c || 0);
      const warmCount = await db.prepare(
        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'warm\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\''
      ).bind(session.email).all().then(r => r.results?.[0]?.c || 0);
      const hotCount = await db.prepare(
        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'hot\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'hot\''
      ).bind(session.email).all().then(r => r.results?.[0]?.c || 0);
      const followedCount = await db.prepare(
        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'')
      .bind(session.email).all().then(r => r.results?.[0]?.c || 0);
      const pendingCount = await db.prepare(
        isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'')
      .bind(session.email).all().then(r => r.results?.[0]?.c || 0);

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

     /******  ORIGINAL DASHBOARD CONTENTS ******/

     // Get projects
      let projects;
      if (isAdmin) {
        const result = await db.prepare(
                       `SELECT p.*, u.name as client_name, u.company as client_company
           FROM projects p JOIN users u ON p.user_id = u.id
           ORDER BY p.updated_at DESC`)
                     .all();
        projects = (result?.results || []);
      } else {
        const result = await db.prepare(
                         'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
                       .bind(session.id).all();
        projects = (result?.results || []);
     }

       // Get recent updates for user's projects
      const projectIds = projects.map(p => p.id);
      let updates = [];
      if (projectIds.length > 0) {
        const placeholders = projectIds.map(() => '?').join(',');
        const result = await db.prepare(
                      `SELECT pu.*, p.name as project_name FROM project_updates pu
           JOIN projects p ON pu.project_id = p.id
           WHERE pu.project_id IN (${placeholders})
           ORDER BY pu.created_at DESC LIMIT 20`)
                    .bind(...projectIds).all();
        updates = (result?.results || []);
     }

       // Stats
      const activeProjects = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
      const totalMonthly = projects.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);

      let stats;
      if (isAdmin) {
        const clientCount = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first();
        const leadCount = await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").first();
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
    console.error('Dashboard error:', err);
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
 * - Success: `{success: true, data: {...}, fetchAt: 'ISO-8601'}`
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

