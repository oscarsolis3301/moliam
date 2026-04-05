/**
 * Schema Migration — Submissions table upgrade (Runtime D1 binding)
 * POST /api/migrate-submissions
 * 
 * Adds service + budget_range columns to submissions if missing.
 * Only needs runtime D1 access, not CLI permissions.
 */

export async function onRequestPost(context) {
  const { env } = context;
  const db = env.MOLIAM_DB;
  
  try {
    // Check current schema
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='submissions'").all();
    
    if (tables.results.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "submissions table doesn't exist yet" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Try to add columns (IF NOT EXISTS silently skips if already present)
    await db.prepare(`
      ALTER TABLE submissions 
      ADD COLUMN IF NOT EXISTS service TEXT;
      
      ALTER TABLE submissions 
      ADD COLUMN IF NOT EXISTS budget_range TEXT;
    `).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: "Submissions table migrated successfully",
      columns_added: ["service", "budget_range"]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Migration failed:", err.message);
    return new Response(JSON.stringify({
      success: false,
      error: "Migration failed",
      details: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
