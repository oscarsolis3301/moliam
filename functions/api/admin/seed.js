import { getDb } from '../../utils/db.js';

const salt = "_moliam_salt_2026";

export async function onRequestPost(context) {
  const request = context.request;
  const db = context.env.MOLIAM_DB;
  
  // Check secret key
  const seedKey = request.headers.get('x-seed-key');
  if (seedKey !== 'moliam2026') {
    return new Response(JSON.stringify({ error: 'Invalid seed key' }), { 
      status: 403, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    // Hash passwords properly using Web Crypto API
    const hashFn = async (password) => {
      const enc = new TextEncoder();
      const data = enc.encode(password + salt);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const adminHash = await hashFn('Moliam2026!');
    const oscarHash = await hashFn('OnePlus2026!');

    // Insert admin user
    await db.prepare(`
      INSERT OR IGNORE INTO users (email, password_hash, name, role, company, is_active) 
      VALUES ('admin@moliam.com', ?, 'Roman', 'superadmin', 'Moliam', 1)
    `).bind(adminHash).run();

    // Insert client user (Oscar)
    await db.prepare(`
      INSERT OR IGNORE INTO users (email, password_hash, name, role, company, phone, is_active)
      VALUES ('oscar@onepluselectric.com', ?, 'Oscar Solis', 'client', 'OnePlus Electric', '(949) 736-0902', 1)
    `).bind(oscarHash).run();

    // Get user ID and create project for Oscar  
    const oscarUser = await db.prepare("SELECT id FROM users WHERE email = 'oscar@onepluselectric.com'").all();
    
    if (oscarUser.results && oscarUser.results.length > 0) {
      const oscarUserId = oscarUser.results[0].id;
      
      // Create project
      await db.prepare(`
        INSERT OR IGNORE INTO projects (user_id, name, type, status, monthly_rate, setup_fee, start_date, next_billing)
        VALUES (?, 'Website + GBP Package', 'retainer', 'active', 400, 300, '2026-03-25', '2026-05-01')
      `).bind(oscarUserId).run();

      // Get the project ID
      const oscarProject = await db.prepare("SELECT id FROM projects WHERE user_id = ? ORDER BY id DESC LIMIT 1").bind(oscarUserId).all();
      
      if (oscarProject.results && oscarProject.results.length > 0) {
        const oscarProjectId = oscarProject.results[0].id;
        
        // Insert project updates/milestones
        await db.prepare(`
          INSERT INTO project_updates (project_id, title, description, type) 
          VALUES (?, 'Website Deployed', 'Custom contractor website live at onepluselectric.com', 'milestone')
        `).bind(oscarProjectId).run();

        await db.prepare(`
          INSERT INTO project_updates (project_id, title, description, type)
          VALUES (?, 'GBP Optimized', 'Google Business Profile fully optimized with photos, services, and posts', 'milestone')
        `).bind(oscarProjectId).run();

        await db.prepare(`
          INSERT INTO project_updates (project_id, title, description, type)
          VALUES (?, 'First Review Response', 'Set up automated review response system', 'update')
        `).bind(oscarProjectId).run();

        // Insert invoice - use direct values instead of SELECT subquery
        await db.prepare(`
          INSERT OR IGNORE INTO invoices (client_id, invoice_number, amount, status, due_date, description, line_items)
          VALUES (?, 'INV-2026-001', 700, 'paid', '2026-04-01', 'Setup + First Month', '[{"desc":"Website Setup","amount":300},{"desc":"Monthly Retainer (Apr)","amount":400}]')
        `).bind(oscarUserId).run();
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Database seeded successfully' }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
      
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Seed failed', details: err.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
