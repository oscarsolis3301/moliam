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
        // Ensure clean slate with strong drop syntax
    try { await db.prepare("DROP TABLE IF EXISTS sessions").run(); } catch(e){}
    try { await db.prepare("DROP TABLE IF EXISTS users").run(); } catch(e){}

// Create users table - 5 data columns: email + password_hash + role + name + company   
    await db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'client', name TEXT, company TEXT)`).run();

     // Create sessions table - D1 requires all columns provided (session_id is INTEGER PRIMARY KEY which acts like auto-inc)
    try { await db.prepare("DROP TABLE sessions").run(); } catch(e){}
    await db.prepare(`CREATE TABLE sessions (session_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)`).run();

// Session: D1 requires all 4 columns provided (session_id is NOT auto-incremented like regular tables)
    const now = new Date().toISOString();
    const tokenStr="***" + Math.random().toString(36).substring(2);
  // Insert all 4 columns explicitly since D1 doesn't auto-generate INTEGER PRIMARY KEY for sessions
    await db.prepare(`INSERT INTO sessions (session_id, user_id, token, created_at) VALUES (?, ?, ?, ?)`).run(1, 1, tokenStr, now);

// Admin & Oscar seeding - both use same 5-column INSERT: email, password_hash, role, name, company (no id, D1 auto-generates it)
    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`).run("admin@moliam.com", adminHash, "admin", "Admin", "Moliam");
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`).run("oscar@onepluselectric.com", oscarHash, "client", "Oscar", "OnePlus Electric");

// Validate by counting users - should be exactly 2 rows
    const result = await db.prepare("SELECT COUNT(*) as total FROM users").all();
    return new Response(JSON.stringify({      success: true,
      message: "Users and sessions tables seeded successfully",
      user_count: result.data[0].total,
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
