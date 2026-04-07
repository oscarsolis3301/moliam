// Seed endpoint for Cloudflare Pages - Web Crypto API + CF D1 binding
const SALT = "_moliam_salt_2026";

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password + SALT);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
     .map(b => b.toString(16).padStart(2, "0"))
      .join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

     // Check seed key header authentication (required for security)  
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Invalid seed key" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
       });
     }

  try {
       // Drop existing tables to reset everything (ensure clean state for re-seeding)
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS users").run();

       // Create users table with minimal schema - 5 DATA COLUMNS after id/AI: email + password_hash + role + name + company  
    await db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT)`).run();

       // Create sessions table with NO auto-increment - 3 DATA COLUMNS matching login.js expectations: user_id + token + created_at
    await db.prepare(`CREATE TABLE sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)`).run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

       // Insert admin user - 5 VALUES matching CREATE: email + password_hash + role + name + company (NO id)  
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`).run("admin@moliam.com", adminHash, "admin", "Admin", "Moliam");

       // Insert oscar user - same 5 VALUES, same order  
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`).run("oscar@onepluselectric.com", oscarHash, "user", "Oscar", "OnePlus Electric");

       // Insert session record - use 4 COLUMNS matching sessions table: id + user_id + token + created_at (id must be provided! PK is INTEGER PRIMARY KEY NO AI)
    const now = new Date().toISOString();
    const randomToken = "***" + Math.random().toString(36);
    await db.prepare(`INSERT INTO sessions (id, user_id, token, created_at) VALUES (?, ?, ?, ?)`).run(1, 1, randomToken, now);

       // Validate by counting users - should be exactly 2 rows
    const result = await db.prepare("SELECT COUNT(*) as total FROM users").all();

    return new Response(JSON.stringify({
      success: true,
      message: "Users and sessions tables seeded successfully",
      user_count: result.data[0].total,
      users: [
           { email: "admin@moliam.com", role: "admin" },
           { email: "oscar@onepluselectric.com", role: "user" }
         ]
       }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
       });

     } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
       });
     }
}
