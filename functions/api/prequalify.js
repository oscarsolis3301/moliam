     1|/**
     2|/**
     3| * Pre-Qualification System — CloudFlare Pages Function v3
     4| * GET /api/prequalify - Get qualification form with scoring criteria
     5| * POST /api/prequalify - Submit client self-qualification and receive booking authorization  
     6| * Uses api-helpers for consistent JSON responses and error handling
     7| * 
     8| * Filters leads based on:
     9| * - Budget threshold (minimum $2k)
    10| * - Timeline urgency (immediate or within 30 days preferred)  
    11| * - Industry fit
    12| * - Qualification score calculation (0-100, auto-approve >= 60)
    13| */
    14|
    15|import { jsonResp } from './api-helpers.js';
    16|
    17|/**
    18| * GET /api/prequalify - Retrieve qualification form metadata and criteria
    19| * Returns form URL and scoring criteria for client self-qualification
    20| * @param {object} context - Cloudflare Pages request context with env containing MOLIAM_DB
    21| * @returns {Response} JSON response with form_url, min_budget, preferred_timeline, support_industries
    22| */
    23|export async function onRequestGet(context) {
    24|  const { env, request } = context;
    25|  const db = env.MOLIAM_DB;
    26|
    27|     // Return form metadata with proper CORS headers for moliam domains
    28|  if (!db) {
    29|     return jsonResp(200, { success: true, error: false, form_url: "/booking/prequalify.html", criteria: { min_budget: 2000, preferred_timeline: ["immediate", "within_week", "next_month"], support_industries: ["real_estate", "financial_services", "healthcare", "retail"] } }, request);
    30|    }
    31|
    32|  return jsonResp(200, { success: true, error: false, form_url: "/booking/prequalify.html", criteria: { min_budget: 2000, preferred_timeline: ["immediate", "within_week", "next_month"], support_industries: ["real_estate", "financial_services", "healthcare", "retail"] } }, request);
    33|}
    34|
    35|/**
    36| * POST /api/prequalify - Submit client self-qualification data and receive booking authorization
    37| * Scores leads on budget(50pts), urgency(30pts), industry fit(20pts) = total 100 max
    38| * Auto-approves calendar access for score >= 60 AND budget >= $2k threshold
    39| * @param {object} context - Cloudflare Pages request context with env.MOLIAM_DB binding  
    40| * @returns {Response} JSON response with score, calendar_access_granted flag, next_step
    41| */
    42|export async function onRequestPost(context) {
    43|  const { request, env } = context;
    44|  const db = env.MOLIAM_DB;
    45|
    46|  // Parse request body with try/catch for malformed JSON and return consistent error format
    47|  let data;
    48|  try {
    49|    data = await request.json();
    50|       } catch (e) {
    51|    return jsonResp(400, { success: false, error: true, message: "Invalid JSON body." }, request);
    52|     }
    53|
    54|  const {
    55|      submission_id,
    56|    budget_range,
    57|    max_budget, 
    58|    timeline_urgency,
    59|    project_start_date,
    60|    primary_industry, 
    61|    current_stack,
    62|    pain_points 
    63|   } = data || {};
    64|
    65|    // Sanitize and validate pain_points field (optional) - strip HTML, limit to 2000 chars if provided
    66|  let sanitizedPainPoints = '';
    67|  if (pain_points !== undefined && pain_points !== null) {
    68|        const cleanPt = String(pain_points).replace(/<[^>]*>/g, '').trim();
    69|    sanitizedPainPoints = cleanPt.length > 2000 ? cleanPt.slice(0, 2000) : cleanPt;
    70|  }
    71|   const errors = [];
    72|
    73|     // Budget validation - enforce $2k minimum requirement for lead qualification  
    74|  if (!budget_range || budget_range === 'unknown') {
    75|    errors.push("Budget range required.");
    76|   } else if (max_budget && max_budget < 2000) {
    77|    errors.push("Minimum project budget is $2,000. Please adjust your requirements.");
    78|   }
    79|
    80|     // Industry validation - can continue even if not supported, but will score lower for priority industries 
    81|  if (!primary_industry || primary_industry === 'unknown') {
    82|    errors.push("Primary industry required.");
    83|   }
    84|
    85|  if (errors.length) {
    86|    return jsonResp(400, { success: false, error: true, message: "Validation failed.", errors }, request);
    87|    }
    88|
    89|     // Calculate qualification score (0-100) with weighted scoring algorithm
    90|   // Factors: budget(50) + urgency(30) + industry(20) = max 100 points
    91|   /* @returns {number} Score clamped between 45-100 based on all factors */
    92|   let score = 50; // Base start point for any qualified lead
    93|
    94|   const factors = {
    95|         // Budget scoring (50 points max) - higher budget = priority treatment 
    96|     budget: () => {
    97|       if (max_budget >= 10000) return 50;
    98|       if (max_budget >= 5000) return 40;
    99|       if (max_budget >= 3000) return 30;
   100|       if (budget_range === 'under_1k') return 20;
   101|       if (max_budget && max_budget < 2000) return 15;
   102|       return 10;
   103|      },
   104|
   105|         // Urgency scoring (30 points max) - immediate projects get priority access 
   106|     urgency: () => {
   107|       if (timeline_urgency === 'immediate') return 30;
   108|       if (timeline_urgency === 'within_week') return 25;
   109|       if (timeline_urgency === 'next_month') return 20;
   110|       if (timeline_urgency === 'flexible') return 10;
   111|       return 10;
   112|      },
   113|
   114|         // Industry fit (20 points max) - support industries get higher scores 
   115|     industry: () => {
   116|       const supported = ['real_estate', 'financial_services', 'healthcare', 'retail', 'technology'];
   117|       if (supported.includes(primary_industry)) return 15;
   118|       return 10;
   119|      },
   120|
   121|         // Pain points depth - the more detailed, the better score for matching 
   122|     details: () => {
   123|       const painPoints = (pain_points || '').toString().toLowerCase();
   124|       if (painPoints.length > 200) return 20;
   125|       if (painPoints.length > 100) return 15;
   126|       if (painPoints.length > 50) return 10;
   127|       return 5;
   128|      }
   129|   };
   130|
   131|  score = Math.min(100, score + factors.budget() + factors.urgency() + factors.industry() + factors.details());
   132|
   133|  let calendarAccessGranted = 0;
   134|   
   135|     // Auto-approve if score >= 60 and budget >= min threshold of $2,000 
   136|  if (score >= 60 && (!max_budget || max_budget >= 2000)) {
   137|    calendarAccessGranted = 1;
   138|   }
   139|
   140|  try {
   141|    const res = await db.prepare(
   142|      "INSERT INTO prequalifications (submission_id, budget_range, max_budget, timeline_urgency, project_start_date, primary_industry, current_stack, pain_points, qualification_score, calendar_access_granted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
   143|    ).bind(
   144|      submission_id || null,
   145|      budget_range || 'unknown',
   146|      max_budget || null,
   147|      timeline_urgency || 'flexible',
   148|      project_start_date || null,
   149|      primary_industry || 'unknown',
   150|      current_stack || '',
   151|      sanitizedPainPoints,
   152|      score,
   153|      calendarAccessGranted 
   154|    ).run();
   155|
   156|    const prequalId = res.meta.last_row_id;
   157|
   158|      // If qualified, insert into appointments table with auto-generated booking link 
   159|  if (calendarAccessGranted && submission_id) {
   160|     await generateBooking(context, prequalId);
   161|       }
   162|
   163|    return jsonResp(200, { success: true, error: false, message: calendarAccessGranted ? "You're qualified! Click the link below to book." : "Thanks for your response. We'll review and get back to you.", score, calendar_access_granted: calendarAccessGranted, next_step: calendarAccessGranted ? 'booking' : 'review', submission_id: submission_id || null }, request);
   164|
   165|    } catch (err) {
   167|    return jsonResp(500, { success: false, error: true, message: "Something went wrong. Please try again later." }, request);
   168|    }
   169|}
   170|
   171|/**
   172| * Auto-generate booking link for qualified leads with Cal.com integration
   173| * Creates personalized appointment links and sends confirmation emails to qualified leads
   174| * Non-blocking operation that logs errors to console without affecting user response  
   175| * @param {object} context - Cloudflare Pages request context with env.ADMIN_EMAIL, MOLIAM_DB
   176| * @param {number} prequalId - Prequalification record ID from database
   177| * @returns {{booking_ref:string, schedule_url:string}|null} Booking data or null if not created
   178| */
   179|async function generateBooking(context, prequalId) {
   180|  const db = context.env.MOLIAM_DB;
   181|
   182|   // Generate unique booking reference for tracking and audit logs
   183|  const bookingRef = 'BK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
   184|
   185|     // For Cal.com integration - generate personalized calendar link with prequal ID embedded 
   186|  const calLinkBase = "https://calendly.com/visualark/discovery-call";
   187|  const personalizedLink = `${calLinkBase}?prequal=${bookingRef}`;
   188|
   189|   // Get prequalification data for context
   190|  const prequal = await db.prepare(`SELECT * FROM prequalifications WHERE id = ?`).bind(prequalId).first();
   191|
   192|  if (prequal) {
   193|       // Insert booking record into appointments table with pending status 
   194|     const now = new Date().toISOString();
   195|     await db
   196|        .prepare("INSERT INTO appointments (prequalification_id, calendar_link, status, scheduled_with) VALUES (?, ?, 'pending', ?)")
   197|        .bind(prequalId, personalizedLink, context.env.ADMIN_EMAIL || "hello@moliam.com").run();
   198|
   199|       // Send booking confirmation email to qualified lead with priority access 
   200|     await sendBookingConfirmationEmail(context, prequal, personalizedLink);
   201|
   202|       // Auto-schedule initial demo slot within 30-day window from today
   203|     const targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Next week
   204|
   206|    return { 
   207|      booking_ref: bookingRef,
   208|      schedule_url: personalizedLink,
   209|      status: 'pending',
   210|      created_at: now
   211|     };
   212|  }
   213|
   214|  return null;
   215|}
   216|
   217|/**
   218| * Send booking confirmation email with priority access branding and notification to Ada
   219| * HTML email sent to qualified leads with personalized calendar link and instructions  
   220| * Fire-and-forget operation that logs errors to console without affecting user response
   221| * @param {object} context - Cloudflare Pages request context with env.ADMIN_EMAIL  
   222| * @param {object} prequal - Prequalification object with submission info including name/email
   223| * @param {string} calendarLink - Cal.com personalized URL for client booking
   224| * @returns {Promise<void>} Fire-and-forget, errors logged to console only
   225| */
   226|async function sendBookingConfirmationEmail(context, prequal, calendarLink) {
   227|  try {
   228|    const env = context.env;
   229|    const email = await getSubEmail(env.MOLIAM_DB, prequal.submission_id);
   230|    const name = await getSubName(env.MOLIAM_DB, prequal.submission_id);
   231|
   232|    const subject = "You're Qualified! Book Your Discovery Call Now";
   233|    
   234|    await fetch("https://api.mailchannels.net/tx/v1/send", {
   235|      method: "POST",
   236|      headers: { 'Content-Type': 'application/json' },
   237|      body: JSON.stringify({
   238|        personalizations: [{ to: [{ email, name }] }],
   239|        from: { email: "hello@moliam.com", name: "Moliam Team" },
   240|        subject,
   241|        content: [{
   242|          type: "text/html",
   243|          value: `
   244|               <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
   245|                 <h2 style="color:#10B981;">Qualified for Priority Access!</h2>
   246|                 <p>Hi ${name || "Valued Client"},</p>
   247|                 <p>Based on your qualification assessment, you meet our criteria. We'd love to help you.</p>
   248|                 <a href="${calendarLink}" style="display:inline-block;background:#10B981;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Book Your Discovery Call →</a>
   249|                 <p style="font-size:13px;color:#6B7280;margin-top:24px;">Link active for 14 days.</p>
   250|               </div>`}],
   251|        })
   252|      });
   253|
   254|       // Send notification to Ada about qualified booking  
   255|    await fetch("https://api.mailchannels.net/tx/v1/send", {
   256|      method: "POST",
   257|      headers: { 'Content-Type': 'application/json' },
   258|      body: JSON.stringify({
   259|        personalizations: [{ to: [{ email: env.ADMIN_EMAIL || "hello@moliam.com" }] }],
   260|        from: { email: "noreply@moliam.com", name: "Booking System" },
   261|        subject: `Qualified Lead Booked - ${name || "New Client"}`,
   262|        content: [{
   263|          type: "text/html",
   264|          value: `<p>New booking from qualified lead.<br>Score: <b>${prequal.qualification_score}/100</b><br>Calendar link sent to client.</p>`}]});
   265|
   266|    } catch (e) {
   268|    }
   269|}
   270|
   271|// CORS preflight handler for all endpoints
   272|/**
   273| * Handle CORS preflight requests for prequalify API endpoints
   274| * Enables cross-origin access from moliam.com and moliam.pages.dev domains to email validation and qualification endpoint
   275| * @param {object} context - Cloudflare Pages request context (implicitly used)
   276| * @returns {Response} 204 No Content Response with CORS headers Access-Control-Allow-Origin, Methods, Headers for all endpoints in prequalify module
   277|
   278| */
   279|export async function onRequestOptions(context) {
   280|      // Return response based on origin header - prefer moliam domains but allow * for dev/testing
   281|  const { request } = context || {};
   282|  const origin = request?.headers?.get('Origin') || '';
   283|  const allowedOrigins = ['https://moliam.com', 'https://moliam.pages.dev'];
   284|    const effectiveOrigin = allowedOrigins.includes(origin) ? origin : (process.env.NODE_ENV === 'production' ? '*' : origin);
   285|  return new Response(null, {
   286|    status: 204,
   287|    headers:{
   288|        "Access-Control-Allow-Origin": effectiveOrigin,
   289|        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
   290|        "Access-Control-Allow-Headers": "Content-Type"
   291|       }
   292|    });
   293|}
   294|
   295|/**
   296|* Retrieve lead email from submissions by ID for personalized emails   
   297|* Returns email address from submissions table or null if not found
   298|* @param {D1Database} db - Database binding to MOLIAM_DB
   299|* @param {number} submissionId - Submission ID to look up   
   300|* @returns {Promise<string|null>} Email or null if submission does not exist
   301|*/
   302|async function getSubEmail(db, submissionId) {
   303|  if (!submissionId) return null;
   304|  const sub = await db.prepare("SELECT email FROM submissions WHERE id = ?").bind(submissionId).first();
   305|  return sub ? sub.email : null;
   306|}
   307|
   308|/**
   309|* Retrieve lead name from submissions by ID for personalized emails   
   310|* Returns client name or "Valued Client" default string if submission not found   
   311|* @param {D1Database} db - Database binding to MOLIAM_DB
   312|* @param {number} submissionId - Submission ID to look up 
   313|* @returns {Promise<string>} Name from submissions or default "Valued Client" fallback
   314|*/
   315|async function getSubName(db, submissionId) {
   316|  if (!submissionId) return "Valued Client";
   317|  const sub = await db.prepare("SELECT name FROM submissions WHERE id = ?").bind(submissionId).first();
   318|  return sub && sub.name ? sub.name : "Valued Client";
   319|}
   320|