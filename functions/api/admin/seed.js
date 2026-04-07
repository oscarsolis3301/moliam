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
       // Drop and recreate users table to ensure consistent schema matching login.js expectations
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    
    const createTable = `CREATE TABLE users (
        id INTEGER PRIMARY KEY, 
        name TEXT NOT NULL, 
        email TEXT UNIQUE NOT NULL, 
        password_hash TEXT NOT NULL, 
        role TEXT NOT NULL, 
        company TEXT, 
        is_active INTEGER DEFAULT 1, 
        last_login datetime
    )`;
    await db.prepare(createTable).run();

    const saltedPassword1 = await hashPassword("Moliam2026!");
      const saltedPassword2 = await hashPassword("OnePlus2026!");

    // Fix: INSERT has 7 placeholders, provide exactly 7 values (remove extra column)
    await db.prepare(
        "INSERT INTO users (name,email,password_hash,role,is_active,last_login) VALUES (?, ?, ?, ?, ?, ?)"
     ).run("Administrator","admin@moliam.com",saltedPassword1,"admin",1,null);

    await db.prepare(
        "INSERT INTO users (name,email,password_hash,role,is_active,last_login) VALUES (?, ?, ?, ?, ?, ?)"
     ).run("Oscar Johnson","oscar@onepluselectric.com",saltedPassword2,"user",1, null);

    return new Response(JSON.stringify({ 
      success:true, 
      message:"Users seeded successfully", 
            users:[{ email:"admin@moliam.com",role:"admin" },{ email:"oscar@onepluselectric.com",role:"user" }]
            }), {
      status: 200,
            headers: { "Content-Type": "application/json" }
           });

        } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Internal server error: "+err.message }), {
      status: 500,
            headers: { "Content-Type": "application/json" }
             });
      }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Origin":"*",
                "Access-Control-Allow-Methods":"POST, OPTIONS",
                      "Access-Control-Allow-Headers":"x-seed-key",
              }});
}
