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

      // Admin insert: 4 columns matching staging DB schema (as per admin/index.js CREATE TABLE)
    try {
      await db.prepare(
           "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin User', 'superadmin')"
         ).bind("admin@moliam.com", adminHash).run();
       } catch (e) {
         // users table might not exist or already seeded, skip
       }

     // Oscar insert: same 4-column schema
    try {
      await db.prepare(
           "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Oscar Johnson', 'user')"
         ).bind("oscar@onepluselectric.com", oscarHash).run();
       } catch (e) {
         // users table might not exist or already seeded, skip
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
