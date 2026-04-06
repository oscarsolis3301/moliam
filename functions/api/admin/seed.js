const crypto = require('crypto');
module.exports = async function(req, res) {
  const salt = "_moliam_salt_2026";

   // Check secret key
  const seedKey = req.headers['x-seed-key'];
  if (seedKey !== 'moliam2026') {
    return res.status(403).json({ error: 'Invalid seed key' });
   }

  try {
    const db = await getDb();

     // Hash passwords properly
    const adminHash = crypto.createHash('sha256').update('Moliam2026!' + salt).digest('hex');
    const oscarHash = crypto.createHash('sha256').update('OnePlus2026!' + salt).digest('hex');

     // Insert admin user
    await db.run(`
      INSERT OR IGNORE INTO users (email, password_hash, name, role, company, is_active) 
      VALUES ('admin@moliam.com', ?, 'Roman', 'superadmin', 'Moliam', 1)
     `, [adminHash]);

     // Insert client user (Oscar's hash here - fix the SQL syntax)
    await db.run(`
      INSERT OR IGNORE INTO users (email, password_hash, name, role, company, phone, is_active)
      VALUES ('oscar@onepluselectric.com', ?, 'Oscar Solis', 'client', 'OnePlus Electric', '(949) 736-0902', 1)
     `, [oscarHash]);

     // Get user ID and create project for Oscar  
    const oscarUser = await db.get("SELECT id FROM users WHERE email = 'oscar@onepluselectric.com'");
    if (oscarUser) {
      await db.run(`
        INSERT OR IGNORE INTO projects (user_id, name, type, status, monthly_rate, setup_fee, start_date, next_billing)
        VALUES (?, 'Website + GBP Package', 'retainer', 'active', 400, 300, '2026-03-25', '2026-05-01')
       `, [oscarUser.id]);

      // Get the project ID
      const oscarProject = await db.get("SELECT id FROM projects WHERE user_id = ? ORDER BY id DESC LIMIT 1", [oscarUser.id]);

      if (oscarProject) {
         // Insert project updates/milestones - use direct values instead of SELECT subquery
        await db.run(`
          INSERT INTO project_updates (project_id, title, description, type) 
          VALUES (?, 'Website Deployed', 'Custom contractor website live at onepluselectric.com', 'milestone')
        `, [oscarProject.id]);

        await db.run(`
          INSERT INTO project_updates (project_id, title, description, type)
          VALUES (?, 'GBP Optimized', 'Google Business Profile fully optimized with photos, services, and posts', 'milestone')
        `, [oscarProject.id]);

        await db.run(`
          INSERT INTO project_updates (project_id, title, description, type)
          VALUES (?, 'First Review Response', 'Set up automated review response system', 'update')
        `, [oscarProject.id]);

         // Insert invoice - use direct values instead of SELECT subquery
        await db.run(`
          INSERT OR IGNORE INTO invoices (client_id, invoice_number, amount, status, due_date, description, line_items)
          VALUES (?, 'INV-2026-001', 700, 'paid', '2026-04-01', 'Setup + First Month', '[{"desc":"Website Setup","amount":300},{"desc":"Monthly Retainer (Apr)","amount":400}]')
        `, [oscarUser.id]);
       }
     }

    return res.json({ success: true, message: 'Database seeded successfully' });

   } catch (err) {
    return res.status(500).json({ error: 'Seed failed', details: err.message });
  }
};