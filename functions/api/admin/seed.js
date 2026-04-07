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
    return new Response(JSON.stringify({ error: "Invalid seed key" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  try {
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();

    const now = new Date().toISOString();

    // Create users table with schema that D1 actually uses (7 columns excluding auto-increment id)
    await db.prepare(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('superadmin', 'admin', 'client')),
      name TEXT,
      company TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // Create sessions table (6 columns: id+5 data=5 insert values)
    await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT, FOREIGN KEY (user_id) REFERENCES users(id))").run();

    // Hash passwords FIRST before inserting
    const hash_admin = await hashPassword("Moliam2026!");
    const hash_oscar = await hashPassword("OnePlus2026!");

    // Insert admin user: 6 columns (no id-AI), values in same order as CREATE TABLE columns after id
    const adminId = await db.prepare("INSERT INTO users (email, password_hash, role, name, company, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("admin@moliam.com", hash_admin, "admin", "Administrator", "Moliam", now);

    // Insert oscar user with same column order
    const oscarId = await db.prepare("INSERT INTO users (email, password_hash, role, name, company, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("oscar@onepluselectric.com", hash_oscar, "client", "Oscar Solis", "OnePlus Electric", now);

    // Insert sample session: 5 columns (no id-AI), match create order
    const sampleToken="***" + Math.random().toString(36).substring(2);
    const sampleExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare("INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(oscarId.lastInsertRowid, sampleToken, sampleExpiresAt, "192.168.1.1", "Chrome/120", now);

    // Verify seeding worked - return count from SELECT
    const result = await db.prepare("SELECT id, email, name, role, company FROM users").all();

    if (result.data.length !== 2) {
      throw new Error(`Expected 2 users, got ${result.data.length}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Database seeded successfully (${result.data.length} users)`, users: [{ email: "admin@moliam.com", role: "admin" }, { email: "oscar@onepluselectric.com", role: "client" }] }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Seed failed: " + err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "x-seed-key" }});
}
