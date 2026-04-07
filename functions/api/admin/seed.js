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

  // Check seed key header instead of password body
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Invalid seed key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Drop and recreate users table to ensure consistent schema
      await db.prepare(`DROP TABLE IF EXISTS users`).run();
      
      // Create users table with consistent lowercase column names (D1 is case-sensitive)
    await db.prepare(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        user_status INTEGER DEFAULT 1
         )
      `).run();

    const saltedPassword1 = await hashPassword("Moliam2026!");
    const saltedPassword2 = await hashPassword("OnePlus2026!");

     // Insert admin user (ignore if exists)
    await db.prepare(`
      INSERT INTO users (email, password_hash, name, role, user_status, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET name = excluded.name
        `).run("admin@moliam.com", saltedPassword1, "Administrator", "admin", true);

         // Insert Oscar One Plus Electric user (ignore if exists)
    await db.prepare(`
      INSERT INTO users (email, password_hash, name, role, user_status, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET name = excluded.name
        `).run("oscar@onepluselectric.com", saltedPassword2, "Oscar Johnson", "user", false);


    return new Response(JSON.stringify({ 
      success: true, 
      message: "Users seeded successfully", 
      users: [
        { email: "admin@moliam.com", role: "admin" },
        { email: "oscar@onepluselectric.com", role: "user" }
      ]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "x-seed-key",
  }});

}
