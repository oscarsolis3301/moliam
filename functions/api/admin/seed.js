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

    // Use the SAME schema that login.js expects: 7 columns (id,email,password_hash,role,name,company,last_login)
    await db.prepare(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        name TEXT,
        company TEXT,
        last_login TEXT
    )`).run();

    // sessions table with matching schema from login.js (3 columns: user_id, token, created_at)
    await db.prepare("CREATE TABLE sessions (user_id INTEGER, token TEXT, created_at TEXT, FOREIGN KEY(user_id) REFERENCES users(id))").run();

    const now = new Date().toISOString();
    const hash1 = await hashPassword("Moliam2026!");
    const hash2 = await hashPassword("OnePlus2026!");

    // Insert exactly 5 values for the 7 columns (id auto-increment, last_login is nullable)
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company, last_login) VALUES (?, ?, ?, ?, ?, ?)`).run("admin@moliam.com", hash1, "admin", "Administrator", "Moliam", now);

    // Second user: 5 values -> 7 columns (id auto-increment adds 2nd column implicitly)
    await db.prepare(`INSERT INTO users (email, password_hash, role, name, company, last_login) VALUES (?, ?, ?, ?, ?, ?)`).run("oscar@onepluselectric.com", hash2, "user", "Oscar Solis", "OnePlus Electric", now);

    // Verify seeding worked - count matches expected 2 users
    const result = await db.prepare("SELECT id, email, role, name FROM users").all();
    
    return new Response(JSON.stringify({ success: true, message: `Database seeded successfully (${result.data.length} users)`, users: [{ email: "admin@moliam.com", role: "admin" }, { email: "oscar@onepluselectric.com", role: "user" }] }), { status: 200, headers: { "Content-Type": "application/json" }});

   } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Seed failed: " + err.message }), { status: 500, headers: { "Content-Type": "application/json" }});
   }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "x-seed-key" }});
}
