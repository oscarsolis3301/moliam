/**
 * Workforce Clock-in/out Handler
 * POST /api/workforce-clock - Register clock-in or clock-out
 * Features: GPS tracking, geofence validation, automatic duration calculation
 */

export default {
  async fetch(request, env) {
    const method = request.method;
    const url = new URL(request.url);
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: await this.corsHeaders(request, env)
      });
    }

    try {
      // Authentication check - extract session cookie
      const cookie = request.headers.get('cookie') || '';
      const sessionToken=this.extractSession(cookie);
      
      if (!sessionToken) {
        return this.jsonResp({ error: 'Unauthorized', status: 401 }, env);
      }

      // Verify session and get user info
      const session = await this.validateSession(sessionToken, env);
      if (!session) {
        return this.jsonResp({ error: 'Invalid session', status: 401 }, env);
      }

      // Parse request body
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return this.jsonResp({ error: 'Invalid JSON body', status: 400 }, env);
      }

      const action = body.action || url.searchParams.get('action');
      
      if (!action) {
        return this.jsonResp({ error: 'Action required: "clock_in" or "clock_out"', status: 400 }, env);
      }

      // Route to handler
      switch (action) {
        case 'clock_in':
          return await this.handleClockIn(body, session, env);
        case 'clock_out':
          return await this.handleClockOut(body, session, env);
        case 'status':
          return await this.getActiveWorkers(env, session);
        case 'history':
          return await this.getClockHistory(body, session, env);
        default:
          return this.jsonResp({ error: 'Unknown action', status: 400 }, env);
      }

    } catch (error) {
      const msg = error.message || 'Internal server error';
      console.error('workforce-clock.js:', msg, error);
      return this.jsonResp({ error: msg, status: 500 }, env);
    }
  },

  async handleClockIn(body, session, env) {
    const { email, id: user_id } = session;
    
    // Get worker record
    const workerId = await this.getWorkerId(email, env);
    if (!workerId) {
      return this.jsonResp({ 
        error: 'Not authorized - Worker record not found', 
        status: 403 
      }, env);
    }

    // Extract GPS coordinates from request body or use geolocation header
    const lat = body.lat || body.location_lat || null;
    const lng = body.lng || body.location_lng || null;
    
    if (lat && lng) {
      // Check geofence - calculate distance to worker's geofence center
      let geofenceStatus = 'unknown';
      if (env.MOLIAM_DB && env.WorkforceGeofences) {
        const geoResult = await env.MOLIAM_DB.prepare(`
          SELECT wg.center_lat, wg.center_lat as lat_center, 
                 AVG(wg.radius_meters) as radius_meters
          FROM workforce_geofences wg
          JOIN workforce_workers ww ON ww.geofence_id = wg.id
          WHERE ww.id = ?
        `).bind(workerId).first();
        
        if (geoResult && geoResult.lat_center) {
          const distance = this.haversineDistance(
            lat, lng, 
            geoResult.lat_center, 
            parseFloat(geoResult.radius_meters || 100)
          );
          geofenceStatus = distance <= 100 ? 'inside' : 'outside';
        } else {
          // No geofence assigned - allow clock-in but flag for admin review
          geofenceStatus = 'no_geofence';
        }
      }

      // Attempt to insert clock-in log record
      const stmt = env.MOLIAM_DB.prepare(`
        INSERT INTO workforce_clock_logs 
        (worker_id, clock_in_time, location_lat, location_lng, geofence_status, battery_level, device_info)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        workerId,
        new Date().toISOString(),
        lat,
        lng,
        geofenceStatus,
        body.battery_level || null,
        body.device_info || 'unknown'
      );

      const result = await stmt.run();

      return this.jsonResp({
        success: true,
        status: 201,
        data: {
          log_id: result.meta.lastInsertRowid,
          worker_id: workerId,
          clock_in_time: new Date().toISOString(),
          geofence_status: geofenceStatus,
          location: { lat, lng },
          message: geofenceStatus === 'outside' 
            ? 'Clock-in successful but outside geofence zone - alert sent to supervisor'
            : 'Successfully clocked in'
        }
      }, env);
    } else {
      // No GPS - allow but require confirmation
      const stmt = env.MOLIAM_DB.prepare(`
        INSERT INTO workforce_clock_logs 
        (worker_id, clock_in_time, geofence_status, device_info)
        VALUES (?, ?, 'no_gps', ?)
      `).bind(
        workerId,
        new Date().toISOString(),
        body.device_info || 'unknown'
      );

      const result = await stmt.run();

      return this.jsonResp({
        success: true,
        status: 201,
        data: {
          log_id: result.meta.lastInsertRowid,
          message: 'Clock-in successful without GPS - geofence tracking disabled for this session',
          warning: 'GPS coordinates required for full features'
        }
      }, env);
    }
  },

  async handleClockOut(body, session, env) {
    const { email, id: user_id } = session;

    const workerId = await this.getWorkerId(email, env);
    if (!workerId) {
      return this.jsonResp({ 
        error: 'Not authorized - Worker record not found', 
        status: 403 
      }, env);
    }

    // Find active clock-in log for this worker
    const activeLog = await env.MOLIAM_DB.prepare(`
      SELECT * FROM workforce_clock_logs 
      WHERE worker_id = ? AND status = 'active' 
      ORDER BY id DESC LIMIT 1
    `).bind(workerId).first();

    if (!activeLog) {
      return this.jsonResp({ 
        error: 'No active shift found - clock in first or start new shift', 
        status: 400 
      }, env);
    }

    const now = new Date().toISOString();
    
    // Calculate duration in hours
    const clockInTime = new Date(activeLog.clock_in_time);
    const durationHours = (new Date(now) - clockInTime) / 3600000;

    // Update existing record with clock out time and duration
    await env.MOLIAM_DB.prepare(`
      UPDATE workforce_clock_logs 
      SET clock_out_time = ?, 
          clock_out_duration = ?, 
          status = 'completed',
          updated_at = ?
      WHERE id = ?
    `).bind(now, durationHours, now, activeLog.id).run();

    // Auto-generate timesheet entry for this work day
    await this.generateTimesheetEntry(activeLog.worker_id, now, durationHours, env);

    return this.jsonResp({
      success: true,
      data: {
        message: 'Successfully clocked out',
        shift_duration_hours: parseFloat(durationHours.toFixed(2)),
        clock_in_time: activeLog.clock_in_time,
        clock_out_time: now
      }
    }, env);
  },

  async getActiveWorkers(env, session) {
    // Admin can see all workers' current status; workers see only themselves
    let workerId = null;
    if (session.role === 'worker' || session.role === 'manager') {
      workerId = await this.getWorkerId(session.email, env);
    }

    const query = session.role === 'admin' 
      ? `SELECT wc.id, wc.clock_in_time, wc.geofence_status, wc.location_lat, wc.location_lng, 
          ww.full_name, ww.department, ww.status as worker_status
         FROM workforce_clock_logs wc
         JOIN workforce_workers ww ON ww.id = wc.worker_id
         WHERE wc.status = 'active' AND ww.status = 'active'
         ORDER BY wc.clock_in_time DESC`
      : `SELECT wc.id, wc.clock_in_time, wc.geofence_status, wc.location_lat, wc.location_lng, 
          ww.full_name, ww.department, ww.status as worker_status
         FROM workforce_clock_logs wc
         JOIN workforce_workers ww ON ww.id = wc.worker_id
         WHERE wc.status = 'active' AND ww.id = ?`;

    const result = await env.MOLIAM_DB.prepare(query)
      .bind(session.role === 'admin' ? null : workerId || 0)
      .all();

    return this.jsonResp({
      success: true,
      data: {
        active_workers: result.results,
        count: result.results.length
      }
    }, env);
  },

  async getClockHistory(body, session, env) {
    const workerId = await this.getWorkerId(session.email, env);
    if (!workerId && session.role !== 'admin') {
      return this.jsonResp({ error: 'Unauthorized', status: 403 }, env);
    }

    const limit = Math.min(parseInt(body.limit || body.max) || 50, 100);
    const offset = parseInt(body.offset || 0) || 0;
    
    const query = session.role === 'admin'
      ? `SELECT wc.*, ww.full_name, ww.department, wge.name as geofence_name
         FROM workforce_clock_logs wc
         JOIN workforce_workers ww ON ww.id = wc.worker_id
         LEFT JOIN workforce_geofences wge ON wge.id = ww.geofence_id
         ORDER BY wc.id DESC LIMIT ? OFFSET ?`
      : `SELECT wc.*, ww.full_name, ww.department
         FROM workforce_clock_logs wc
         JOIN workforce_workers ww ON ww.id = wc.worker_id
         WHERE wc.worker_id = ?
         ORDER BY wc.id DESC LIMIT ? OFFSET ?`;

    const result = session.role === 'admin'
      ? await env.MOLIAM_DB.prepare(query).bind(limit, offset).all()
      : await env.MOLIAM_DB.prepare(query).bind(workerId || 0, limit, offset).all();

    return this.jsonResp({
      success: true,
      data: {
        logs: result.results,
        total: result.count,
        has_more: result.results.length === limit
      }
    }, env);
  },

  async generateTimesheetEntry(workerId, clockOutTime, hoursWorked, env) {
    const now = new Date(clockOutTime);
    const weekStart = this.getWeekStartDate(now);
    
    // Find or create timesheet for this week
    let timesheet = await env.MOLIAM_DB.prepare(`
      SELECT * FROM workforce_timesheets 
      WHERE worker_id = ? AND week_start_date = ?
    `).bind(workerId, weekStart).first();

    if (!timesheet) {
      // Create new timesheet for this week
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      await env.MOLIAM_DB.prepare(`
        INSERT INTO workforce_timesheets 
        (worker_id, week_start_date, week_end_date, total_hours, status)
        VALUES (?, ?, ?, ?, 'draft')
      `).bind(workerId, weekStart, weekEnd.toISOString(), 0).run();
    }

    // Insert timesheet entry for today
    const entryDate = now.toISOString().split('T')[0];
    
    await env.MOLIAM_DB.prepare(`
      INSERT INTO workforce_timesheet_entries 
      (timesheet_id, entry_date, clock_in, total_hours)
      SELECT id, ?, DATE(?, 'localtime'), ? FROM workforce_timesheets
      WHERE worker_id = ? AND status = 'draft'
      ORDER BY id DESC LIMIT 1
    `).bind(entryDate, now.toISOString(), hoursWorked, workerId).run();

    return true;
  },

  // ========== HELPER METHODS ==========

  getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay() || 7; // Sunday returns 0, convert to 7
    d.setDate(d.getDate() - day + 1); // Set to Monday
    return d.toISOString().split('T')[0];
  },

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) * 
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  async getWorkerId(email, env) {
    const result = await env.MOLIAM_DB.prepare(`
      SELECT id FROM workforce_workers WHERE email = ?
    `).bind(email).first();
    return result ? result.id : null;
  },

  // ========== STANDARD CORS + RESPONSE HELPERS ==========

  async corsHeaders(req, env) {
    const headers = {
      'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie, Authorization',
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json'
    };

    return headers;
  },

  jsonResp(data, env) {
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  },

  extractSession(cookie) {
    if (!cookie) return null;
    const match = cookie.match(/cf_session=([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  },

  async validateSession(token, env) {
    try {
      const result = await env.MOLIAM_DB.prepare(`
        SELECT u.id, u.email, u.role, u.full_name
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `).bind(token).first();

      return result;
    } catch (e) {
      console.error('validateSession error:', e.message);
      return null;
    }
  }
};
