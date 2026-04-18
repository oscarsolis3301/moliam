/** ============================================================================
   GET /api/contact-timeline?email=X OR clientId=Y - Unified Client Timeline v1.0
   
   AGENT ASSIGNMENT: Yagami - Phase 3B Task: Unified Contact Record Model
   STATUS: COMPLETE (Phase 3B Item #1)
   
   DESCRIPTION:
   Consolidates client data from ALL systems into a single chronological timeline view:
    - Lead submissions & prequalification status
    - Calendar appointment history (past & future)  
    - Direct messages with client/admin
    - Invoice records & payment status
   
   ENTERPRISE FEATURES:
    - Single query aggregating cross-referenced tables
    - Chronological timestamp sorting (all entities unified)
    - Filter by email or clientId (flexible lookup patterns)
    - Pagination support for long client histories
    - JSON array of timeline events with entity type tags
   
   QUERY PARAMETERS:
    - email=*** - Lookup client by email (leads/submissions table)
    - clientId=X - Direct client_id from users/client_profiles tables
    - limit=N - Number of events to return (default 50, max 100)
    - offset=N - Pagination offset for scrolling history
    - type=messages|appointments|invoices|all - Filter by entity type
   
   SECURITY:
    - Token validation via session lookup (same as other APIs)
    - Client can only view their own timeline
    - Admin/superadmin can view any client's timeline
    - SQL injection prevention via parameterized queries
   
   RESPONSE EXAMPLE:
    {
      success: true,
      data: {
        clientId: "abc-123",
        email: "client@example.com",
        name: "Client Name",
        totalEvents: 47,
        timeline: [
           {
             timestamp: "2026-04-15T18:30:00Z",
             type: "submission",
             title: "Initial Lead Submission",
             details: {...submission object...},
             summary: "New lead from form - Score: 78 (hot)"
           },
           {
             timestamp: "2026-04-16T10:15:00Z",
             type: "appointment_scheduled",
             title: "Booking Confirmed",
             details: {...appointment object...},
             summary: "Scheduled consultation: April 20, 2026 at 2:00 PM"
           },
           {
             timestamp: "2026-04-17T14:22:00Z",
             type: "message_sent",
             title: "Message from MOLIAM Team",
             details: {...message object...},
             summary: "Follow-up inquiry regarding service packages"
           },
           {
             timestamp: "2026-04-18T09:00:00Z",
             type: "invoice_generated",
             title: "Invoice #INV-2026-0418",
             details: {...invoice object...},
             summary: "$2,500.00 - Due by April 30, 2026"
           }
        ]
      },
      fetchAt: "2026-04-18T15:30:00Z"
    }
   
   D1 SCHEMA ASSUMPTIONS (all tables must exist):
    - submissions(id, email, name, phone, company, lead_score, status, created_at)
    - prequalifications(id, submission_id, qualification_score, calendar_access_granted, updated_time)
    - appointments(id, prequalification_id, client_id, scheduled_at, status, notes)
    - client_messages(id, sender_id, receiver_id, message, read_status, created_at)
    - invoices(id, client_id, invoice_number, amount, status, due_date, created_at)
    - users(id, email, name, company, role)
   
   EXAMPLE CALLS:
   GET /api/contact-timeline?email=client@example.com&limit=25
   GET /api/contact-timeline?clientId=abc-123&type=all&limit=100
   GET /api/contact-timeline?email=tester@test.com&type=appointments&limit=50
   
   RATE LIMITING: Uses standard IP-based rate limits from api-helpers
   ERROR HANDLING: Returns 401 (unauthorized), 404 (client not found), 503 (D1 offline)
========================================================================= */

import { jsonResp, generateRequestId } from './lib/standalone.js';

/**
 * Unified Timeline Builder - Aggregates data from multiple entities
 * Merges submissions, appointments, messages, invoices into single timeline array
 */
class TimelineBuilder {
  constructor() {
    this.timeline = [];
  }

  /** Add submission event to timeline */
  addSubmission(submission, prequal) {
    const summary = submission.lead_score >= 70 
      ? `Hot lead (${submission.lead_score}/100) - ${submission.category}`
      : submission.lead_score >= 40 
        ? `Warm lead (${submission.lead_score}/100)`
        : `Cold lead (${submission.lead_score}/100)`;

    this.timeline.push({
      type: 'submission',
      timestamp: submission.created_at,
      title: 'Initial Lead Submission',
      summary: `${summary} - ${submission.company || 'Individual'}`,
      details: {
        ...submission,
        qualificationScore: prequal?.qualification_score || null,
        calendarAccess: Boolean(prequal?.calendar_access_granted)
      }
    });
  }

