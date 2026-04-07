/**
 * POST /api/admin/add-user — Add a single user without touching existing data
 * Requires X-Seed-Key header for auth
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

  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401, headers: { "Content-Type": "application/json" } 
    });
  }

  try {
    const data = await request.json();
    const { email, password, name, role, company } = data;
    
    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "email, password, name required" }), { 
        status: 400, headers: { "Content-Type": "application/json" } 
      });
    }

    const hash = await hashPassword(password);
    
    // Use only columns guaranteed to exist in the actual D1 schema
    await db.prepare(
      "INSERT OR REPLACE INTO users (email, password_hash, name, role, company) VALUES (?, ?, ?, ?, ?)"
    ).bind(email, hash, name, role || "client", company || null).run();

    return new Response(JSON.stringify({ success: true, message: "User " + email + " created" }), { 
      status: 200, headers: { "Content-Type": "application/json" } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { "Content-Type": "application/json" } 
    });
  }
}
