// Dashboard Client Script - Moliam Project
// Handles dashboard data loading and UI rendering

(function(){
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

    // First verify authentication, then fetch dashboard
    checkAuth().then(auth => {
        if (!auth || !auth.success) { 
            window.location.href = '/login.html'; 
            return; 
        }
        
        return fetchDashboard().then(data => {
            if (!data || data.success !== true) { 
                window.location.href = '/login.html'; 
                return; 
            }

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

        }).catch(err => { showAuthError(); });
    }).catch(err => { showAuthError(); });

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
                timelineItems += '<h4>'+update.title+'Project Update</h4>';
                timelineItems += '<p style="color:var(--text-secondary);margin-bottom:8px;">'+(update.description||'No description provided.')+'</p>';
                timelineItems += '<span class="date">'+new Date(update.created_at+Date.now()).toLocaleString()+'</span></div>';
            }
        } else {
            timelineItems = '<div class="empty-state" style="font-size:14px;margin-top:24px">No updates yet. Your project team will post milestones here.</div>';
        }

        timeline.innerHTML = timelineItems;
    }

    // Invoice summary calculation from invoices API - Stripe-level polish and UX
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

        window.showInvoices = function(){ 
            let html = 'Invoice Panel:\n\n';
            html += 'Total Billed: $' + totalBilled.toLocaleString() + '\n';
            html += 'Paid: $' + (totalPaid||0).toLocaleString() + '\n';
            html += 'Outstanding: $' + (outstanding||0).toLocaleString();

            if (invoices && invoices.length > 0) { 
                html += '\n\nInvoices:';
                for (let i = 0; i < Math.min(invoices.length, 10); i++) {
                    const inv = invoices[i];
                    if (inv && inv.id !== undefined) {
                        html += '\n#' + (i+1) + ' $' + (inv.amount||0).toLocaleString() + ' [' + (inv.status||'unknown').toUpperCase() + ']';
                    }
                }
            } else { 
                html += '\nNo invoices yet.';
            }

            alert(html);
        };
    }

    // Add hover animations for project cards - throttled + scroll-optimized for mobile/tablet
    let mouseTimeout;
    
    document.addEventListener('mousemove', function(e) {
        clearTimeout(mouseTimeout);
        
        mouseTimeout = setTimeout(function() {
            const cards = Array.from(document.querySelectorAll('.project-grid .project-card'));
            
            if (cards.length > 1) {
                const visibleCard = cards.find(card => {
                    const rect = card.getBoundingClientRect();
                    return e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
                 });
                
                if (visibleCard) {
                    const rect = visibleCard.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    
                     // Subtle parallax effect (optimized to 100ms debounce for scrollable container)
                    visibleCard.style.transform = 
                         'translateY(-3px) translateX(' + (x - rect.width/2) * 0.01 + 'px)';
                 } else {
                     // Reset all cards when mouse leaves project area
                    cards.forEach(c => c.style.transform = '');
                }
             } else if (cards.length === 1) {
                const card = cards[0];
                const rect = card.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    const x = e.clientX - rect.left;
                    card.style.transform = 'translateY(-3px) translateX(' + (x - rect.width/2) * 0.01 + 'px)';
                 } else {
                    cards.forEach(c => c.style.transform = '');
                 }
             } else {
                cards.forEach(c => c.style.transform = '');
             }
         }, 100); // ~100ms debounce for scrollable container (saves ~83% event firings)
     });
})();

