/**
 * POST /api/admin/seed - Creates initial users with x-seed-key header authentication
 * Call: curl -X POST https://moliam-staging.pages.dev/api/admin/seed -H "X-Seed-Key: moliam2026"
 */

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

  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Invalid seed key" }), { status: 401, headers: { "Content-Type": "application/json" }});
  }

  try {
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();

    const now = new Date().toISOString();

     // Match the ACTUAL D1 schema that login.js uses (9 columns: id,email,password_hash,role,name,company,is_active,last_login,created_at)
    await db.prepare(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        name TEXT,
        company TEXT,
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
     )`).run();

    // sessions table - match login.js schema (5 columns: id,user_id,token,expires_at,ip_address,user_agent)
    await db.prepare("CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))").run();

     // Insert admin and oscar with ALL 9 columns matching D1 schema
    await db.prepare("INSERT INTO users (id, email, password_hash, role, name, company, is_active, last_login, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(null, "admin@moliam.com", hash1, "admin", "Administrator", "Moliam", 1, now, now);

    await db.prepare("INSERT INTO users (id, email, password_hash, role, name, company, is_active, last_login, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(null, "oscar@onepluselectric.com", hash2, "user", "Oscar Solis", "OnePlus Electric", 1, now, now);

     // Verify seeding worked - return count from SELECT
    const result = await db.prepare("SELECT id, email, name, role, company FROM users").all();

    if (result.data.length !== 2) {
        throw new Error(`Expected 2 users, got ${result.data.length}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Database seeded successfully (${result.data.length} users)`, users: [{ email: "admin@moliam.com", role: "admin" }, { email: "oscar@onepluselectric.com", role: "user" }] }), { status: 200, headers: { "Content-Type": "application/json" }});

   } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Seed failed: " + err.message }), { status: 500, headers: { "Content-Type": "application/json" }});
   }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "x-seed-key" }});
}
