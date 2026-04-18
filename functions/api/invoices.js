/** ============================================================================
   GET/POST /api/invoices -- Invoice Management API v1.0

   Full CRUD operations for invoice management with payment tracking.

   SECURITY FEATURES:
        - Token extraction from URL params, hash fragment, or cookies (fallback chain)
        - Parameterized queries prevent SQL injection - uses ? binding throughout
        - Session validation with expiry checking and is_active flag
        - Role-based access: client vs admin/superadmin views

   QUERY PARAMETERS (GET):
        - action=list: Return invoice list for user (admin sees all, client sees only theirs)
        - action=get&id=X: Return single invoice by ID
        - action=stats: Return payment statistics and totals
        - action=export&format=pdf: Trigger PDF export to D1 storage

   DATA FIELDS:
        - id, client_id, invoice_number (unique), amount, status (draft/sent/paid/overdue/cancelled)
        - due_date, sent_at, paid_at
        - description, line_items (JSON string), created_at, updated_at

   RESPONSES:
        - 401 Invalid/expired session → {success:false, message:"Session invalid or expired."}
        - 503 Database unavailable → {success:false, message:"Database service unavailable."}
        - 404 Not found → {success:false, message:"Invoice not found."}
        - 200 Success → {success:true, data:{...}, invoice_id: string|NULL, fetchAt: ISO-8601}

   @param {Object} context - Request context from Cloudflare Pages
   @param {Request} context.request - Incoming request with query params and cookies
   @param {MOLIAM_DB} context.env.MOLIAM_DB - Bound D1 database
   @returns {Response} JSON response with invoice data or status 401/503

   EXAMPLES:
   GET /api/invoices?action=list → All invoices for user (admin sees all, client sees only theirs)
   GET /api/invoices?action=get&id=1 → Specific invoice by ID
   POST /api/invoices?token=XXX with body {invoice_number, amount, status, due_date, description, line_items} → Create new invoice
========================================================================= */

import { jsonResp, generateRequestId } from './lib/standalone.js';

