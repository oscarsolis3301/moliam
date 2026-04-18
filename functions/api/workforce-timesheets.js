/**
 * Workforce Timesheets Handler
 * GET/POST /api/workforce-timesheets - View, manage, submit timesheets
 * CA OT compliance: 1.5x after 8hrs/day, 2x on Sunday holidays
 */

export default {
  async fetch(request, env) {
    const method = request.method;
    
    if (method === 'OPTIONS') {
      return this.corsResponse(request, env);
     }

    try {
      const session = await this.auth(request, env);
      if (!session) {
        return this.json({ error: 'Unauthorized', code: 401 }, 401);
       }

      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'list';

       switch (action) {
        case 'list':
          return await this.listTimesheets(session, env);
        case 'view':
          return await this.viewTimesheet(session, env);
        case 'submit':
          return await this.submitTimesheet(request, session, env);
        case 'approve':
          return await this.approveTimesheet(request, session, env);
        case 'entries':
          return await this.getEntries(session, env);
        case 'caot_report':
          return await this.generateCAOTovertimesReport(env, session);
        default:
          return this.json({ error: 'Unknown action', code: 400 }, 400);
       }

     } catch (error) {
      console.error('workforce-timesheets.js:', error.message);
      return this.json({ error: 'Internal server error', code: 500 }, 500);
     }
   },

  async listTimesheets(session, env) {
    const where = [];
    const params = [];

     // Filter scope by role
    if (['worker', 'manager'].includes(session.role)) {
      const workerId = await this.getWorkerId(session.email, env);
      if (workerId) {
        where.push('wt.worker_id = ?');
        params.push(workerId);
       } else {
         return this.json({ error: 'Worker record not found', code: 403 }, 403);
       }
     }

    const status = session.queryParams.get('status');
    if (status && ['draft', 'submitted', 'approved', 'payrolled'].includes(status)) {
      where.push('wt.status = ?');
      params.push(status);
     }

    const dateFilter = session.queryParams.get('from') || session.queryParams.get('month');
    if (dateFilter) {
      where.push('wt.week_start_date >= ?');
      params.push(dateFilter);
     }

    const fromClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const query = `
       SELECT wt.*, ww.full_name, ww.department, 
         CAST(wt.total_hours as REAL) as total_hours,
         CAST(wt.regular_hours as REAL) as regular_hours,
         ((wt.overtime_hours_regular * 1.5) + (wt.overtime_hours_weekend * 2.0)) * COALESCE(ww.hourly_rate, 0) as ot_pay_amount
        FROM workforce_timesheets wt
       JOIN workforce_workers ww ON ww.id = wt.worker_id
       ${fromClause}
      ORDER BY wt.week_start_date DESC
      LIMIT 100
     `;

    const result = params.length > 0 
      ? await env.MOLIAM_DB.prepare(query).bind(...params).all()
       : await env.MOLIAM_DB.prepare(query).all();

    return this.json({
      success: true,
      timesheets: result.results.slice(0, 20),
      has_more: result.count > 20
     });
   },

  async viewTimesheet(session, env) {
    const id = parseInt(session.queryParams.get('id'));
    
    if (!id || isNaN(id)) {
      return this.json({ error: 'Missing timesheet ID', code: 400 }, 400);
     }

    const query = `
       SELECT wt.*, ww.full_name, ww.department, ww.hourly_rate, ww.overtime_rate,
         CAST(wt.total_hours as REAL) as total_hours
        FROM workforce_timesheets wt
       JOIN workforce_workers ww ON ww.id = wt.worker_id
       WHERE id = ?
     `;

    const sheet = await env.MOLIAM_DB.prepare(query).bind(id).first();
    if (!sheet) {
      return this.json({ error: 'Timesheet not found', code: 404 }, 404);
     }

     // Get entries for this timesheet
    const entries = await env.MOLIAM_DB.prepare(`
       SELECT * FROM workforce_timesheet_entries 
       WHERE timesheet_id = ?
      ORDER BY entry_date
     `).bind(id).all();

    sheet.entries = entries.results;

    return this.json({ success: true, timesheet: sheet });
   },

  async submitTimesheet(request, session, env) {
    const data = await this.getJsonBody(request);
    
    const timesheetId = parseInt(data.timesheet_id);
    if (!timesheetId) {
      return this.json({ error: 'Missing timesheet_id', code: 400 }, 400);
     }

     // Verify ownership or admin rights
    const sheet = await env.MOLIAM_DB.prepare(`
       SELECT * FROM workforce_timesheets WHERE id = ?
     `).bind(timesheetId).first();

    if (!sheet) {
      return this.json({ error: 'Timesheet not found', code: 404 }, 404);
     }

    const workerId = await this.getWorkerId(session.email, env);
    if (workerId !== sheet.worker_id && session.role !== 'admin' && session.role !== 'manager') {
      return this.json({ error: 'Access denied', code: 403 }, 403);
     }

     // Update timesheet status to submitted and timestamp
    const now = new Date().toISOString();
    
    await env.MOLIAM_DB.prepare(`
       UPDATE workforce_timesheets 
       SET status = 'submitted', submitted_at = ?
       WHERE id = ?
     `).bind(now, timesheetId).run();

     // Send notification to manager/admin if not admin themselves
    if (session.role === 'worker') {
      await this.notifyManager(timesheetId, session, env);
     }

    return this.json({
      success: true,
      message: 'Timesheet submitted for approval',
      data: sheet
     });
   },

  async approveTimesheet(request, session, env) {
     if (session.role !== 'admin' && session.role !== 'manager') {
      return this.json({ error: 'Only admins/managers can approve timesheets', code: 403 }, 403);
     }

    const data = await this.getJsonBody(request);
    const id = parseInt(data.timesheet_id);
    
    if (!id) {
      return this.json({ error: 'Missing timesheet_id', code: 400 }, 400);
     }

    const status = data.status || 'approved';
    const now = new Date().toISOString();

    const updateQuery = status === 'approved' 
       ? `UPDATE workforce_timesheets SET status = ?, approved_at = ? WHERE id = ?`
       : `UPDATE workforce_timesheets SET status = ? WHERE id = ?`;

    if (status === 'approved') {
      await env.MOLIAM_DB.prepare(updateQuery).bind(status, now, id).run();
     } else {
      await env.MOLIAM_DB.prepare(updateQuery).bind(status, id).run();
     }

    return this.json({ success: true, message: `Timesheet ${status}` });
   },

  async getEntries(session, env) {
    const sheetsId = parseInt(session.queryParams.get('timesheet_id'));
    
    if (!sheetsId || isNaN(sheetsId)) {
      return this.json({ error: 'Missing timesheet_id', code: 400 }, 400);
     }

    const query = `
       SELECT * FROM workforce_timesheet_entries 
       WHERE timesheet_id = ?
      ORDER BY entry_date ASC
     `;

    const result = await env.MOLIAM_DB.prepare(query).bind(sheetsId).all();

    return this.json({ success: true, entries: result.results });
   },

  async generateCAOTovertimesReport(env, session) {
     if (session.role !== 'admin') {
      return this.json({ error: 'Admin access required', code: 403 }, 403);
     }

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];

     // Aggregate overtime data by worker, week, and department
    const query = `
       SELECT wt.id, wt.worker_id, ww.full_name, ww.department, ww.hourly_rate, ww.overtime_rate,
         wt.week_start_date,
         CAST(wt.total_hours as REAL) as total_hours,
         CAST(wt.regular_hours as REAL) as regular_hours,
         CAST(wt.overtime_hours_regular as REAL) as overtime_regular,
         CAST(wt.overtime_hours_weekend as REAL) as overtime_sunday,
         (COALESCE(wt.overtime_hours_regular, 0) * COALESCE(ww.overtime_rate, 1.5) + 
          COALESCE(wt.overtime_hours_weekend, 0) * COALESCE(ww.overtime_rate, 2.0)) as overtime_pay
        FROM workforce_timesheets wt
       JOIN workforce_workers ww ON ww.id = wt.worker_id
       WHERE wt.week_start_date >= ? AND wt.status = 'approved'
      ORDER BY wt.overtime_hours_regular DESC, wt.overtime_hours_weekend DESC
     `;

    const result = await env.MOLIAM_DB.prepare(query).bind(lastMonth).all();
    
     // Calculate total OT pay for the period
    let totalOTPay = 0;
    const formattedData = result.results.map(row => {
      const hoursOf = parseFloat(row.overtime_regular) || 0;
      const weekSundays = parseFloat(row.overtime_sunday) || 0;
       const rate = row.hourly_rate || 0;
      const otRate = row.overtime_rate || 1.5;
       totalOTPay += (hoursOf * rate * otRate) + (weekSundays * rate * otRate);

      return {
        ...row,
        overtime_pay: parseFloat(((hoursOf * rate * otRate) + (weekSundays * rate * otRate)).toFixed(2)),
        weeklyTotals: row.week_start_date,
        totalHours: parseFloat(row.total_hours.toFixed(1))
       };
     });

    return this.json({
      success: true,
      report_period: `Last 30 days from ${lastMonth}`,
      total_overtime_payments: totalOTPay.toFixed(2),
      summary: {
        total_sheets: formattedData.length,
        workers_with_ot: new Set(formattedData.map(d => d.worker_id)).size,
        average_hours_per_sheet: (formattedData.reduce((acc, r) => acc + parseFloat(r.total_hours || 0), 0) / formattedData.length).toFixed(1)
       },
      data: formattedData
     });
   },

   // ========== HELPER METHODS ==========

  async getJsonBody(request) {
    try {
      return await request.json();
     } catch (e) {
      return {};
     }
   },

  corsResponse(req, env) {
    const headers = {
      'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie'
    };
    return new Response(null, { headers });
   },

  async auth(req, env) {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/cf_session=([a-zA-Z0-9]+)/);
    
    if (!match) return null;
     const token = match[1];

    try {
      const result = await env.MOLIAM_DB.prepare(`
         SELECT u.id, u.email, u.role, u.full_name, COALESCE(ww.hourly_rate, 0) as hourly_rate
        FROM sessions s
       JOIN users u ON u.id = s.user_id
      LEFT JOIN workforce_workers ww ON ww.user_id = u.id
       WHERE s.token = ? AND s.expires_at > datetime('now')
     `).bind(token).first();

      return result;
    } catch (e) {
      console.error('auth error:', e.message);
      return null;
    }
  },

  async getWorkerId(email, env) {
    const result = await env.MOLIAM_DB.prepare(`
       SELECT id FROM workforce_workers WHERE email = ?
     `).bind(email).first();
    return result ? result.id : null;
   },

  async notifyManager(timesheetId, workerSession, env) {
     // Notify manager/approver that worker submitted timesheet
    const sheet = await env.MOLIAM_DB.prepare(`
       SELECT wt.*, ww.full_name, ww.email as worker_email 
       FROM workforce_timesheets wt
      JOIN workforce_workers ww ON ww.id = wt.worker_id
       WHERE wt.id = ?
     `).bind(timesheetId).first();

    if (!sheet) return;

    // Find managers/admins to notify
    const managers = await env.MOLIAM_DB.prepare(`
       SELECT email, full_name FROM users 
       WHERE role IN ('admin', 'manager') AND is_active = 1
     `).all();

    for (const mgr of managers.results) {
      // Log notification - could integrate with Discord webhook or email
      console.log(`TIMESHEET NOTIFICATION: ${mgr.full_name} <${mgr.email}> has new timesheet from ${sheet.full_name}`);
     }
   },

  json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
   }
};
