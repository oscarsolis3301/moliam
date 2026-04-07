/**
 * Admin Seed API Endpoint  
 * POST /api/admin/seed - Resets the entire database with admin user, includes seed for all tables including client_profiles (3 columns) and lead-intake table.
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

    // Drop all tables (they should all be gone from previous runs)
    for (const table of ['users', 'sessions', 'submissions', 'leads', 'rate_limits', 'client_profiles', 'client_messages', 'client_activity', 'lead_scores', 'notification_logs']) {
      try {
        await db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
      } catch (e) {
        // Table might not exist, that's OK
      }
    }

    // Create users table - 7 data columns + auto-incremented id = 8 total
    await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', name TEXT, company TEXT, is_active INTEGER DEFAULT 1, last_login TEXT)").run();

    // Create sessions table - 6 data columns + id = 7 total
    await db.prepare("CREATE TABLE sessions(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT)").run();

    // Create clients table - 6 data columns + id = 7 total  
    await db.prepare("CREATE TABLE clients(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT DEFAULT '', role TEXT DEFAULT 'client', company TEXT)").run();

    // Create submissions table - 14 data columns + id = 15 total
    await db.prepare("CREATE TABLE submissions(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, company TEXT, message TEXT, user_agent TEXT, screen_resolution TEXT, budget TEXT, scope TEXT, industry TEXT, urgency_level TEXT DEFAULT 'medium', pain_points TEXT, lead_score INTEGER DEFAULT 0, category TEXT DEFAULT 'cold', submitted_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

    // Create leads table - 8 data columns + id = 9 total
    await db.prepare("CREATE TABLE leads(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, first_name TEXT, last_name TEXT, phone TEXT, company TEXT, source TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_active INTEGER DEFAULT 1)").run();
    
    // Create rate_limits table - 4 data columns + id = 5 total
    await db.prepare("CREATE TABLE rate_limits(id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT, request_count INTEGER DEFAULT 0, reset_at TEXT, ip_address_hash TEXT)").run();

// client_profiles: 4 columns - id (auto-increment), display_name, user_id, bio
    await db.prepare("DROP TABLE IF EXISTS client_profiles").run();
    await db.prepare("CREATE TABLE client_profiles(id INTEGER PRIMARY KEY AUTOINCREMENT, display_name TEXT NOT NULL, user_id INTEGER NOT NULL, bio TEXT DEFAULT '')").run();

// Create client_messages table - 7 data columns + id = 8 total
    await db.prepare("DROP TABLE IF EXISTS client_messages").run();
    await db.prepare("CREATE TABLE client_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, from_email TEXT, to_email TEXT, subject TEXT, message TEXT, sent_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0)").run();

// Create client_activity table - 5 data columns + id = 6 total
    await db.prepare("DROP TABLE IF EXISTS client_activity").run();
    await db.prepare("CREATE TABLE client_activity(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action_type TEXT, details TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

// Create lead_scores table - 6 data columns + id = 7 total
    await db.prepare("DROP TABLE IF EXISTS lead_scores").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS lead_scores(id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id INTEGER, base_score INTEGER, industry_boost INTEGER, urgency_boost INTEGER, budget_fit_score INTEGER, total_score INTEGER)").run();

// Create notification_logs table - 6 data columns + id = 7 total
    await db.prepare("DROP TABLE IF EXISTS notification_logs").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS notification_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id INTEGER, channel_type TEXT, status TEXT, payload_preview TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();

const adminHash = await hashPassword("Moliam2026!");

// Insert admin into users table (id will be auto-incremented)
    await db.prepare(
       "INSERT INTO users(email, password_hash, role, name, company, is_active) VALUES(?, ?, ?, ?, ?, ?)"
     ).run(["admin@moliam.com", adminHash, "admin", "Admin Moliam.", "Moliam", 1]);

// Get the newly created user_id for client_profiles
    const usersResult = await db.prepare("SELECT id FROM users WHERE email = 'admin@moliam.com'").all();

if (usersResult.results.length === 0) {
return jsonResp(500, { error: "Failed to create admin user" });
}

// Insert into client_profiles with 3 columns (id is auto-incremented): display_name, user_id, bio
    const firstUserId = usersResult.results[0].id;
    await db.prepare("INSERT INTO client_profiles(display_name, user_id, bio) VALUES(?, ?, ?)") 
      .run(["VisualArk", firstUserId, "AI-powered digital marketing agency"]);

    return jsonResp(200, { success: true, message: "Database seeded successfully", users: [{ email: "admin@moliam.com", role: "admin"}]});

  } catch (err) {
    return jsonResp(500, { error: err.message });
  }
}
