/**
 * Admin Seed API Endpoint  
 * POST /api/admin/seed - Resets the entire database with admin user
 */
import { hashPassword, jsonResp, corsResponse } from "../../../lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.MOLIAM_DB;

      // CORS preflight if needed
  if (request.method === "OPTIONS") return corsResponse(204);

  try {
    const seedKey = request.headers.get("x-seed-key");
    if (seedKey !== "moliam2026") {
      return jsonResp(403, { error: "Invalid seed key" });
     }

     // Clean existing tables
    await db.prepare('DROP TABLE IF EXISTS users').run();
    await db.prepare('DROP TABLE IF EXISTS sessions').run();
    await db.prepare('DROP TABLE IF EXISTS submissions').run();
    await db.prepare('DROP TABLE IF EXISTS leads').run();
    await db.prepare('DROP TABLE IF EXISTS rate_limits').run();
    await db.prepare('DROP TABLE IF EXISTS client_profiles').run();
    await db.prepare('DROP TABLE IF EXISTS client_messages').run();
    await db.prepare('DROP TABLE IF EXISTS client_activity').run();

     // Create all tables with proper structure
    await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT, is_active INTEGER DEFAULT 1, last_login TEXT)").run();

        await db.prepare("CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT)").run();

    await db.prepare("CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT DEFAULT '', role TEXT DEFAULT 'client', company TEXT)").run();

    await db.prepare("CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, company TEXT, message TEXT, user_agent TEXT, screen_resolution TEXT, lead_score INTEGER DEFAULT 0, category TEXT DEFAULT 'cold', submitted_at TEXT DEFAULT CURRENT_TIMESTAMP)")
      .run();

        await db.prepare("CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, first_name TEXT, last_name TEXT, phone TEXT, company TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_active INTEGER DEFAULT 1)").run();
       
    await db.prepare("CREATE TABLE IF NOT EXISTS rate_limits(id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT, request_count INTEGER DEFAULT 0, reset_at TEXT, UNIQUE(ip_address))").run();

        // client_profiles: 3 columns - user_id, display_name, bio (3 values)
    await db.prepare("CREATE TABLE IF NOT EXISTS client_profiles(user_id INTEGER PRIMARY KEY, display_name TEXT, bio TEXT)").run();

    await db.prepare("CREATE TABLE IF NOT EXISTS client_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, from_email TEXT, to_email TEXT, subject TEXT, message TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0)")
      .run();

    await db.prepare("CREATE TABLE IF NOT EXISTS client_activity(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action_type TEXT, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
      .run();

    const adminHash = await hashPassword("Moliam2026!");
        await db.prepare(          "INSERT INTO users(email, password_hash, role, name, company, is_active) VALUES(?, ?, ?, ?, ?, ?)"
        ).run(["admin@moliam.com", adminHash, "admin", "Admin Moliam.", "Moliam", 1]);

    const users = await db.prepare("SELECT id FROM users").all();
        for (const u of users.results) {
      if (u && u.id) {
        // client_profiles has only 3 columns - user_id, display_name, bio
        await db.prepare("INSERT INTO client_profiles(user_id, display_name, bio) VALUES(?, ?, ?)")
           .run([u.id, "VisualArk", "AI-powered digital marketing agency"]);
      }
     }

     return jsonResp(200, { success: true, message: "Database seeded successfully", users: [{ email: "admin@moliam.com", role: "admin" }]});

    } catch (err) {
      return jsonResp(500, { error: err.message });
   }
}
