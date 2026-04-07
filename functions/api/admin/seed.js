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
  
        // Check existing table schemas (for debugging)
    const schemaCheck = await db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('users', 'sessions')").all();
    
        // Force complete schema reset by dropping ALL tables thoroughly - no auth_sessions, no company column remnants
    await db.prepare("DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS auth_sessions;").run();

           // Now recreate from scratch with CORRECT schema: 5 columns (id:auto, name, email, role, password_hash) = 4 manual values
    await db.prepare(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role TEXT DEFAULT 'user', password_hash TEXT NOT NULL)`).run();
    
          // debug: show actual schema after CREATE
    const finalSchema = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").all();

    await db.prepare(`CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)`).run();

          // Compute hashes for admin and oscar users before insert
    
  const adminHash = await hashPassword("Moliam2026!");
  const oscarHash = await hashPassword("OnePlus2026!");

// Insert with exact matching: table has (id auto, name, email, role, password_hash) = 4 manual inserts
    await db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)").run("Admin User", "admin@moliam.com", "admin", adminHash);
    await db.prepare("INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)").run("Oscar Johnson", "oscar@onepluselectric.com", "user", oscarHash);

    return new Response(JSON.stringify({
      success: true,
       message: "Schema reset and seeded successfully",
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
    return new Response(JSON.stringify({ 
       error: "Internal server error", 
       debug_rows: schemaCheck.rows.length,
        user_count_after_attempt: await db.prepare("SELECT COUNT(*) as cnt FROM users LIMIT 1").all().rows[0]?.cnt ?? null
       }), {
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
