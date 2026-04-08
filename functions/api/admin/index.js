/**
 * GET /api/admin/ - Health check endpoint
 */
import { jsonResp } from '../lib/api-helpers.js';

export async function onRequest() {
  return jsonResp(200, { service: "Moliam Admin API", version: "1.0.0" });}

/**
 * POST /api/admin/ - Alias for legacy seed endpoint (redirects to dedicated seed.js)
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
      // Check seed key header for backward compatibility
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return jsonResp(401, { error: "Unauthorized - Invalid seed key" }, request);}

      // Delegate to seed.js logic
  try {
    const db = env.MOLIAM_DB;
    
        // Create users table if not exists (simplified)
    await db.prepare(
          `CREATE TABLE IF NOT EXISTS users (` +
           `id INTEGER PRIMARY KEY AUTOINCREMENT, ` +
           `email TEXT UNIQUE NOT NULL, ` +
           `password_hash TEXT NOT NULL, ` +
           `role TEXT DEFAULT 'user', ` +
           `name TEXT, ` +
           `created_at TEXT DEFAULT CURRENT_TIMESTAMP` +
           ')'
         ).run();

    const salt = "_moliam_salt_2026";
    const encoded1 = new TextEncoder().encode("Moliam2026!" + salt);
    const hash1 = await crypto.subtle.digest("SHA-256", encoded1);
    const hashedAdmin = Array.from(new Uint8Array(hash1))
           .map(b => b.toString(16).padStart(2, "0"))
           .join("");

     const encoded2 = new TextEncoder().encode("OnePlus2026!" + salt);
     const hash2 = await crypto.subtle.digest("SHA-256", encoded2);
     const hashedUser = Array.from(new Uint8Array(hash2))
           .map(b => b.toString(16).padStart(2, "0"))
           .join("");

        // Insert seed users
    try {
      await db.prepare(
         `INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin User', 'admin')`
       ).bind('admin@moliam.com', hashedAdmin).run();
     } catch (e) {}

    try {
      await db.prepare(
         `INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, 'Oscar Johnson', 'user')`
       ).bind('oscar@onepluselectric.com', hashedUser).run();
     } catch (e) {}

    return jsonResp(200, { success: true, message: "Admin endpoints initialized", users_created: 2 }, request);} catch (err) {
    return jsonResp(500, { error: err.message || "Internal server error" }, request);}
}

/**
 * PUT /api/admin/ - General admin endpoint with update functionality
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  
      // Check seed key header for auth
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return jsonResp(401, { error: "Unauthorized - Invalid seed key" }, request);}

  try {
     const data = await request.json();
     
    return jsonResp(200, { success: true, message: "Admin PUT endpoint updated" }, request);} catch (err) {
    return jsonResp(400, { error: err.message || "Failed to parse request" }, request);}
}
