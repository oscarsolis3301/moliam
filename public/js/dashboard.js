// Dashboard Client Script - Moliam Project
// Handles dashboard data loading and UI rendering + Chart.js visualizations

(async function() {
    'use strict';

// Define session token for API authentication (needed by fetch calls in Activity Feed)   
let session_token;
try { const urlParams = new URLSearchParams(window.location.search); session_token=urlParams.get('token'); } catch(e) {}
if (!session_token && document.cookie) { const match = document.cookie.match(/session=([^;]+)/); if (match) session_token=match[1]; }

const urlParams = new URLSearchParams(window.location.search);
let impersonatedUserId = urlParams.get('impersonate');

         // Check if user is authenticated (cookie-based)
    function checkAuth() {
        return fetch('/api/auth/me', { credentials: 'include' })
               .then(r => r.json())
               .catch(e => null);
     }

          // Fetch dashboard data
    function fetchDashboard() {
        return fetch('/api/dashboard', { credentials: 'include' })
               .then(r => r.json())
               .catch(e => null);
      }

         // Show auth error state
    function showAuthError() {
        document.body.innerHTML = '<div style="text-align:center;padding:48px"><h2>Login Required</h2><a href="/login.html" class="btn">Go to Login →</a></div>';
       }

        // Load invoices data when requested (lazy load)
    window.loadInvoicesData = function() {
        return fetch('/api/invoices', { credentials: 'include' })
               .then(r => r.json())
               .catch(e => []);
      };
        
         // Initialize charts using ChartViz module
    async function initializeCharts(data, isAdmin) {
            if (typeof Chart === 'undefined' || !window.ChartViz) return;

            let categoryData = null;
            let revenueData = null;

            if (data.leads && data.leads.category_totals) {
              categoryData = {
                 categories: data.leads.category_totals,
                 title: 'Lead Distribution'
               };

            const funnelContainer = document.getElementById('funnel-chart');
            if (funnelContainer) {
                    try {
                        await window.ChartViz.createLeadsFunnel('funnel-chart', categoryData);
                      } catch (e) { console.warn('Chart init failed:', e); }
                  }
              }

            if (data.stats && data.stats.monthly_revenue_data) {
                revenueData = data.stats.monthly_revenue_data;

                const revenueContainer = document.getElementById('revenue-chart');
                if (revenueContainer) {
                        try {
                            await window.ChartViz.createRevenueChart('revenue-chart', revenueData);
                           } catch (e) { console.warn('Revenue chart init failed:', e); }
                       }
              }

               // Log initialization for dev console
            console.log('Dashboard Charts Initialized:', {
                funnel: !!categoryData,
                revenue: !!revenueData,
                isAdmin: isAdmin
            });
    }

    const [auth, dashboard] = await Promise.allSettled([
        checkAuth(),
        fetchDashboard()
      ]);

    if (auth.status === 'rejected' || !auth.value?.success) { 
        window.location.href = '/login.html'; 
        return; 
      }

    if (dashboard.status === 'rejected' || !dashboard.value?.success) {
        window.location.href = '/login.html';
        return;
      }

    let data = dashboard.value;
    let currentUserId = data.user?.id;
    let currentUserRole = data.user?.role;

   const isAdmin = (currentUserRole === 'admin' || currentUserRole === 'superadmin');

       // Show impersonation banner for admin viewing another client
    if (impersonatedUserId && isAdmin) {
        document.getElementById('impersonation-banner').style.display = 'block';
        let name = data.user?.name || 'Unknown User';
        document.getElementById('impersonated-name').textContent = '👁 Viewing as ' + name;

         // Filter to show only that user's projects for the impersonation view
        if (data.projects) {
            data.projects = data.projects.filter(p => p.user_id == impersonatedUserId);
           }
       }

         // Initially show skeleton, then fade out when data ready
    const skeletonStats = document.getElementById('skeleton-stats');
    if(skeletonStats){
        skeletonStats.style.display = 'grid';
        setTimeout(() => {
            if(skeletonStats) skeletonStats.className += ' fade-out';
            setTimeout(()=>{if(skeletonStats)skeletonStats.style.display='none'},300);
           }, 600);
       }

        // Render stats cards with staggered animation delay
    renderStats(data, isAdmin, data.stats || {}, currentUserId);

          // Get total client count for admin dashboard mode
    if (isAdmin) {
        fetch('/api/admin/clients', { credentials: 'include' })
               .then(r => r.json())
               .then(c => {
                if (c.clients && c.clients.length > 0) { 
                    const el = document.getElementById('total-clients');
                    if(el)el.textContent = c.clients.length; 
                   }
               });
         }

          // Render project cards - enhance with hover effects and animations
    renderProjects(data.projects || []);

// Render milestone updates/timeline
    renderTimeline(data.updates || []);

      // Load activity feed from new backend API (Task 21)
    loadActivityFeed();

       // Calculate invoice summary for stats display
    calculateInvoiceStats(data.invoices || []);

        // Initialize visualizations if data available
    await initializeCharts(data, isAdmin);

    }).catch(err => { 
         console.error('Dashboard init error:', err); 
         showAuthError(); 
    });

