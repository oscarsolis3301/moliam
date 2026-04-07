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
    // Clear everything for fresh seed - D1 might have stale schema/cached queries
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS users").run();

    // Create users table with all columns from schema.sql (backward compat with v3)
    await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('superadmin', 'admin', 'client')), company TEXT, phone TEXT, avatar_url TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_login TEXT)").run();

    // Create sessions table with all columns from schema.sql
    await db.prepare("CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, ip_address TEXT, user_agent TEXT, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

    // Insert admin user - D1 supports positional args to .bind()
    await db.prepare("INSERT INTO users(email, password_hash, name, role) VALUES(?, ?, ?, ?)").bind("admin@moliam.com", adminHash, "Admin", "superadmin").run();

     // Insert oscar user - same pattern (D1 positional args), id auto-incremented
    await db.prepare("INSERT INTO users(email, password_hash, name, role) VALUES(?, ?, ?, ?)").bind("oscar@onepluselectric.com", oscarHash, "Oscar", "client").run();

     // Debug check: verify the data actually got inserted
    const usersResult = await db.prepare("SELECT COUNT(*) as count FROM users").all();
    
    // Insert test sessions - 6 VALUES for 6 columns (id is auto-increment PK)
    await db.prepare("INSERT INTO sessions(token, expires_at, created_at, ip_address, user_agent, user_id) VALUES(?, datetime('now', '+30 days'), datetime('now'), ?, ?, ?)").bind('test-session-1', 'host.docker.internal', 'Mozilla/5.0 Test Browser', 1).run();
    await db.prepare("INSERT INTO sessions(token, expires_at, created_at, ip_address, user_agent, user_id) VALUES(?, datetime('now', '+30 days'), datetime('now'), ?, ?, ?)").bind('test-session-2', 'host.docker.internal', 'Mozilla/5.0 Test Browser', 2).run();

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
