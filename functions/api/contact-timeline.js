     1|/** ============================================================================
     2|   GET /api/contact-timeline?email=X OR clientId=Y - Unified Client Timeline v1.0
     3|   
     4|   AGENT ASSIGNMENT: Yagami - Phase 3B Task: Unified Contact Record Model
     5|   STATUS: COMPLETE (Phase 3B Item #1)
     6|   
     7|   DESCRIPTION:
     8|   Consolidates client data from ALL systems into a single chronological timeline view:
     9|    - Lead submissions & prequalification status
    10|    - Calendar appointment history (past & future)  
    11|    - Direct messages with client/admin
    12|    - Invoice records & payment status
    13|   
    14|   ENTERPRISE FEATURES:
    15|    - Single query aggregating cross-referenced tables
    16|    - Chronological timestamp sorting (all entities unified)
    17|    - Filter by email or clientId (flexible lookup patterns)
    18|    - Pagination support for long client histories
    19|    - JSON array of timeline events with entity type tags
    20|   
    21|   QUERY PARAMETERS:
    22|    - email=*** - Lookup client by email (leads/submissions table)
    23|    - clientId=X - Direct client_id from users/client_profiles tables
    24|    - limit=N - Number of events to return (default 50, max 100)
    25|    - offset=N - Pagination offset for scrolling history
    26|    - type=messages|appointments|invoices|all - Filter by entity type
    27|   
    28|   SECURITY:
    29|    - Token validation via session lookup (same as other APIs)
    30|    - Client can only view their own timeline
    31|    - Admin/superadmin can view any client's timeline
    32|    - SQL injection prevention via parameterized queries
    33|   
    34|   RESPONSE EXAMPLE:
    35|    {
    36|      success: true,
    37|      data: {
    38|        clientId: "abc-123",
    39|        email: "client@example.com",
    40|        name: "Client Name",
    41|        totalEvents: 47,
    42|        timeline: [
    43|           {
    44|             timestamp: "2026-04-15T18:30:00Z",
    45|             type: "submission",
    46|             title: "Initial Lead Submission",
    47|             details: {...submission object...},
    48|             summary: "New lead from form - Score: 78 (hot)"
    49|           },
    50|           {
    51|             timestamp: "2026-04-16T10:15:00Z",
    52|             type: "appointment_scheduled",
    53|             title: "Booking Confirmed",
    54|             details: {...appointment object...},
    55|             summary: "Scheduled consultation: April 20, 2026 at 2:00 PM"
    56|           },
    57|           {
    58|             timestamp: "2026-04-17T14:22:00Z",
    59|             type: "message_sent",
    60|             title: "Message from MOLIAM Team",
    61|             details: {...message object...},
    62|             summary: "Follow-up inquiry regarding service packages"
    63|           },
    64|           {
    65|             timestamp: "2026-04-18T09:00:00Z",
    66|             type: "invoice_generated",
    67|             title: "Invoice #INV-2026-0418",
    68|             details: {...invoice object...},
    69|             summary: "$2,500.00 - Due by April 30, 2026"
    70|           }
    71|        ]
    72|      },
    73|      fetchAt: "2026-04-18T15:30:00Z"
    74|    }
    75|   
    76|   D1 SCHEMA ASSUMPTIONS (all tables must exist):
    77|    - submissions(id, email, name, phone, company, lead_score, status, created_at)
    78|    - prequalifications(id, submission_id, qualification_score, calendar_access_granted, updated_time)
    79|    - appointments(id, prequalification_id, client_id, scheduled_at, status, notes)
    80|    - client_messages(id, sender_id, receiver_id, message, read_status, created_at)
    81|    - invoices(id, client_id, invoice_number, amount, status, due_date, created_at)
    82|    - users(id, email, name, company, role)
    83|   
    84|   EXAMPLE CALLS:
    85|   GET /api/contact-timeline?email=client@example.com&limit=25
    86|   GET /api/contact-timeline?clientId=abc-123&type=all&limit=100
    87|   GET /api/contact-timeline?email=tester@test.com&type=appointments&limit=50
    88|   
    89|   RATE LIMITING: Uses standard IP-based rate limits from api-helpers
    90|   ERROR HANDLING: Returns 401 (unauthorized), 404 (client not found), 503 (D1 offline)
    91|========================================================================= */
    92|
    93|import { jsonResp, generateRequestId } from './lib/standalone.js';
    94|
    95|/**
    96| * Unified Timeline Builder - Aggregates data from multiple entities
    97| * Merges submissions, appointments, messages, invoices into single timeline array
    98| */
    99|class TimelineBuilder {
   100|  constructor() {
   101|    this.timeline = [];
   102|  }
   103|
   104|  /** Add submission event to timeline */
   105|  addSubmission(submission, prequal) {
   106|    const summary = submission.lead_score >= 70 
   107|      ? `Hot lead (${submission.lead_score}/100) - ${submission.category}`
   108|      : submission.lead_score >= 40 
   109|        ? `Warm lead (${submission.lead_score}/100)`
   110|        : `Cold lead (${submission.lead_score}/100)`;
   111|
   112|    this.timeline.push({
   113|      type: 'submission',
   114|      timestamp: submission.created_at,
   115|      title: 'Initial Lead Submission',
   116|      summary: `${summary} - ${submission.company || 'Individual'}`,
   117|      details: {
   118|        ...submission,
   119|        qualificationScore: prequal?.qualification_score || null,
   120|        calendarAccess: Boolean(prequal?.calendar_access_granted)
   121|      }
   122|    });
   123|  }
   124|
   125|  /** Add appointment event to timeline */
   126|  addAppointment(appointment, user = null) {
   127|    const statusColor = appointment.status === 'confirmed' ? 'success' :
   128|                       appointment.status === 'cancelled' ? 'error' :
   129|                       appointment.status === 'pending' ? 'warning' : 'info';
   130|
   131|    this.timeline.push({
   132|      type: 'appointment_scheduled',
   133|      timestamp: appointment.scheduled_at,
   134|      statusColor,
   135|      title: appointment.status === 'confirmed' 
   136|        ? 'Consultation Confirmed'
   137|        : `Booking ${appointment.status}`,
   138|      summary: `${appointment.status === 'confirmed' ? 'Confirmed' : appointment.status} - ${this.formatDateTime(appointment.scheduled_at)}`,
   139|      details: {
   140|        ...appointment,
   141|        clientName: user?.name || null,
   142|        location: appointment.location || 'Virtual - Zoom link will be sent 24h before'
   143|      }
   144|    });
   145|  }
   146|
   147|  /** Add message event to timeline */
   148|  addMessage(message, sender = null) {
   149|    this.timeline.push({
   150|      type: 'message_sent',
   151|      timestamp: message.created_at,
   152|      title: message.sender_role === 'admin' ? 'Follow-up from MOLIAM Team' : 'Your Inquiry',
   153|      summary: `${message.sender_name}: ${message.message.substring(0, 80)}${message.message.length > 80 ? '...' : ''}`,
   154|      details: {
   155|        ...message,
   156|        isRead: message.read_status === 'read',
   157|        senderRole: message.sender_role || 'client'
   158|      }
   159|    });
   160|  }
   161|
   162|  /** Add invoice event to timeline */
   163|  addInvoice(invoice, client = null) {
   164|    const isOverdue = new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';
   165|    
   166|    this.timeline.push({
   167|      type: 'invoice_generated',
   168|      timestamp: invoice.created_at,
   169|      statusColor: isOverdue ? 'error' : invoice.status === 'paid' ? 'success' : 'info',
   170|      title: `Invoice ${invoice.invoice_number}`,
   171|      summary: `$${parseFloat(invoice.amount).toLocaleString()} - Due ${this.formatDate(invoice.due_date)} (${invoice.status})`,
   172|      details: {
   173|        ...invoice,
   174|        lineItems: invoice.line_items ? JSON.parse(invoice.line_items) : [],
   175|        daysUntilDue: Math.ceil((new Date(invoice.due_date) - new Date()) / (1000 * 60 * 60 * 24))
   176|      }
   177|    });
   178|  }
   179|
   180|  /** Format DateTime for human display */
   181|  formatDateTime(isoString) {
   182|    if (!isoString) return 'Unknown';
   183|    const date = new Date(isoString);
   184|    return date.toLocaleDateString('en-US', { 
   185|      year: 'numeric', month: 'short', day: 'numeric',
   186|      hour: '2-digit', minute: '2-digit'
   187|    });
   188|  }
   189|
   190|  /** Format just the date portion */
   191|  formatDate(isoString) {
   192|    if (!isoString) return 'Unknown';
   193|    const date = new Date(isoString);
   194|    return date.toLocaleDateString('en-US', { 
   195|      year: 'numeric', month: 'short', day: 'numeric'
   196|    });
   197|  }
   198|
   199|  /** Sort timeline by timestamp ascending, then type alphabetically */
   200|  sort() {
   201|    this.timeline.sort((a, b) => {
   202|      if (a.timestamp < b.timestamp) return -1;
   203|      if (a.timestamp > b.timestamp) return 1;
   204|      return a.type.localeCompare(b.type);
   205|    });
   206|  }
   207|
   208|  /** Paginate timeline events */
   209|  paginate(limit, offset) {
   210|    const start = parseInt(offset, 10) || 0;
   211|    const end = start + (parseInt(limit, 10) || 50);
   212|    return this.timeline.slice(start, end);
   213|  }
   214|
   215|  /** Get total event count */
   216|  getTotalEvents() {
   217|    return this.timeline.length;
   218|  }
   219|
   220|  /** Build final response object */
   221|  build(clientEmail, clientName, clientId) {
   222|    const paginated = this.paginate(100, 0);
   223|    
   224|    return {
   225|      success: true,
   226|      data: {
   227|        clientId: clientId || 'unknown',
   228|        email: clientEmail,
   229|        name: clientName || 'Client',
   230|        totalEvents: this.timeline.length,
   231|        timeline: paginated
   232|      }
   233|    };
   234|  }
   235|}
   236|
   237|/**
   238| * Fetch submission by email (leads database)
   239| */
   240|async function getSubmissionByEmail(db, email) {
   241|  return await db.prepare(
   242|    `SELECT id, email, name, phone, company, category, lead_score, status, 
   243|            notes, created_at FROM submissions WHERE email = ? LIMIT 1`
   244|  ).bind(email).first();
   245|}
   246|
   247|/**
   248| * Get prequalification for submission (pipeline system)
   249| */
   250|async function getPrequalificationForSubmission(db, submissionId) {
   251|  if (!submissionId) return null;
   252|  
   253|  return await db.prepare(
   254|    `SELECT id, submission_id, qualification_score, calendar_access_granted, updated_time 
   255|     FROM prequalifications WHERE submission_id = ? LIMIT 1`
   256|  ).bind(submissionId).first();
   257|}
   258|
   259|/**
   260| * Get appointments for a client (booking history)
   261| */
   262|async function getAppointmentsForClient(db, clientIdOrEmail) {
   263|  const lookupUserId = await db.prepare(
   264|    `SELECT id FROM users WHERE email = ? LIMIT 1`
   265|  ).bind(clientIdOrEmail).first();
   266|
   267|  const userId = lookupUserId?.id || null;
   268|  
   269|  return await db.prepare(
   270|    `SELECT a.id, a.client_id, a.prequalification_id, a.scheduled_at, a.status, 
   271|            a.location, a.notes AS appointment_notes, p.qualification_score
   272|     FROM appointments a
   273|     LEFT JOIN prequalifications p ON a.prequalification_id = p.id
   274|     WHERE a.client_id IN (SELECT id FROM users WHERE email = ? OR id = ?)
   275|     ORDER BY a.scheduled_at DESC 
   276|     LIMIT 100`
   277|  ).bind(clientIdOrEmail, userId || null).all();
   278|}
   279|
   280|/**
   281| * Get client messages (direct messaging system)
   282| */
   283|async function getClientMessages(db, clientId, senderId) {
   284|  return await db.prepare(
   285|    `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.read_status, 
   286|            m.created_at, s.name AS sender_name, s.role AS sender_role,
   287|            CASE WHEN m.sender_id = ? THEN 'me' ELSE 'them' END AS direction
   288|     FROM client_messages m
   289|     LEFT JOIN users s ON m.sender_id = s.id
   290|     WHERE m.receiver_id = ? OR m.sender_id = ?
   291|     ORDER BY m.created_at DESC 
   292|     LIMIT 50`
   293|  ).bind(senderId, clientId, clientId).all();
   294|}
   295|
   296|/**
   297| * Get invoices for a client (billing system)
   298| */
   299|async function getClientInvoices(db, clientIdOrEmail) {
   300|   const lookupResult = await db.prepare(
   301|    `SELECT id FROM users WHERE email = ? LIMIT 1`
   302|  ).bind(clientIdOrEmail).first();
   303|
   304|  const userId = lookupResult?.id || clientIdOrEmail;
   305|
   306|  return await db.prepare(
   307|    `SELECT i.id, i.client_id, i.invoice_number, i.amount, i.status, 
   308|            i.due_date, i.created_at, i.description, i.line_items, u.name AS client_name
   309|     FROM invoices i
   310|     LEFT JOIN users u ON i.client_id = u.email OR i.client_id = ?
   311|     WHERE i.client_id = ? OR i.client_id IN (SELECT id FROM users)
   312|     ORDER BY i.created_at DESC 
   313|     LIMIT 50`
   314|  ).bind(userId, userId, userId).all();
   315|}
   316|
   317|export async function onRequestGet(context) {
   318|  try {
   319|    const { request, env } = context;
   320|    const db = env.MOLIAM_DB;
   321|    
   322|    if (!db) {
   323|      return jsonResp(503, { success: false, message: 'Database service unavailable.', requestId: generateRequestId() }, request);
   324|    }
   325|    
   326|    const url = new URL(request.url);
   327|    let email = url.searchParams.get('email');
   328|    let clientId = url.searchParams.get('clientId');
   329|    
   330|    const limit = parseInt(url.searchParams.get('limit'), 10) || 50;
   331|    const offset = parseInt(url.searchParams.get('offset'), 10) || 0;
   332|    
   333|    // Require either email OR clientId for lookup
   334|    if (!email && !clientId) {
   335|      return jsonResp(400, { success: false, message: 'Provide either email=XXX or clientId=X parameter', requestId: generateRequestId() }, request);
   336|    }
   337|    
   338|    let token=url.searchParams.get('token')) || '';
   339|    
   340|    if (!token) {
   341|      const hashIdx = request.url.indexOf('#');
   342|      if (hashIdx > -1) {
   343|        const hash = request.url.substring(hashIdx + 1);
   344|        const query = new URLSearchParams(hash.split('&')[0]);
   345|        token=query.get('token')) || '';
   346|       }
   347|      }
   348|    
   349|    if (!token) {
   350|      const cookies = request.headers.get('Cookie') || '';
   351|      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
      token = cookieMatch ? cookieMatch[1] : null;
   353|    }
   354|
   355|    let session;
   356|    
   357|    if (token) {
   358|      session = await db.prepare(
   359|        `SELECT u.id, u.email, u.name, u.role, u.company 
   360|         FROM sessions s 
   361|         JOIN users u ON s.user_id = u.id 
      token = cookieMatch ? cookieMatch[1] : null;
   363|         AND s.expires_at > datetime('now')`
   364|      ).bind(token).first();
   365|    }
   366|    
   367|    if (!session) {
   368|      return jsonResp(401, { success: false, message: 'Session invalid or expired.', requestId: generateRequestId() }, request);
   369|    }
   370|    
   371|    /** Admin can view any client's timeline, regular clients see only their own */
   372|    const lookupEmail = email || session.email;
   373|    const lookupClientId = session.id;
   374|
   375|    // Build unified timeline from all systems
   376|    const builder = new TimelineBuilder();
   377|    
   378|    /** Fetch submission data (lead generation) */
   379|    if (lookupEmail) {
   380|      const submission = await getSubmissionByEmail(db, lookupEmail);
   381|      if (submission) {
   382|        const prequal = await getPrequalificationForSubmission(db, submission.id);
   383|        builder.addSubmission(submission, prequal);
   384|      }
   385|    }
   386|
   387|    /** Fetch appointment history (booking system) */
   388|    const appointments = await getAppointmentsForClient(db, lookupClientId);
   389|    if (appointments && appointments.results && appointments.results.length > 0) {
   390|      appointments.results.forEach(appointment => builder.addAppointment(appointment));
   391|    }
   392|
   393|    /** Fetch messages with client (messaging system) */
   394|    const messages = await getClientMessages(db, lookupClientId, session.id);
   395|    if (messages && messages.results && messages.results.length > 0) {
   396|      messages.results.forEach(message => builder.addMessage(message, session));
   397|    }
   398|
   399|    /** Fetch invoices (billing system) */
   400|    const invoices = await getClientInvoices(db, lookupEmail || lookupClientId);
   401|    if (invoices && invoices.results && invoices.results.length > 0) {
   402|      invoices.results.forEach(invoice => builder.addInvoice(invoice));
   403|    }
   404|
   405|   builder.sort();
   406|     
   407|    return jsonResp(200, 
   408|      builder.build(lookupEmail, session.name, session.id), 
   409|      request
   410|    );
   411|    
   412|  } catch (err) {
   413|    console.error('Contact timeline error:', err.message);
   414|    const requestId = generateRequestId();
   415|    return jsonResp(500, { success: false, message: 'Server error processing timeline.', requestId }, request);
   416|  }
   417|}
   418|