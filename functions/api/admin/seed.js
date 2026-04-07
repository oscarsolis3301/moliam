// Seed endpoint for Cloudflare Pages - uses Web Crypto API + CF D1 binding

async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
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
    // Create users table with all 7 columns (id auto-increment)
    // id + email + password_hash + name + role + company + is_active = 6 insertable columns
    await db.prepare(
      "CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT, role TEXT DEFAULT 'client', company TEXT, is_active INTEGER DEFAULT 1)"
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
    await db.prepare("CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, name TEXT, company TEXT, phone TEXT, message TEXT, submitted_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, first_name TEXT, last_name TEXT, phone TEXT, company TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_active INTEGER DEFAULT 1)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS rate_limits(id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT, request_count INTEGER DEFAULT 0, reset_at TEXT, UNIQUE(ip_address))").run();

    // Create client_profiles, client_messages, client_activity from dashboard system
    await db.prepare("CREATE TABLE IF NOT EXISTS client_profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id), display_name TEXT, bio TEXT, avatar_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS client_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), from_email TEXT, to_email TEXT, subject TEXT, message TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS client_activity(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), action_type TEXT, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

    // Insert admin user (id auto-increment + 6 values = 7 columns)
    await db.prepare("INSERT OR REPLACE INTO users (email, password_hash, name, role, company, is_active) VALUES (?, ?, ?, ?, ?, ?)").run('admin@moliam.com', adminHash, 'Admin', 'admin', 'Moliam', 1);

    // Insert oscar user (6 values for 6 non-id columns)
    await db.prepare("INSERT OR REPLACE INTO users (email, password_hash, name, role, company, is_active) VALUES (?, ?, ?, ?, ?, ?)").run('oscar@onepluselectric.com', oscarHash, 'Oscar', 'client', 'OnePlus Electric', 1);

    // Create default client profiles for both users
    await db.prepare("INSERT OR REPLACE INTO client_profiles (user_id, display_name, bio) SELECT id, email || ' Profile', 'Client account' FROM users WHERE email = 'admin@moliam.com'").run();
    await db.prepare("INSERT OR REPLACE INTO client_profiles (user_id, display_name, bio) SELECT id, email || ' Profile', 'Client account' FROM users WHERE email = 'oscar@onepluselectric.com'").run();

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
