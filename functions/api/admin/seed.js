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
    // Full cleanup - force drop all tables without IF EXISTS check, then recreate from scratch
    const drop1 = await db.prepare("DROP TABLE users").execute();
    const drop2 = await db.prepare("DROP TABLE sessions").execute();

    // Create users table - columns: id (auto-increment), email, password_hash, role, name, company
    await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

     // Insert admin user - 5 data columns (email, password_hash, role, name, company) = 5 placeholders = CORRECT

    await db.prepare("INSERT INTO users(email, password_hash, role, name, company) VALUES(?, ?, ?, ?, ?)").run("admin@moliam.com", adminHash, "admin", "Admin", "Moliam");

     // Insert oscar user - same 5 columns, all parameters correct
    await db.prepare("INSERT INTO users(email, password_hash, role, name, company) VALUES(?, ?, ?, ?, ?)").run("oscar@onepluselectric.com", oscarHash, "client", "Oscar", "OnePlus Electric");

     // Debug check: verify the data actually got inserted
    const usersResult = await db.prepare("SELECT COUNT(*) as count FROM users").all();

    // Create sessions table - columns: id (auto-increment), user_id, token, created_at
    await db.prepare("CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)").run();

     // Debug: insert session with correct column count = 3 VALUES for user_id, token, created_at (id is autoincrement)
     try {
       const sess1 = await db.prepare("INSERT INTO sessions(user_id, token, created_at) VALUES(?, ?, ?)").run(1, "session-token-1", new Date().toISOString());
       const sess2 = await db.prepare("INSERT INTO sessions(user_id, token, created_at) VALUES(?, ?, ?)").run(2, "session-token-2", new Date().toISOString());
     } catch (err) {
       // If there's a column mismatch error, let the outer try-catch handle it with full error message
       throw err;
     }

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
