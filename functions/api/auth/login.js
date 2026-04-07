/**
 * Login API Endpoint
 * POST /api/auth/login
 * Authenticates user, creates session, sets cookie
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  // CORS preflight
  if (request.method === "OPTIONS") return corsResponse(204);

  let data;
  try { 
    data = await request.json(); 
  } catch {
    return jsonResp(400, { error: true, message: "Invalid JSON." });
  }

  const email = (data.email || "").toLowerCase().trim();
  const password = (data.password || "").trim();

  if (!email || !password) {
    return jsonResp(400, { error: true, message: "Email and password required." });
  }

  try {
    // Find user
    const user = await db.prepare(
      "SELECT id, email, name, role, company, password_hash, is_active FROM users WHERE email = ?"
    ).bind(email).first();

    if (!user) {
      return jsonResp(401, { error: true, message: "Invalid email or password." });
    }

    if (!user.is_active) {
      return jsonResp(403, { error: true, message: "Account disabled. Contact support." });
    }

    // Verify password (SHA-256 based — simple but effective for CF Workers)
    const hash = await hashPassword(password);
    if (hash !== user.password_hash) {
      return jsonResp(401, { error: true, message: "Invalid email or password." });
    }

    // Create session token
    const token = await generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const ua = request.headers.get("user-agent") || "";

    await db.prepare(
      "INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
    ).bind(user.id, token, expiresAt, ip, ua).run();

    // Update last login
    await db.prepare(
      "UPDATE users SET last_login = datetime('now') WHERE id = ?"
    ).bind(user.id).run();

    // Set cookie + return user data
    const headers = new Headers({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getAllowedOrigin(request),
      "Access-Control-Allow-Credentials": "true",
    });

    headers.append("Set-Cookie",
      `moliam_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );

    // Normalize superadmin → admin for frontend routing
    const displayRole = user.role === 'superadmin' ? 'admin' : user.role;

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: displayRole,
        company: user.company,
      }
    }), { status: 200, headers });

  } catch (err) {
    console.error("Login error:", err);
    return jsonResp(500, { error: true, message: "Server error. Try again." });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return corsResponse(204);
}

async function hashPassword(password) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(password + "_moliam_salt_2026")
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin.includes("moliam.pages.dev") || origin.includes("moliam.com") || origin.includes("localhost")) {
    return origin;
  }
  return "https://moliam.pages.dev";
}

function corsResponse(status) {
  return new Response(null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    }
  });
}

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://moliam.pages.dev",
      "Access-Control-Allow-Credentials": "true",
    }
  });
}
