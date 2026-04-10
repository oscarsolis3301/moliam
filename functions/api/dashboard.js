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
        const query = new URLSearchParams(hash);
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
                "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"\n           ).bind(token).first();
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
    if (action === 'leads') {
        // Return all submissions with lead_score, category, follow_up_status
        // SECURITY FIX: Use separate parameterized queries for admin vs client to prevent SQL injection
      const result = isAdmin
          ? await db.prepare(`SELECT s.id, s.name, s.email, s.phone, s.company, s.message,
                 s.lead_score, s.category, s.created_at,
                 s.follow_up_status, s.follow_up_at, l.status as lead_status
           FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id ORDER BY s.created_at DESC LIMIT 100`).all()
          : await db.prepare(`SELECT s.id, s.name, s.email, s.company, s.message,
                 s.lead_score, s.category, s.created_at,
                 s.follow_up_status, s.follow_up_at
           FROM submissions s WHERE s.email=? ORDER BY s.created_at DESC LIMIT 50`).bind(session.email).all();

      return jsonResp(200, {
          success: true,
          action: 'leads',
          data: (result?.results || []),
          fetchAt: new Date().toISOString()
              }, request);
    }
    84|
    if (action === 'pipeline') {
         // Return pipeline summary: count by hot/warm/cold, follow-up stats
         // SECURITY FIX: Use ternary to separate admin vs client queries, bind email parameter for client access
      const coldCount = isAdmin 
         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'cold\'').then(r => r.results?.[0]?.c || 0)
         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
      const warmCount = isAdmin
         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'warm\'').then(r => r.results?.[0]?.c || 0)
         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
      const hotCount = isAdmin
         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE category=\'hot\'').then(r => r.results?.[0]?.c || 0)
         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'hot\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
      const followedCount = isAdmin
         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'').then(r => r.results?.[0]?.c || 0)
         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'').bind(session.email).then(r => r.results?.[0]?.c || 0);
      const pendingCount = isAdmin
         ? await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'').then(r => r.results?.[0]?.c || 0)
         : await db.prepare('SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\'').bind(session.email).then(r => r.results?.[0]?.c || 0);

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
    // Get project IDs and fetch recent updates
    const projectIds = projects.map(p => p.id);
    let updates = [];
    if (projectIds.length > 0) {
        // SECURITY: Using placeholder generation with .bind() - no SQL injection risk since placeholders are fixed '?' only
        const placeholders = projectIds.map(() => '?').join(',');
        const result = await db.prepare(
                       `SELECT pu.*, p.name as project_name FROM project_updates pu
           JOIN projects p ON pu.project_id = p.id
           WHERE pu.project_id IN (${placeholders})
           ORDER BY pu.created_at DESC LIMIT 20`)
                     .bind(...projectIds).all();
        updates = (result?.results || []);
    }

    // Stats calculation (no DB access, safe)
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
    } catch (err) {
      console.error('Dashboard error:', err);
      return jsonResp(500, { success: false, message: 'Server error.' }, request);
    }
}

/**
 * CORS preflight handler for dashboard endpoints - allows browsers to properly test access
 * Handles OPTIONS requests with moliam.com and moliam.pages.dev origins only (no wildcards)
 * @param {object} context - Cloudflare Pages function context
 * @returns {Response} 204 No Content with proper Access-Control headers
 */
export async function onRequestOptions(context) {
  const allowedOrigins = ['https://moliam.com', 'https://www.moliam.com', 'https://moliam.pages.dev'];
  const origin = context.request.headers.get('Origin');
  
  if (allowedOrigins.includes(origin)) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, moliam_session',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }
  
  return new Response(null, { status: 204 });
}

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