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
     // DROP ALL tables to ensure clean state (including any migrations/other)
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS submissions").run();
    await db.prepare("DROP TABLE IF EXISTS leads").run();
    await db.prepare("DROP TABLE IF EXISTS rate_limits").run();
    await db.prepare("DROP TABLE IF EXISTS client_profiles").run();
    await db.prepare("DROP TABLE IF EXISTS client_messages").run();
    await db.prepare("DROP TABLE IF EXISTS client_activity").run();

      // Create users table - matches login.js SELECT and INSERT schemas (9 columns: id auto, email, password_hash, role, name, company, is_active, last_login)
    await db.prepare(
        "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT, is_active INTEGER DEFAULT 1, last_login TEXT)"
      ).run();

     const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

      // Insert admin user - matches login.js INSERT (7 columns + 2 optional)
    await db.prepare(
        "INSERT INTO users(email, password_hash, role, name, company, is_active) VALUES(?, ?, 'admin', 'Admin', 'Moliam', 1)"
      ).run(adminHash);

     // Insert oscar user - same schema (7 columns + 2 optional)  
    await db.prepare(
        "INSERT INTO users(email, password_hash, role, name, company, is_active) VALUES(?, ?, 'client', 'Oscar', 'OnePlus Electric', 1)"
      ).run(oscarHash);

      // Create sessions table - matches login.js INSERT exactly (6 columns: id auto, user_id, token, expires_at, ip_address, user_agent)
    await db.prepare(
        "CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT)"
      ).run();

  return new Response(JSON.stringify({
      success: true,
      message: "Database seeded successfully",
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