// ============================================================================
// ACTIVITY FEED LOADER - Task 21: Connect to /api/activity backend endpoint

/** Load activity feed from backend API and render items in #activity-feed section */
async function loadActivityFeed() {
    try {
        const sessionToken = getSessionToken();
        if (!sessionToken) return;

        const response = await fetch(`/api/activity?action=list&token=${sessionToken}`);
        
        if (!response.ok) throw new Error('Failed to load activity feed');
        
            const result = await response.json();
            
        if (result.success && result.data && Array.isArray(result.data)) {
            if (result.data.length > 0) {
                console.log(`Loaded ${result.data.length} activities from backend`);
                for (const activity of result.data.slice(0, 20)) {
                    addActivityItem({
                        type: activity.action_type || 'info',
                        title: 'Activity Update',
                        description: activity.details || 'No details provided',
                        timestamp: activity.created_at || new Date().toISOString()
                      });
                  }
              } else {
                const feedContainer = document.getElementById('activity-feed');
                if (feedContainer) {
                    feedContainer.innerHTML = '<div class="empty-state" style="font-size:14px;margin-top:24px">No recent activity yet. Your project updates will appear here automatically.</div>';
                 }
              }
        } else {
            console.warn('Activity load failed:', result.message || result.error);
              }

          } catch (err) {
            console.warn('Activity feed error:', err.message);
             // Graceful degradation - don't fail dashboard if activity API unavailable
           }
}

// Helper to get session token from available sources
function getSessionToken() {
    if (session_token) return session_token;
    try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'session') return value;
        }
    } catch(e) {}
    return null;
}

// Export for external use if needed
window.loadActivityFeed = loadActivityFeed;



