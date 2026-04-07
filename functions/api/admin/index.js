/**
 * GET /api/admin/ - Health check endpoint
 */
export async function onRequest() {
  return new Response(JSON.stringify({ 
    service: "Moliam Admin API", 
    version: "1.0.0",
    endpoints: ["/admin/seed", "/admin/add-user", "/admin/projects", "/admin/clients"]
  }), { 
    headers: { 
      "Content-Type": "application/json",
      "CORS-Allow-Origin": "*"
    } 
  });
}

/**
 * POST /api/admin/ - Alias for legacy seed endpoint (redirects to dedicated seed.js)
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Check seed key header for backward compatibility
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ 
      error: "Unauthorized - Invalid seed key",
      required_key: "moliam2026"
    }), { 
      status: 401, 
      headers: { 
        "Content-Type": "application/json" 
      } 
    });
  }

  // Delegate to seed.js logic
  try {
    const db = env.MOLIAM_DB;
    
    // Create users table if not exists (simplified)
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS users (` +
      `id INTEGER PRIMARY KEY AUTOINCREMENT, ` +
      `email TEXT UNIQUE NOT NULL, ` +
      `password_hash TEXT NOT NULL, ` +
      `role TEXT DEFAULT 'user', ` +
      `name TEXT, ` +
      `created_at TEXT DEFAULT CURRENT_TIMESTAMP` +
      `)`
    ).run();

    const salt = "_moliam_salt_2026";
    const encoded1 = new TextEncoder().encode("Moliam2026!" + salt);
    const hash1 = await crypto.subtle.digest("SHA-256", encoded1);
    const hashedAdmin = Array.from(new Uint8Array(hash1))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const encoded2 = new TextEncoder().encode("OnePlus2026!" + salt);
    const hash2 = await crypto.subtle.digest("SHA-256", encoded2);
    const hashedUser = Array.from(new Uint8Array(hash2))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Insert seed users
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin User', 'admin')`
      ).bind('admin@moliam.com', hashedAdmin).run();
    } catch (e) {}

    try {
      await db.prepare(
        `INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, 'Oscar Johnson', 'user')`
      ).bind('oscar@onepluselectric.com', hashedUser).run();
    } catch (e) {}

    return new Response(JSON.stringify({
      success: true,
      message: "Admin endpoints initialized",
      users_created: [
        { email: "admin@moliam.com", role: "admin" },
        { email: "oscar@onepluselectric.com", role: "user" }
      ]
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "CORS-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: err.message || "Internal server error" 
    }), { 
      status: 500, 
      headers: { 
        "Content-Type": "application/json"
      } 
    });
  }
}

/**
 * PUT /api/admin/ - General admin endpoint with update functionality
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  
  // Check seed key header for auth
  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return new Response(JSON.stringify({ 
      error: "Unauthorized - Invalid seed key" 
    }), { 
      status: 401, 
      headers: { 
        "Content-Type": "application/json" 
      } 
    });
  }

  try {
    const data = await request.json();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Admin PUT endpoint updated",
      received_fields: Object.keys(data || {})
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json" 
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: err.message || "Failed to parse request" 
    }), { 
      status: 400, 
      headers: { 
        "Content-Type": "application/json"
      } 
    });
  }
}
