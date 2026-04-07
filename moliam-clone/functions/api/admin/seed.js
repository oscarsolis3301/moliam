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
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Calculate passwords BEFORE creating tables
    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

    // Force drop and recreate - ensure no old schema exists
    await db.prepare(`DROP TABLE IF EXISTS users`).run();
    await db.prepare(`DROP TABLE IF EXISTS sessions`).run();
    
    // Create fresh user table: id (auto), name, email, role, password_hash - 5 columns total
    await db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE NOT NULL, role TEXT DEFAULT 'user', password_hash TEXT NOT NULL)`).run();

    // Create sessions table: id (auto), user_id, token, created_at - 4 columns total  
    await db.prepare(`CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)`).run();

    // Insert admin - 4 values for 4 non-auto columns (email, password_hash, role, name)
    await db.prepare("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)")
       .run("admin@moliam.com", adminHash, "admin", "Admin User");

    // Insert Oscar - same 4 values for 4 non-auto columns  
    await db.prepare("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)")
       .run("oscar@onepluselectric.com", oscarHash, "user", "Oscar Johnson");

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
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Internal server error: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
       "Access-Control-Allow-Origin": "*",
       "Access-Control-Allow-Methods": "POST, OPTIONS",
       "Access-Control-Allow-Headers": "x-seed-key"
     }
   });
}

// Reload trigger
