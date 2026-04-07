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
    // Use IF NOT EXISTS for safe re-creation (no data loss if tables exist)
     // Also ALTER ADD COLUMN pattern to add missing columns if schema was deployed differently

     // First create users table with all 11 required columns matching moliam/schema.sql
    await db.prepare("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('superadmin', 'admin', 'client')), company TEXT, phone TEXT, avatar_url TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_login TEXT)").run();

     // Create sessions table with all columns from schema.sql
    await db.prepare("CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, ip_address TEXT, user_agent TEXT)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

// Insert admin user - email + 10 OTHERS (id auto-incremented)
    await db.prepare("INSERT INTO users(email, password_hash, name, role) VALUES(?, ?, ?, ?)").run("admin@moliam.com", adminHash, "Admin", "superadmin");

      // Insert oscar user - same pattern (email + 10 OTHERS), id auto-incremented
    await db.prepare("INSERT INTO users(email, password_hash, name, role) VALUES(?, ?, ?, ?)").run("oscar@onepluselectric.com", oscarHash, "Oscar", "client");

        // Debug check: verify the data actually got inserted
    const usersResult = await db.prepare("SELECT COUNT(*) as count FROM users").all();
    
    // Insert test sessions - 2 sessions with correct column count (7 columns: id,user_id,token,expires_at,created_at,ip_address,user_agent)
    await db.prepare("INSERT INTO sessions(user_id, token, expires_at, created_at, ip_address, user_agent) VALUES(1, 'test-session-1', datetime('now', '+30 days'), datetime('now'), 'host.docker.internal', 'Mozilla/5.0 Test Browser')").run();
    await db.prepare("INSERT INTO sessions(user_id, token, expires_at, created_at, ip_address, user_agent) VALUES(2, 'test-session-2', datetime('now', '+30 days'), datetime('now'), 'host.docker.internal', 'Mozilla/5.0 Test Browser')").run();
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
