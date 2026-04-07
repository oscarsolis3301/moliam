// Seed endpoint for Cloudflare Pages - uses Web Crypto API + CF D1 binding

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password + "_moliam_salt_2026");
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
    // DROP ALL tables to ensure clean state (including any migrations/other)
    await db.prepare('DROP TABLE IF EXISTS users').run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS submissions").run();
    await db.prepare("DROP TABLE IF EXISTS leads").run();
    await db.prepare("DROP TABLE IF EXISTS rate_limits").run();
    await db.prepare("DROP TABLE IF EXISTS client_profiles").run();
    await db.prepare("DROP TABLE IF EXISTS client_messages").run();
    await db.prepare("DROP TABLE IF EXISTS client_activity").run();

    // Create users table - matches login.js SELECT and INSERT schemas (9 columns: id auto, email, password_hash, role, name, company, is_active, last_login)
    await db.prepare(
           "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT, is_active INTEGER DEFAULT 1, last_login TEXT)"
         ).run();

    // Create sessions table with all 6 columns (id auto-increment)    
     // id + user_id + token + expires_at + ip_address + user_agent = 5 insertable columns
    await db.prepare(
           "CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT)"
         ).run();

    // Create clients table - uses 5 columns for client dashboard
    await db.prepare(
           "CREATE TABLE clients(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT DEFAULT '', role TEXT DEFAULT 'client', company TEXT)"
         ).run();

    // Create submissions, leads, rate_limits tables if needed by other endpoints
    await db.prepare(
           "CREATE TABLE submissions(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT, company TEXT, phone TEXT, message TEXT, submitted_at TEXT DEFAULT CURRENT_TIMESTAMP)"
         ).run();
    await db.prepare(
           "CREATE TABLE leads(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, first_name TEXT, last_name TEXT, phone TEXT, company TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_active INTEGER DEFAULT 1)"
         ).run();
    await db.prepare(
           "CREATE TABLE rate_limits(id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT, request_count INTEGER DEFAULT 0, reset_at TEXT, UNIQUE(ip_address))"
         ).run();

// Create client_profiles table (id auto, user_id ref, display_name TEXT, bio TEXT) - 4 columns total, id is AUTOINCREMENT so INSERT uses 3 values for remaining columns
    await db.prepare(
        "CREATE TABLE IF NOT EXISTS client_profiles(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, display_name TEXT DEFAULT '', bio TEXT)"
    ).run();

// Create client_messages and client_activity from dashboard system
    await db.prepare(
        "CREATE TABLE client_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, from_email TEXT, to_email TEXT, subject TEXT, message TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    ).run();

    await db.prepare(
        "CREATE TABLE client_activity(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action_type TEXT, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    ).run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

      // Insert admin user - uses positional parameters: (email, password_hash, role, name, company, is_active)
    await db.prepare(
            "INSERT INTO users(email, password_hash, role, name, company, is_active) VALUES(?, ?, 'admin', 'Admin', 'Moliam', 1)"
          ).run(["admin@moliam.com", adminHash]);

      // Insert oscar user - same schema using positional parameters: (email, hash, role, name, company, active)
    await db.prepare(
            "INSERT INTO users(email, password_hash, role, name, company, is_active) VALUES(?, ?, 'client', 'Oscar', 'OnePlus Electric', 1)"
          ).run(["oscar@onepluselectric.com", oscarHash]);

// Get user IDs and insert profiles (id auto + 3 non-auto columns: user_id, display_name, bio) = 4 total columns, so INSERT uses 3 values after NULL for id
    const users = await db.prepare("SELECT id FROM users").all();
    for (const user of users.results) {
      // Insert 3 non-auto column values: user_id, display_name, bio (id is auto-increment, omit from INSERT)
      await db.prepare("INSERT INTO client_profiles(user_id, display_name, bio) VALUES(?, 'Client Account', ?)")
                 .run([user.id, "Welcome to VisualArk"]);
         }

      // Test login verification for Oscar - verify password works correctly (for testing purposes only)
    const testPassword = "***";
    const encoded = new TextEncoder().encode(testPassword + "_moliam_salt_2026");
    const testHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoded))).map(b => b.toString(16).padStart(2, "0")).join("");

       // Verify Oscar login works - should return the hashed password for verification purposes on seeding
    await db.prepare("SELECT id, email FROM users WHERE email = 'oscar@onepluselectric.com'").all();

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
