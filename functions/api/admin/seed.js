// Seed endpoint for Cloudflare Pages - uses Web Crypto API + CF D1 binding

const SALT = "_moliam_salt_2026";

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password + SALT);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

    // Check seed key header for authentication
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Invalid seed key" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
      });
    }

  try {
      // Drop existing tables to reset schema
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();

      // Create users table - columns: id (auto-increment), email, password_hash, role, name, company
    await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

      // Insert admin user - use correct SQL with 5 placeholders (no id, it's auto-incremented)
    await db.prepare("INSERT INTO users(email, password_hash, role, name, company) VALUES(?, ?, ?, ?, ?)").run("admin@moliam.com", adminHash, "admin", "Admin", "Moliam");

      // Insert oscar user - use correct SQL with 5 placeholders (no id, it's auto-incremented)
    await db.prepare("INSERT INTO users(email, password_hash, role, name, company) VALUES(?, ?, ?, ?, ?)").run("oscar@onepluselectric.com", oscarHash, "client", "Oscar", "OnePlus Electric");

      // Create sessions table — match login.js schema (5 columns)
    await db.prepare("CREATE TABLE sessions(user_id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT)").run();

    return new Response(JSON.stringify({
      success: true,
      message: "Users and sessions tables seeded successfully",
      users: [
             { email: "admin@moliam.com", role: "admin" },
             { email: "oscar@onepluselectric.com", role: "client" }
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
