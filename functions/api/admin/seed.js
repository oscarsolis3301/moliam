import { hashPassword, jsonResp, corsResponse } from "../../lib/auth.js";

/** @type {Parameters<typeof onRequestPost>[0]} context - Cloudflare Pages context */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  if (request.method === "OPTIONS") return corsResponse(204);

  try {
    const seedKey = request.headers.get("x-seed-key");
    if (seedKey !== "moliam2026") {
      return jsonResp(403, { error: "Invalid seed key" });
       }

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

      // Try deleting existing seed users; ignore if table doesn't exist
    try {
      await db.prepare(
            "DELETE FROM users WHERE email IN ('admin@moliam.com', 'oscar@onepluselectric.com')"
          ).run();
        } catch {}

    const results = [];

      // STAGING DB SCHEMA: CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT unique, password_hash TEXT NOT NULL, role TEXT DEFAULT 'client', name TEXT) = 5 total columns, 4 data columns we INSERT
    try {
      await db.prepare(
            "INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)"
          ).bind("admin@moliam.com", adminHash, "admin", "Admin User").run();
      results.push({ email: "admin@moliam.com" });
       } catch (e) {
      console.warn("Admin seed failed:", e.message);

           // Try 3-column without role matching staging's actual schema
         try {
           await db.prepare(
                 "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)"
               ).bind("admin@moliam.com", adminHash, "Admin User").run();
           results.push({ email: "admin@moliam.com" });
           } catch(ignoreErr) {
             console.warn("3-col insert also failed:", ignoreErr.message);
           }
         }

           // Oscar with 4-column try first
    try {
      await db.prepare(
            "INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'client', ?)"
          ).bind("oscar@onepluselectric.com", oscarHash, "Oscar Johnson").run();
      results.push({ email: "oscar@onepluselectric.com" });
       } catch (e) {
         console.log("Oscar 4-col insert failed:", e.message);

             // Try 3-column without role for Oscar too
           try {
             await db.prepare(
                   "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)"
                 ).bind("oscar@onepluselectric.com", oscarHash, "Oscar Johnson").run();
             results.push({ email: "oscar@onepluselectric.com" });
           } catch(ignoreErr) {
             console.warn("Oscar 3-col insert also failed:", ignoreErr.message);
           }
         }

    return jsonResp(200, {
      success: true,
      message: results.length > 0 ? "Database seeded successfully" : "No users created (schema may be incompatible)",
      created: results.length,
      users: results,
        });
      } catch (err) {
    console.error("Seed error:", err);
    return jsonResp(500, { error: err.message });
         }
}

/** @type {Parameters<typeof onRequestOptions>[0]} context - Cloudflare Pages context */
export async function onRequestOptions() {
  return corsResponse(204);
}