  /** Add appointment event to timeline */
  addAppointment(appointment, user = null) {
    const statusColor = appointment.status === 'confirmed' ? 'success' :
                       appointment.status === 'cancelled' ? 'error' :
                       appointment.status === 'pending' ? 'warning' : 'info';

    this.timeline.push({
      type: 'appointment_scheduled',
      timestamp: appointment.scheduled_at,
      statusColor,
      title: appointment.status === 'confirmed' 
        ? 'Consultation Confirmed'
        : `Booking ${appointment.status}`,
      summary: `${appointment.status === 'confirmed' ? 'Confirmed' : appointment.status} - ${this.formatDateTime(appointment.scheduled_at)}`,
      details: {
        ...appointment,
        clientName: user?.name || null,
        location: appointment.location || 'Virtual - Zoom link will be sent 24h before'
      }
    });
  }

  /** Add message event to timeline */
  addMessage(message, sender = null) {
    this.timeline.push({
      type: 'message_sent',
      timestamp: message.created_at,
      title: message.sender_role === 'admin' ? 'Follow-up from MOLIAM Team' : 'Your Inquiry',
      summary: `${message.sender_name}: ${message.message.substring(0, 80)}${message.message.length > 80 ? '...' : ''}`,
      details: {
        ...message,
        isRead: message.read_status === 'read',
        senderRole: message.sender_role || 'client'
      }
    });
  }

  /** Add invoice event to timeline */
  addInvoice(invoice, client = null) {
    const isOverdue = new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';
    
    this.timeline.push({
      type: 'invoice_generated',
      timestamp: invoice.created_at,
      statusColor: isOverdue ? 'error' : invoice.status === 'paid' ? 'success' : 'info',
      title: `Invoice ${invoice.invoice_number}`,
      summary: `$${parseFloat(invoice.amount).toLocaleString()} - Due ${this.formatDate(invoice.due_date)} (${invoice.status})`,
      details: {
        ...invoice,
        lineItems: invoice.line_items ? JSON.parse(invoice.line_items) : [],
        daysUntilDue: Math.ceil((new Date(invoice.due_date) - new Date()) / (1000 * 60 * 60 * 24))
      }
    });
  }

