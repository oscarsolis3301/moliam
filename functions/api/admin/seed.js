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

      // Match the ACTUAL D1 schema that login.js uses (8 columns: id,email,password_hash,role,name,company,created_at)
    await db.prepare(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('superadmin', 'admin', 'client')),
        name TEXT,
        company TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
       )`).run();

      // sessions table - exactly 5 insertable columns: user_id,token,expires_at,ip_address,user_agent (id auto-incremented)
    await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT, FOREIGN KEY (user_id) REFERENCES users(id))").run();

    // Hash passwords using hashPassword(), then insert BOTH users with ALL 7 columns matching D1 schema (auto-increment id)
    const hash_admin = await hashPassword("Moliam2026!");
    const hash_oscar = await hashPassword("OnePlus2026!");

     await db.prepare("INSERT INTO users (email, password_hash, role, name, company, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(hash_admin, "admin@moliam.com", "admin", "Administrator", "Moliam", now);
    await db.prepare("INSERT INTO users (email, password_hash, role, name, company, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(hash_oscar, "oscar@onepluselectric.com", "user", "Oscar Solis", "OnePlus Electric", now);

    // Insert a session - columns: id(AI),user_id,token,expires_at,ip_address,user_agent = 6 cols, insert 5 values (no id)
    const sampleToken="***" + Math.random().toString(36).substring(2);
    const sampleExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare("INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)").run(2, sampleToken, sampleExpiresAt, "192.168.1.1", "Mozilla/5.0");


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
