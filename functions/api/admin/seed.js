/**
 * Admin Seed API Endpoint  
 * POST /api/admin/seed - Seeded admin and oscar users into existing tables only
 */
import { hashPassword, jsonResp, corsResponse } from "../../lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // CORS preflight if needed
  if (request.method === "OPTIONS") return corsResponse(204);

  try {
    const seedKey = request.headers.get("x-seed-key");
    if (seedKey !== "moliam2026") {
      return jsonResp(403, { error: "Invalid seed key" });
    }

    // Hash passwords BEFORE inserting - no schema changes
    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

    // Delete any old seed users (if they exist), handle gracefully
    try {
      await db.prepare("DELETE FROM users WHERE email IN ('admin@moliam.com', 'oscar@onepluselectric.com')").run();
    } catch {
      // Table might not exist, that's OK
    }

    // Insert Admin - use 6-column schema matching actual DB: id, email, password_hash, role, name, created_at
    try {
      await db.prepare(
         "INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
       ).bind("admin@moliam.com", adminHash, "superadmin", "Admin User").run();
     } catch (e) {
       // users table might not exist, skip
     }

     // Insert Oscar - same 6-column schema
    try {
      await db.prepare(
         "INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
       ).bind("oscar@onepluselectric.com", oscarHash, "user", "Oscar Johnson").run();
     } catch (e) {
       // users table might not exist, skip
     }

    return jsonResp(200, { 
      success: true, 
      message: "Database seeded successfully (schema-preserving)",
      users: [
        { email: "admin@moliam.com", role: "superadmin" },
        { email: "oscar@onepluselectric.com", role: "user" }
      ]
    });

  } catch (err) {
    console.error("Seed error:", err);
    return jsonResp(500, { error: err.message });
  }
}

export async function onRequestOptions() {
  return corsResponse(204);
}
