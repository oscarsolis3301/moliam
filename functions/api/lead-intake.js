     1|     1|/**
     2|     2| * MOLIAM Lead Capture → CRM Pipeline
     3|     3| * Enhanced contact form with scoring and automation triggers
     4|     4| * POST /api/lead-intake — Uses api-helpers for consistent validation and JSON responses
     5|     5| */
     6|     6|
     7|     7|import { jsonResp, validateEmail, validatePhone, sanitizeText, hashSHA256, calculateLeadScore, sliceText } from './api-helpers.js';
     8|     8|
     9|     9|/**
    10|    10| * Handle POST requests to lead intake endpoint with email validation, phone validation, HTML stripping, and lead scoring
    11|    11| * @param {object} context - Cloudflare Pages function context with request and env
    12|    12| * @returns {Response} JSON response with success/error status and proper CORS headers
    13|    13| */
    14|    14|export async function onRequestPost(context) {
    15|    15|  const { request, env } = context;
    16|    16|  const db = env.MOLIAM_DB;
    17|    17|
    18|    18|  // Return consistent JSON error with CORS headers when DB unavailable
    19|    19|  if (!db) {
    20|    20|    return jsonResp(503, { success: false, error: true, message: "Database not available. Please try again later." }, request);
    21|    21|  }
    22|    22|
    23|    23|  // --- Parse body with try/catch for malformed JSON ---
    24|    24|  let data;
    25|    25|  try {
    26|    26|    data = await request.json();
    27|    27|  } catch {
    28|    28|    return jsonResp(400, { success: false, error: true, message: "Invalid JSON body." }, request);
    29|    29|  }
    30|    30|
    31|    31|  // --- Sanitize all text fields (strip HTML, apply length limits) ---
    32|    32|  const name = sanitizeText(String(data.name || ""), 200);
    33|    33|  const emailResult = validateEmail(String(data.email || ""));
    34|    34|  if (!emailResult.valid) return jsonResp(400, { success: false, error: true, message: emailResult.error }, request);
    35|    35|  const email = emailResult.value;
    36|    36|
    37|    37|  const phoneResult = validatePhone(data.phone);
    38|    38|  if (!phoneResult.valid) return jsonResp(400, { success: false, error: true, message: phoneResult.error }, request);
    39|    39|  const phone = phoneResult.value;
    40|    40|
    41|    41|  const company = sanitizeText(String(data.company || ""), 100);
    42|    42|  const message = sanitizeText(String(data.message || ""), 2000);
    43|    43|
    44|    44|  // Enhanced fields for scoring (sanitized)
    45|    45|  const budget = sanitizeText(String(data.budget || "undisclosed"), 50);
    46|    46|  const scope = sanitizeText(String(data.scope || data.inquiry_type || "General inquiry").trim(), 200);
    47|    47|  const industry = sanitizeText(String(data.industry || "general").trim(), 100);
    48|    48|  const urgency_level = String(data.urgency_level || 'medium').toLowerCase();
    49|    49|
    50|    50|  // Sanitized pain_points array (limit item length to 500 chars)
    51|    51|  const pain_points = Array.isArray(data.pain_points) 
    52|    52|      ? data.pain_points.filter(p => p && typeof p.trim === "function" && p.trim().length > 0).slice(0, 5).map((p, i) => sanitizeText(String(p), 500))
    53|    53|       : [];
    54|    54|
    55|    55|  // Field length validation after sanitization
    56|    56|  const errors = [];
    57|    57|  if (name.length < 2) errors.push("Name must be at least 2 characters.");
    58|    58|  if (message.length < 10) errors.push("Message must be at least 10 characters.");
    59|    59|
    60|    60|  if (errors.length) {
    61|    61|    return jsonResp(400, { success: false, error: true, message: errors.join(" ") }, request);
    62|    62|  }
    63|    63|
    64|    64|  // Parse additional optional fields with length limits
    65|    65|  const screenRes = data.screenResolution ? String(data.screenResolution).trim() : "";
    66|    66|  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    67|    67|  const ua = request.headers.get("user-agent") || "";
    68|    68|
    69|    69|  try {
    70|    70|    // --- Rate limiting check (5 per 6 min window per IP) ---
    71|    71|    const ipHash = await hashSHA256(ip);
    72|    72|    const rl = await db.prepare(
    73|    73|          "SELECT request_count, window_start FROM rate_limits WHERE ip_address_hash = ?"
    74|    74|       ).bind(ipHash).first();
    75|    75|
    76|    76|    if (rl) {
    77|    77|      const windowAge = Date.now() - new Date(rl.window_start).getTime();
    78|    78|      if (windowAge < 360000 && rl.request_count >= 5) {
    79|    79|        return jsonResp(429, { 
    80|    80|            success: false, error: true,
    81|    81|            message: "Too many submissions. Please wait a few minutes.",
    82|    82|            retryAfter: Math.ceil((360000 - windowAge) / 1000)
    83|    83|           }, request);
    84|    84|      }
    85|    85|    }
    86|    86|
    87|    87|     // --- Insert submission with parameterized queries to prevent SQL injection ---
    88|    88|    const sub = await db.prepare(
    89|    89|      `INSERT INTO submissions 
    90|    90|       (name, email, phone, company, message, user_agent, screen_resolution, budget, scope, industry, urgency_level, pain_points) 
    91|    91|       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    92|    92|      ).bind(name, email, phone, company, message, ua, screenRes, budget, scope, industry, urgency_level, JSON.stringify(pain_points)).run();
    93|    93|
    94|    94|    const subId = sub.meta?.last_row_id;
    95|    95|
    96|    96|    if (!subId) {
    97|    97|      console.error("Failed to get last_row_id:", JSON.stringify(sub));
    98|    98|      return jsonResp(500, { success: false, error: true, message: "Failed to save submission. Please try again." }, request);
    99|    99|     }
   100|   100|
   101|   101|     // --- Calculate Lead Score using api-helpers ---
   102|   102|    const scoreResult = calculateLeadScore({
   103|   103|      email, name, company, budget, scope, industry, urgency_level, message
   104|   104|     });
   105|   105|
   106|   106|    await db.prepare(
   107|   107|       `UPDATE submissions SET lead_score = ? WHERE id = ?`
   108|   108|      ).run(scoreResult.total_score, subId);
   109|   109|
   110|   110|     // --- Insert detailed scoring ---
   111|   111|    const painPointsJson = JSON.stringify(pain_points);
   112|   112|    await db.prepare(
   113|   113|       `INSERT INTO lead_scores 
   114|   114|       (submission_id, base_score, industry_boost, urgency_boost, budget_fit_score, total_score) 
   115|   115|       VALUES (?, ?, ?, ?, ?, ?)`
   116|   116|      ).bind(subId, scoreResult.base_score, scoreResult.industry_boost, scoreResult.urgency_boost, scoreResult.budget_fit_score, scoreResult.total_score).run();
   117|   117|
   118|   118|// --- Initiate CRM Sync (non-blocking) ---
   119|   119|  initiateCrmSync(context.env, subId, { name, email, phone, company, budget, scope, industry, urgency_level }).catch(err => {
   120|   120|      console.warn("CRM sync failed:", err.message);
   121|   121|    });
   122|   122|
   123|   123|    // --- Queue Email Sequences (background task) ---
   124|   124|    queueEmailSequences(env, subId).catch(err => {
   125|   125|            console.warn("Email sequencing failed:", err.message);
   126|   126|            });
   127|   127|
   128|   128|    // --- Send Real-time Discord Notification (non-blocking) ---
   129|   129|    const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
   130|   130|    if (webhookUrl && webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.includes("YOUR_") && !webhookUrl.includes("PLACEHOLDER")) {
   131|   131|      sendDiscordAlert(webhookUrl, scoreResult).catch(err => {
   132|   132|        console.warn("Discord alert failed:", err.message);
   133|   133|          });
   134|   134|      }
   135|   135|
   136|   136|    // --- Log to audit tables ---
   137|   137|    await db.prepare(
   138|   138|       `INSERT INTO notification_logs (submission_id, channel_type, status, payload_preview) 
   139|   139|         VALUES (?, 'discord', 'success', ?)`
   140|   140|       ).bind(subId, JSON.stringify({ name, email, score: scoreResult.total_score })).run();
   141|   141|
   142|   142|return jsonResp(200, {
   143|   143|      success: true,
   144|   144|      message: `Thank you ${name}! Your inquiry has been prioritized with a lead score of ${scoreResult.total_score}/100. We'll be in contact within 5 minutes of your submission.`,
   145|   145|      submissionId: subId,
   146|   146|      leadScore: scoreResult.total_score,
   147|   147|      urgency: scoreResult.urgency_status
   148|   148|      }, request);
   149|   149|
   150|   150|} catch (err) {
   151|   151|    console.error("Lead intake error:", err);
   152|   152|    return jsonResp(500, { 
   153|   153|        success: false, error: true,
   154|   154|        message: "Something went wrong. Please email us directly at hello@moliam.com.",
   155|   155|        requestId: crypto.randomUUID ? crypto.randomUUID() : undefined
   156|   156|      }, request);
   157|   157|}
   158|   158|}
   159|   159|
   160|   160|/**
   161|   161| * Lead Scoring Engine — Auto-calculate lead priority
   162|   162| * Algorithm: Base 40 + budget(0-25) + industry(0-20) + urgency(0-25) = max 100
   163|   163| * Categories: hot (75+), moderate (60-74), normal (<60)
   164|   164| * @param {object} data - Lead data with email, name, company, budget, scope, industry, urgency_level, message
   165|   165| * @returns {{base_score:number,intustry_boost:int,urgency_boost:int,budget_fit_score:int,total_score:int,urgency_status:string,score_breakdown:object}} Scoring result object with components and final total
   166|   166| */
   167|   167|function calculateLeadScore(data) {
   168|   168|  const { email, name, company, budget, scope, industry, urgency_level, message } = data;
   169|   169|  let base_score = 40; // Base score for any qualified lead
   170|   170|
   171|   171|    // Budget scoring (0-25 points)
   172|   172|  let budgetFit = 50;
   173|   173|  if (budget.includes("under $10") || budget === "undisclosed") {
   174|   174|    base_score += 5;
   175|   175|    budgetFit = 30;
   176|   176|    } else if (/\\d+\\.\\d+/.test(budget) && /\\d+$/.exec(budget)[0] > 5) {
   177|   177|    base_score += 15;
   178|   178|    budgetFit = 75;
   179|   179|    } else if /^\\w+\\s?\\$[5-9k]?|^\\d+[$,]?\\d{3,}/.test(budget)) {
   180|   180|        // Check for $5k-$10k matches
   181|   181|    base_score += 12;
   182|   182|    budgetFit = 65;
   183|   183|    }
   184|   184|
   185|   185|      // Industry scoring (0-20 points) - boost priority for priority industries
   186|   186|  const industryBoost = 
   187|   187|       /tech|saas|software|ai|startup/i.test(industry) ? 18 :
   188|   188|       /finance|financial|fintech/i.test(industry) ? 16 :
   189|   189|       /health|medical|healthcare/i.test(industry) ? 14 :
   190|   190|       /education|academia|university/i.test(industry) ? 10 :
   191|   191|       /manufacturing|retail|ecommerce/i.test(industry) ? 12 :
   192|   192|       8;
   193|   193|
   194|   194|      // Urgency scoring (0-25 points) - higher urgency = higher score
   195|   195|  const urgencyBoostMap = {
   196|   196|        'critical': 30,
   197|   197|        'high': 20,
   198|   198|        'medium': 10,
   199|   199|        'low': 5
   200|   200|      };
   201|   201|  let urgencyBoost = urgencyBoostMap[urgency_level?.toLowerCase()] || 10;
   202|   202|
   203|   203|      // Keyword matches in message for additional scoring
   204|   204|  if (/immediate|urgent|deadline|asap|quickly|fast|\\b30\\s*days\\b/i.test(message)) {
   205|   205|    base_score += 8;
   206|   206|    urgencyBoost += 10;
   207|   207|    }
   208|   208|
   209|   209|  const total_score = Math.min(100, base_score + industryBoost + urgencyBoost);
   210|   210|  
   211|   211|      // Determine overall urgency status
   212|   212|  let urgency_status = 'normal';
   213|   213|  if (total_score >= 75) urgency_status = 'hot';
   214|   214|  else if (total_score >= 60) urgency_status = 'moderate';
   215|   215|
   216|   216|  return {
   217|   217|    base_score,
   218|   218|    industry_boost: industryBoost,
   219|   219|    urgency_boost: urgencyBoost,
   220|   220|    budget_fit_score: budgetFit,
   221|   221|    total_score,
   222|   222|    urgency_status,
   223|   223|    score_breakdown: { base_score, industry_boost, urgencyBoost }
   224|   224|      };
   225|   225|}
   226|   226|
   227|   227|/**
   228|   228| * CRM Sync - Push to HubSpot/Airtable/Pipedrive (fire-and-forget)
   229|   229| * Sends lead data to external CRM systems asynchronously without blocking response
   230|   230| * Uses error handling with console.warn only - non-blocking to user
   231|   231| * @param {object} env - Worker environment variables with HUBSPOT_API_KEY, AIRTABLE_API_KEY
   232|   232| * @param {number} submission_id - Lead submission ID from database   
   233|   233| * @param {object} data - Lead object with name, email, phone, company, budget, scope, industry, urgency_level, message
   234|   234| * @returns {Promise<null>} Null on success (errors logged to console only)
   235|   235| */
   236|   236|async function initiateCrmSync(env, submission_id, data) {
   237|   237|  try {
   238|   238|    const CRM_PROVIDER = env.HUBSPOT_API_KEY || env.AIRTABLE_API_KEY;
   239|   239|    
   240|   240|    // Skip if no CRM configured
   241|   241|    if (!CRM_PROVIDER) return null;
   242|   242|
   243|   243|    const crmUrl = CRM_PROVIDER.includes('hubspot') 
   244|   244|         ? 'https://api.hubapi.com/crm/v3/objects/contacts'
   245|   245|         : (env.AIRTABLE_API_KEY ? 'https://api.airtable.com/v0/' + env.AIRTABLE_APP_ID + '/Leads' : null);
   246|   246|
   247|   247|    if (!crmUrl) return null;
   248|   248|
   249|   249|    const payload = JSON.stringify({
   250|   250|      properties: {
   251|   251|        name: data.name,
   252|   252|        email: data.email,
   253|   253|        phone: data.phone,
   254|   254|        company: data.company || "Freelance",
   255|   255|        budget_range: data.budget,
   256|   256|        project_scope: data.scope,
   257|   257|        industry_type: data.industry,
   258|   258|        urgency: data.urgency_level,
   259|   259|        pain_points: data.pain_points?.length ? data.pain_points.join(", ") : null,
   260|   260|        inquiry_message: sliceText(data.message, 1024),
   261|   261|        lead_score: 50, // Placeholder - actual scoring done in main function
   262|   262|        source: "moliam-web-intake",
   263|   263|        submitted_at: new Date().toISOString()
   264|   264|      }
   265|   265|    });
   266|   266|
   267|   267|    const headers = { 'Content-Type': 'application/json' };
   268|   268|
   269|   269|    if (CRM_PROVIDER.includes('hubspot') && env.HUBSPOT_API_KEY) {
   270|   270|      headers['Authorization'] = `Bearer ${env.HUBSPOT_API_KEY}`;
   271|   271|      await fetch(crmUrl, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(5000) });
   272|   272|      } else if (CRM_PROVIDER.includes('airtable') && env.AIRTABLE_API_KEY) {
   273|   273|      headers['Authorization'] = `Bearer ${env.AIRTABLE_API_KEY}`;
   274|   274|      await fetch(crmUrl, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(5000) });
   275|   275|      }
   276|   276|
   277|   277|    return null; // Success logged separately
   278|   278|   } catch (err) {
   279|   279|     console.warn("CRM sync failed:", err.message);
   280|   280|     return null; // Fire and forget - don't propagate errors to user
   281|   281|   }
   282|   282|}
   283|   283|
   284|   284|/**
   285|   285| * Send Discord alert webhook with lead score embedding (fire-and-forget)
   286|   286| * Non-blocking call that logs errors to console without affecting user response
   287|   287| * Uses error handling - never throws to caller
   288|   288| * @param {string} webhookUrl - Discord webhook URL from env.DISCORD_WEBHOOK_URL
   289|   289| * @param {object} scoreResult - calculatedLeadScore result object with total_score, urgency_status
   290|   290| * @returns {Promise<null>} Null always (errors logged only)
   291|   291| */
   292|   292|async function sendDiscordAlert(webhookUrl, scoreResult) {
   293|   293|  try {
   294|   294|    const priorityTag = scoreResult.total_score >= 75 ? "<@1466244456088080569>" : "";
   295|   295|
   296|   296|    await fetch(webhookUrl, {
   297|   297|      method: "POST",
   298|   298|      headers: { "Content-Type": "application/json" },
   299|   299|      body: JSON.stringify({
   300|   300|        username: "Moliam Lead Score Alert",
   301|   301|        avatar_url: "https://moliam.com/logo.png",
   302|   302|        content: priorityTag + `Lead scored ${scoreResult.total_score}/100 (${scoreResult.urgency_status})`,
   303|   303|        embeds: [{
   304|   304|          title: "🔔 New Lead — High Priority",
   305|   305|          color: scoreResult.total_score >= 75 ? 0x10B981 : 0xF59E0B,
   306|   306|          fields: [
   307|   307|              { name: "Lead Score", value: `${scoreResult.total_score}/100`, inline: true },
   308|   308|              { name: "Status", value: scoreResult.urgency_status.charAt(0).toUpperCase() + scoreResult.urgency_status.slice(1), inline: true }
   309|   309|             ],
   310|   310|          footer: { text: `moliam.com/lead-score` },
   311|   311|          timestamp: new Date().toISOString()
   312|   312|         }]
   313|   313|        })
   314|   314|     });
   315|   315|
   316|   316|    return null; // Success logged separately
   317|   317|  } catch (err) {
   318|   318|     console.warn("Discord alert failed:", err.message);
   319|   319|     return null;
   320|   320|   }
   321|   321|}
   322|   322|
   323|   323|/**
   324|   324| * Queue email sequences for new lead submissions (fire-and-forget background task)
   325|   325| * Non-blocking call that logs errors to console without affecting user response
   326|   326| * @param {object} env - Worker environment with EMAIL_API_KEY if configured
   327|   327| * @param {number} submission_id - Lead submission ID from database
   328|   328| * @returns {Promise<null>} Null always (errors logged only)
   329|   329| */
   330|   330|async function queueEmailSequences(env, submission_id) {
   331|   331|  try {
   332|   332|    // Background job to send welcome emails and sequence triggers
   333|   333|    const hasEmailProvider = env.EMAIL_API_KEY || env.MAILGUN_API_KEY || env.SENDGRID_API_KEY;
   334|   334|    if (!hasEmailProvider) return null;
   335|   335|
   336|   336|// Check if DB is available before attempting queue operations
   337|   337|if (env.MOLIAM_DB) {
   338|   338|  await env.MOLIAM_DB.prepare(
   339|   339|        `INSERT INTO email_queue (submission_id, queued_at, status) VALUES (?, datetime('now'), 'pending')`
   340|   340|      ).bind(submission_id).run();
   341|   341|}
   342|   342|
   343|   343|return null;
   344|   344|   } catch (err) {
   345|   345|    console.warn("Email queue failed:", err.message);
   346|   346|    return null;
   347|   347|   }
   348|   348|}
   349|   349|