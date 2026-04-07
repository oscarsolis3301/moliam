// Seed endpoint for Cloudflare Pages - Web Crypto API + CF D1 binding

const SALT = "_moliam_salt_2026";

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password + SALT);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // Validate seed key header
  if (request.headers.get("x-seed-key") !== "moliam2026") {
    return new Response(
      JSON.stringify({ error: "Invalid seed key" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
       // Drop existing tables to ensure fresh start (use if exists syntax)
await db.prepare("DROP TABLE IF EXISTS `sessions`").run();
    await db.prepare("DROP TABLE IF EXISTS `users`").run();

      // Create users table with autoincrement id and all required columns
    await db
      .prepare(
        "CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'client', company TEXT, phone TEXT, avatar_url TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_login TEXT)",
      )
      .run();

    // Create sessions table with exactly 3 columns matching what INSERT will provide
    await db
      .prepare(
        "CREATE TABLE sessions(user_id INTEGER NOT NULL REFERENCES users(id), token TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
      )
      .run();

    // Insert admin user with hash password
    const insertAdmin = await db
      .prepare(
        "INSERT INTO users(email, password_hash, name, role, company, phone, is_active) VALUES(?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "admin@moliam.com",
        await hashPassword("Moliam2026!"),
        "Admin",
        "superadmin",
        "Moliam",
        null,
        1,
      );

    // Get admin ID immediately after insert
    const adminIdResult = await db
      .prepare("SELECT id FROM users WHERE email='admin@moliam.com' LIMIT 1")
      .all();
    const adminId = adminIdResult.results?.[0]?.id || -1;
    if (adminId === -1) {
      throw new Error("Failed to retrieve admin ID after insert");
    }

    // Insert Oscar user
    const insertOscar = await db
      .prepare(
        "INSERT INTO users(email, password_hash, name, role, company, phone, is_active) VALUES(?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "oscar@onepluselectric.com",
        await hashPassword("OnePlus2026!"),
        "Oscar",
        "client",
        "OnePlus Electric",
        null,
        1,
      );

    // Get Oscar ID
    const oscarIdResult = await db
       .prepare(
         "SELECT id FROM users WHERE email='oscar@onepluselectric.com' LIMIT 1"
       )
       .all();
    const oscarId = oscarIdResult.results?.[0]?.id || -1;
    if (oscarId === -1) {
      throw new Error("Failed to retrieve Oscar ID after insert");
     }

      // Create sessions table in staging with only user_id and token columns (no id PK)
    await db
       .prepare(
         "CREATE TABLE sessions(user_id INTEGER NOT NULL REFERENCES users(id), token TEXT NOT NULL)",
       )
       .run();

    // Insert test sessions for both users - 2 params, 2 placeholders (matches staging schema)
    await db
       .prepare(
         "INSERT INTO sessions(user_id, token) VALUES(?, ?)",
       )
       .run(adminId, "test-session-1");

    await db
       .prepare(
         "INSERT INTO sessions(user_id, token) VALUES(?, ?)",
       )
       .run(oscarId, "test-session-2");

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Seeded successfully",
        users: [
          { email: "admin@moliam.com", role: "superadmin" },
          { email: "oscar@onepluselectric.com", role: "client" },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: `Seeding failed: ${err.message}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
