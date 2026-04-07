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

  // Check seed key header
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Invalid seed key" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Drop existing tables to reset schema completely
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS users").run();

    // Recreate with minimal schema that D1 supports
    await db.prepare(
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT REFERENCES users(email),
        role TEXT DEFAULT 'user',
        name TEXT,
        company TEXT
      )`
    ).run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

    // Insert admin user - 5 values for 5 columns (id auto-increment)
    await db.prepare(
      `INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`
    ).run("admin@moliam.com", adminHash, "admin", "Admin", "Moliam");

    // Insert oscar user - 5 values for 5 columns (id auto-increment)
    await db.prepare(
      `INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)`
    ).run("oscar@onepluselectric.com", oscarHash, "user", "Oscar", "OnePlus Electric");

    // Simple sessions table with no FK constraint issues - 3 columns matching login.js expectations
    await db.prepare(
      `CREATE TABLE sessions (
        user_id INTEGER,
        token TEXT,
        created_at TEXT
      )`
    ).run();

    // Validate seeding - run final query to confirm tables exist
    const tables = await db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`
    ).all();

    return new Response(JSON.stringify({
      success: true,
      message: "Users and sessions tables seeded successfully",
      users: [
        { email: "admin@moliam.com", role: "admin" },
        { email: "oscar@onepluselectric.com", role: "user" }
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
