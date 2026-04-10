// dashboard.js - Dashboard initialization and data fetching module
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  let impersonatedUserId = urlParams.get('impersonate');

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
      document.getElementById('skeleton-stats').style.display = 'grid';
      setTimeout(() => document.getElementById('skeleton-stats').style.display = 'none', 600);

      // Render stats cards with staggered animation delay
      const statsGrid = document.getElementById('stats-grid');
      let html = '';
      
      if (isAdmin) {
        html += '<div class="stat-card" style="animation-delay:0.1s"><div class="label">Clients</div><div class="value" id="total-clients">0</div></div>';
        html += '<div class="stat-card" style="animation-delay:0.15s"><div class="label">Active Projects</div><div class="value">'+data.stats.active_projects+'</div></div>';
      } else {
        html += '<div class="stat-card" style="animation-delay:0.1s"><div class="label">Active Projects</div><div class="value">'+(data.stats?.active_projects||0)+'</div></div>';
        html += '<div class="stat-card" style="animation-delay:0.15s"><div class="label">Monthly Revenue</div><div class="value">$'+(data.stats.monthly_total||0).toLocaleString()+'</div></div>';
      }

      statsGrid.innerHTML = html;

      // Get total client count for admin dashboard mode
      if (isAdmin) {
        fetch('/api/admin/clients', { credentials: 'include' })
          .then(r => r.json())
          .then(c => {
            if (c.clients && c.clients.length > 0) { 
              document.getElementById('total-clients').textContent = c.clients.length; 
            }
          });
      }

      // Render project cards - enhance with hover effects and animations
      const projectGrid = document.getElementById('projects-grid');
      let projHtml = '';
      
      if (!data.projects || data.projects.length === 0) {
        projHtml = '<div class="empty-state" style="animation-delay:0.2s"><p>No active projects yet.<a href="/">Book a project now!</a></p></div>';
      } else {
        let delayCounter = 0.1;
        for (const project of data.projects) {
          const typeClass = 'type-'+(project.type||'website').toLowerCase();
          const statusClass = 'status-'+(project.status||'active').toLowerCase().replace(' ','_');
          let typeDisplay = project.type ? project.type.charAt(0).toUpperCase() + project.type.slice(1) : 'Website';
          let statusDisplay = (project.status==='active') ? 'Active' : (project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Completed');

          projHtml += '<div class="project-card" style="animation-delay:'+(delayCounter+=0.05)+'s"><span class="type-badge '+typeClass+'">'+typeDisplay+'</span> <span class="status-badge '+statusClass+'">'+statusDisplay+'</span><h3>'+project.name+'</h3><div class="meta"><div>Type: '+typeDisplay+'</div><div>Status: '+statusDisplay+'</div><div>Monthly Rate: $'+(project.monthly_rate||0).toLocaleString()+'</div><div>Started: '+new Date(project.created_at||Date.now()).toLocaleDateString()+'</div></div></div>';
        }
      }

      projectGrid.innerHTML = projHtml;

      // Render milestone updates/timeline
      const timeline = document.getElementById('timeline');
      let timelineItems = '';

      if (data.updates && data.updates.length > 0) {
        for (const update of data.updates.slice(0,15)) {
          if (!update.title && !update.description) continue;
          timelineItems += '<div class="timeline-item"><div class="timeline-dot"></div>' +
             '<h4>'+(update.title||'Project Update')+'</h4> '+
            '<p style="color:var(--text-secondary);margin-bottom:8px;">'+(update.description||'No description provided.')+'</p>' +
            '<span class="date">'+new Date(update.created_at||Date.now()).toLocaleString()+'</span></div>';
        }
      } else {
        timelineItems = '<div class="empty-state" style="font-size:14px;margin-top:24px">No updates yet. Your project team will post milestones here.</div>';
      }

      timeline.innerHTML = timelineItems;

      // Invoice summary calculation from invoices API  
      let totalBilled=0, totalPaid=0, outstanding=0;
      for (const inv of data.invoices||[]) {
        const amt = inv.amount||0;
        totalBilled += amt;
        if (inv.status==='paid') totalPaid+=amt; else outstanding+=amt;
      }

      document.getElementById('invoice-stats').innerHTML = '<span class="sub-label">Total Billed</span>' +
        '<span class="value">$'+totalBilled.toLocaleString()+'</span>' +
        '<div style="margin-top:12px"><span class="sub-label">Paid</span><span class="value paid">$'+(totalPaid||0).toLocaleString()+'</span></div>' +
        '<div style="margin-top:8px"><span class="sub-label">Outstanding</span><span class="value pending">$'+(outstanding||0).toLocaleString()+'</span></div>';

      window.showInvoices = function(){ 
        let html = 'Invoice Panel:\n\nTotal Billed: $' + totalBilled.toLocaleString() + '\nPaid: $' + (totalPaid||0).toLocaleString() + '\nOutstanding: $' + (outstanding||0).toLocaleString();

        if (data.invoices && data.invoices.length > 0) { 
          html += '\n\nInvoices:';

          for (let i = 0; i < Math.min(data.invoices.length, 10); i++) {
            const inv = data.invoices[i];

            if (inv && inv.id !== undefined) {
              html += '\n#' + (i+1) + ' $' + (inv.amount||0).toLocaleString() + ' [' + (inv.status||'unknown').toUpperCase() + ']';
            }
          }
        } else { 
          html += '\nNo invoices yet.';
        }

        alert(html);
      };

    }).catch(err => { showAuthError(); });
  }).catch(err => { showAuthError(); });
})();
