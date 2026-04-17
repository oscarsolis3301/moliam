// Admin Dashboard Script - Moliam Project
// Handles metrics dashboard data loading, aggregation, rendering, and export functionality
// Consumes /api/admin/metrics backend endpoint for aggregate client/project statistics

(function() {
  'use strict';
  
  // Session token extraction from cookie (same pattern as dashboard.js)
  let sessionToken = null;
  try {
    const match = document.cookie.match(/moliam_session=([^;]+)/);
    if (match) sessionToken = match[1];
  } catch (e) {}

  // Check if user is admin via /api/auth/me endpoint
  async function checkAuth() {
    return fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .catch(e => null);
  }

  // Fetch all metrics from backend dashboard endpoint with unified aggregated data
  async function fetchAdminMetrics() {
    if (!sessionToken) {
      console.warn('[ADMIN] No session token found - showing auth error');
      showAuthError();
      return null;
    }
    
    try {
      const response = await fetch('/api/admin/metrics', { 
        credentials: 'include' 
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('[ADMIN] Metrics fetch failed:', data.message || response.status);
        showAuthError();
        return null;
      }
      
      const data = await response.json();
      console.log('[ADMIN] Metrics loaded successfully:', data.requestId);
      return data.data;
    } catch (err) {
      console.error('[ADMIN] Connection error:', err.message);
      showErrorState('Network error. Please try again.');
      return null;
    }
  }

  // Render client statistics cards (total, active, inactive counts)
  function renderClientStats(stats) {
    const countEl = document.getElementById('total-clients-count');
    const activeEl = document.getElementById('mrr-display');
    const projectsEl = document.getElementById('active-projects-count');
    
    if (countEl) countEl.textContent = stats.clients?.totalClients || 0;
    if (activeEl) activeEl.textContent = stats.revenue?.formattedTotalMRR || '-';
    if (projectsEl) projectsEl.textContent = stats.projects?.totalProjects || 0;
  }

  // Render project type distribution bar chart using ChartViz module
  async function renderProjectTypeChart(projectStats) {
    if (!window.ChartViz || !projectStats || !projectStats.typeDistribution) return;
    
    const containerId = 'project-type-chart';
    const container = document.getElementById(containerId);
    if (!container || container.querySelector('.chart-wrapper')) return;
    
    const labels = projectStats.typeDistribution.map(t => t.type.toUpperCase());
    const values = projectStats.typeDistribution.map(t => t.count);
    const totalValues = projectStats.typeDistribution.map(t => t.totalValue);
    
    try {
      await ChartViz.createProjectDistribution(containerId, {
        labels: labels || ['WEBSITE', 'GBP', 'LSA', 'RETAINER'],
        statuses: [
          { label: 'Projects', values: values },
          { label: 'Total Value', values: totalValues }
        ],
        title: 'Project Distribution by Type'
      });
    } catch (e) {
      console.warn('[ADMIN] Project type chart init failed:', e);
    }
  }

  // Render lead funnel donut/pie chart using ChartViz module
  async function renderLeadFunnelChart(leadStats) {
    if (!window.ChartViz || !leadStats || !leadStats.categoryTotals) return;
    
    const container = document.getElementById('lead-funnel-chart');
    if (!container || container.querySelector('canvas')) return;
    
    try {
      await ChartViz.createLeadsFunnel('lead-funnel-chart', {
        categories: leadStats.categoryTotals,
        title: 'Lead Pipeline Distribution'
      });
      
       // Add newsletter subscriber count to footer
      const newsletterEl = document.getElementById('email-subscribers-count');
      if (newsletterEl) {
        newsletterEl.textContent = leadStats.newsletterSubscribers || 0;
      }
    } catch (e) {
      console.warn('[ADMIN] Lead funnel chart init failed:', e);
    }
  }

  // Render recent activities list with timeline items
  function renderActivityFeed(activities) {
    const tbody = document.getElementById('activity-tbody') || document.querySelector('#clients-table tbody');
    if (!tbody) return;
    
     // Create activities section if it doesn't exist (insert after stats section)
    let activitySection = document.getElementById('recent-activity-section');
    if (!activitySection) {
      const main = document.querySelector('main');
      activitySection = document.createElement('section');
      activitySection.className = 'section-card';
      activitySection.id = 'recent-activity-section';
      activitySection.setAttribute('aria-label', 'Recent client activities');
      
      activitySection.innerHTML = `<header class="section-header"><h2>Recent Activity Timeline</h2><span class="status-badge status-active">Live Updates</span></header><hr/><div class="table-wrapper" role="region" tabindex="0"><ul class="activity-timeline" id="activity-list"></ul></div>`;
      
      main.insertBefore(activitySection, main.querySelector('#clients-table')?.nextElementSibling);
    }
    
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;
    
     // Clear previous entries (if any duplicates exist)
    listEl.innerHTML = '';
    
    const recentActivities = activities.recentActivities || [];
    
    if (recentActivities.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No recent activity found.';
      li.className = 'loading-state-wrapper';
      listEl.appendChild(li);
      return;
    }
    
     // Build timeline entries with formatted timestamps and user info (glassmorphism styling)
    recentActivities.forEach((activity, idx) => {
      const timeLabel = activity.formatted_time || new Date().toLocaleTimeString();
      const li = document.createElement('li');
      li.className = 'timeline-item animate-entry';
      li.style.animationDelay = `${idx * 0.05}s`; // Staggered reveal animation
      
      li.innerHTML = `
        <div class="timeline-dot" aria-hidden="true"></div>
        <article class="activity-card glass">
          <header class="card-header">
            <h4>${(activity.action_type || 'Activity').toUpperCase()}</h4>
            <time datetime="${activity.created_at}">${timeLabel}</time>
          </header>
          <p class="user-info"><small>User: ${escapeHtml(activity.user_name || activity.user_email || 'Unknown')}</small></p>
          <p class="card-details">${escapeHtml(activity.details)}</p>
        </article>
      `;
      listEl.appendChild(li);
    });
    
     // Add total count badge showing last 24 hours or all-time statistics
    const totalEl = document.getElementById('total-activity-count');
    if (totalEl) {
      totalEl.textContent = activities.totalActivityCount || 'N/A';
    }
  }

   // Escape HTML to prevent XSS attacks (security best practice for admin dashboards)
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

   // Show authentication error state when no session token found or invalid
  function showAuthError() {
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:48px">
          <h2>Admin Access Required</h2>
          <p style="color:var(--text-secondary);margin-bottom:24px;">Please log in to the admin panel.</p>
          <a href="/login.html" class="btn btn-primary">Go to Login →</a>
        </div>
      `;
    }
  }

  // Show error overlay with retry capability
  function showErrorState(message) {
    const container = document.querySelector('.container');
    if (container && !container.querySelector('.error-overlay')) {
      const errDiv = document.createElement('div');
      errDiv.className = 'error-overlay';
      errDiv.innerHTML = `
        <div style="text-align:center;padding:48px;border-radius:20px;background:var(--glass-bg);border:1px solid var(--accent-red)">
          <h3 style="color:var(--accent-red)">Error</h3>
          <p>${escapeHtml(message)}</p>
          <button onclick="location.reload()" class="btn btn-primary" style="margin-top:16px;">Retry</button>
        </div>
      `;
      container.prepend(errDiv);
    }
  }

  // Export all metrics to CSV or JSON file (download trigger for reporting)
  async function exportMetrics(format = 'csv') {
    try {
      const response = await fetch(`/api/admin/metrics?format=${format}`, { 
        credentials: 'include' 
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('[EXPORT] Failed:', data.message || response.status);
        showErrorState('Export failed: ' + (data.message || response.statusText));
        return;
      }
      
      let filename = `moliam-metrics-export-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'json') filename += '.json';
      else filename += '.csv';
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
       // Show confirmation toast (accessibility improvement for export action)
      const toast = document.getElementById('success-toast-content');
      if (toast) toast.textContent = `${format.toUpperCase()} export complete: ${filename}`;
      
    } catch (err) {
      console.error('[EXPORT] Download failed:', err.message);
      showErrorState('Failed to download export: ' + err.message);
    }
  }

   // Refresh dashboard data on demand (user-triggered refresh action)
  async function refreshDashboard() {
    const loader = document.querySelector('.status-badge .spinner');
    if (loader) loader.style.display = 'inline-block';
    
    const data = await fetchAdminMetrics();
    
    if (data && loader) {
      loader.style.display = 'none';
      console.log('[ADMIN] Dashboard refreshed successfully at', new Date().toISOString());
    }
  }

  // Initialize dashboard on page load
  async function init() {
     // Get session token from cookie (same fallback pattern as dashboard.js line 10)
    try {
      const match = document.cookie.match(/moliam_session=([^;]+)/);
      if (match) sessionToken = match[1];
    } catch (e) {}

     if (!sessionToken || !document.getElementById('clients-tbody')) {
       showAuthError();
      return;
     }

     // Load all metrics data concurrently (client stats + project breakdown + lead funnel + activity feed)
    const data = await fetchAdminMetrics();
    if (!data) return;
    
     // Render client overview cards immediately for fast visual feedback (total, active projects, MRR)
    renderClientStats(data);

     // Render project type distribution bar chart (ChartViz integration) via async IIFE call chain
    await renderProjectTypeChart(data.projects);

     // Render lead funnel pipeline visualization (donut/donut chart from categoryTotals breakdown)
    await renderLeadFunnelChart(data.leads);

     // Build activity timeline with timestamps and user info for last 20 activities (glassmorphism styling)
    if (data.activity && data.activity.recentActivities) {
      renderActivityFeed(data.activity);
    } else {
       // Show empty state when no recent activities available (admin monitoring needs)
      console.warn('[ADMIN] No activity feed data returned from /api/admin/metrics response');
    }

     // Attach event listeners to Quick Action buttons (refresh, export actions wired with aria-label attributes)
    attachEventListeners();
    
    console.log('[ADMIN] Dashboard initialized successfully', data.requestId);
  }

   // Wire up button events for export/download and refresh functionality (accessibility improvements)
  function attachEventListeners() {
     // Export Data CSV button -> triggers exportMetrics('csv') with download via Blob API (Chrome/Firefox/Edge compatible)
    const exportBtn = document.querySelector('.action-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => exportMetrics('csv'), { once: true });
    }

     // Reset Metrics button -> shows confirmation modal before clear operation (error prevention for admin)
    const resetBtn = document.querySelector('.action-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const modal = document.getElementById('confirmation-modal');
        if (modal) modal.style.visibility = 'visible';
      });
    }

     // Refresh Dashboard button -> calls refreshDashboard() with spinner indicator and status badge updates
    const refreshBtn = document.querySelector('.action-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refreshDashboard());
    }

     // Confirmation modal Yes/Cancel handlers (accessibility improvements for WCAG compliance)
    const confirmYesBtn = document.getElementById('modal-yes-btn');
    const cancelBtn = document.getElementById('modal-confirm-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const modal = document.getElementById('confirmation-modal');
        if (modal) modal.style.visibility = 'hidden';
      });
    }
  }

   // Auto-init when DOM is ready (DOMContentLoaded for performance, defer script attribute also fires early)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
