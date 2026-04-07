/**
 * /api/admin/projects/:id
 * PATCH — update project fields (status, etc.)
 */

export async function onRequestPatch(context) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.match(/moliam_session=([a-f0-9]+)/);
  const token = match ? match[1] : null;

  if (!token) return jsonResp(401, { error: "Not authenticated." }, request);

  const db = env.MOLIAM_DB;
  const session = await db.prepare(
      "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1"
    ).bind(token).first();

  if (!session) return jsonResp(401, { error: "Not authenticated." }, request);
  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { error: "Admin access required." }, request);

  const projectId = parseInt(params.id);

  if (!projectId) {
    return jsonResp(400, { error: "Invalid project ID." }, request);
  }

  const authedSession = session;

  let data;
  try { data = await request.json(); } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." }, request);
  }

  try {
    // Verify project exists
    const project = await db.prepare("SELECT id, name FROM projects WHERE id = ?").bind(projectId).first();
    if (!project) {
      return jsonResp(404, { error: true, message: "Project not found." }, request);
    }

    const updates = [];
    const binds = [];

    // Status update
    if (data.status !== undefined) {
      const validStatuses = ["onboarding", "in_progress", "review", "active", "paused", "completed"];
      if (!validStatuses.includes(data.status)) {
        return jsonResp(400, { error: true, message: `Status must be one of: ${validStatuses.join(", ")}` }, request);
      }
      updates.push("status = ?");
      binds.push(data.status);
    }

    // Monthly rate update
    if (data.monthly_rate !== undefined) {
      updates.push("monthly_rate = ?");
      binds.push(parseFloat(data.monthly_rate) || 0);
    }

    // Notes update
    if (data.notes !== undefined) {
      updates.push("notes = ?");
      binds.push(data.notes);
    }

    if (updates.length === 0) {
      return jsonResp(400, { error: true, message: "No valid fields to update." }, request);
     }

           // SECURITY: Only allowed field names are pushed to updates array via conditional block above
           // uses parameter binding (.bind(...binds)) for all values
    updates.push("updated_at = datetime('now')");
    binds.push(projectId);

    await db.prepare(
      `UPDATE projects SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...binds).run();

    // If status changed, log it as an update
    if (data.status) {
      await db.prepare(
        "INSERT INTO project_updates (project_id, title, description, type) VALUES (?, ?, ?, 'update')"
      ).bind(projectId, `Status → ${data.status.replace('_', ' ')}`, `Project status changed to ${data.status.replace('_', ' ')}.`).run();
    }

    return jsonResp(200, {
      success: true,
      message: `Project updated.`,
    }, request);

  } catch (err) {
    console.error("Update project error:", err);
    return jsonResp(500, { error: true, message: "Server error." }, request);
  }
}

export async function onRequestOptions() {
  return corsResponse(204);
}

// ── Shared helpers ──

async function requireAdmin(request, env) {
  const token = getSessionToken(request);
  if (!token) return jsonResp(401, { error: true, message: "Not authenticated." }, request);
  const db = env.MOLIAM_DB;
  const session = await db.prepare(
    "SELECT u.id, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.is_active = 1 AND s.expires_at > datetime('now')"
  ).bind(token).first();
  if (!session) return jsonResp(401, { error: true, message: "Session invalid." }, request);
  if (session.role !== "admin" && session.role !== "superadmin") return jsonResp(403, { error: true, message: "Admin only." }, request);
  return session;
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

function corsResponse(status) {
  return new Response(null, { status, headers: {
    "Access-Control-Allow-Origin": "https://moliam.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  }});
}

function jsonResp(status, body, request) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": request ? getAllowedOrigin(request) : "https://moliam.pages.dev",
    "Access-Control-Allow-Credentials": "true",
  }});
}
