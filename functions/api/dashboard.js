/**
 * GET /api/dashboard
 * Returns current user's projects + recent updates
 * Works for both clients (see own stuff) and admins (see everything)
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { error: true, message: "Not authenticated." }, request);

  try {
    const session = await db.prepare(
      "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"
    ).bind(token).first();

    if (!session) return jsonResp(401, { error: true, message: "Session invalid." }, request);

    const isAdmin = session.role === "admin" || session.role === "superadmin";

    // Get projects
    let projects;
    if (isAdmin) {
      const result = await db.prepare(
        `SELECT p.*, u.name as client_name, u.company as client_company
        FROM projects p JOIN users u ON p.user_id = u.id
        ORDER BY p.updated_at DESC`
      ).all();
      projects = result.results;
    } else {
      const result = await db.prepare(
        "SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
      ).bind(session.id).all();
      projects = result.results;
    }

    // Get recent updates for user's projects
    const projectIds = projects.map(p => p.id);
    let updates = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => "?").join(",");
      const result = await db.prepare(
        `SELECT pu.*, p.name as project_name FROM project_updates pu
        JOIN projects p ON pu.project_id = p.id
        WHERE pu.project_id IN (${placeholders})
        ORDER BY pu.created_at DESC LIMIT 20`
      ).bind(...projectIds).all();
      updates = result.results;
    }

    // Stats
    const activeProjects = projects.filter(p => ["active", "in_progress"].includes(p.status)).length;
    const totalMonthly = projects.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);

    let stats;
    if (isAdmin) {
      const clientCount = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first();
      const leadCount = await db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").first();
      stats = {
        total_clients: clientCount.c,
        active_projects: activeProjects,
        monthly_revenue: totalMonthly,
        new_leads: leadCount.c,
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
      user: { id: session.id, name: session.name, email: session.email, role: session.role, company: session.company },
      projects,
      updates,
      stats,
    }, request);

  } catch (err) {
    console.error("Dashboard error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  }});
}

function getSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) return origin;
  return "https://moliam.pages.dev";
}

function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
    "Access-Control-Allow-Credentials": "true",
  }});
}