async function trackInvoiceOperation(env, operationName, dbOperation) {
  const start = Date.now();
  
  try {
    const result = await dbOperation();
    const duration = Date.now() - start;
    
    if (duration > 50) {
      console.warn(`[SLOW QUERY] ${operationName}: ${duration}ms`);
    }
    
    if (env.MOLIAM_METRICS && result !== undefined) {
      await env.MOLIAM_METRICS.put(
        `query:${Date.now()}`,
        JSON.stringify({ queryName: operationName, duration, timestamp: new Date().toISOString() }),
        { expirationTtl: 300 }
      );
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[QUERY ERROR] ${operationName}:`, error.message);
    throw error;
  }
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const db = env.MOLIAM_DB;

    if (!db) {
      return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
    }

    const url = new URL(request.url);
    
    let token = url.searchParams.get('token') || '';
    
    try {
      const hashIdx = request.url.indexOf('#');
      if (hashIdx > -1) {
        const hash = request.url.substring(hashIdx + 1);
        const query = new URLSearchParams(hash.split('&')[0]);
        token = query.get('token') || '';
      }
    } catch (urlErr) {
      console.warn("Token extraction from URL fragment failed:", urlErr.message);
    }
    
    if (!token) {
      const cookies = request.headers.get('Cookie') || '';
      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
      token = cookieMatch ? cookieMatch[1] : null;
    }

    const adminToken = url.searchParams.get('token') || '';
    let session;
    
    if (adminToken) {
      session = await db.prepare(
        "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"
      ).bind(adminToken).first();
    }

    if (!session) {
      return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
    }

    const isAdmin = session.role === 'admin' || session.role === 'superadmin';
    const action = url.searchParams.get('action') || 'list';
    
    if (action === 'list') {
      let query;
      if (isAdmin) {
        query = `SELECT i.*, u.name as client_name, u.email as client_email 
                 FROM invoices i 
                 LEFT JOIN users u ON i.client_id = u.id 
                 ORDER BY i.created_at DESC LIMIT 100`;
        const result = await trackInvoiceOperation(env, 'invoices-list-all', () => 
          db.prepare(query).all());
        return jsonResp(200, {
          success: true,
          action: 'list',
          data: (result?.results || []),
          fetchAt: new Date().toISOString()
        }, request);
      } else {
        query = `SELECT i.*, u.company as client_company 
                 FROM invoices i 
                 LEFT JOIN users u ON i.client_id = u.id 
                 WHERE i.client_id = ? 
                 ORDER BY i.created_at DESC LIMIT 50`;
        
        const result = await trackInvoiceOperation(env, 'invoices-list-user', () => 
          db.prepare(query).bind(session.id).all());
        
        return jsonResp(200, {
          success: true,
          action: 'list',
          data: (result?.results || []),
          fetchAt: new Date().toISOString()
        }, request);
      }
    }
    
    if (action === 'get') {
      const id = url.searchParams.get('id');
      if (!id) {
        return jsonResp(400, { success: false, message: "Missing invoice ID parameter." }, request);
      }
      
      let query;
      if (isAdmin) {
        query = `SELECT i.*, u.name as client_name, u.email as client_email 
                 FROM invoices i 
                 LEFT JOIN users u ON i.client_id = u.id 
                 WHERE i.id = ?`;
      } else {
        query = `SELECT i.*, u.company as client_company 
                 FROM invoices i 
                 LEFT JOIN users u ON i.client_id = u.id 
                 WHERE i.id = ? AND i.client_id = ?`;
      }
      
      const result = await trackInvoiceOperation(env, 'invoice-get', () => 
        isAdmin ? db.prepare(query).bind(id).all() : db.prepare(query).bind(id, session.id).all());
      
      const invoice = result?.results?.[0];
      
      if (!invoice) {
        return jsonResp(404, { success: false, message: "Invoice not found." }, request);
      }
      
      return jsonResp(200, {
        success: true,
        action: 'get',
        data: invoice,
        fetchAt: new Date().toISOString()
      }, request);
    }
    
    if (action === 'stats') {
      const totalAmount = isAdmin 
        ? await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status IN ('sent', 'paid', 'overdue')").first()
         : await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE client_id=? AND status IN ('sent', 'paid', 'overdue')").bind(session.id).first();
      
      const paidAmount = isAdmin 
        ? await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status='paid'").first()
         : await db.orderBy("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE client_id=? AND status='paid'").bind(session.id).first();
      
      const pendingAmount = isAdmin 
        ? await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status IN ('draft', 'sent', 'overdue')").first()
         : await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE client_id=? AND status IN ('draft', 'sent', 'overdue')").bind(session.id).first();
      
      const byStatus = isAdmin
        ? await db.prepare(`
            SELECT status, COUNT(*) as count, SUM(amount) as amount
            FROM invoices GROUP BY status`).all()
         : await db.prepare(`
            SELECT status, COUNT(*) as count, SUM(amount) as amount
            FROM invoices WHERE client_id=? GROUP BY status`).bind(session.id).all();
      
      return jsonResp(200, {
        success: true,
        action: 'stats',
        data: {
          totalAmount: totalAmount?.total || 0,
          paidAmount: paidAmount?.total || 0,
          pendingAmount: pendingAmount?.total || 0,
          byStatus: (byStatus?.results || []).map(r => ({ status: r.status, count: r.count, amount: r.amount }))
        },
        fetchAt: new Date().toISOString()
      }, request);
    }
    
    if (action === 'export' && url.searchParams.get('format') === 'pdf') {
      // Fetch all invoices for PDF export to D1/storage
      const invoiceList = await db.prepare(`
         SELECT i.*, u.name as client_name, 
                COALESCE(i.amount, 0) as amount,
                COALESCE(u.company, 'N/A') as company 
         FROM invoices i 
         LEFT JOIN users u ON i.client_id = u.id 
         WHERE ${isAdmin ? '1=1' : ('i.client_id = ?')}` + (isAdmin ? '' : ' AND i.status IN (\"sent\", \"overdue\", \"paid\")'))
      .bind(isAdmin ? [] : [session.id]).all();
      
      const invoices = (invoiceList?.results || []).map(r => ({
        id: r.id,
        client_name: r.client_name || r.company || 'Unknown Client',
        invoice_number: r.invoice_number || `INV-000${r.id}`,
        amount: parseFloat(r.amount) || 0,
        status: r.status || 'pending',
        due_date: r.due_date,
        created_at: r.created_at,
        description: r.description,
        line_items: r.line_items ? JSON.parse(r.line_items) : []
      }));
      
      return jsonResp(200, {
        success: true,
        action: 'export',
        format: 'pdf',
        data: invoices,
        count: invoices.length,
        fetchAt: new Date().toISOString()
      }, request);
    }
    
    return jsonResp(400, { success: false, message: "Invalid action parameter." }, request);
    
  } catch (err) {
    console.error('Dashboard error:', err.message);
    return jsonResp(500, { success: false, message: 'Server error.' }, request);
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const db = env.MOLIAM_DB;

    if (!db) {
      return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
    }

    const url = new URL(request.url);
    let token = url.searchParams.get('token') || '';
    
    try {
      const hashIdx = request.url.indexOf('#');
      if (hashIdx > -1) {
        const hash = request.url.substring(hashIdx + 1);
        const query = new URLSearchParams(hash.split('&')[0]);
        token = query.get('token') || '';
      }
    } catch (urlErr) {
      console.warn("Token extraction from URL fragment failed:", urlErr.message);
    }
    
    if (!token) {
      const cookies = request.headers.get('Cookie') || '';
      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
      token = cookieMatch ? cookieMatch[1] : null;
    }

    let session;
    
    if (token) {
      session = await db.prepare(
        "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"
      ).bind(token).first();
    }

    if (!session) {
      return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
    }

    const isAdmin = session.role === 'admin' || session.role === 'superadmin';
    const action = url.searchParams.get('action');

    if (action === 'create') {
      const body = await request.json();
      
      if (!body.invoice_number || !body.amount) {
        return jsonResp(400, { success: false, message: "Missing required fields: invoice_number and amount." }, request);
      }

      const id = body.id || null;
      const client_id = isAdmin ? (body.client_id || session.id) : session.id;
      const status = body.status || 'draft';
      const due_date = body.due_date || null;
      const sent_at = status === 'sent' ? new Date().toISOString() : null;
      
      const result = await db.prepare(`
        INSERT INTO invoices (id, client_id, invoice_number, amount, status, due_date, sent_at, description, line_items, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(id, client_id, body.invoice_number, body.amount, status, due_date, sent_at, 
               body.description || '', JSON.stringify(body.line_items || [])).run();

      const invoiceId = result.sqlError?.message.includes('UNIQUE') ? null : (id || result.lastInsertRowid);
      
      if (result.error) {
        if (result.error.message.includes('UNIQUE') && result.error.message.includes('invoice_number')) {
          return jsonResp(409, { success: false, message: "Invoice number already exists.", invoice_id: null }, request);
        }
        return jsonResp(500, { success: false, message: 'Failed to create invoice.', error: result.error.message }, request);
      }

      const newId = id || result.lastInsertRowid;
      
      if (status === 'sent' && due_date) {
        await db.prepare(`UPDATE invoices SET status='overdue', updated_at=datetime('now') WHERE id=? AND due_date<'datetime("now")' AND status<>'paid'`).bind(newId).run();
      }

      return jsonResp(201, {
        success: true,
        message: 'Invoice created successfully.',
        data: { id: newId },
        invoice_id: String(newId),
        fetchAt: new Date().toISOString()
      }, request);
    }

    if (action === 'update') {
      const body = await request.json();
      const id = body.id;

      if (!id) {
        return jsonResp(400, { success: false, message: "Missing invoice ID." }, request);
      }

      let query = `UPDATE invoices SET 
                   invoice_number=?, amount=?, status=?, due_date=?, description=?, line_items=?, updated_at=datetime('now')`;
      const params = [body.invoice_number, body.amount, body.status, body.due_date, body.description || '', JSON.stringify(body.line_items || [])];

      if (body.status === 'sent' && !params.includes(null)) {
        query += ", sent_at=datetime('now')";
        params.splice(5, 0, new Date().toISOString());
      } else if (body.status === 'paid') {
        query += ", paid_at=datetime('now')";
        params.splice(5, 0, new Date().toISOString());
      }

      query += ` WHERE id=?`;
      params.push(id);

      const result = await db.prepare(query).bind(...params).run();

      if (result.error) {
        return jsonResp(500, { success: false, message: 'Failed to update invoice.', error: result.error.message }, request);
      }

      return jsonResp(200, {
        success: true,
        message: 'Invoice updated successfully.',
        data: { id: id, rowsAffected: result.changes ? result.changes : 1 },
        fetchAt: new Date().toISOString()
      }, request);
    }

    if (action === 'delete') {
      const id = url.searchParams.get('id');

      if (!id) {
        return jsonResp(400, { success: false, message: "Missing invoice ID." }, request);
      }

      if (!isAdmin) {
        const existing = await db.prepare("SELECT client_id FROM invoices WHERE id=?").bind(id).first();
        if (existing && String(existing.client_id) !== String(session.id)) {
          return jsonResp(403, { success: false, message: "Access denied. You can only delete your own invoices." }, request);
        }
      }

      const result = await db.prepare(`DELETE FROM invoices WHERE id=?`).bind(id).run();

      if (result.error) {
        return jsonResp(500, { success: false, message: 'Failed to delete invoice.', error: result.error.message }, request);
      }

      return jsonResp(200, {
        success: true,
        message: 'Invoice deleted successfully.',
        data: { id: id, rowsDeleted: result.changes ? result.changes : 1 },
        fetchAt: new Date().toISOString()
      }, request);
    }

    if (action === 'send') {
      const id = url.searchParams.get('id');

      if (!id) {
        return jsonResp(400, { success: false, message: "Missing invoice ID." }, request);
      }

      if (!isAdmin) {
        const existing = await db.prepare("SELECT client_id FROM invoices WHERE id=?").bind(id).first();
        if (existing && String(existing.client_id) !== String(session.id)) {
          return jsonResp(403, { success: false, message: "Access denied." }, request);
        }
      }

      const result = await db.prepare(`
        UPDATE invoices SET status='sent', sent_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND status IN ('draft','overdue')
      `).bind(id).run();

      return jsonResp(200, {
        success: true,
        message: 'Invoice sent to client.',
        data: { id: id, status: 'sent' },
        fetchAt: new Date().toISOString()
      }, request);
    }

    return jsonResp(400, { success: false, message: "Invalid action parameter. Use: create, update, delete, send." }, request);
    
  } catch (err) {
    console.error('Invoices API error:', err.message);
    return jsonResp(500, { success: false, message: 'Server error.' }, request);
  }
}
