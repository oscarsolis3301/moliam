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
    // DROP ALL existing tables to ensure clean state (including client_profiles/client_activity from dashboard)
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS submissions").run();
    await db.prepare("DROP TABLE IF EXISTS leads").run();
    await db.prepare("DROP TABLE IF EXISTS rate_limits").run();
    await db.prepare("DROP TABLE IF EXISTS client_profiles").run();
    await db.prepare("DROP TABLE IF EXISTS client_messages").run();
    await db.prepare("DROP TABLE IF EXISTS client_activity").run();
    // v3 schema tables - these might already exist in production, so just drop them if they do
    await db.prepare("DROP TABLE IF EXISTS contacts").run();
    await db.prepare("DROP TABLE IF EXISTS appointments").run();
    await db.prepare("DROP TABLE IF EXISTS reschedule_queue").run();

    // Schema v2 - clients table (dashboard uses this + client_activity)
    await db.prepare(
      "CREATE TABLE clients(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'client', company TEXT, is_active INTEGER DEFAULT 1)"
    ).run();

    // Create users table with all columns for login compatibility
    await db.prepare(
      "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'client', company TEXT, is_active INTEGER DEFAULT 1, last_login TEXT)"
    ).run();

    // Create sessions table - matches login.js schema (7 columns)
    await db.prepare(
      "CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT)"
    ).run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

     // Insert admin user (all 6 columns with placeholders + params for all)
    await db.prepare(
        "INSERT INTO users(email, password_hash, name, role, company, is_active) VALUES(?, ?, ?, ?, ?, ?)"
      ).run("admin@moliam.com", adminHash, "Admin", "admin", "Moliam", 1);

      // Insert oscar user (all 6 columns with placeholders + params for all)
    await db.prepare(
        "INSERT INTO users(email, password_hash, name, role, company, is_active) VALUES(?, ?, ?, ?, ?, ?)"
      ).run("oscar@onepluselectric.com", oscarHash, "Oscar", "client", "OnePlus Electric", 1);

    // Create clients table - uses in dashboard (schema v2 style)
    await db.prepare(
      "CREATE TABLE clients(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT DEFAULT '', role TEXT DEFAULT 'client', company TEXT, is_active INTEGER DEFAULT 1)"
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: "Database seeded successfully",
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
