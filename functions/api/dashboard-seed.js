/**
 * MOLIAM Dashboard Seed — CloudFlare Pages Function
 * GET /api/dashboard-seed
 *
 * Creates tables + seeds demo data if empty.
 */

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.MOLIAM_DB;

  try {
    // Create tables if not exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS client_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        company_name TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        email TEXT NOT NULL,
        plan TEXT DEFAULT 'retainer',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS client_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES client_profiles(id)
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS client_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        agent_name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES client_profiles(id)
      )
    `).run();

    // Check if already seeded
    const existing = await db.prepare('SELECT COUNT(*) as count FROM client_profiles').first();
    if (existing && existing.count > 0) {
      return new Response(JSON.stringify({ message: 'Already seeded', count: existing.count }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Seed OnePlus Electric profile
    const result = await db.prepare(`
      INSERT INTO client_profiles (token, company_name, contact_name, email, plan)
      VALUES ('oneplus-demo-2026', 'OnePlus Electric', 'Oscar Solis Marquez', 'oscar@onepluselectric.com', 'retainer')
    `).run();

    const clientId = result.meta.last_row_id;

    // Seed 5 sample activity entries
    const activities = [
      { agent: 'Ada (AI)', desc: 'Optimized Google Business Profile — added 3 new service categories' },
      { agent: 'Ada (AI)', desc: 'Published blog post: "5 Signs You Need an Electrical Panel Upgrade"' },
      { agent: 'Ada (AI)', desc: 'Responded to 2 new Google reviews with personalized replies' },
      { agent: 'Moliam Team', desc: 'Monthly SEO report delivered — organic traffic up 18%' },
      { agent: 'Ada (AI)', desc: 'Updated website service page with new licensing info' },
    ];

    for (let i = 0; i < activities.length; i++) {
      await db.prepare(`
        INSERT INTO client_activity (client_id, agent_name, description, created_at)
        VALUES (?, ?, ?, datetime('now', ?))
      `).bind(clientId, activities[i].agent, activities[i].desc, `-${i} hours`).run();
    }

    // Seed 3 sample messages
    const messages = [
      { sender: 'Moliam Team', msg: 'Welcome to your Moliam dashboard! Feel free to message us anytime.' },
      { sender: 'Oscar Solis Marquez', msg: 'Thanks! Can we add emergency electrical services to the website?' },
      { sender: 'Moliam Team', msg: 'Absolutely — we\'ll have that updated within 24 hours. Ada is drafting the copy now.' },
    ];

    for (let i = 0; i < messages.length; i++) {
      await db.prepare(`
        INSERT INTO client_messages (client_id, sender, message, created_at)
        VALUES (?, ?, ?, datetime('now', ?))
      `).bind(clientId, messages[i].sender, messages[i].msg, `-${(messages.length - i) * 2} hours`).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Seeded successfully',
      client_id: clientId,
      activities_created: activities.length,
      messages_created: messages.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
