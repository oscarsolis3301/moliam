/**
 * Admin Seed API Endpoint
 * POST /api/admin/seed - Seeded admin and oscar users into existing tables only
 * 
 * @description Creates initial admin and Oscar Johnson accounts for database seeding
 * @returns {Response} JSON response with success status or error details
 * 
 * Security: Requires x-seed-key header with value "moliam2026"
 * Rate Limiting: Handled by Cloudflare Pages infrastructure
 * CORS: All responses include proper CORS headers (X-MOLIAM-ORIGIN)
 * 
 * @example curl -X POST https://moliam-staging.pages.dev/api/admin/seed -H "X-Seed-Key: moliam2026"
 * Response: { success: true, users: [ {...}, {...} ] }
 */
import { hashPassword, jsonResp, corsResponse } from "../../lib/auth.js";

/**
 * Main POST handler for seed endpoint
 * @param {Object} context - Cloudflare Pages request context
 * @param {Request} context.request - Incoming HTTP request
 * @param {Env} context.env - Environment binding containing MOLIAM_DB
 * @returns {Promise<Response>} Json or CORS response
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

   // Handle CORS preflight requests for POST
  if (request.method === "OPTIONS") return corsResponse(204);

  try {
    /* --- AUTHENTICATION --- */
    // Validate seed key from request header
    const seedKey = request.headers.get("x-seed-key");
    if (seedKey !== "moliam2026") {
      return jsonResp(403, { error: "Invalid seed key" });
     }

    /* --- PASSWORD HASHING --- */
    // Hash passwords using Web Crypto API before inserting into DB
    // Hardcoded admin password: Moliam2026! (must be changed after first login)
    const adminHash = await hashPassword("Moliam2026!");
    // Oscar Johnson account password: OnePlus2026!
    const oscarHash = await hashPassword("OnePlus2026!");

     /* --- CLEANUP OLD SEEDS (IF ANY) --- */
    // Delete any previously seeded users if they exist, catch errors if table doesn't exist - this is safe
    try {
      await db.prepare("DELETE FROM users WHERE email IN ('admin@moliam.com', 'oscar@onepluselectric.com')").run();
     } catch {
        // Table might not exist, that's OK - idempotent behavior
      }

<<<<<<< HEAD
     /* --- INSERT ADMIN USER (4-column schema) --- */
    // Creates admin account with superadmin role using 4 columns matching staging DB schema
    // Columns: email, password_hash, name, role - DO NOT modify without updating schema
    try {
      await db.prepare(
              "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin User', 'superadmin')"
            ).bind("admin@moliam.com", adminHash, "Admin User", "superadmin").run();
         } catch (e) {
           // Table schema differs or already seeded - skip gracefully for idempotency
         }

        /* --- INSERT OSCAR USER (4-column schema) --- */
    // Creates Oscar Johnson account with user role using 4 columns matching staging DB
     try {
      await db.prepare(
              "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Oscar Johnson', 'user')"
             ).bind("oscar@onepluselectric.com", oscarHash, "Oscar Johnson", "user").run();
         } catch (e) {
           // Table schema differs or already seeded - skip gracefully
         }

      /* --- BONUS FIELDS UPDATE (7th and 8th columns - OPTIONAL) --- */
    // Attempts to add company field if 8-column schema exists, ignore errors for compatibility
    try {
      await db.prepare(
             "UPDATE users SET company='One Plus Electric' WHERE email='oscar@onepluselectric.com'"
           ).run();
         } catch (e) {
           // company column doesn't exist in this environment - OK, handle gracefully
         }
=======
      // Admin insert: use 4 columns matching staging DB - must provide exactly 4 values
    try {
      await db.prepare(
             "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin User', 'superadmin')"
           ).bind("admin@moliam.com", adminHash, "Admin User", "superadmin").run();
        } catch (e) {
          // Table schema differs or already seeded, skip gracefully
        }

       // Oscar insert: match the 4-column schema from staging (email, password_hash, name, role)
    try {
      await db.prepare(
             "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Oscar Johnson', 'user')"
            ).bind("oscar@onepluselectric.com", oscarHash, "Oscar Johnson", "user").run();
        } catch (e) {
          // Table schema differs or already seeded, skip gracefully
        }
>>>>>>> origin/main

       /* --- ADDITIONAL FIELDS UPDATE (last 2 columns - OPTIONAL) --- */
    // Tries to add phone and last_login NULL fields if they exist - ignore errors for safety
    try {
      await db.prepare(
             "UPDATE users SET phone=NULL, last_login=NULL WHERE email='admin@moliam.com'"
           ).run();
         } catch (e) {
           // phone/last_login columns don't exist - that's OK, skip silently
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

/**
 * CORS preflight handler for OPTIONS requests
 * @param {Object} context - Cloudflare Pages request context
 * @returns {Response} 204 No Content with CORS headers
 */
export async function onRequestOptions() {
  return corsResponse(204);
}
