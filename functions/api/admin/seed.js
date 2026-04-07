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
    await db.prepare('DROP TABLE IF EXISTS users').run().catch(() => console.log("users table not found"));
    await db.prepare("DROP TABLE IF EXISTS sessions").run().catch(() => console.log("sessions table not found"));
    await db.prepare("DROP TABLE IF EXISTS submissions").run().catch(() => console.log("submissions table not found"));
    await db.prepare("DROP TABLE IF EXISTS leads").run().catch(() => console.log("leads table not found"));
    await db.prepare("DROP TABLE IF EXISTS rate_limits").run().catch(() => console.log("rate_limits table not found"));
    await db.prepare("DROP TABLE IF EXISTS client_profiles").run().catch(() => console.log("client_profiles table not found"));
    await db.prepare("DROP TABLE IF EXISTS client_messages").run().catch(() => console.log("client_messages table not found"));
    await db.prepare("DROP TABLE IF EXISTS client_activity").run().catch(() => console.log("client_activity table not found"));

      // Ensure absolutely clean slate - drop sqlite_master entries related to our tables
    await db.prepare("DELETE FROM sqlite_sequence WHERE name LIKE 'users%' OR name LIKE 'sessions%' OR name LIKE 'submissions%' OR name LIKE 'leads%' OR name LIKE 'rate_%' OR name LIKE 'client_%'").run().catch(() => console.log("sqlite_sequence cleanup skipped"));

      // Log cleanup completion
 // Log cleanup completion
    console.log("Database tables dropped, starting fresh...");

            // Get all existing schema for verification
    try {
        const checkSchema = await db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
        console.log("CURRENT SCHEMA BEFORE DROP:", JSON.stringify({tables: 8, items: checkSchema.map(t => t.name)}));
      } catch(e) {
       console.error("SCHEMA CHECK FAILED before drop:", e.message);
        if (e.stack) console.error("STACK:", e.stack);
      }

    // Drop all tables and log each one being dropped - use specific exceptions per table so we know which fails
     let droppedUsers = false, droppedSessions = false;
    try { await db.prepare('DROP TABLE IF EXISTS users').run(); droppedUsers = true; console.log("✓ DROPPED users"); } catch(e) { console.error("✗ DROP users FAILED:", e.message); }
    try { await db.prepare("DROP TABLE IF EXISTS sessions").run(); droppedSessions = true; console.log("✓ DROPPED sessions"); } catch(e) { console.error("✗ DROP sessions FAILED:", e.message); }

      // Log what we have - if we got here, the basic schema is fine
     console.log("Basic D1 connectivity confirmed - proceeding with table creation");

     // Create users table with AUTOINCREMENT id column (matches login.js SELECT columns: id, email, name, role, company, password_hash, is_active) + last_login = 8 total columns
    console.log("Creating users table...");
    try {
      await db.prepare(
       "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT, is_active INTEGER DEFAULT 1, last_login TEXT)"
         ).run();
      console.log("Users table created successfully");
     } catch(e) {
       console.error("Error creating users table:", e.message);
       throw e;
     }

        // Create sessions table with login.js columns: id auto-increment + 5 insertable columns = total 6 columns
    console.log("Creating sessions table...");
    try {
      await db.prepare(
       "CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT DEFAULT NULL, ip_address TEXT, user_agent TEXT)"
         ).run();
      console.log("Sessions table created successfully");
     } catch(e) {
       console.error("Error creating sessions table:", e.message);
       throw e;
     }


     // Create clients table (dashboard uses this + client_activity) - 6 columns
     // id + email + password_hash + name + role + company = 5 insertable + is_active default
    await db.prepare(
       "CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT DEFAULT '', role TEXT DEFAULT 'client', company TEXT)"
     ).run();

     // Create submissions, leads, rate_limits tables if needed by other endpoints
    await db.prepare("CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, company TEXT, message TEXT, user_agent TEXT, screen_resolution TEXT, lead_score INTEGER DEFAULT 0, category TEXT DEFAULT 'cold', submitted_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id INTEGER REFERENCES submissions(id), email TEXT, first_name TEXT, last_name TEXT, phone TEXT, company TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_active INTEGER DEFAULT 1)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS rate_limits(id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, endpoint TEXT, timestamp TEXT, UNIQUE(ip, endpoint))").run();

     // Create client_profiles, client_messages, client_activity from dashboard system (user_id is FK to users(id))
    await db.prepare("CREATE TABLE IF NOT EXISTS client_profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id), display_name TEXT, bio TEXT, avatar_url TEXT DEFAULT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS client_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), from_email TEXT, to_email TEXT, subject TEXT, message TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS client_activity(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), action_type TEXT, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

       // Insert users first to get auto-generated IDs
    console.log("Inserting admin user...");
    const adminUserInsert = await db.prepare("INSERT INTO users(email, password_hash, role, name, company, is_active, last_login) VALUES(?, ?, 'admin', 'Admin moliam.com', 'Moliam', 1, CURRENT_TIMESTAMP)").run(["admin@moliam.com", adminHash]);
    console.log("Inserting oscar user...");
    const oscarUserInsert = await db.prepare("INSERT INTO users(email, password_hash, role, name, company, is_active, last_login) VALUES(?, ?, 'client', 'Oscar Lin', 'OnePlus Electric', 1, CURRENT_TIMESTAMP)").run(["oscar@onepluselectric.com", oscarHash]);

    // Insert client profiles - user_id is the FK/PK pointing to users.id (5 cols total: user_id, display_name, bio, avatar_url, created_at)
    const adminId = adminUserInsert.lastInsertRowid;
    await db.prepare("INSERT OR REPLACE INTO client_profiles(user_id, display_name, bio, avatar_url, created_at) VALUES (?, 'Admin moliam.com Profile', 'Client account', NULL, CURRENT_TIMESTAMP)").run(adminId);

    const oscarRow = await db.prepare("SELECT id FROM users WHERE email = ?").bind(["oscar@onepluselectric.com"]).first();
    if (oscarRow && oscarRow.id) {
      await db.prepare("INSERT OR REPLACE INTO client_profiles(user_id, display_name, bio, avatar_url, created_at) VALUES (?, 'Oscar Lin Profile', 'Client account', NULL, CURRENT_TIMESTAMP)").run([oscarRow.id]);
    }

    return new Response(JSON.stringify({ 
      message: "Database seeded successfully", 
      users: 2,
      tables: 10 
     }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
   } catch (err) {
    console.error("Seed operation failed:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
     });
   }
}
