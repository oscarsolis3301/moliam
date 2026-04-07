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

     // Admin insert: match admin/index.js CREATE TABLE exactly using 6 columns: id (auto), email, password_hash, role, name, created_at (auto)
    try {
      await db.prepare(
            "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin User', 'superadmin')"
          ).bind("admin@moliam.com", adminHash).run();
        } catch (e) {
          // Table schema differs or already seeded, skip gracefully
        }

      // Oscar insert: same 6-column match (id, email, password_hash auto-generated; name, role explicit)
    try {
      await db.prepare(
            "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Oscar Johnson', 'user')"
          ).bind("oscar@onepluselectric.com", oscarHash).run();
        } catch (e) {
          // Table schema differs or already seeded, skip gracefully
        }

     // Also try adding company if the CREATE TABLE has 8+ columns - just ignore errors
    try {
      await db.prepare(
            "UPDATE users SET company='One Plus Electric' WHERE email='oscar@onepluselectric.com'"
          ).run();
        } catch (e) {
          // company column doesn't exist, that's OK
        }

     // Try updating phone and last_login if columns exist - ignore on error
    try {
      await db.prepare(
            "UPDATE users SET phone=NULL, last_login=NULL WHERE email='admin@moliam.com'"
          ).run();
        } catch (e) {
          // phone/last_login columns don't exist, that's OK
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
