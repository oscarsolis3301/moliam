// Client Dashboard - MOLIAMA
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  let impersonatedUserId = urlParams.get('impersonate');

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      return await response.json();
    } catch (e) { console.error(e); return null; }
  }

  function showAuthError() {
    document.body.innerHTML = 
      '<div style="text-align:center;padding:48px"><h2>Login Required</h2><a href="/login.html" class="btn">Go to Login →</a></div>';
  }

  async function fetchDashboardData() {
    try {
      const response = await fetch('/api/dashboard', { credentials: 'include' });
      const data = await response.json();
      return data;
    } catch (e) { console.error('Failed to fetch dashboard:', e); return null; }
  }

  async function render() {
    // Step 1: Check authentication
    const auth = await checkAuth();
    if (!auth || !auth.success) {
      window.location.href = '/login.html';
      return;
    }

    // Step 2: Fetch dashboard data
    let data = await fetchDashboardData();
    if (!data || data.success !== true) {
      window.location.href = '/login.html';
      return;
    }

    const currentUserId = data.user?.id;
    const currentUserRole = data.user?.role;
    const isAdmin = (currentUserRole === 'admin' || currentUserRole === 'superadmin');

    // Step 3: Handle impersonation mode for admins
    if (impersonatedUserId && isAdmin) {
      try {
        const response = await fetch(`/api/admin/client/${impersonatedUserId}`, { credentials: 'include' });
        const clientData = await response.json();
        
        if (!clientData || !clientData.success) {
          console.error('Failed to fetch impersonated user');
          document.getElementById('impersonation-banner').style.display = 'none';
        } else {
          const name = clientData.client?.name || 'Unknown User';
          document.getElementById('impersonation-banner').style.display = 'block';
          document.getElementById('impersonated-name').textContent = `👁 Viewing as ${name}`;

          // Filter dashboard data to impersonated user
          const filteredClone = JSON.parse(JSON.stringify(data));
          if (filteredClone.projects) {
            filteredClone.projects = filteredClone.projects.filter(p => p.user_id == impersonatedUserId);
          }
          if (filteredClone.updates) {
            filteredClone.updates = filteredClone.updates.filter(u => u.user_id == impersonatedUserId);
          }
          data = filteredClone;
        }
      } catch (e) { console.error(e); }
    }

    // Show skeleton placeholder briefly for UX polish
    document.getElementById('skeleton-stats').style.display = 'grid';
    setTimeout(() => document.getElementById('skeleton-stats').style.display = 'none', 600);

    // Render all content
    renderDashboard(data, data.invoices || []);
  }

  function renderStats(stats, isAdmin) {
    const statsGrid = document.getElementById('stats-grid');
    let html = '';

    if (isAdmin) {
      html += '<div class="stat-card" style="animation-delay:0.1s"><div class="label">Clients</div><div class="value" id="total-clients">0</div></div>';
      html += `<div class="stat-card" style="animation-delay:0.15s"><div class="label">Active Projects</div><div class="value">${stats?.active_projects||0}</div></div>`;
    } else {
      html += `<div class="stat-card" style="animation-delay:0.1s"><div class="label">Active Projects</div><div class="value">${(stats?.active_projects||0)}</div></div>`;
      html += `<div class="stat-card" style="animation-delay:0.15s"><div class="label">Monthly Revenue</div><div class="value">$${(stats?.monthly_total||0).toLocaleString()}</div></div>`;
    }

    statsGrid.innerHTML = html;

    // For admin mode, fetch total client count
    if (isAdmin) {
      fetch('/api/admin/clients', { credentials: 'include' })
        .then(r => r.json())
        .then(c => {
          if (c.clients && c.clients.length > 0) {
            document.getElementById('total-clients').textContent = c.clients.length;
          }
        });
    }
  }

  function renderProjects(projects) {
    const projectGrid = document.getElementById('projects-grid');
    
    if (!projects || projects.length === 0) {
      projectGrid.innerHTML = '<div class="empty-state" style="animation-delay:0.2s"><p>No active projects yet.<a href="/">Book a project now!</a></p></div>';
      return;
    }

    let projHtml = '';
    let delayCounter = 0.1;

    for (const project of projects) {
      const typeClass = 'type-'+(project.type||'website').toLowerCase();
      const statusClass = 'status-'+(project.status||'active').toLowerCase().replace(' ','_');
      let typeDisplay = project.type ? project.type.charAt(0).toUpperCase() + project.type.slice(1) : 'Website';
      let statusDisplay = (project.status==='active') ? 'Active' : (project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Completed');

      projHtml += `<div class="project-card" style="animation-delay:${(delayCounter+=0.05)}s">` +
        `<span class="type-badge ${typeClass}">${typeDisplay}</span>` +
        ` <span class="status-badge ${statusClass}">${statusDisplay}</span>` +
        `<h3>${project.name}</h3>` +
        `<div class="meta">` +
          `<div>Type: ${typeDisplay}</div>` +
          `<div>Status: ${statusDisplay}</div>` +
          `<div>Monthly Rate: $${(project.monthly_rate||0).toLocaleString()}</div>` +
          `<div>Started: ${new Date(project.created_at||Date.now()).toLocaleDateString()}</div>` +
        `</div></div>`;
    }

    projectGrid.innerHTML = projHtml;
  }

  function renderTimeline(updates) {
    const timeline = document.getElementById('timeline');
    
    if (!updates || updates.length === 0) {
      timeline.innerHTML = '<div class="empty-state" style="font-size:14px;margin-top:24px">No updates yet. Your project team will post milestones here.</div>';
      return;
    }

    let timelineItems = '';
    
    for (const update of updates.slice(0,15)) {
      if (!update.title && !update.description) continue;
      
      timelineItems += '<div class="timeline-item"><div class="timeline-dot"></div>' +
        `<h4>${update.title||'Project Update'}</h4>` +
        `<p style="color:var(--text-secondary);margin-bottom:8px;">${update.description||'No description provided.'}</p>` +
        `<span class="date">${new Date(update.created_at||Date.now()).toLocaleString()}</span></div>`;
    }

    timeline.innerHTML = timelineItems;
  }

  function renderInvoices(invoices) {
    let totalBilled = 0, totalPaid = 0, outstanding = 0;
    
    for (const inv of invoices || []) {
      const amt = inv.amount||0;
      totalBilled += amt;
      if (inv.status==='paid') totalPaid+=amt; else outstanding+=amt;
    }

    document.getElementById('invoice-stats').innerHTML = 
      '<span class="sub-label">Total Billed</span>' +
      `<span class="value">$${totalBilled.toLocaleString()}</span>` +
      `<div style="margin-top:12px"><span class="sub-label">Paid</span><span class="value paid">$${(totalPaid||0).toLocaleString()}</span></div>` +
      `<div style="margin-top:8px"><span class="sub-label">Outstanding</span><span class="value pending">$${(outstanding||0).toLocaleString()}</span></div>`;

    window.showInvoices = function() { 
      let html = 'Invoice Panel:\n\nTotal Billed: $' + totalBilled.toLocaleString() + '\nPaid: $' + (totalPaid||0).toLocaleString() + '\nOutstanding: $' + (outstanding||0).toLocaleString();
      
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

  function renderDashboard(data, rawInvoices) {
    // Render stats cards (only shows for admin mode if needed)
    const stats = data.stats || {};
    const isAdmin = (data.user?.role === 'admin' || data.user?.role === 'superadmin');
    
    if (isAdmin) {
      renderStats(stats, isAdmin);
    }

    // Render project cards
    renderProjects(data.projects || []);

    // Render timeline/milestones  
    renderTimeline(data.updates || []);

    // Update invoice stats for impersonation view or normal view
    const invoicesForDisplay = rawInvoices || data.invoices || [];
    renderInvoices(invoicesForDisplay);
  }

  // Start: auth check → fetch data → render everything
  render();
});
