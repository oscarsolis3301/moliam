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

      // Create users table with minimal schema compatible with D1 - exact column matching in INSERT
    await db.prepare(
        `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT)`
      ).run();

      // Create sessions table with EXACTLY matching columns to what login.js expects (3 columns)  
    await db.prepare(
        `CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, token TEXT NOT NULL)`
      ).run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

      // Insert admin user - 5 VALUES matching CREATE columns: email + password_hash + role + name + company (NO id, auto-increment)  
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`).run("admin@moliam.com", adminHash, "admin", "Admin", "Moliam");

      // Insert oscar user - same 5 VALUES, same order
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`).run("oscar@onepluselectric.com", oscarHash, "user", "Oscar", "OnePlus Electric");

      // Insert session record with 2 DATA COLUMNS matching sessions table: user_id + token (no id/AI) - match the CREATE TABLE perfectly  
    await db.prepare(`INSERT INTO sessions (user_id, token) VALUES (?, ?)`).run(1, "***" + Math.random().toString(36).substring(2));

      // Validate by counting users successfully - confirm 2 rows exist
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
