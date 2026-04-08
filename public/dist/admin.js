// Admin Dashboard - MOLIAMA
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  
  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      return await response.json();
    } catch (e) { 
      console.error(e); 
      return null; 
    }
  }

  function showAuthError() {
    document.body.innerHTML = 
       '<div style="text-align:center;padding:48px"><h2>Access Denied</h2><a href="/login.html" class="btn">Go to Login →</a></div>';
  }

  async function fetchAdminClients() {
    try {
      const response = await fetch('/api/admin/clients', { 
        credentials: 'include' 
      });
      const data = await response.json();
      return data;
    } catch (e) { 
      console.error('Failed to fetch clients:', e); 
      return { success: false }; 
    }
  }

  async function render() {
    // Step 1: Check authentication and admin access
    const auth = await checkAuth();
    if (!auth || !auth.success || (auth.user?.role !== 'admin' && auth.user?.role !== 'superadmin')) {
      window.location.href = '/login.html';
      return;
    }

    // Step 2: Fetch all clients data
    let clientsData = await fetchAdminClients();
    if (!clientsData || !clientsData.success) {
      document.getElementById('clients-table-wrapper').innerHTML = 
         '<div class="empty-state">Error loading clients. Please try again.</div>';
      return;
    }

    const clients = clientsData.clients || [];
    renderStats(clients);
    renderClientsTable(clients);
  }

  function renderStats(clients) {
    const totalClients = clients.length;
    const activeProjects = clients.reduce((sum, c) => sum + (c.projects_count || 0), 0);
    const mrr = clients.reduce((sum, c) => sum + (parseFloat(c.monthly_revenue) || 0), 0);

    document.getElementById('total-clients').textContent = totalClients;
    document.getElementById('active-projects').textContent = activeProjects;
    document.getElementById('mrr').textContent = '$' + mrr.toLocaleString(undefined, {minimumFractionDigits: 0});
  }

  function renderClientsTable(clients) {
    const wrapper = document.getElementById('clients-table-wrapper');

    if (!clients.length) {
      wrapper.innerHTML = '<div class="empty-state">No clients found.</div>';
      return;
    }

    let html = '<table class="client-table"><thead><tr>' +
                 '<th style="width:35%">Client</th>' +
                 '<th style="width:15%">Status</th>' +
                 '<th style="width:15%">Projects</th>' +
                 '<th style="width:20%">Revenue</th>' +
                 '<th style="width:15%">Actions</th>' +
               '</tr></thead><tbody>';

    for (let c of clients) {
      const statusClass = c.is_active === true || c.is_active === 'true' ? 'active' : 'inactive';
      const projectsCount = c.projects_count || 0;
      const revenueMonthly = parseFloat(c.monthly_revenue) || 0;

      html += '<tr>' +
                 '<td><div class="client-name">' + (c.name || 'Unknown') + '</div>' +
                        '<div class="client-email">' + (c.email || 'No email') + '</div></td>' +
                 '<td><span class="status-badge ' + statusClass + '">' + 
                       (c.is_active === true || c.is_active === 'true' ? 'Active' : 'Inactive') + 
                       '</span></td>' +
                 '<td>' + projectsCount + ' project(s)</td>' +
                 '<td>$' + revenueMonthly.toLocaleString(undefined, {minimumFractionDigits: 0}) + '/mo</td>' +
                 '<td>';

      // View as Client button (redirects to dashboard with impersonation)
      const viewUrl = '/dashboard.html?impersonate=' + c.id;
      html += '<a href="' + viewUrl + '" class="view-btn">👁 View Dashboard</a>';

      html += '</td></tr>';
    }

    html += '</tbody></table>';
    wrapper.innerHTML = html;

    // Add search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase();
        const rows = wrapper.querySelectorAll('tbody tr');
        
        for (let row of rows) {
          const name = row.cells[0].textContent.toLowerCase();
          const email = row.cells[1]?.textContent?.toLowerCase() || '';
          
          if (name.includes(term) || email.includes(term)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        }
        
        if (!term.trim()) {
          for (let row of rows) row.style.display = '';
        }
      });
    }
  }

  // Initialize on load
  render();
});
