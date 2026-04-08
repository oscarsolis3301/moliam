/**
 * MOLIAM Follow-Up Sequence — CloudFlare Pages Functions v3
 * GET /api/followup — returns all leads needing follow-up (submitted > 5min ago, no follow-up sent)
 * POST /api/followup — marks a lead as followed-up, stores timestamp
 */

/**
 * Handle GET requests to retrieve follow-up queue - list submissions pending follow-up (>5min old, no follow_up_at set)
 * @param {object} context - Cloudflare Pages function context with request and env.MOLIAM_DB binding
 * @returns {Response} JSON response with array of leads needing follow-up or error message about DB/connection issues
 */
export async function onRequestGet(context) {
  
  if (!db) return jsonResp(500, { error: true, message: "Database not bound" });

  try {
    // --- Ensure submissions table has follow_up columns ---
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending'").run();
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_at TEXT").run();

    // Get all submissions pending follow-up (submitted > 5min, no follow_up_at timestamp)
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const results = await db.prepare(
        "SELECT s.id, s.name, s.email, s.phone, s.company, s.message, s.lead_score, s.category, s.created_at, " +
            "s.follow_up_status, s.follow_up_at, l.status as lead_status " +
        "FROM submissions s " +
        "LEFT JOIN leads l ON l.submission_id = s.id " +
        "WHERE (julianday(?) - julianday(s.created_at)) * 86400 > 300 AND s.follow_up_at IS NULL " +
        "ORDER BY s.created_at ASC"
      ).bind(new Date().toISOString()).all();

    return jsonResp(200, {
      success: true,
      count: results.results.length,
      leads: results.results
         ? results.results.map(r => ({
             id: r.id,
             name: r.name,
             email: r.email,
             phone: r.phone,
             company: r.company,
             message: r.message,
             leadScore: r.lead_score,
             category: r.category,
             createdAt: r.created_at,
             followUpStatus: r.follow_up_status,
             submitTime: r.created_at
           }))
         : [],
      fetchAt: new Date().toISOString()
    });

  } catch (err) {
    console.error("GET /api/followup error:", err);
    return jsonResp(500, { error: true, message: "Database query failed", details: err.message });
  }
}

/**
 * Handle POST requests to mark leads as followed-up - stores follow-up timestamp and updates status to completed
 * @param {object} context - Cloudflare Pages function context with request and env.MOLIAM_DB binding
 * @returns {Response} JSON response with success/status and lead ID that was marked followed-up, or 400/500 errors for validation/DB issues
 */
export async function onRequestPost(context) {
  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON body" });
  }

  const leadId = data.lead_id;
  if (!leadId || typeof leadId !== 'number') {
    return jsonResp(400, { error: true, message: "Valid lead_id (integer) required" });
   }

  try {
    // --- Ensure submissions table has follow_up columns ---
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending'").run();
    await db.prepare("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS follow_up_at TEXT").run();

    const now = new Date().toISOString();
    
    // Mark this lead as followed up with timestamp
    const result = await db.prepare(
        "UPDATE submissions SET follow_up_status = 'completed', follow_up_at = ? WHERE id = ?"
      ).bind(now, leadId).run();

    if (result.changes.length === 0 || result.meta.last_row_id !== leadId) {
      return jsonResp(404, { error: true, message: "Lead not found or already followed up" });
     }

    // Optional: Update related leads table
    try {
      await db.prepare("UPDATE leads SET follow_up_at = ?, status = 'followed' WHERE submission_id = ?")
         .bind(now, leadId).run();
     } catch {}

    return jsonResp(200, {
      success: true,
      message: "Lead marked as followed up",
      leadId: leadId,
      followUpAt: now,
    });

  } catch (err) {
    console.error("POST /api/followup error:", err);
    return jsonResp(500, { error: true, message: "Database update failed", details: err.message });
  }
}

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
