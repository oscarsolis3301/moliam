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
       // Drop and recreate all tables to match production schema exactly
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS users").run();

       // Create users table - exact schema from production (no email unique, simpler)
    await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client', company TEXT, phone TEXT, avatar_url TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_login TEXT)").run();

      // Create sessions table - production schema (4 columns: id, user_id, token, created_at)
    await db.prepare("CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

       // Insert admin user - match all columns exactly (id auto-incremented)
 await db.prepare(`INSERT INTO users(name, email, password_hash, role, company) VALUES(:name, :email, :password, :role, :company)`).bind({ name: "Admin", email: "admin@moliam.com", password: adminHash, role: "superadmin", company: "Moliam" }).run();

       // Insert oscar user - same pattern (id auto-incremented)
await db.prepare(`INSERT INTO users(name, email, password_hash, role, company) VALUES(:name, :email, :password, :role, :company)`).bind({ name: "Oscar", email: "oscar@onepluselectric.com", password: oscarHash, role: "client", company: "OnePlus Electric" }).run();

     // Get actual user IDs from inserted users
  const allUsers = await db.prepare("SELECT id, email FROM users ORDER BY role DESC").all();
const adminUser = allUsers.results.find(u => u.email === "admin@moliam.com");

           // Insert test session with production schema (3 columns - matches login.js)
   if (adminUser) await db.prepare(`INSERT INTO sessions(user_id, token, created_at) VALUES(?, ?, datetime('now'))`).bind(adminUser.id, "test-session-1").run();

                  // Insert oscar's session - same 3-column pattern as login.js
   const oscarUser = allUsers.results.find(u => u.email === "oscar@onepluselectric.com");
   if (oscarUser) await db.prepare(`INSERT INTO sessions(user_id, token, created_at) VALUES(?, ?, datetime('now'))`).bind(oscarUser.id, "test-session-2").run();

    return new Response(JSON.stringify({
      success: true,
      message: "Users and sessions tables seeded successfully",
      users: [
          { email: "admin@moliam.com", role: "superadmin" },
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
