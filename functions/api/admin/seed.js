/**
 * Seed endpoint - creates tables + inserts demo users
 * POST /api/admin/seed with X-Seed-Key: moliam2026
 * @returns {Response} JSON response with success/error and CORS handling
 */
import { jsonResp } from './lib/standalone.js';

const SALT = "_moliam_salt_2026";

/**
 * Hash password using SHA-256 with salt for secure storage
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hexadecimal string representation of hashed password (64 chars)
 */
async function hashPassword(password) {
  const buf = await crypto.subtle.digest(
       "SHA-256",
    new TextEncoder().encode(password + SALT)
     );
  return Array.from(new Uint8Array(buf))
         .map(b => b.toString(16).padStart(2, "0"))
      .join("");
}

/**
 * POST /api/admin/seed -- Seeds database with demo users and tables
 * Requires X-Seed-Key: moliam2026 header for authorization
 * @param {object} context - Cloudflare Pages function context with request and env
 * @returns {Response} JSON response with success/error and seed results
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

  const seedKey = request.headers.get("x-seed-key");
  if (seedKey !== "moliam2026") {
    return jsonResp(403, { error: "Invalid seed key" }, request);
  }

  try {
       // Drop and recreate core tables
    await db.prepare("DROP TABLE IF EXISTS sessions").run();
    await db.prepare("DROP TABLE IF EXISTS users").run();

        // Users table - matches what login.js expects
    await db.prepare(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'client',
        company TEXT,
        phone TEXT,
        avatar_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT
        )
      `).run();

       // Sessions table - matches what login.js INSERT expects
    await db.prepare(`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();

       // Create other tables if they don't exist (preserve existing data)
    const otherTables = [
       `CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, email TEXT, phone TEXT, company TEXT,
        service TEXT, message TEXT, source TEXT,
        created_at TEXT DEFAULT (datetime('now'))
        )`,
       `CREATE TABLE IF NOT EXISTS client_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, display_name TEXT, bio TEXT
        )`,
       `CREATE TABLE IF NOT EXISTS client_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, subject TEXT, message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
        )`,
       `CREATE TABLE IF NOT EXISTS client_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, action_type TEXT, details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
        )`,
       `CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER, name TEXT, type TEXT,
        status TEXT DEFAULT 'active', monthly_rate REAL,
        start_date TEXT, created_at TEXT DEFAULT (datetime('now'))
        )`,
       `CREATE TABLE IF NOT EXISTS project_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER, title TEXT, description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
        )`
      ];

    for (const sql of otherTables) {
      try { await db.prepare(sql).run(); } catch (e) { /* table may exist */ }
     }

       // Seed users
    const adminHash = await hashPassword("Moliam2026!");
    const oscarHash = await hashPassword("OnePlus2026!");

    await db.prepare(
        "INSERT INTO users (email, password_hash, name, role, company, is_active) VALUES (?, ?, ?, ?, ?, 1)"
      ).bind("admin@moliam.com", adminHash, "Administrator", "admin", "Moliam").run();

    await db.prepare(
        "INSERT INTO users (email, password_hash, name, role, company, is_active) VALUES (?, ?, ?, ?, ?, 1)"
      ).bind("oscar@onepluselectric.com", oscarHash, "Oscar Solis", "client", "OnePlus Electric").run();

       // Verify
    const count = await db.prepare("SELECT COUNT(*) as total FROM users").first();

    return jsonResp(200, { success: true, message: "Database seeded", users_created: count.total }, request);

    } catch (err) {
    return jsonResp(500, { error: err.message }, request);
      }
}

/**
 * Handle CORS preflight requests to seed endpoint returns 204 No Content with proper headers
 * @param {Request} request - Cloudflare Pages Request object (unused, standard signature)
 * @returns {Response} 204 No Content with Access-Control headers for moliam.com and moliam.pages.dev
 */
export async function onRequestOptions() {
  const headers = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Methods": "POST, OPTIONS",
"Access-Control-Allow-Headers": "Content-Type, X-Seed-Key",
};

  return new Response(null, { status: 204, headers });
}
