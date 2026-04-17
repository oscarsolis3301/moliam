1|// Dashboard Client Script - Moliam Project
     2|// Handles dashboard data loading and UI rendering + Chart.js visualizations
     3|
     4|(async function() {
     5|    'use strict';
     6|
     7|// Define session token for API authentication (needed by fetch calls in Activity Feed)
     8|let session_token;
     9|try { session_token='***' || ''; } catch(e) {}
    10|if (!session_token && document.cookie) { const match = document.cookie.match(/moliam_session=([^;]+)/); if (match) session_token=*** }
    11|
    12|// Helper: Extract session parameter from URL - simplified version of existing code above
    13|function urlParam(name) {
    14|    try { return new URLSearchParams(window.location.search).get(name); }
    15|    catch(e) { return null; }
    16|}
    17|
    18|const urlParams = new URLSearchParams(window.location.search);
    19|let impersonatedUserId = urlParams.get('impersonate');
    20|
    21|         // Check if user is authenticated (cookie-based)
    22|    function checkAuth() {
    23|        return fetch('/api/auth/me', { credentials: 'include' })
    24|               .then(r => r.json())
    25|               .catch(e => null);
    26|     }
    27|
    28|          // Fetch dashboard data
    29|    function fetchDashboard() {
    30|        return fetch('/api/dashboard', { credentials: 'include' })
    31|               .then(r => r.json())
    32|               .catch(e => null);
    33|      }
    34|
    35|         // Show auth error state
    36|    function showAuthError() {
    37|        document.body.innerHTML = '<div style="text-align:center;padding:48px"><h2>Login Required</h2><a href="/login.html" class="btn">Go to Login →</a></div>';
    38|       }
    39|
    40|        // Load invoices data when requested (lazy load)
    41|    window.loadInvoicesData = function() {
    42|        return fetch('/api/invoices', { credentials: 'include' })
    43|               .then(r => r.json())
    44|               .catch(e => []);
    45|      };
    46|
    47|         // Initialize charts using ChartViz module
    48|    async function initializeCharts(data, isAdmin) {
    49|            if (typeof Chart === 'undefined' || !window.ChartViz) return;
    50|
    51|            let categoryData = null;
    52|            let revenueData = null;
    53|
    54|            if (data.leads && data.leads.category_totals) {
    55|              categoryData = {
    56|                 categories: data.leads.category_totals,
    57|                 title: 'Lead Distribution'
    58|               };
    59|
    60|            const funnelContainer = document.getElementById('funnel-chart');
    61|            if (funnelContainer) {
    62|                    try {
    63|                        await window.ChartViz.createLeadsFunnel('funnel-chart', categoryData);
    64|                       } catch (e) { console.warn('Chart init failed:', e); }
    65|            }
    66|              }
    67|
    68|            if (data.stats && data.stats.monthly_revenue_data) {
    69|                revenueData = data.stats.monthly_revenue_data;
    70|
    71|                const revenueContainer = document.getElementById('revenue-chart');
    72|                if (revenueContainer) {
    73|                        try {
    74|                            await window.ChartViz.createRevenueChart('revenue-chart', revenueData);
    75|                           } catch (e) { console.warn('Revenue chart init failed:', e); }
    76|                       }
    77|              }
    78|
    79|               // Log initialization for dev console
    80|            console.log('Dashboard Charts Initialized:', {
    81|                funnel: !!categoryData,
    82|                revenue: !!revenueData,
    83|                isAdmin: isAdmin
    84|            });
    85|    }
    86|
    87|    const [auth, dashboard] = await Promise.allSettled([
    88|        checkAuth(),
    89|        fetchDashboard()
    90|      ]);
    91|
    92|    if (auth.status === 'rejected' || !auth.value?.success) {
    93|        window.location.href = '/login.html';
    94|        return;
    95|      }
    96|
    97|    if (dashboard.status === 'rejected' || !dashboard.value?.success) {
    98|        window.location.href = '/login.html';
    99|        return;
   100|      }
   101|
   102|    let data = dashboard.value;
   103|    let currentUserId = data.user?.id;
   104|    let currentUserRole = data.user?.role;
   105|
   106|   const isAdmin = (currentUserRole === 'admin' || currentUserRole === 'superadmin');
   107|
   108|       // Show impersonation banner for admin viewing another client
   109|    if (impersonatedUserId && isAdmin) {
   110|        document.getElementById('impersonation-banner').style.display = 'block';
   111|        let name = data.user?.name || 'Unknown User';
   112|        document.getElementById('impersonated-name').textContent = '👁 Viewing as ' + name;
   113|
   114|         // Filter to show only that user's projects for the impersonation view
   115|        if (data.projects) {
   116|            data.projects = data.projects.filter(p => p.user_id == impersonatedUserId);
   117|           }
   118|       }
   119|
   120|         // Initially show skeleton, then fade out when data ready
   121|    const skeletonStats = document.getElementById('skeleton-stats');
   122|    if(skeletonStats){
   123|        skeletonStats.style.display = 'grid';
   124|        setTimeout(() => {
   125|            if(skeletonStats) skeletonStats.className += ' fade-out';
   126|            setTimeout(()=>{if(skeletonStats)skeletonStats.style.display='none'},300);
   127|           }, 600);
   128|       }
   129|
   130|        // Render stats cards with staggered animation delay
   131|    renderStats(data, isAdmin, data.stats || {}, currentUserId);
   132|
   133|          // Get total client count for admin dashboard mode
   134|    if (isAdmin) {
   135|        fetch('/api/admin/clients', { credentials: 'include' })
   136|               .then(r => r.json())
   137|               .then(c => {
   138|                if (c.clients && c.clients.length > 0) {
   139|                    const el = document.getElementById('total-clients');
   140|                    if(el)el.textContent = c.clients.length;
   141|                   }
   142|               });
   143|         }
   144|
   145|          // Render project cards - enhance with hover effects and animations
   146|    renderProjects(data.projects || []);
   147|
   148|// Render milestone updates/timeline
   149|    renderTimeline(data.updates || []);
   150|
   151|      // Load activity feed from new backend API (Task 21)
   152|    loadActivityFeed();
   153|
   154|       // Calculate invoice summary for stats display
   155|    calculateInvoiceStats(data.invoices || []);
   156|
   157|        // Initialize visualizations if data available
   158|    await initializeCharts(data, isAdmin);
   159|
   160|    }).catch(err => {
   161|         console.error('Dashboard init error:', err);
   162|// Load activity feed from new backend API (Task 21)
   163|loadActivityFeed();
   164|
   165|// ============================================================================
   166|// ACTIVITY FEED LOADER - Task 21: Connect to /api/activity backend endpoint
   167|
   168|/** Load activity feed from backend API and render items in #activity-feed section */
   169|async function loadActivityFeed() {
   170|    try {
   171|        const sessionToken=getSes...n();
   172|        if (!sessionToken) {
   173|            console.warn('No session token available for activity feed');
   174|            return;
   175|            }
   176|
   177|        const response = await fetch(`/api/activity?action=list&token=${enco...)}`, {
   178|            credentials: 'include'
   179|          });
   180|
   181|        if (!response.ok) throw new Error(`Failed to load activity feed: ${response.status}`);
   182|
   183|        const result = await response.json();
   184|
   185|        if (result.success && result.data && Array.isArray(result.data)) {
   186|            if (result.data.length > 0) {
   187|                console.log(`Loaded ${result.data.length} activities from backend`);
   188|                for (const activity of result.data.slice(0, 20)) {
   189|                    addActivityItem({
   190|                        type: activity.action_type || 'info',
   191|                        title: 'Activity Update',
   192|                        description: activity.details || 'No details provided',
   193|                        timestamp: activity.created_at || new Date().toISOString()
   194|                    });
   195|                }
   196|            } else {
   197|                const feedContainer = document.getElementById('activity-feed');
   198|                if (feedContainer) {
   199|                    feedContainer.innerHTML = '<div class="empty-state" style="font-size:14px;margin-top:24px">No recent activity yet. Your project updates will appear here automatically.</div>';
   200|                }
   201|            }
   202|        } else {
   203|            console.warn('Activity load failed:', result.message || result.error);
   204|        }
   205|
   206|    } catch (err) {
   207|        console.warn('Activity feed error:', err.message);
   208|        // Graceful degradation - don't fail dashboard if activity API unavailable
   209|    }
   210|}
   211|
   212|/** Helper to get session token from available sources */
   213|function getSessionToken() {
   214|    if (session_token) return session_token;
   215|    try {
   216|        const cookies = document.cookie.split(';');
   217|        for (const cookie of cookies) {
   218|            const [name, value] = cookie.trim().split('=');
   219|            if (name === 'session') return value;
   220|        }
   221|     } catch(e) { return null; }
   222|    return null;
   223|}
   224|
   225|// Export for external use if needed
   226|window.loadActivityFeed = loadActivityFeed;
   227|
   228|/** Load activity history from backend API */
   229|      window.loadActivityHistory = async function(loadLimit = 20) {
   230|    try {
   231|        const sessionToken=getSes...n();
   232|        if (!sessionToken) return [];
   233|
   234|        const response = await fetch(`/api/activity?action=list&limit=${loadLimit}&token=${enco...)}`, {
   235|            method: 'GET',
   236|            credentials: 'include'
   237|          });
   238|
   239|        if (!response.ok) throw new Error(`HTTP ${response.status}`);
   240|
   241|        const result = await response.json();
   242|
   243|        const feedContainer = document.getElementById('activity-feed');
   244|
   245|        if (result.success && Array.isArray(result.data)) {
   246|            // Clear empty state and rebuild from data
   247|            feedContainer.innerHTML = '';
   248|
   249|            for (const activity of result.data) {
   250|                addActivityItem(activity);   // false = don't auto-scroll on history items
   251|            }
   252|
   253|            console.log(`✓ Loaded ${result.data.length} activities to feed`);
   254|            return result.data;
   255|        } else {
   256|            throw new Error(result.error || 'Unknown error loading activity');
   257|        }
   258|
   259|    } catch (error) {
   260|        console.warn('Activity API load failed:', error.message);
   261|
   262|        // Show friendly empty state instead of technical errors
   263|        const feedContainer = document.getElementById('activity-feed');
   264|        if (feedContainer) {
   265|            feedContainer.innerHTML = '<div class="empty-state" style="color:var(--accent-amber)">Recent activity unavailable. Your dashboard will update automatically when new events occur.</div>';
   266|        }
   267|
   268|        return [];
   269|    }
   270|}
   271|
   272|// Stat cards with staggered animation - enhanced design patterns from Linear/Vercel/Supabase dashboards
   273|// Stat cards with staggered animation - enhanced design patterns from Linear/Vercel/Supabase dashboards
   274|function renderStats(data, isAdmin, stats, currentUserId) {
   275|    const statsGrid = document.getElementById('stats-grid');
   276|    let html = '';
   277|
   278|    if (isAdmin) {
   279|        html += '<div class="stat-card" style="--stagger:0.1s"><div class="label">Clients</div><div class="value" id="total-clients">0</div></div>';
   280|        html += '<div class="stat-card" style="--stagger:0.15s"><div class="label">Active Projects</div><div class="value">'+stats.active_projects+'</div></div>';
   281|      } else {
   282|        html += '<div class="stat-card" style="--stagger:0.1s"><div class="label">Active Projects</div><div class="value">'+(data.stats?.active_projects||0)+'</div></div>';
   283|        html += '<div class="stat-card" style="--stagger:0.15s"><div class="label">Monthly Revenue</div><div class="value">$'+(stats.monthly_total||0).toLocaleString()+'</div></div>';
   284|      }
   285|
   286|   statsGrid.innerHTML = html;
   287|}
   288|
   289|// Project cards with modern visual polish and smooth animations
   290|function renderProjects(projects) {
   291|    const projectGrid = document.getElementById('projects-grid');
   292|    let projHtml = '';
   293|
   294|    if (!projects || projects.length === 0) {
   295|        projHtml = '<div class="empty-state" style="--stagger:0.2s"><p>No active projects yet.<a href="/">Book a project now!</a></p></div>';
   296|      } else {
   297|        let delayCounter = 0.1;
   298|        for (const project of projects) {
   299|            const typeClass = 'type-'+(project.type||'website').toLowerCase();
   300|            const statusClass = 'status-'+((project.status||'active').toLowerCase().replace(' ','_'));
   301|            let typeDisplay = project.type ? project.type.charAt(0).toUpperCase() + project.type.slice(1) : 'Website';
   302|            let statusDisplay = (project.status==='active') ? 'Active' :
   303|                                (project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Completed');
   304|
   305|            projHtml += '<div class="project-card" style="--stagger:'+(delayCounter+=0.05)+'s">';
   306|            projHtml += '<span class="type-badge '+typeClass+'">'+typeDisplay+'</span>';
   307|            projHtml += '<span class="status-badge '+statusClass+'">'+statusDisplay+'</span>';
   308|            projHtml += '<h3>'+project.name+'</h3>';
   309|            projHtml += '<div class="meta">';
   310|            projHtml += '<div>Type: '+typeDisplay+'</div>';
   311|            projHtml += '<div>Status: '+statusDisplay+'</div>';
   312|            projHtml += '<div>Monthly Rate: $'+(project.monthly_rate||0).toLocaleString()+'</div>';
   313|            projHtml += '<div>Started: '+new Date(project.created_at+Date.now()).toLocaleDateString()+'</div>';
   314|            projHtml += '</div></div>';
   315|           }
   316|       }
   317|
   318|    projectGrid.innerHTML = projHtml;
   319|}
   320|
   321|// Timeline with smooth scroll and visual polish - Supabase design language
   322|function renderTimeline(updates) {
   323|    const timeline = document.getElementById('timeline');
   324|    let timelineItems = '';
   325|
   326|    if (updates && updates.length > 0) {
   327|        for (const update of updates.slice(0,15)) {
   328|            if (!update.title && !update.description) continue;
   329|            timelineItems += '<div class="timeline-item">';
   330|            timelineItems += '<div class="timeline-dot"></div>';
   331|            timelineItems += '<h4>'+update.title+' Project Update</h4>';
   332|            timelineItems += '<p style="color:var(--text-secondary);margin-bottom:8px;">'+(update.description||'No description provided.')+'</p>';
   333|            timelineItems += '<span class="date">'+new Date(update.created_at+Date.now()).toLocaleString()+'</span></div>';
   334|           }
   335|       } else {
   336|        timelineItems = '<div class="empty-state" style="font-size:14px;margin-top:24px">No updates yet. Your project team will post milestones here.</div>';
   337|      }
   338|
   339|   timeline.innerHTML = timelineItems;
   340|}
   341|
   342|// Invoice summary calculation and list rendering with WCAG touch targets 44px minimum
   343|function calculateInvoiceStats(invoices) {
   344|    let totalBilled=0, totalPaid=0, outstanding=0;
   345|
   346|    for (const inv of invoices) {
   347|        const amt = inv.amount||0;
   348|        totalBilled += amt;
   349|        if (inv.status==='paid') totalPaid+=amt; else outstanding+=amt;
   350|      }
   351|
   352|   const invoiceStatsEl = document.getElementById('invoice-stats');
   353|   if(invoiceStatsEl){
   354|       invoiceStatsEl.innerHTML = '<span class="sub-label">Total Billed</span>' +
   355|              '<span class="value">$'+totalBilled.toLocaleString()+'</span>' +
   356|              '<div style="margin-top:12px"><span class="sub-label">Paid</span><span class="value paid">$'+(totalPaid||0).toLocaleString()+'</span></div>' +
   357|              '<div style="margin-top:8px"><span class="sub-label">Outstanding</span><span class="value pending">$'+(outstanding||0).toLocaleString()+'</span></div>';
   358|      }
   359|
   360|
   361|// Enhanced invoice list rendering with glassmorphism design patterns and WCAG touch targets 44px minimum
   362|    window.loadInvoicesData = async function() {
   363|        try {
   364|            const response = await fetch('/api/invoices?action=list', {
   365|                credentials: 'include'
   366|           });
   367|            if (!response.ok) throw new Error('Failed to load invoices');
   368|
   369|            const result = await response.json();
   370|
   371|            if (result.success && result.data && Array.isArray(result.data)) {
   372|                renderInvoiceCards(result.data);
   373|              } else {
   374|                document.getElementById('invoice-list').innerHTML = '<div class="empty-state">No invoices found.</div>';
   375|              }
   376|         } catch (e) {
   377|            console.error('Invoice load error:', e);
   378|            document.getElementById('invoice-list').innerHTML =
   379|                  '<div class="empty-state" style="color:var(--accent-red)">Failed to load invoices. Please try again.</div>';
   380|          }
   381|       };
   382|
   383|    window.showInvoices = function() {
   384|        return window.loadInvoicesData();
   385|      };
   386|
   387|    window.showInvoiceList = function() {
   388|           // Scroll to invoice list section and load
   389|        const invoiceSection = document.querySelector('.invoice-section');
   390|        if (invoiceSection) {
   391|            invoiceSection.scrollIntoView({ behavior: 'smooth' });
   392|          }
   393|        window.loadInvoicesData();
   394|      };
   395|
   396|     // Render invoices as interactive cards with status badges, amounts, due dates, and actions
   397|    function renderInvoiceCards(invoices) {
   398|        const listContainer = document.getElementById('invoice-list');
   399|
   400|        if (!invoices || invoices.length === 0) {
   401|            listContainer.innerHTML = '<div class="empty-state">No invoices yet. Create your first invoice to get started.</div>';
   402|            return;
   403|          }
   404|
   405|        let cardsHTML = '';
   406|        for (const inv of invoices) {
   407|            const statusClass = (inv.status||'draft').toLowerCase().replace(' ','_');
   408|            const formattedAmount = '$'+(inv.amount||0).toLocaleString();
   409|            const invoiceDate = inv.due_date ? new Date(inv.due_date + Date.now()).toLocaleDateString() : 'N/A';
   410|
   411|            cardsHTML += '<div class="invoice-card" data-id="'+(inv.id||'')+'">';
   412|            cardsHTML += '<div class="invoice-header">';
   413|            cardsHTML += '<div class="invoice-number">#'+(inv.invoice_number||'N/A').toUpperCase()+'</div>';
   414|            cardsHTML += '<span class="status-badge-'+(statusClass)+' status-badge">'+(inv.status||'draft').charAt(0).toUpperCase()+(inv.status||'draft').slice(1)+'</span>';
   415|            cardsHTML += '</div>';
   416|            cardsHTML += '<div class="invoice-amount">'+formattedAmount+'</div>';
   417|            cardsHTML += '<div class="invoice-meta"><div>Due: '+invoiceDate+'</div>';
   418|
   419|            if (inv.line_items && JSON.parse(inv.line_items||'[]').length > 0) {
   420|                const items = JSON.parse(inv.line_items);
   421|                cardsHTML += '<div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">line items: '+items.length+'</div>';
   422|                   }
   423|
   424|              // Action buttons with WCAG 44px minimum touch targets on mobile
   425|            const btnClass = 'btn primary';
   426|            const ariaLabel = 'View invoice '+ (inv.invoice_number || inv.id);
   427|            cardsHTML += '<div class="invoice-actions-inline">';
   428|            cardsHTML += '<button class="'+btnClass+'" style="min-height:44px;min-width:44px;" onclick="window.viewInvoice('+ (inv.id||0) +')" aria-label="'+ariaLabel+'">';
   429|            cardsHTML += '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
   430|            cardsHTML += ' View Details';
   431|            cardsHTML += '</button><a class="btn secondary" href="/api/invoices?action=get&invoice_id='+ (inv.id||'') +'" download aria-label="Download PDF invoice '+ (inv.invoice_number || inv.id) +'">';
   432|            cardsHTML += '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>';
   433|            cardsHTML += ' PDF Export';
   434|            cardsHTML += '</a></div>';
   435|            cardsHTML += '</div>';
   436|          }
   437|
   438|        listContainer.innerHTML = cardsHTML;
   439|
   440|          // Add staggered animation delay for sequential reveal pattern
   441|        const cards = document.querySelectorAll('.invoice-card');
   442|        for (let i = 0; i < cards.length; i++) {
   443|            cards[i].style.setProperty('--stagger', (i * 0.05).toFixed(2)+'s');
   444|          }
   445|
   446|console.log('Rendered '+cards.length+' invoice cards');
   447|       }
   448|
   449|/** Client Activity Feed Widget - Task 20 Integration **/
   450|
   451|// Initialize activity feed when dashboard loads
   452|function initializeClientActivity() {
   453|    const feedContainer = document.getElementById('activity-feed');
   454|
   455|    if (!feedContainer) return;
   456|
   457|     // Show loading state initially
   458|    feedContainer.innerHTML = '<div class="activity-empty"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-5a2 2 0 012-2h7.5l2.5 1.5V19a2 2 0 01-2 2z" /></svg><div class="empty-title">Activity Feed</div><div class="empty-text">Recent project updates and milestones will appear here automatically.</div></div>';
   459|
   460|     // Connect to activity feed if module exists
   461|    if (typeof ActivityFeed !== 'undefined') {
   462|        console.log('✓ Activating Client Activity Feed Widget (Task 20)');
   463|
   464|         // Load any past activities from API
   465|        loadActivityHistory(10).then(history => {
   466|            console.log(`Loaded ${history.length} historical activities`);
   467|         });
   468|
   469|         // Subscribe to realtime WebSocket messages if available
   470|        if (typeof window.addEventListener === 'function') {
   471|            window.addEventListener('activity-update', function(e) {
   472|                if (e.detail && e.detail.activity) {
   473|                    ActivityFeed.addItem(e.detail.activity, true);
   474|                 }
   475|             }, false);
   476|         }
   477|
   478|         // Auto-refresh activity feed every 30 seconds for desktop users
   479|        setInterval(() => {
   480|            const statusIndicator = findStatusIndicators();
   481|            if (statusIndicator && document.hidden === false) {
   482|                // Only refresh when user is on this page and session active
   483|                loadActivityHistory(5).catch(e => console.warn('Activity feed auto-refresh failed:', e));
   484|             }
   485|         }, 30000);   // 30 second interval
   486|
   487|      } else {
   488|        console.log('Activity Feed module not loaded yet');
   489|     }
   490|}
   491|
   492|/** Load activity history from backend API */
   493|      window.loadActivityHistory = async function(loadLimit = 20) {
   494|    try {
   495|            const sessionToken=getSes...n();
   496|            if (!sessionToken) return [];
   497|
   498|            const response = await fetch(`/api/activity?token=${enco...t}`, {
   499|            method: 'GET',
   500|            credentials: 'include'
   501|