/** Load activity history from backend API */
window.loadActivityHistory = async function(loadLimit = 20) {
    try {
            const response = await fetch(`/api/activity?token=${session_token}`, {
            method: 'GET',
            credentials: 'include'
          });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        const feedContainer = document.getElementById('activity-feed');
        
        if (result.success && Array.isArray(result.data)) {
              // Clear empty state and rebuild from data
            feedContainer.innerHTML = '';
            
            for (const activity of result.data) {
                addActivityItem(activity);  // false = don't auto-scroll on history items
              }

            console.log(`✓ Loaded ${result.data.length} activities to feed`);
            

// Stat cards with staggered animation - enhanced design patterns from Linear/Vercel/Supabase dashboards
function renderStats(data, isAdmin, stats, currentUserId) {
    const statsGrid = document.getElementById('stats-grid');
    let html = '';
    
    if (isAdmin) {
        html += '<div class="stat-card" style="--stagger:0.1s"><div class="label">Clients</div><div class="value" id="total-clients">0</div></div>';
        html += '<div class="stat-card" style="--stagger:0.15s"><div class="label">Active Projects</div><div class="value">'+stats.active_projects+'</div></div>';
      } else {
        html += '<div class="stat-card" style="--stagger:0.1s"><div class="label">Active Projects</div><div class="value">'+(data.stats?.active_projects||0)+'</div></div>';
        html += '<div class="stat-card" style="--stagger:0.15s"><div class="label">Monthly Revenue</div><div class="value">$'+(stats.monthly_total||0).toLocaleString()+'</div></div>';
      }

   statsGrid.innerHTML = html;
}

// Project cards with modern visual polish and smooth animations
function renderProjects(projects) {
    const projectGrid = document.getElementById('projects-grid');
    let projHtml = '';

    if (!projects || projects.length === 0) {
        projHtml = '<div class="empty-state" style="--stagger:0.2s"><p>No active projects yet.<a href="/">Book a project now!</a></p></div>';
      } else {
        let delayCounter = 0.1;
        for (const project of projects) {
            const typeClass = 'type-'+(project.type||'website').toLowerCase();
            const statusClass = 'status-'+((project.status||'active').toLowerCase().replace(' ','_'));
            let typeDisplay = project.type ? project.type.charAt(0).toUpperCase() + project.type.slice(1) : 'Website';
            let statusDisplay = (project.status==='active') ? 'Active' : 
                                (project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Completed');

            projHtml += '<div class="project-card" style="--stagger:'+(delayCounter+=0.05)+'s">';
            projHtml += '<span class="type-badge '+typeClass+'">'+typeDisplay+'</span>';
            projHtml += '<span class="status-badge '+statusClass+'">'+statusDisplay+'</span>';
            projHtml += '<h3>'+project.name+'</h3>';
            projHtml += '<div class="meta">';
            projHtml += '<div>Type: '+typeDisplay+'</div>';
            projHtml += '<div>Status: '+statusDisplay+'</div>';
            projHtml += '<div>Monthly Rate: $'+(project.monthly_rate||0).toLocaleString()+'</div>';
            projHtml += '<div>Started: '+new Date(project.created_at+Date.now()).toLocaleDateString()+'</div>';
            projHtml += '</div></div>';
           }
       }

    projectGrid.innerHTML = projHtml;
}

// Timeline with smooth scroll and visual polish - Supabase design language
function renderTimeline(updates) {
    const timeline = document.getElementById('timeline');
    let timelineItems = '';

    if (updates && updates.length > 0) {
        for (const update of updates.slice(0,15)) {
            if (!update.title && !update.description) continue;
            timelineItems += '<div class="timeline-item">';
            timelineItems += '<div class="timeline-dot"></div>';
            timelineItems += '<h4>'+update.title+' Project Update</h4>';
            timelineItems += '<p style="color:var(--text-secondary);margin-bottom:8px;">'+(update.description||'No description provided.')+'</p>';
            timelineItems += '<span class="date">'+new Date(update.created_at+Date.now()).toLocaleString()+'</span></div>';
           }
       } else {
        timelineItems = '<div class="empty-state" style="font-size:14px;margin-top:24px">No updates yet. Your project team will post milestones here.</div>';
      }

   timeline.innerHTML = timelineItems;
}

// Invoice summary calculation and list rendering with WCAG touch targets 44px minimum
function calculateInvoiceStats(invoices) {
    let totalBilled=0, totalPaid=0, outstanding=0;
    
    for (const inv of invoices) {
        const amt = inv.amount||0;
        totalBilled += amt;
        if (inv.status==='paid') totalPaid+=amt; else outstanding+=amt;
      }

   const invoiceStatsEl = document.getElementById('invoice-stats');
   if(invoiceStatsEl){
       invoiceStatsEl.innerHTML = '<span class="sub-label">Total Billed</span>' +
              '<span class="value">$'+totalBilled.toLocaleString()+'</span>' +
              '<div style="margin-top:12px"><span class="sub-label">Paid</span><span class="value paid">$'+(totalPaid||0).toLocaleString()+'</span></div>' +
              '<div style="margin-top:8px"><span class="sub-label">Outstanding</span><span class="value pending">$'+(outstanding||0).toLocaleString()+'</span></div>';
      }

       
   // Enhanced invoice list rendering with glassmorphism design patterns and WCAG touch targets 44px minimum
    window.loadInvoicesData = async function() {
        try {
            const response = await fetch('/api/invoices?action=list&credential=none');
            if (!response.ok) throw new Error('Failed to load invoices');
            const result = await response.json();
            
            if (result.success && result.data && Array.isArray(result.data)) {
                renderInvoiceCards(result.data);
              } else {
                document.getElementById('invoice-list').innerHTML = '<div class="empty-state">No invoices found.</div>';
              }
         } catch (e) {
            console.error('Invoice load error:', e);
            document.getElementById('invoice-list').innerHTML = 
                  '<div class="empty-state" style="color:var(--accent-red)">Failed to load invoices. Please try again.</div>';
          }
       };

    window.showInvoices = function() {
        return window.loadInvoicesData();
      };

    window.showInvoiceList = function() {
           // Scroll to invoice list section and load
        const invoiceSection = document.querySelector('.invoice-section');
        if (invoiceSection) {
            invoiceSection.scrollIntoView({ behavior: 'smooth' });
          }
        window.loadInvoicesData();
      };

     // Render invoices as interactive cards with status badges, amounts, due dates, and actions
    function renderInvoiceCards(invoices) {
        const listContainer = document.getElementById('invoice-list');
        
        if (!invoices || invoices.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">No invoices yet. Create your first invoice to get started.</div>';
            return;
          }

        let cardsHTML = '';
        for (const inv of invoices) {
            const statusClass = (inv.status||'draft').toLowerCase().replace(' ','_');
            const formattedAmount = '$'+(inv.amount||0).toLocaleString();
            const invoiceDate = inv.due_date ? new Date(inv.due_date + Date.now()).toLocaleDateString() : 'N/A';
            
            cardsHTML += '<div class="invoice-card" data-id="'+(inv.id||'')+'">';
            cardsHTML += '<div class="invoice-header">';
            cardsHTML += '<div class="invoice-number">#'+(inv.invoice_number||'N/A').toUpperCase()+'</div>';
            cardsHTML += '<span class="status-badge-'+(statusClass)+' status-badge">'+(inv.status||'draft').charAt(0).toUpperCase()+(inv.status||'draft').slice(1)+'</span>';
            cardsHTML += '</div>';
            cardsHTML += '<div class="invoice-amount">'+formattedAmount+'</div>';
            cardsHTML += '<div class="invoice-meta"><div>Due: '+invoiceDate+'</div>';
            
            if (inv.line_items && JSON.parse(inv.line_items||'[]').length > 0) {
                const items = JSON.parse(inv.line_items);
                cardsHTML += '<div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">line items: '+items.length+'</div>';
                   }
              
              // Action buttons with WCAG 44px minimum touch targets on mobile
            const btnClass = 'btn primary';
            const ariaLabel = 'View invoice '+ (inv.invoice_number || inv.id);
            cardsHTML += '<div class="invoice-actions-inline">';
            cardsHTML += '<button class="'+btnClass+'" style="min-height:44px;min-width:44px;" onclick="window.viewInvoice('+ (inv.id||0) +')" aria-label="'+ariaLabel+'">';
            cardsHTML += '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
            cardsHTML += ' View Details';
            cardsHTML += '</button><a class="btn secondary" href="/api/invoices?action=get&invoice_id='+ (inv.id||'') +'" download aria-label="Download PDF invoice '+ (inv.invoice_number || inv.id) +'">';
            cardsHTML += '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>';
            cardsHTML += ' PDF Export';
            cardsHTML += '</a></div>';
            cardsHTML += '</div>';
          }

        listContainer.innerHTML = cardsHTML;

          // Add staggered animation delay for sequential reveal pattern
        const cards = document.querySelectorAll('.invoice-card');
        for (let i = 0; i < cards.length; i++) {
            cards[i].style.setProperty('--stagger', (i * 0.05).toFixed(2)+'s');
          }

console.log('Rendered '+cards.length+' invoice cards');
       }

/** Client Activity Feed Widget - Task 20 Integration **/

// Initialize activity feed when dashboard loads
function initializeClientActivity() {
    const feedContainer = document.getElementById('activity-feed');
    
    if (!feedContainer) return;

     // Show loading state initially
    feedContainer.innerHTML = '<div class="activity-empty"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-5a2 2 0 012-2h7.5l2.5 1.5V19a2 2 0 01-2 2z" /></svg><div class="empty-title">Activity Feed</div><div class="empty-text">Recent project updates and milestones will appear here automatically.</div></div>';
    
     // Connect to activity feed if module exists
    if (typeof ActivityFeed !== 'undefined') {
        console.log('✓ Activating Client Activity Feed Widget (Task 20)');
        
         // Load any past activities from API
        loadActivityHistory(10).then(history => {
            console.log(`Loaded ${history.length} historical activities`);
         });

         // Subscribe to realtime WebSocket messages if available
        if (typeof window.addEventListener === 'function') {
            window.addEventListener('activity-update', function(e) {
                if (e.detail && e.detail.activity) {
                    ActivityFeed.addItem(e.detail.activity, true);
                 }
             }, false);
         }

         // Auto-refresh activity feed every 30 seconds for desktop users
        setInterval(() => {
            const statusIndicator = findStatusIndicators();
            if (statusIndicator && document.hidden === false) {
                // Only refresh when user is on this page and session active
                loadActivityHistory(5).catch(e => console.warn('Activity feed auto-refresh failed:', e));
             }
         }, 30000);   // 30 second interval

      } else {
        console.log('Activity Feed module not loaded yet');
     }
}

/** Load activity history from backend API */
window.loadActivityHistory = async function(loadLimit = 20) {
    try {
            const response = await fetch(`/api/activity?token=${session_token}`, {
            method: 'GET',
            credentials: 'include'
         });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        const feedContainer = document.getElementById('activity-feed');
        
        if (result.success && Array.isArray(result.data)) {
             // Clear empty state and rebuild from data
            feedContainer.innerHTML = '';
            
            for (const activity of result.data) {
                ActivityFeed.addItem(activity, false);  // false = don't auto-scroll on history items
             }

            console.log(`✓ Loaded ${result.data.length} activities to feed`);
            return result.data;
         } else {
            throw new Error(result.error || 'Unknown error loading activity');
         }

     } catch (error) {
        console.warn('Activity API load failed:', error.message);
        
         // Show friendly empty state instead of technical errors
        const feedContainer = document.getElementById('activity-feed');
        if (feedContainer) {
            feedContainer.innerHTML = '<div class="empty-state" style="color:var(--accent-amber)">Recent activity unavailable. Your dashboard will update automatically when new events occur.</div>';
         }

        return [];
     }
}

/** Helper to auto-initialize activity feed on page load
 * Waits for ActivityFeed module to be ready before activating */
window.addEventListener('load', function() {
    // Check if ActivityFeed module loaded successfully  
    if (typeof ActivityFeed !== 'undefined') {
         initializeClientActivity();
     } else {
        console.warn('ActivityFeed module was not loaded from activity-feed.js');
     }
}, false);

/** Sample data for demo purposes - can be used to test feed rendering */
function addSampleActivities(count = 3) {
    const feeds = document.getElementById('activity-feed');
    if (!feeds) return;

    const samples = [
        {type: 'project_update', title: 'Project Progress Update', description: 'Web development phase completed, moving to testing stage.', timestamp: new Date(Date.now() - 3600000).toISOString()},
        {type: 'message', title: 'Client Message', description: 'Thanks for the quick turnaround on this project!', timestamp: new Date(Date.now() - 7200000).toISOString()},
        {type: 'milestone', title: 'Deliverable Submitted', description: 'First prototype delivered, awaiting client review.', timestamp: new Date(Date.now() - 14400000).toISOString()}
    ];

    const itemsToCreate = samples.slice(0, count);
    
    for (const sample of itemsToCreate) {
        addActivityItem({
            type: sample.type,
            title: sample.title,
            description: sample.description,
            timestamp: sample.timestamp || new Date().toISOString()
         });
     }
}

function findStatusIndicators() {
    const indicators = document.querySelectorAll('.status-badge, .indicator-dot');
    return indicators.length > 0 ? true : false;
}

window.ActivityFeed = ActivityFeed;   // export for external use if needed

/** Simple activity item creation (fallback if module not available) */
function addActivityItem(itemObj, autoScroll) {
    const feeds = document.getElementById('activity-feed');
    if (!feeds) return;

     const emptyState = feeds.querySelector('.activity-empty, .empty-state');
    if (emptyState) {
        emptyState.remove();
     }

    // Fallback card rendering if ActivityFeed module not loaded yet
    const now = new Date(itemObj.timestamp || Date.now());
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const itemHTML = `<article class="activity-item status-${itemObj.type || 'info'} stagger-1" data-type="${itemObj.type}">` +
                     `<div class="activity-icon-container"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-5a2 2 0 012-2h7.5l2.5 1.5V19a2 2 0 01-2 2z" /></svg></div>` +
                     `<div class="activity-content">` +
                     `<h4 class="activity-title">${escapeHtml(itemObj.title || 'Update')}</h4>` +
                     `<p class="activity-description">${escapeHtml(itemObj.description || '')}</p>` +
                     `<time class="activity-timestamp" datetime="${now.toISOString()}">${formattedTime}</time>` +
                     `</div>`;

    feeds.insertAdjacentHTML('afterbegin', itemHTML);

     if (autoScroll && feeds) {
        feeds.scrollTop = 0;
     }

     // Limit to last 50 items
    const allItems = feeds.querySelectorAll('.activity-item:not(.activity-placeholder)');
    if (allItems.length > 50) {
        for (let i = 0; i < allItems.length - 50; i++) {
            allItems[i].remove();
         }
     }

     const liveRegion = document.getElementById('activity-live-region');
    if (liveRegion && itemObj.title) {
        liveRegion.textContent = `${itemObj.type} update: ${itemObj.title}`;
        setTimeout(() => { liveRegion.textContent = ''; }, 5000);
     }

    console.log(`Added activity: ${itemObj.type || 'update'}`, itemObj.title);
}

/** HTML escape for XSS prevention */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const safe = document.createElement('div');
    safe.textContent = str;
    return safe.innerHTML;
}

// Add global helper for testing/demo purposes
window.addActivityItem = addActivityItem;     // for inline onclick use from HTML

})();  // Close main IIFE
