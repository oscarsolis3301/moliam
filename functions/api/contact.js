     1|     1|/**
     2|     2| * MOLIAM Contact Form — CloudFlare Pages Function v3
     3|     3| * POST /api/contact — Enhanced with lead scoring and auto-categorization
     4|     4| * Input validation: email format, text field lengths, HTML stripping
     5|     5| */
     6|     6|
     7|     7|import { jsonResp, validateEmail, validatePhone, sanitizeText, calculateLeadScore } from './api-helpers.js';
     8|     8|
     9|     9|/**
    10|    10| * Handle POST requests to contact form endpoint
    11|    11| * @param {object} context - Cloudflare Pages function context with request and env
    12|    12| * @returns {Response} JSON response with success/error status
    13|    13| */
    14|    14|export async function onRequestPost(context) {
    15|    15|  const { request, env } = context;
    16|    16|  const db = env.MOLIAM_DB;
    17|    17|
    18|    18|  // Parse request body with try/catch for malformed JSON
    19|    19|  let data;
    20|    20|  try {
    21|    21|    data = await request.json();
    22|    22|  } catch {
    23|    23|    return jsonResp(400, { success: false, error: true, message: "Invalid JSON body." }, undefined, request);
    24|    24|  }
    25|    25|
    26|    26|  // --- Validate & Sanitize Input Fields ---
    27|    27|  const name = sanitizeText(String(data.name || ""), 100);
    28|    28|  const emailResult = validateEmail(String(data.email || ""));
    29|    29|  if (!emailResult.valid) return jsonResp(400, { success: false, error: true, message: emailResult.error }, undefined, request);
    30|    30|  const email = emailResult.value;
    31|    31|
    32|    32|  const phoneResult = validatePhone(data.phone);
    33|    33|  if (!phoneResult.valid) return jsonResp(400, { success: false, error: true, message: phoneResult.error }, undefined, request);
    34|    34|  const phone = phoneResult.value;
    35|    35|
    36|    36|  const company = sanitizeText(String(data.company || ""), 100);
    37|    37|  const message = sanitizeText(String(data.message || ""), 2000);
    38|    38|
    39|    39|  // --- Field Length Validation (after sanitization) ---
    40|    40|  const errors = [];
    41|    41|  if (name.length < 2) errors.push("Name must be at least 2 characters.");
    42|    42|  if (message.length < 10) errors.push("Message must be at least 10 characters long.");
    43|    43|
    44|    44|  if (errors.length) return jsonResp(400, { success: false, error: true, message: errors.join(" ") }, undefined, request);
    45|    45|
    46|    46|  // --- Check D1 availability ---
    47|    47|  if (!db) {
    48|    48|    // D1 not bound — still send webhook and return success
    49|    49|    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
    50|    50|    return jsonResp(200, { success: true, message: "Thanks! We'll be in touch within 1 business day.", submissionId: 0 }, undefined, request);
    51|    51|  }
    52|    52|
    53|    53|  try {
    54|    54|    // --- Rate limiting (best effort) ---
    55|    55|    try {
    56|    56|      const rawIP = request.headers.get("CF-Connecting-IP") || "unknown";
    57|    57|      const ipHash = await hashSHA256(rawIP);
    58|    58|      const endpoint = "/api/contact";
    59|    59|
    60|    60|      // Cleanup old rate limit rows (older than 1 hour before checking/inserting)
    61|    61|      try {
    62|    62|        await db.prepare(
    63|    63|          "DELETE FROM rate_limits WHERE timestamp < datetime('now', '-1 hour')"
    64|    64|        ).run();
    65|    65|      } catch {}
    66|    66|
    67|    67|      const countResult = await db.prepare(
    68|    68|        "SELECT COUNT(*) as cnt FROM rate_limits WHERE ip = ? AND endpoint = ? AND timestamp > datetime('now', '-1 hour')"
    69|    69|      ).bind(ipHash, endpoint).first();
    70|    70|      const count = countResult?.cnt || 0;
    71|    71|
    72|    72|      if (count >= 5) {
    73|    73|        return jsonResp(429, { success: false, error: true, message: "Too many submissions. Please try again later." }, undefined, request);
    74|    74|      }
    75|    75|
    76|    76|      // Under limit - insert rate record and proceed
    77|    77|      await db.prepare(
    78|    78|        "INSERT INTO rate_limits (ip, endpoint, timestamp) VALUES (?, ?, datetime('now'))"
    79|    79|      ).bind(ipHash, endpoint).run();
    80|    80|    } catch {
    81|    81|      // Rate limiting table might not exist — skip, don't fail the submission
    82|    82|    }
    83|    83|
    84|    84|    // --- Insert submission with parameterized queries to prevent SQL injection ---
    85|    85|    const ua = request.headers.get("user-agent") || "";
    86|    86|    const screenRes = data.screenResolution || "";
    87|    87|    let subId = 0;
    88|    88|
    89|    89|    try {
    90|    90|      const sub = await db.prepare(
    91|    91|        "INSERT INTO submissions (name, email, phone, company, message, user_agent, screen_resolution, lead_score, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    92|    92|      ).bind(name, email, phone, company, message, ua, screenRes, 0, "cold").run();
    93|    93|      subId = sub.meta.last_row_id;
    94|    94|    } catch {
    95|    95|      // If submissions table schema is wrong, try minimal insert without new columns
    96|    96|      try {
    97|    97|        const sub = await db.prepare(
    98|    98|          "INSERT INTO submissions (name, email, phone, message) VALUES (?, ?, ?, ?)"
    99|    99|        ).bind(name, email, phone, message).run();
   100|   100|        subId = sub.meta.last_row_id;
   101|   101|      } catch {
   102|   102|        // Table might not exist at all — continue without DB
   103|   103|      }
   104|   104|    }
   105|   105|
   106|   106|    // --- Lead scoring with clear service-based tiers ---
   107|   107|    const scoreResult = calculateLeadScore({
   108|   108|      email,
   109|   109|      company,
   110|   110|      budget: data.budget || "undisclosed",
   111|   111|      scope: data.scope || "",
   112|   112|      industry: data.industry || "general",
   113|   113|      urgency_level: data.urgency_level || "medium",
   114|   114|      message
   115|   115|    });
   116|   116|    const score = scoreResult.score;
   117|   117|    const category = scoreResult.category; // hot (80+), warm (40-79), cold (<40)
   118|   118|
   119|   119|    // --- Update submission with lead_score and category if we have a valid subId ---
   120|   120|    if (subId > 0) {
   121|   121|      try {
   122|   122|        await db.prepare("UPDATE submissions SET lead_score = ?, category = ? WHERE id = ?")
   123|   123|          .bind(score, category, subId).run();
   124|   124|      } catch {
   125|   125|        // Ignore update failures
   126|   126|      }
   127|   127|    }
   128|   128|
   129|   129|    // --- Create lead (best effort) ---
   130|   130|    try {
   131|   131|      await db.prepare(
   132|   132|        "INSERT INTO leads (submission_id, email, first_name, last_name, phone, company, source, created_at, is_active) VALUES (?, '', '', ?, ?, 'webform', datetime('now'), 1)"
   133|   133|      ).bind(subId, email, phone, data.company || null).run();
   134|   134|    } catch {
   135|   135|      // leads table might not exist — skip
   136|   136|    }
   137|   137|
   138|   138|    // --- Discord webhook with lead score + priority tag ---
   139|   139|    const socials = {
   140|   140|      website: (data.website || "").trim(),
   141|   141|      gbp: (data.gbp || "").trim(),
   142|   142|      facebook: (data.facebook || "").trim(),
   143|   143|      instagram: (data.instagram || "").trim(),
   144|   144|      yelp: (data.yelp || "").trim(),
   145|   145|    };
   146|   146|    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score, category, subId, socials });
   147|   147|
   148|   148|    return jsonResp(200, {
   149|   149|      success: true,
   150|   150|      message: "Thanks! We'll be in touch within 1 business day.",
   151|   151|      submissionId: subId,
   152|   152|      leadScore: score,
   153|   153|      category: category,
   154|   154|    }, undefined, request);
   155|   155|
   156|   156|  } catch (err) {
   157|   157|    // Even if D1 completely fails, still send webhook and return success to user
   158|   158|    await sendWebhook(env, { name, email, phone, company, message, service: data.service, score: 0, category: "cold", subId: 0 });
   159|   159|    return jsonResp(200, {
   160|   160|      success: true,
   161|   161|      message: "Thanks! We'll be in touch within 1 business day.",
   162|   162|      submissionId: 0,
   163|   163|    }, undefined, request);
   164|   164|  }
   165|   165|}
   166|   166|
   167|   167|/**
   168|   168| * Send Discord webhook notification for new lead submissions
   169|   169| * Skips test/debug emails and handles webhook failures gracefully (non-blocking)
   170|   170| * @param {object} env - Cloudflare worker environment with DISCORD_WEBHOOK_URL
   171|   171| * @param {{name: string, email: string, phone: string|null, company: string, message: string, service?: string, score: number, category: string, subId: number}} params - Lead data to send to webhook
   172|   172| */
   173|   173|async function sendWebhook(env, { name, email, phone, company, message, service, score, category, subId }) {
   174|   174|  const webhookUrl = env.DISCORD_WEBHOOK_URL || "";
   175|   175|  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return;
   176|   176|
   177|   177|  // Skip test/debug submissions — only real leads get webhooks
   178|   178|  const skipEmails = ["test@test.com", "test@moliam.com", "debug@moliam.com", "preview@moliam.com", "roman@moliam.com"];
   179|   179|  if (skipEmails.includes(email) || email.endsWith("@example.com")) return;
   180|   180|
   181|   181|  try {
   182|   182|    const svcRaw = (service || "").toLowerCase();
   183|   183|    const svcLabel = { website: "Website Build", gbp: "GBP Optimization", lsa: "Google LSA", retainer: "Full Retainer", other: "Other" }[svcRaw] || service || "—";
   184|   184|
   185|   185|    // Determine priority tag based on lead_score and category
   186|   186|    let priorityTag = "";
   187|   187|    if (category === "hot") {
   188|   188|      priorityTag = "<@1466244456088080569>";   // Ada - hot leads
   189|   189|    } else if (category === "warm") {
   190|   190|      priorityTag = "<@1486921534441259098>";   // Ultra - warm leads    
   191|   191|    } else {
   192|   192|      priorityTag = "";   // cold leads don't need immediate attention tag
   193|   193|    }
   194|   194|
   195|   195|    // Build fields array with lead score and category
   196|   196|    const fields = [
   197|   197|      { name: "📧 Email", value: email, inline: true },
   198|   198|      { name: "📱 Phone", value: phone || "—", inline: true },
   199|   199|      { name: "🏢 Company", value: company || "—", inline: true },
   200|   200|      { name: "🎯 Service", value: svcLabel, inline: true },
   201|   201|      { name: "📊 Lead Score", value: `**${score}/100**`, inline: true },
   202|   202|      { name: "🏷️ Category", value: `**${category.toUpperCase()}**`, inline: true },
   203|   203|    ];
   204|   204|
   205|   205|    // Add social media fields if provided
   206|   206|    const s = socials || {};
   207|   207|    const socialLines = [];
   208|   208|    if (s.website) socialLines.push(`🌐 [Website](${s.website})`);
   209|   209|    if (s.gbp) socialLines.push(`📍 [Google Business](${s.gbp})`);
   210|   210|    if (s.facebook) socialLines.push(`📘 [Facebook](${s.facebook})`);
   211|   211|    if (s.instagram) socialLines.push(`📸 ${s.instagram.startsWith('http') ? `[Instagram](${s.instagram})` : `@${s.instagram.replace('@','')}`}`);
   212|   212|    if (s.yelp) socialLines.push(`⭐ [Yelp](${s.yelp})`);
   213|   213|
   214|   214|    if (socialLines.length > 0) {
   215|   215|      fields.push({ name: "🔗 Online Presence", value: socialLines.join("\n") });
   216|   216|    }
   217|   217|
   218|   218|    fields.push({ name: "💬 Message", value: (message || "—").length > 300 ? message.slice(0, 297) + "…" : (message || "—") });
   219|   219|
   220|   220|    await fetch(webhookUrl, {
   221|   221|      method: "POST",
   222|   222|      headers: { "Content-Type": "application/json" },
   223|   223|      body: JSON.stringify({
   224|   224|        username: "Moliam Lead",
   225|   225|        avatar_url: "https://moliam.com/logo.png",
   226|   226|        content: priorityTag + (priorityTag ? " New high-priority lead! " : " New lead submitted!"),
   227|   227|        embeds: [{
   228|   228|          title: "🔔" + (category === "hot" ? " HOT LEAD —" : category === "warm" ? " Warm Lead —" : " New Lead —") + name,
   229|   229|          color: category === "hot" ? 0x10B981 : category === "warm" ? 0xF59E0B : 0x3B82F6,
   230|   230|          fields,
   231|   231|          footer: { text: `Lead #${subId} • moliam.com` },
   232|   232|          timestamp: new Date().toISOString(),
   233|   233|        }],
   234|   234|      }),
   235|   235|    });
   236|   236|  } catch {
   237|   237|    // Webhook failure is never fatal
   238|   238|  }
   239|   239|
   240|   240|  const socials = {
   241|   241|   website: (data.website || "").trim(),
   242|   242|   gbp: (data.gbp || "").trim(),
   243|   243|   facebook: (data.facebook || "").trim(),
   244|   244|   instagram: (data.instagram || "").trim(),
   245|   245|   yelp: (data.yelp || "").trim(),
   246|   246| };
   247|   247| await sendWebhook(env, { name, email, phone, company, message, service: data.service, score, category, subId, socials });
   248|   248|}
   249|   249|
   250|   250|/**
   251|   251| * Generate SHA256 hash of string for IP/user identification and rate limiting
   252|   252| * Uses Web Crypto API (subtle digest) for SHA-256 computation
   253|   253| * @param {string} str - String to hash
   254|   254| * @returns {Promise<string>} Hex representation of SHA-256 hash (lowercase, 64 chars)
   255|   255| */
   256|   256|async function hashSHA256(str) {
   257|   257|  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
   258|   258|  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
   259|   259|}
   260|   260|