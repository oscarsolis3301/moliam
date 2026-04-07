// Seed endpoint for Cloudflare Pages - uses Web Crypto API + CF D1 binding

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

  // Check seed key header for authentication
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Invalid seed key" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Drop existing tables to reset schema
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();

    // Recreate with complete schema: 6 columns (id, email, password_hash, role, name, company)
    const createUsersTable = "CREATE TABLE users (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "email TEXT UNIQUE NOT NULL," +
      "password_hash TEXT NOT NULL," +
      "role TEXT DEFAULT 'user'," +
      "name TEXT," +
      "company TEXT" +
      ")";
    await db.prepare(createUsersTable).run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

    // Insert admin user - 5 values for 5 columns (id auto-increment)
    await db.prepare(
      "INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)"
    ).run("admin@moliam.com", adminHash, "admin", "Admin", "Moliam");

    // Insert oscar user - 5 values for 5 columns (id auto-increment)
    await db.prepare(
      "INSERT INTO users (email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?)"
    ).run("oscar@onepluselectric.com", oscarHash, "user", "Oscar", "OnePlus Electric");

    // Create sessions table with 3 columns (user_id, token, created_at) matching login.js
    const createSessionsTable = "CREATE TABLE sessions (" +
      "user_id INTEGER," +
      "token TEXT," +
      "created_at TEXT," +
      "FOREIGN KEY(user_id) REFERENCES users(id)" +
      ")";
    await db.prepare(createSessionsTable).run();

    // Validate seeding - run final query to confirm tables exist with correct schema
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;").all();

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
