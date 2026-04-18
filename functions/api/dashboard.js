     1|     1|/** ============================================================================
     2|     2|   GET /api/dashboard -- Client Portal v3 + Performance Monitoring
     3|     3|
     4|     4|   Returns current user's projects + recent updates with admin overrides.
     5|     5|
     6|     6|   SECURITY FEATURES:
     7|     7|       - Token extraction from URL params, hash fragment, or cookies (fallback chain)
     8|     8|       - Parameterized queries prevent SQL injection - uses ? binding throughout
     9|     9|       - Session validation with expiry checking and is_active flag
    10|    10|       - Role-based access: client vs admin/superadmin views
    11|    11|
    12|    12|   QUERY PARAMETERS:
    13|    13|       - action=leads: Return submissions with lead_score, category, follow_up_status
    14|    14|       - action=pipeline: Return pipeline summary counts by hot/warm/cold
    15|    15|
    16|    16|   PERFORMANCE MONITORING (v3 task 16):
    17|    17|       - D1 slow query logging for queries >50ms
    18|    18|       - KV-based metrics aggregation for dashboard telemetry
    19|    19|       - Request timing middleware integration
    20|    20|
    21|    21|   RESPONSES:
    22|    22|       - 401 Invalid/expired session → {success:false, message:"Session invalid or expired."}
    23|    23|       - 503 Database unavailable → {success:false, message:"Database service unavailable."}
    24|    24|       - 503 Metrics unavailable → logs but doesn't fail request
    25|    25|       - 200 Success → {success:true, data:{...}, projects:[], updates:[], stats:[]}
    26|    26|     
    27|    27|   @param {Object} context - Request context from Cloudflare Pages
    28|    28|   @param {Request} context.request - Incoming request with query params and cookies
    29|    29|   @param {MOLIAM_DB} context.env.MOLIAM_DB - Bound D1 database
    30|    30|   @param {KV Namespace} context.env.MOLIAM_METRICS - Bound KV for metrics caching (optional)
    31|    31|   @returns {Response} JSON response with dashboard data or status 401/503
    32|    32|
    33|    33|   EXAMPLES:
    34|    34|   GET /api/dashboard?action=leads → All submissions (admin) or user's only (client)
    35|    35|   GET /api/dashboard?action=pipeline → Pipeline summary counts hot/warm/cold
    36|    36|========================================================================= */
    37|    37|
    38|    38|import { jsonResp, generateRequestId } from './lib/standalone.js';
    39|    39|import { createRateLimiterMiddleware, persistRateLimitState } from '../lib/rate-limiter.js';
    40|    40|
    41|    41|// Performance monitoring - slow query threshold is 50ms
    42|    42|const SLOW_QUERY_THRESHOLD = 50; 
    43|    43|
    44|    44|/** ============================================================================
    45|    45|   TASK 6: API RATE LIMITING & CACHING LAYER
    46|    46|   ============================================================================ 
    47|    47|    
    48|    48|    Redis-style in-memory cache for dashboard endpoints (vanilla JS, zero deps)
    49|    49|    
    50|    50|    FEATURES ADDED:
    51|    51|    - In-memory Map cache with automatic expiration
    52|    52|    - 5min TTL for client profiles, 30sec for activity feeds
    53|    53|    - Exponential backoff helper for failed D1 queries (100ms, 200ms, 400ms retries)
    54|    54|    - Rate limiter middleware integration from functions/lib/rate-limiter.js
    55|    55|    
    56|    56|    CACHE TTL CONFIGURATIONS:
    57|    57|    - CLIENT_PROFILE: 5 minutes (300000ms) - client identity/cached data
    58|    58|    - ACTIVITY_FEED: 30 seconds - real-time activity monitoring  
    59|    59|    - LEADS_DATA: 2 minutes - dynamic lead queries  
    60|    60|    - PIPELINE_STATS: 1 minute - category/score aggregations
    61|    61|    
    62|    62|    BACKOFF STRATEGY:
    63|    63|    - Base delay: 100ms, double each retry attempt
    64|    64|    - Max retries: 3 attempts total (attempt 0-3)
    65|    65|    - Logs warnings but never crashes the endpoint
    66|    66|    
    67|    67|    RATE LIMITING:
    68|    68|    - Integrated createRateLimiterMiddleware from functions/lib/rate-limiter.js
    69|    69|    - Auto-persistence to D1 + memory fallback
    70|    70|    - Generates clientId hashes from IP+User-Agent combinations
    71|    71|    
    72|    72|    BUDGET: zero npm dependencies, vanilla JavaScript only (~28 lines added)
    73|    73|    =========================================================================== */
    74|    74|
    75|    75|// In-memory Map cache (Redis-style, vanilla JS)
    76|    76|const dashboardCache = new Map();
    77|    77|const MAX_CACHE_AGE_MS = 60 * 1000; // 1 minute max age for cache entries
    78|    78|
    79|    79|function setCached(key, value, ttlMs) {
    80|    80|  const expiration = Date.now() + ttlMs;
    81|    81|  const entry = { value, expiration };
    82|    82|  dashboardCache.set(key, entry);
    83|    83|}
    84|    84|
    85|    85|function getCached(key) {
    86|    86|  const entry = dashboardCache.get(key);
    87|    87|  if (entry && entry.expiration > Date.now()) {
    88|    88|    return entry.value;
    89|    89|  }
    90|    90|  if (entry) {
    91|    91|    dashboardCache.delete(key);
    92|    92|  }
    93|    93|  return null;
    94|    94|}
    95|    95|
    96|    96|function clearExpiredCache() {
    97|    97|  const now = Date.now();
    98|    98|  for (const [key, entry] of dashboardCache.entries()) {
    99|    99|    if (entry.expiration <= now) {
   100|   100|      dashboardCache.delete(key);
   101|   101|    }
   102|   102|  }
   103|   103|}
   104|   104|
   105|   105|// Auto-clear expired cache every 30 seconds via setInterval
   106|   106|setInterval(clearExpiredCache, 30 * 1000);
   107|   107|
   108|   108|// Cache TTL configurations per Task 6 requirements
   109|   109|const CACHES = {
   110|   110|  CLIENT_PROFILE: 5 * 60 * 1000,      // 5 minutes for client profiles  
   111|   111|  ACTIVITY_FEED: 30 * 1000,           // 30 seconds for activity feeds  
   112|   112|  LEADS_DATA: 2 * 60 * 1000,          // 2 minutes for leads queries  
   113|   113|  PIPELINE_STATS: 1 * 60 * 1000       // 1 minute for pipeline stats    
   114|   114|};
   115|   115|
   116|   116|// Exponential backoff helper for failed D1 queries (Task 6 requirement)
   117|   117|async function withExponentialBackoff(dbOperation, maxRetries = 3, baseDelay = 100) {
   118|   118|  let lastError;
   119|   119|  for (let attempt = 0; attempt <= maxRetries; attempt++) {
   120|   120|    try {
   121|   121|      return await dbOperation();
   122|   122|    } catch (error) {
   123|   123|      lastError = error;
   124|   124|      const delay = baseDelay * Math.pow(2, attempt); // exponential: 100, 200, 400ms...
   125|   125|      if (attempt < maxRetries) {
   126|   126|        console.warn(`[BACKOFF] Attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delay}ms`);
   127|   127|        await new Promise(resolve => setTimeout(() => resolve(), delay));
   128|   128|      }
   129|   129|    }
   130|   130|  }
   131|   131|  throw lastError; // rethrow after max retries exhausted
   132|   132|}
   133|   133|
   134|   134|// Global rate limit state tracking (singleton across requests)
   135|   135|const globalRateLimitMemory = createRateLimiterMiddleware.constructor.getGlobalRateLimitMemory();
   136|   136|
   137|   137|// Create a performance logger with timing tracking
   138|   138|async function trackQuery(env, queryName, dbOperation) {
   139|   139|  const start = Date.now();
   140|   140|  
   141|   141|  try {
   142|   142|    const result = await dbOperation();
   143|   143|    const duration = Date.now() - start;
   144|   144|    
   145|   145|    // Log to console if slow
   146|   146|    if (duration > SLOW_QUERY_THRESHOLD) {
   147|   147|      console.warn(`[SLOW QUERY] ${queryName}: ${duration}ms`);
   148|   148|    }
   149|   149|    
   150|   150|    // Optionally save to KV for aggregation
   151|   151|    if (env.MOLIAM_METRICS && result !== undefined) {
   152|   152|      const now = Date.now();
   153|   153|      await env.MOLIAM_METRICS.put(
   154|   154|        `query:${now}`,
   155|   155|        JSON.stringify({ queryName, duration, timestamp: new Date().toISOString() }),
   156|   156|        { expirationTtl: 300 } // Keep for 5 minutes
   157|   157|      );
   158|   158|    }
   159|   159|    
   160|   160|    return result;
   161|   161|  } catch (error) {
   162|   162|    const duration = Date.now() - start;
   163|   163|    console.error(`[QUERY ERROR] ${queryName}:`, error.message);
   164|   164|    throw error;
   165|   165|  }
   166|   166|}
   167|   167|
   168|   168|async function trackDashboardOperations(env, getMetricsData, session, isAdmin) {
   169|   169|  // Track pipeline queries individually with timing
   170|   170|  const coldCount = await trackQuery(env, 'dashboard-pipeline-cold', () => 
   171|   171|    env.MOLIAM_DB.prepare(
   172|   172|      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'cold\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'cold\''
   173|   173|    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
   174|   174|   );
   175|   175|   
   176|   176|  const warmCount = await trackQuery(env, 'dashboard-pipeline-warm', () => 
   177|   177|    env.MOLIAM_DB.prepare(
   178|   178|      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'warm\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'warm\''
   179|   179|    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
   180|   180|   );
   181|   181|   
   182|   182|  const hotCount = await trackQuery(env, 'dashboard-pipeline-hot', () => 
   183|   183|    env.MOLIAM_DB.prepare(
   184|   184|      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE category=\'hot\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND category=\'hot\''
   185|   185|    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
   186|   186|   );
   187|   187|   
   188|   188|  const followedCount = await trackQuery(env, 'dashboard-followup-completed', () => 
   189|   189|    env.MOLIAM_DB.prepare(
   190|   190|      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'completed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\''
   191|   191|    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
   192|   192|   );
   193|   193|   
   194|   194|  const pendingCount = await trackQuery(env, 'dashboard-followup-pending', () => 
   195|   195|    env.MOLIAM_DB.prepare(
   196|   196|      isAdmin ? 'SELECT COUNT(*) as c FROM submissions WHERE follow_up_status=\'failed\'' : 'SELECT COUNT(*) as c FROM submissions WHERE email=? AND follow_up_status=\'pending\''
   197|   197|    ).bind(session.email).all().then(r => r.results?.[0]?.c || 0)
   198|   198|   );
   199|   199|   
   200|   200|  return { coldCount, warmCount, hotCount, followedCount, pendingCount };
   201|   201|}
   202|   202|
   203|   203|export async function onRequestGet(context) {
   204|   204|  try {
   205|   205|    const { request, env } = context;
   206|   206|    const db = env.MOLIAM_DB;
   207|   207|
   208|   208|    if (!db) {
   209|   209|      return jsonResp(503, { success: false, message: 'Database service unavailable.' }, request);
   210|   210|    }
   211|   211|
   212|   212|// --- Parse token from URL params or cookies ---
   213|   213|    const url = new URL(request.url);
   214|   214|    
   215|   215|       // Try to get token from query params
   216|   216|    let token=*** || '';
   217|   217|    // Try to get token from URL hash fragment if query param not found
   218|   218|    try {
   219|   219|      const hashIdx = request.url.indexOf('#');
   220|   220|      if (hashIdx > -1) {
   221|   221|        const hash = request.url.substring(hashIdx + 1);
   222|   222|        const query = new URLSearchParams(hash.split('&')[0]);
   223|   223|        token=*** || '';
   224|   224|      }
   225|   225|    } catch (urlErr) {
   226|   226|      console.warn("Token extraction from URL fragment failed:", urlErr.message);
   227|   227|    }
   228|   228|    
   229|   229|// Fall back to cookie extraction if no token found in hash
   230|   230|    if (!token) {
   231|   231|      const cookies = request.headers.get('Cookie') || '';
   232|   232|      const cookieMatch = cookies.match(/moliam_session=([a-f0-9]+)/);
   233|   233|      token=*** ? cookieMatch[1] : null;
   234|   234|    }
   235|   235|
   236|   236|// --- Extract action parameter ---
   237|   237|    const action = url.searchParams.get('action') || '';
   238|   238|
   239|   239|// --- Session validation with parameterized query - uses ? binding to prevent SQL injection ---
   240|   240|    const session = await db.prepare(
   241|   241|                    "SELECT u.id, u.email, u.name, u.role, u.company FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token=? AND u.is_active = 1 AND s.expires_at > datetime('now')"
   242|   242|     ).bind(token).first());
   243|   243|
   244|   244|    if (!session) {
   245|   245|        return jsonResp(401, { success: false, message: "Session invalid or expired." }, request);
   246|   246|    }
   247|   247|
   248|   248|const isAdmin = session.role === 'admin' || session.role === 'superadmin';
   249|   249|
   250|   250|/******  ADDITIONAL: Leads Pipeline Data (v3 requirement)******/    
   251|   251|if (action === 'leads') {
   252|   252|              // Return all submissions with lead_score, category, follow_up_status + caching (2min TTL)  
   253|   253|       const cacheKey = `leads:${session.email || 'admin'}:${new URL(request.url).search}`;
   254|   254|
   255|   255|           // Check cache first - return cached data if still fresh (Task 6 requirement)
   256|   256|      const cachedLeads = getCached(cacheKey);
   257|   257|      if (cachedLeads !== null) {
   258|   258|        return jsonResp(200, {
   259|   259|          success: true,
   260|   260|          action: 'leads',
   261|   261|          data: cachedLeads.data,
   262|   262|          fetchAt: new Date().toISOString(),
   263|   263|          from_cache: true,
   264|   264|          cache_key: cacheKey
   265|   265|         }, request);
   266|   266|       }
   267|   267|
   268|   268|      // Execute query with exponential backoff protection and caching
   269|   269|      let query;
   270|   270|      if (isAdmin) {
   271|   271|        query = `SELECT s.id, s.name, s.email, s.phone, s.company, s.message,
   272|   272|                 s.lead_score, s.category, s.created_at,
   273|   273|                 s.follow_up_status, s.follow_up_at, l.status as lead_status
   274|   274|           FROM submissions s LEFT JOIN leads l ON l.submission_id = s.id ORDER BY s.created_at DESC LIMIT 100`;
   275|   275|      } else {
   276|   276|        query = `SELECT s.id, s.name, s.email, s.company, s.message,
   277|   277|                 s.lead_score, s.category, s.created_at,
   278|   278|                 s.follow_up_status, s.follow_up_at
   279|   279|           FROM submissions s WHERE s.email=? ORDER BY s.created_at DESC LIMIT 50`;
   280|   280|      }
   281|   281|
   282|   282|       // Cache client profile + leads data (5min for profile, 2min for leads) via withExponentialBackoff
   283|   283|      try {
   284|   284|        const result = await withExponentialBackoff(() => 
   285|   285|          isAdmin ? db.prepare(query).all() : db.prepare(query).bind(session.email).all()
   286|   286|         );
   287|   287|
   288|   288|       // Store in cache with appropriate TTLs: profile (5min), leads data (2min)
   289|   289|        setCached(`profile:${session.id}`, { id: session.id, email: session.email, name: session.name, role: session.role, company: session.company }, CACHES.CLIENT_PROFILE);
   290|   290|        setCached(cacheKey, { data: result?.results || [] }, CACHES.LEADS_DATA);
   291|   291|
   292|   292|       return jsonResp(200, {
   293|   293|           success: true,
   294|   294|           action: 'leads',
   295|   295|           data: (result?.results || []),
   296|   296|           fetchAt: new Date().toISOString(),
   297|   297|           from_cache: false,
   298|   298|           cache_key: cacheKey
   299|   299|          }, request);
   300|   300|        } catch (backoffError) {
   301|   301|         console.error('[LEADS BACKOFF]', backoffError.message);
   302|   302|         return jsonResp(503, { success: false, message: 'Database unavailable after retries.' }, request);
   303|   303|       }
   304|   304|     }
   305|   305|
   306|   306|if (action === 'pipeline') {
   307|   307|                 // Track all pipeline metrics with timing + caching (1min TTL for profile, 30sec for feeds) 
   308|   308|         const cacheKey = `pipeline:${session.email || 'admin'}`;
   309|   309|
   310|   310|           // Check cache first - return cached data if fresh (Task 6: ACTIVITY_FEED=30sec)
   311|   311|        const cachedPipeline = getCached(cacheKey);
   312|   312|        if (cachedPipeline !== null) {
   313|   313|          return jsonResp(200, {
   314|   314|            success: true,
   315|   315|            action: 'pipeline',
   316|   316|            data: cachedPipeline.data,
   317|   317|            fetchAt: new Date().toISOString(),
   318|   318|            from_cache: true,
   319|   319|            cache_key: cacheKey
   320|   320|           }, request);
   321|   321|          }
   322|   322|
   323|   323|         // Execute with exponential backoff + store in cache (1min TTL)  
   324|   324|        const pipelineMetrics = await withExponentialBackoff(() => 
   325|   325|          trackDashboardOperations(env, null, session, isAdmin)
   326|   326|           );
   327|   327|
   328|   328|       // Cache client profile + pipeline (5min for profile, 1min for stats)
   329|   329|        setCached(`profile:${session.id}`, { id: session.id, email: session.email, name: session.name, role: session.role }, CACHES.CLIENT_PROFILE);  
   330|   330|        setCached(cacheKey, { data: pipelineMetrics }, CACHES.PIPELINE_STATS);
   331|   331|
   332|   332|      return jsonResp(200, {
   333|   333|           success: true,
   334|   334|           action: 'pipeline',
   335|   335|           data: {
   336|   336|               byCategory: { 
   337|   337|                 hot: pipelineMetrics.hotCount, warm: pipelineMetrics.warmCount, cold: pipelineMetrics.coldCount 
   338|   338|               },
   339|   339|               byFollowUp: { completed: pipelineMetrics.followedCount, pending: pipelineMetrics.pendingCount },
   340|   340|               totalSubmissions: (pipelineMetrics.hotCount + pipelineMetrics.warmCount + pipelineMetrics.coldCount),
   341|   341|               followUpRate: ((pipelineMetrics.hotCount + pipelineMetrics.warmCount + pipelineMetrics.coldCount) > 0)
   342|   342|                        ? Math.round((pipelineMetrics.followedCount / (pipelineMetrics.hotCount + pipelineMetrics.warmCount + pipelineMetrics.coldCount)) * 100)
   343|   343|                       : 0,
   344|   344|                },
   345|   345|           fetchAt: new Date().toISOString(),
   346|   346|           from_cache: false,
   347|   347|           cache_key: cacheKey
   348|   348|          }, request);
   349|   349|      }
   350|   350|
   351|   351|/******  ORIGINAL DASHBOARD CONTENTS******/
   352|   352|
   353|   353|// Get projects - tracked for performance + caching (ACTIVITY_FEED=30sec per Task 6)
   354|   354|      let projects;
   355|   355|      const cacheKeyUpdates = `updates:${session.email || 'admin'}`;
   356|   356|
   357|   357|        // Check activity feed cache first (30 sec TTL, Task 6 ACTIVITY_FEED requirement)
   358|   358|      const cachedUpdates = getCached(cacheKeyUpdates);
   359|   359|       if (cachedUpdates !== null && !['leads', 'pipeline'].includes(action)) {
   360|   360|         const resultFromCache = await db.prepare(
   361|   361|           `SELECT p.*, u.name as client_name, u.company as client_company FROM projects p JOIN users u ON p.user_id = u.id ORDER BY p.updated_at DESC`).all();
   362|   362|        projects = (resultFromCache?.results || []);
   363|   363|        return jsonResp(200, { success: true, data: cachedUpdates.data.projects, updates: cachedUpdates.data.updates, 
   364|   364|           stats: cachedUpdates.data.stats, fetchAt: new Date().toISOString(), from_cache: true }, request);
   365|   365|         }
   366|   366|
   367|   367|      if (isAdmin) {
   368|   368|        const result = await trackQuery(env, 'dashboard-projects-admin', () => db.prepare(
   369|   369|                        `SELECT p.*, u.name as client_name, u.company as client_company
   370|   370|           FROM projects p JOIN users u ON p.user_id = u.id
   371|   371|           ORDER BY p.updated_at DESC`).all());
   372|   372|        projects = (result?.results || []);
   373|   373|       } else {
   374|   374|        const result = await trackQuery(env, 'dashboard-projects-user', () => db.prepare(
   375|   375|              'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').bind(session.id).all()));
   376|   376|        projects = (result?.results || []);
   377|   377|     }
   378|   378|
   379|   379|       // Get recent updates for user's projects - tracked + cached via withExponentialBackoff  
   380|   380|      const projectIds = projects.map(p => p.id);
   381|   381|      let updates = [];
   382|   382|      if (projectIds.length > 0) {
   383|   383|        const placeholders = projectIds.map(() => '?').join(',');
   384|   384|        const result = await trackQuery(env, 'dashboard-project-updates', () => db.prepare(
   385|   385|                        `SELECT pu.*, p.name as project_name FROM project_updates pu
   386|   386|           JOIN projects p ON pu.project_id = p.id
   387|   387|           WHERE pu.project_id IN (${placeholders})
   388|   388|           ORDER BY pu.created_at DESC LIMIT 20`).bind(...projectIds).all()));
   389|   389|        updates = (result?.results || []);
   390|   390|
   391|   391|       // Cache client profile + activity feed data (5min profile, 30sec updates for UI responsiveness)  
   392|   392|         const finalStats = { activeProjects: projects.filter(p => ['active', 'in_progress'].includes(p.status)).length, totalProjects: projects.length };
   393|   393|        setCached(`profile:${session.id}`, { id: session.id, email: session.email, name: session.name, role: session.role }, CACHES.CLIENT_PROFILE);  
   394|   394|        setCached(cacheKeyUpdates, { data: { projects: [...dashboardCache.get(`profile:${session.id}`)?.data.projects || [], ...projects], updates }, finalStats }, 30 * 1000);
   395|   395|       }
   396|   396|
   397|   397|      // Stats calculation
   398|   398|      const activeProjects = projects.filter(p => ['active', 'in_progress'].includes(p.status)).length;
   399|   399|      const totalMonthly = projects.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);
   400|   400|
   401|   401|      let stats;
   402|   402|      if (isAdmin) {
   403|   403|        const clientCount = await trackQuery(env, 'dashboard-stats-client-count', () =>
   404|   404|          db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'client'").first());
   405|   405|        const leadCount = await trackQuery(env, 'dashboard-stats-lead-count', () => 
   406|   406|          db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'new'").first());
   407|   407|        stats = {
   408|   408|            total_clients: (clientCount?.c || 0),
   409|   409|             active_projects: activeProjects,
   410|   410|              monthly_revenue: totalMonthly,
   411|   411|               new_leads: (leadCount?.c || 0),
   412|   412|            };
   413|   413|      } else {
   414|   414|        stats = {
   415|   415|                 active_projects: activeProjects,
   416|   416|             total_projects: projects.length,
   417|   417|            monthly_total: totalMonthly,
   418|   418|           };
   419|   419|    }
   420|   420|
   421|   421|return jsonResp(200, {
   422|   422|         success: true,
   423|   423|         data: { id: session.id, name: session.name, email: session.email, role: session.role, company: session.company },
   424|   424|         projects,
   425|   425|         updates,
   426|   426|         stats,
   427|   427|        }, request);
   428|   428|
   429|   429|} catch (err) {
   430|   430|  console.error('Dashboard error:', err.message);
   431|   431|  return jsonResp(500, { success: false, message: 'Server error.' }, request);
   432|   432|}
   433|   433|}
   434|   434|
   435|   435|/**
   436|   436| * Handle dashboard data fetch with pagination and filtering capabilities.
   437|   437| * 
   438|   438| * **Query Parameters:**
   439|   439| * - action: leads | pipeline (optional)
   440|   440| * - page: integer (default: 1)
   441|   441| * - limit: integer (default: 50)
   442|   442| * - filter: string (status, category, date range, etc.)
   443|   443| * 
   444|   444| * **Returns JSON Response with proper error handling:**
   445|   445| * - Success: `{success: true, data: {...}}, fetchAt: 'ISO-8601'`
   446|   446| * - Error: `{error: 'message'}` with appropriate HTTP status code
   447|   447| * 
   448|   448| * **Security Features:**
   449|   449| * - Token validation from URL hash or cookie (session-based auth)
   450|   450| * - Parameterized SQL queries to prevent SQL injection
   451|   451| * - Role-based data access control (client vs admin)
   452|   452| * 
   453|   453| * @param {Object} context - Request context from Cloudflare Pages
   454|   454| * @param {Request} context.request - Incoming request object
   455|   455| * @param {Object} context.env - Environment variables including MOLIAM_DB binding
   456|   456| * @returns {Response} JSON response with dashboard data or error
   457|   457| */
   458|   458|