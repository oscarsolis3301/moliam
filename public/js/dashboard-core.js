// dashboard-core.js - Dashboard fetch/render logic with error handling
(function() {
    'use strict';

    // Check if user is authenticated by hitting auth/me endpoint with credentials: include (cookie-based)
    function checkAuth() {
        return fetch('/api/auth/me', { credentials: 'include' })
             .then(r => r.json())
             .catch(e => null);
    }

    function fetchDashboard() {
        return fetch('/api/dashboard', { credentials: 'include' })
            .then(r => r.json())
            .catch(e => null);
    }

    function showAuthError() {
        document.body.innerHTML = '<div style="text-align:center;padding:48px"><h2>Login Required</h2><a href="/login.html" class="btn">Go to Login →</a></div>';
    }

    // Render project cards - enhance with hover effects and staggered animations
    function renderProjects(data, delayCounter) {
        const projectGrid = document.getElementById('projects-grid');
        let projHtml = '';

        if (!data.projects || data.projects.length === 0) {
            projHtml = '<div class="empty-state" style="animation-delay:0.2s"><p>No active projects yet.<a href="/">Book a project now!</a></p></div>';
        } else {
            delayCounter = 0.1;
            for (const project of data.projects) {
                const typeClass = 'type-' + (project.type || 'website').toLowerCase();
                const statusClass = 'status-' + (project.status || 'active').toLowerCase().replace(' ', '_');
                let typeDisplay = project.type ? project.type.charAt(0).toUpperCase() + project.type.slice(1) : 'Website';
                let statusDisplay = (project.status === 'active') ? 'Active' : (project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Completed');

                projHtml += '<div class="project-card" style="animation-delay:' + (delayCounter += 0.05) + 's">' +
                    '<span class="type-badge ' + typeClass + '">' + typeDisplay + '</span> ' +
                    '<span class="status-badge ' + statusClass + '">' + statusDisplay + '</span>' +
                    '<h3>' + project.name + '</h3>' +
                    '<div class="meta"><div>Type: ' + typeDisplay + '</div><div>Status: ' + statusDisplay + '</div><div>Monthly Rate: $' + (project.monthly_rate || 0) + '</div><div>Started: ' + new Date(Date.now()).toLocaleDateString() + '</div></div></div>';
            }
        }

        projectGrid.innerHTML = projHtml;
    }

    // Render milestone updates/timeline with staggered animation
    function renderTimeline(data) {
        const timeline = document.getElementById('timeline');
        let timelineItems = '';

        if (data.updates && data.updates.length > 0) {
            for (const update of data.updates.slice(0, 15)) {
                if (!update.title && !update.description) continue;
                timelineItems += '<div class="timeline-item">' +
                    '<div class="timeline-dot"></div>' +
                    '<h4>' + (update.title || 'Project Update') + '</h4> ' +
                    '<p style="color:var(--text-secondary);margin-bottom:8px;">' + (update.description || 'No description provided.') + '</p>' +
                    '<span class="date">' + new Date(update.created_at || Date.now()).toLocaleString() + '</span></div>';
            }
        } else {
            timelineItems = '<div class="empty-state" style="font-size:14px;margin-top:24px">No updates yet. Your project team will post milestones here.</div>';
        }

        timeline.innerHTML = timelineItems;
    }

    // Invoice summary calculation from invoices API with error handling
    function renderInvoiceSummary(data) {
        let totalBilled = 0, totalPaid = 0, outstanding = 0;
        
        for (let i = 0; i < data.invoices.length; i++) {
            const inv = data.invoices[i];
            const amt = inv.amount || 0;
            totalBilled += amt;
            if (inv.status === 'paid') totalPaid += amt; else outstanding += amt;
        }

        document.getElementById('invoice-stats').innerHTML = 
            '<span class="sub-label">Total Billed</span>' +
            '<span class="value">$' + formatNumber(totalBilled) + '</span>' +
            '<div style="margin-top:12px"><span class="sub-label">Paid</span><span class="value paid">$' + formatNumber(totalPaid) + '</span></div>' +
            '<div style="margin-top:8px"><span class="sub-label">Outstanding</span><span class="value pending">$' + formatNumber(outstanding) + '</span></div>';

        // Attach showInvoices function for onclick handlers
        window.showInvoices = function() { 
            let html = 'Invoice Panel:\n\nTotal Billed: $' + formatNumber(totalBilled) + '\nPaid: $' + formatNumber(totalPaid) + '\nOutstanding: $' + formatNumber(outstanding);

            if (data.invoices && data.invoices.length > 0) { 
                html += '\n\nInvoices:';
                for (let i = 0; i < Math.min(data.invoices.length, 10); i++) {
                    const inv = data.invoices[i];
                    if (inv && inv.id !== undefined) {
                        html += '\n#' + (i+1) + ' $' + formatNumber(inv.amount || 0) + ' [' + (inv.status || 'unknown').toUpperCase() + ']';
                    }
                }
            } else { 
                html += '\nNo invoices yet.';
            }

            alert(html);
        };
    }

    // Utility: format numbers for display
    function formatNumber(num, locale = 'en-US', currency = 'USD') {
        return (num || 0).toLocaleString(locale, { style: 'currency', currency: currency, currencyDisplay: 'narrow-symbol' });
    }

    // Initialize dashboard with staged loading animations
    function init() {
        // Show initial skeleton, then fade out when data ready
        document.getElementById('skeleton-stats').style.display = 'grid';
        setTimeout(() => document.getElementById('skeleton-stats').style.display = 'none', 600);

        // Render stats cards with staggered animation delay (0.1s, 0.15s)
        const statsGrid = document.getElementById('stats-grid');
        let html = '';

        const urlParams = new URLSearchParams(window.location.search);
        let impersonatedUserId = urlParams.get('impersonate');
        
        // Get total client count for admin dashboard mode
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => r.json())
            .then(auth => {
                if (!auth || !auth.user) return;
                
                const currentUserRole = auth.user?.role;
                const isAdmin = (currentUserRole === 'admin' || currentUserRole === 'superadmin');

                if (isAdmin) {
                    html += '<div class="stat-card" style="animation-delay:0.1s"><div class="label">Clients</div><div class="value" id="total-clients"></div></div>';
                    html += '<div class="stat-card" style="animation-delay:0.15s"><div class="label">Active Projects</div><div class="value">Loading...</div></div>';
                } else {
                    html += '<div class="stat-card" style="animation-delay:0.1s"><div class="label">Active Projects</div><div class="value">0</div></div>';
                    html += '<div class="stat-card" style="animation-delay:0.15s"><div class="label">Monthly Revenue</div><div class="value">$Loading...</div></div>';
                }

                statsGrid.innerHTML = html;

                if (isAdmin) {
                    fetch('/api/admin/clients', { credentials: 'include' })
                        .then(r => r.json())
                        .then(c => {
                            if (c.clients && c.clients.length > 0) { 
                                document.getElementById('total-clients').textContent = c.clients.length;
                            }
                        })
                        .catch(err => console.warn('Failed to fetch clients count:', err.message));
                }

                return fetchDashboard().then(data => {
                    // Show impersonation banner for admin viewing another client (preserve legacy logic)
                    document.getElementById('impersonated-name').textContent = '👁 Viewing as ' + (data.user?.name || 'Unknown User');

                    renderProjects(data, 0.1);
                    renderTimeline(data);
                    renderInvoiceSummary(data);
                });
            })
            .catch(err => {
                showAuthError();
                console.error('Dashboard initialization failed:', err.message);
            });
    }

    // Start dashboard after DOM loads
    if (document.readyState !== 'loading') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

})();
