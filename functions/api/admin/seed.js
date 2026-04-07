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
           const saltedPassword1 = await hashPassword("Moliam2026!");
        const saltedPassword2 = await hashPassword("OnePlus2026!");

      // Force drop and recreate - ensure no old schema exists
    await db.prepare(`DROP TABLE IF EXISTS users`).run();
    await db.prepare(`DROP TABLE IF EXISTS sessions`).run();
         // Create fresh user table with same column order as login.js SELECT expects: id, email, password_hash, role, name
    await db.prepare(`CREATE TABLE users (\\nid INTEGER PRIMARY KEY AUTOINCREMENT, \\nemail TEXT UNIQUE NOT NULL, \\npassword_hash TEXT NOT NULL, \\nrole TEXT DEFAULT 'user', \\nname TEXT\\n)`).run();

        // Create sessions table with correct schema matching login.js expectations
    await db.prepare("CREATE TABLE sessions(\\nid INTEGER PRIMARY KEY AUTOINCREMENT, \\nuser_id INTEGER NOT NULL, \\ntoken TEXT UNIQUE NOT NULL, \\ncreated_at TEXT NOT NULL\\n)").run();

     // Insert admin user - use explicit column names (4 columns + id auto-increments)
    await db.prepare(`INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)`).run("admin@moliam.com", saltedPassword1, "admin", "Admin User");
    console.log("Admin user inserted successfully");

        // Insert Oscar One Plus Electric user - explicit column names (4 columns + id auto-increments)    
    await db.prepare(`INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)`).run("oscar@onepluselectric.com", saltedPassword2, "user", "Oscar Johnson");
    console.log("Oscar user inserted successfully");

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
