// Dashboard Client Script - Moliam Project
// Handles dashboard data loading and UI rendering + Chart.js visualizations

(async function() {
    'use strict';

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

     // Calculate invoice summary for stats display
    calculateInvoiceStats(data.invoices || []);

      // Initialize visualizations if data available
    await initializeCharts(data, isAdmin);

    }).catch(err => { 
         console.error('Dashboard init error:', err); 
         showAuthError(); 
    });

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

}