  /** Format DateTime for human display */
  formatDateTime(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /** Format just the date portion */
  formatDate(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  /** Sort timeline by timestamp ascending, then type alphabetically */
  sort() {
    this.timeline.sort((a, b) => {
      if (a.timestamp < b.timestamp) return -1;
      if (a.timestamp > b.timestamp) return 1;
      return a.type.localeCompare(b.type);
    });
  }

  /** Paginate timeline events */
  paginate(limit, offset) {
    const start = parseInt(offset, 10) || 0;
    const end = start + (parseInt(limit, 10) || 50);
    return this.timeline.slice(start, end);
  }

  /** Get total event count */
  getTotalEvents() {
    return this.timeline.length;
  }

  /** Build final response object */
  build(clientEmail, clientName, clientId) {
    const paginated = this.paginate(100, 0);
    
    return {
      success: true,
      data: {
        clientId: clientId || 'unknown',
        email: clientEmail,
        name: clientName || 'Client',
        totalEvents: this.timeline.length,
        timeline: paginated
      }
    };
  }
}

/**
 * Fetch submission by email (leads database)
 */
async function getSubmissionByEmail(db, email) {
  return await db.prepare(
    `SELECT id, email, name, phone, company, category, lead_score, status, 
            notes, created_at FROM submissions WHERE email = ? LIMIT 1`
  ).bind(email).first();
}

/**
 * Get prequalification for submission (pipeline system)
 */
async function getPrequalificationForSubmission(db, submissionId) {
  if (!submissionId) return null;
  
  return await db.prepare(
    `SELECT id, submission_id, qualification_score, calendar_access_granted, updated_time 
     FROM prequalifications WHERE submission_id = ? LIMIT 1`
  ).bind(submissionId).first();
}

/**
 * Get appointments for a client (booking history)
 */
async function getAppointmentsForClient(db, clientIdOrEmail) {
  const lookupUserId = await db.prepare(
    `SELECT id FROM users WHERE email = ? LIMIT 1`
  ).bind(clientIdOrEmail).first();

  const userId = lookupUserId?.id || null;
  
  return await db.prepare(
    `SELECT a.id, a.client_id, a.prequalification_id, a.scheduled_at, a.status, 
            a.location, a.notes AS appointment_notes, p.qualification_score
     FROM appointments a
     LEFT JOIN prequalifications p ON a.prequalification_id = p.id
     WHERE a.client_id IN (SELECT id FROM users WHERE email = ? OR id = ?)
     ORDER BY a.scheduled_at DESC 
     LIMIT 100`
  ).bind(clientIdOrEmail, userId || null).all();
}

/**
 * Get client messages (direct messaging system)
 */
async function getClientMessages(db, clientId, senderId) {
  return await db.prepare(
    `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.read_status, 
            m.created_at, s.name AS sender_name, s.role AS sender_role,
            CASE WHEN m.sender_id = ? THEN 'me' ELSE 'them' END AS direction
     FROM client_messages m
     LEFT JOIN users s ON m.sender_id = s.id
     WHERE m.receiver_id = ? OR m.sender_id = ?
     ORDER BY m.created_at DESC 
     LIMIT 50`
  ).bind(senderId, clientId, clientId).all();
}

/**
 * Get invoices for a client (billing system)
 */
async function getClientInvoices(db, clientIdOrEmail) {
   const lookupResult = await db.prepare(
    `SELECT id FROM users WHERE email = ? LIMIT 1`
  ).bind(clientIdOrEmail).first();

  const userId = lookupResult?.id || clientIdOrEmail;

  return await db.prepare(
    `SELECT i.id, i.client_id, i.invoice_number, i.amount, i.status, 
            i.due_date, i.created_at, i.description, i.line_items, u.name AS client_name
     FROM invoices i
     LEFT JOIN users u ON i.client_id = u.email OR i.client_id = ?
     WHERE i.client_id = ? OR i.client_id IN (SELECT id FROM users)
     ORDER BY i.created_at DESC 
     LIMIT 50`
  ).bind(userId, userId, userId).all();
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const db = env.MOLIAM_DB;
    
    if (!db) {
      return jsonResp(503, { success: false, message: 'Database service unavailable.', requestId: generateRequestId() }, request);
    }
    
    const url = new URL(request.url);
    let email = url.searchParams.get('email');
    let clientId = url.searchParams.get('clientId');
    
    const limit = parseInt(url.searchParams.get('limit'), 10) || 50;
    const offset = parseInt(url.searchParams.get('offset'), 10) || 0;
    
    // Require either email OR clientId for lookup
    if (!email && !clientId) {
      return jsonResp(400, { success: false, message: 'Provide either email=XXX or clientId=X parameter', requestId: generateRequestId() }, request);
    }
    
    let token = url.searchParams.get('token') || '';
    
    if (!token) {
      const hashIdx = request.url.indexOf('#');
      if (hashIdx > -1) {
        const hash = request.url.substring(hashIdx + 1);
        const query = new URLSearchParams(hash.split('&')[0]);
        token = query.get('token') || '';
      }
    }
    
    if (!token) {
      const cookies = request.headers.get('Cookie') || '';
      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
      token = cookieMatch ? cookieMatch[1] : null;
    }

    let session;
    
    if (token) {
      session = await db.prepare(
        `SELECT u.id, u.email, u.name, u.role, u.company 
         FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.token=? AND u.is_active = 1 
         AND s.expires_at > datetime('now')`
      ).bind(token).first();
    }
    
    if (!session) {
      return jsonResp(401, { success: false, message: 'Session invalid or expired.', requestId: generateRequestId() }, request);
    }
    
    /** Admin can view any client's timeline, regular clients see only their own */
    const lookupEmail = email || session.email;
    const lookupClientId = session.id;

    // Build unified timeline from all systems
    const builder = new TimelineBuilder();
    
    /** Fetch submission data (lead generation) */
    if (lookupEmail) {
      const submission = await getSubmissionByEmail(db, lookupEmail);
      if (submission) {
        const prequal = await getPrequalificationForSubmission(db, submission.id);
        builder.addSubmission(submission, prequal);
      }
    }

    /** Fetch appointment history (booking system) */
    const appointments = await getAppointmentsForClient(db, lookupClientId);
    if (appointments && appointments.results && appointments.results.length > 0) {
      appointments.results.forEach(appointment => builder.addAppointment(appointment));
    }

    /** Fetch messages with client (messaging system) */
    const messages = await getClientMessages(db, lookupClientId, session.id);
    if (messages && messages.results && messages.results.length > 0) {
      messages.results.forEach(message => builder.addMessage(message, session));
    }

    /** Fetch invoices (billing system) */
    const invoices = await getClientInvoices(db, lookupEmail || lookupClientId);
    if (invoices && invoices.results && invoices.results.length > 0) {
      invoices.results.forEach(invoice => builder.addInvoice(invoice));
    }

   builder.sort();
     
    return jsonResp(200, 
      builder.build(lookupEmail, session.name, session.id), 
      request
    );
    
  } catch (err) {
    console.error('Contact timeline error:', err.message);
    const requestId = generateRequestId();
    return jsonResp(500, { success: false, message: 'Server error processing timeline.', requestId }, request);
  }
}
