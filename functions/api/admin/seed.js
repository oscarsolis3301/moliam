/**
 * POST /api/admin/seed
 * Creates the initial admin account. Only works if no admin exists yet.
 * Call once after deploy: curl -X POST https://moliam.pages.dev/api/admin/seed -H "Content-Type: application/json" -d '{"password":"your-admin-password"}'
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  let data;
  try { data = await request.json(); } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." });
  }

  const password = (data.password || "").trim();
  if (!password || password.length < 6) {
    return jsonResp(400, { error: true, message: "Password required (min 6 chars)." });
  }

  try {
    // Check if admin already exists
    const existing = await db.prepare("SELECT id FROM users WHERE role = 'admin'").first();
    if (existing) {
      return jsonResp(409, { error: true, message: "Admin account already exists." });
    }

    const hash = await hashPassword(password);

    await db.prepare(
      "INSERT INTO users (email, password_hash, name, role, company) VALUES (?, ?, ?, 'admin', ?)"
    ).bind("roman@moliam.com", hash, "Roman", "Moliam").run();

    return jsonResp(201, {
      success: true,
      message: "Admin account created. Login at /login with roman@moliam.com",
    });

  } catch (err) {
    console.error("Seed error:", err);
    return jsonResp(500, { error: true, message: "Server error: " + err.message });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }});
}

async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  }});
}
