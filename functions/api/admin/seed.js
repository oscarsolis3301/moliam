import { hashPassword } from "../../lib/auth.js";

// Seed endpoint for Cloudflare Pages - uses Web Crypto API + CF D1 binding

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  try {
    // Check seed key header for authentication
    const seedKey = request.headers.get("x-seed-key");
    if (seedKey !== "moliam2026") {
      return new Response(JSON.stringify({ error: "Invalid seed key" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // DROP ALL tables to ensure clean state (including any migrations/other)
    await db.prepare('DROP TABLE IF EXISTS users').run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS submissions").run();
    await db.prepare("DROP TABLE IF EXISTS leads").run();
    await db.prepare("DROP TABLE IF EXISTS rate_limits").run();
    await db.prepare("DROP TABLE IF EXISTS client_profiles").run();
    await db.prepare("DROP TABLE IF EXISTS client_messages").run();
    await db.prepare("DROP TABLE IF EXISTS client_activity").run();

    // Create users table - matches login.js SELECT and INSERT schemas (id auto, email, password_hash, role, name, company, is_active, last_login)
    await db.prepare(
            "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT, is_active INTEGER DEFAULT 1, last_login TEXT)"
          ).run();

    // Create sessions table with all 6 columns (id auto-increment)  
    // id + user_id + token + expires_at + ip_address + user_agent = 5 insertable columns
    await db.prepare(
            "CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT)"
          ).run();

    // Create clients table (dashboard uses this + client_activity) - 6 columns
    // id + email + password_hash + name + role + company = 5 insertable + is_active default
    await db.prepare(
            "CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT DEFAULT '', role TEXT DEFAULT 'client', company TEXT)"
          ).run();

    // Create submissions, leads, rate_limits tables if needed by other endpoints
    await db.prepare("CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, company TEXT, message TEXT, user_agent TEXT, screen_resolution TEXT, lead_score INTEGER DEFAULT 0, category TEXT DEFAULT 'cold', submitted_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, first_name TEXT, last_name TEXT, phone TEXT, company TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_active INTEGER DEFAULT 1)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS rate_limits(id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT, request_count INTEGER DEFAULT 0, reset_at TEXT, UNIQUE(ip_address))").run();

    // Create client_profiles, client_messages, client_activity from dashboard system
    await db.prepare("CREATE TABLE IF NOT EXISTS client_profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id), display_name TEXT, bio TEXT, avatar_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS client_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), from_email TEXT, to_email TEXT, subject TEXT, message TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS client_activity(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), action_type TEXT, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

         // Insert admin user - uses positional parameters: (email, password_hash, role, name, company, is_active) = 6 values for 6 placeholders
    await db.prepare(
              "INSERT INTO users(email, password_hash, role, name, company, is_active)" + " VALUES(?, ?, 'admin', 'Admin Moliam.', 'Moliam', 1)")
            .run(["admin@moliam.com", adminHash]);

         // Insert oscar user - same schema using positional parameters: (email, hash, role, name, company, active) = 6 values for 6 placeholders  
    await db.prepare(
              "INSERT INTO users(email, password_hash, role, name, company, is_active)" + " VALUES(?, ?, 'client', 'Oscar Lin', 'OnePlus Electric', 1)")
            .run(["oscar@onepluselectric.com", oscarHash]);

      // Get user IDs and insert profiles (5 columns: user_id, display_name, bio, avatar_url, created_at). 
    const users = await db.prepare("SELECT id FROM users").all();
    for (const user of users.results) {
           // Insert 5 columns using default for created_at, empty string for avatar_url
      await db.prepare("INSERT INTO client_profiles(user_id, display_name, bio, avatar_url, created_at) VALUES(?, ?, ?, NULL, CURRENT_TIMESTAMP)")
                   .run([user.id, "Welcome to VisualArk", "Welcome!"]);
       }

    return new Response(JSON.stringify({
      success: true,
      message: "Database seeded successfully",
      users: [
          { email: "admin@moliam.com", role: "admin" },
         { email: "oscar@onepluselectric.com", role: "client" }
       ]
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
     });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
          });
  }
}
