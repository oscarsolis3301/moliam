// Seed endpoint for CF Pages - converts CommonJS seed data to new user accounts

const SALT = "_moliam_salt_2026";

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password + SALT);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function seedDatabase(DB) {
  // Create users table if not exists
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const saltedPassword1 = await hashPassword("Moliam2026!");
  const saltedPassword2 = await hashPassword("OnePlus2026!");

// Insert admin user
  try {
    await DB.prepare(`INSERT INTO users (email, password_hash, role, name) VALUES (?,?,'admin',?)`).run('admin@moliam.com', saltedPassword1, 'Admin User').catch(()=>{});

       // Insert Oscar One Plus Electric user
    try {
      await DB.prepare(`INSERT INTO users (email, password_hash, role, name) VALUES (?,?,'user',?)`).run('oscar@onepluselectric.com', saltedPassword2, 'Oscar Johnson').catch(()=>{});
    } catch (err) {
      console.error("Oscar insert error:", err);
    }

    return true;
  } catch (err) {
    console.error("Seed insert error:", err);
    return false;
  }
}

export async function onRequestPost(context) {
  const env = context.env;
  const DB = env.MOLIAM_DB;
  const request = context.request;

  // Check seed key header
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Invalid seed key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const seeded = await seedDatabase(DB);
    
    if (seeded) {
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
    }
  } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    message: "Already seeded" 
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
