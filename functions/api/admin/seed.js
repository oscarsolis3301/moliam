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

    await db.prepare(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        company TEXT,
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    await db.prepare("CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))").run();

    const now = new Date().toISOString();
    const hash1 = await hashPassword("Moliam2026!");
    const hash2 = await hashPassword("OnePlus2026!");

    await db.prepare("INSERT INTO users (name, email, password_hash, role, company, is_active, last_login, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind("Administrator", "admin@moliam.com", hash1, "admin", "Moliam", 1, now, now)
          .run();

    await db.prepare("INSERT INTO users (name, email, password_hash, role, company, is_active, last_login, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind("Oscar Solis", "oscar@onepluselectric.com", hash2, "user", "OnePlus Electric", 1, now, now)
          .run();

    const count = await db.prepare("SELECT COUNT(*) as cnt FROM users").all();
    
    return new Response(JSON.stringify({ success: true, message: `Database seeded successfully (${count.cnt} users)`, users: [{ email: "admin@moliam.com", role: "admin" }, { email: "oscar@onepluselectric.com", role: "user" }] }), { status: 200, headers: { "Content-Type": "application/json" }});

   } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Seed failed: " + err.message }), { status: 500, headers: { "Content-Type": "application/json" }});
   }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "x-seed-key" }});
}
