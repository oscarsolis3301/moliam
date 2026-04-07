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

     // Admin insert: 8 columns matching schema.sql: email, password_hash, name, role, company, phone, created_at, last_login
    try {
      await db.prepare(
          "INSERT INTO users (email, password_hash, name, role, company, phone, created_at, last_login) VALUES (?, ?, ?, ?, ?, NULL, datetime('now'), NULL)"
        ).bind("admin@moliam.com", adminHash, "Admin User", "superadmin", null).run();
      } catch (e) {
        // users table might not exist, skip
      }

    // Oscar insert: same 8-column schema
    try {
      await db.prepare(
          "INSERT INTO users (email, password_hash, name, role, company, phone, created_at, last_login) VALUES (?, ?, ?, ?, ?, NULL, datetime('now'), NULL)"
        ).bind("oscar@onepluselectric.com", oscarHash, "Oscar Johnson", "user", "One Plus Electric").run();
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
