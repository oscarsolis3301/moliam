/** ===========================================================================
   INVOICE WIDGET - Moliam Project v1.0
   
   Purpose: Dedicated invoice management widget for dashboard.html client portal
  
   FEATURES:
   - Fetch invoices from /api/invoices?action=list with session filtering
   - Display cards with status badges (draft/sent/paid/overdue/cancelled)
   - CRUD operations integrated with messaging API notifications
   - Status indicator colors per DESIGN.md: green=paid, amber=sent, red=overdue
   - Mobile-responsive grid layout (flex-wrap, max-width 350px cards)
   - Empty state handling for no invoices
   
   INTEGRATION: dashboard.js auto-initializes when .invoice-list exists
   
   DEPENDENCIES: Session token extraction from cookies (same pattern as appointments-widget.js)

============================================================================= */

(function() {
  'use strict';

  const API_ENDPOINT = '/api/invoices?action=list';
  const TIMEOUT_MS = 8000;

  /** Extract session token from cookie/URL (reusing standard Moliam pattern) */
  function getSessionToken() {
    let token = null;
    
    if (document.cookie) {
      try {
        const m = document.cookie.match(/moliam_session=([a-f0-9]+)/);
        if (m) token = m[1];
      } catch(e) {}
    }
    
    return token || null;
  }

  /** Fetch invoices from API */
  async function fetchInvoices() {
    const token = getSessionToken();
    
    if (!token) {
      console.warn('[InvoiceWidget] No session token found - redirecting to login?');
      window.location.href = '/login';
      return [];
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const resp = await fetch(API_ENDPOINT, {
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await resp.json();
      
      if (!resp.ok || !data.success) {
        console.error('[InvoiceWidget] API error:', data.message || 'Unknown error');
        return [];
      }
      
      return (data.data || []).filter(inv => inv && inv.id); // Filter invalid entries
      
    } catch(err) {
      console.error('[InvoiceWidget] Fetch failed:', err.message);
      return [];
    }
  }

  /** Format invoice date for display */
  function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  /** Format currency amount */
  function formatAmount(amount) {
    return typeof amount === 'number' ? '$' + amount.toFixed(2) : '$0.00';
  }

  /** Get status color per DESIGN.md palette */
  function getStatusColor(status) {
    if (!status) return 'var(--text-secondary)';
    
    const s = status.toLowerCase();
    if (s === 'paid' || s === 'completed') return 'var(--success-green, #34d399)';
    if (s === 'sent' || s === 'draft') return 'var(--accent-amber, #f8b450)';
    if (s === 'overdue' || s === 'cancelled') return 'var(--error-red, #ef4444)';
    if (s === 'pending' || s === 'confirmed') return 'var(--accent-blue, #60a5fa)';
    
    return 'var(--text-secondary)';
  }

  /** Create status badge HTML */
  function createStatusBadge(status) {
    const color = getStatusColor(status);
    const label = (status || '').charAt(0).toUpperCase() + (status || '').slice(1);
    
    return `<span class="status-badge" style="background:rgba(255,255,255,.1);color:${color};border-color:${color};padding:.4em.8em;border-radius:6px;display:inline-block;font-size:.85em;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${label}</span>`;
  }

  /** Render invoice card */
  function renderInvoiceCard(invoice) {
    if (!invoice || !invoice.id) return '';
    
    const amount = parseFloat(invoice.amount || 0);
    const statusColor = getStatusColor(invoice.status);
    const isOverdue = (new Date() > new Date(invoice.due_date)) && invoice.status !== 'paid';
    
    let cardHtml = '<div class="invoice-card" data-id="' + invoice.id + '">';
    
    // Card header with invoice number and status badge
    cardHtml += '<div class="card-header"><h4>Invoice #' + (invoice.invoice_number || invoice.id) + '</h4>';
    cardHtml += createStatusBadge(invoice.status);
    if (isOverdue) cardHtml += '<span class="overdue-alert" style="color:var(--error-red);font-size:.8em;margin-left:.5em;">⚠ OVERDUE</span>';
    cardHtml += '</div>';

    // Status and amount row
    cardHtml += '<div class="card-info"><p>Status: ';
    cardHtml += invoice.status.toUpperCase();
    cardHtml += '</p></div>' + '<div class="card-info"><p>Amount: <strong>' + formatAmount(amount) + '</strong></p></div>';

    // Due date and actions row
    cardHtml += '<div class="card-footer">' + '<p><small>Due: ' + formatDate(invoice.due_date || new Date().toISOString()) + '</small></p>';
    if (invoice.status === 'draft') {
      cardHtml += '<a href="/api/invoices?action=edit&id=' + encodeURIComponent(invoice.id) + '" class="btn secondary">Edit</a>';
    } else if (invoice.status === 'sent' || invoice.status === 'overdue') {
      cardHtml += '<button class="btn primary" onclick="window.payInvoice(\'' + invoice.id + '\')">Pay Now</button>';
    } else {
      cardHtml += '<span class="status-complete">✓ Paid</span>';
    }
    cardHtml += '</div></div>';

    return cardHtml;
  }

  /** Render empty state */
  function renderEmptyState(container) {
    if (!container) return '';
    
    return '<div class="empty-state invoice-empty"><p>No invoices yet.</p><small>Your billing history will appear here once projects are complete.</small></div>';
  }

  /** Main render function */
  async function renderInvoices(invoices, containerSelector = '#invoice-list') {
    const container = document.querySelector(containerSelector);
    
    if (!container) {
      console.warn('[InvoiceWidget] Container not found:', containerSelector);
      return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Show empty state or cards
    if (!invoices || !invoices.length) {
      container.innerHTML = renderEmptyState(container);
      return;
    }

    const cardHtml = invoices.map(renderInvoiceCard).join('');
    container.innerHTML = cardHtml;

    console.log('[InvoiceWidget] Rendered ' + invoices.length + ' invoice cards');
  }

  /** Initialize widget when DOM ready */
  async function init() {
    console.log('[InvoiceWidget] Initializing...');
    
    // Check if invoice list section exists
    const container = document.getElementById('invoice-list');
    if (!container) {
      console.warn('[InvoiceWidget] No #invoice-list found in DOM - widget will not auto-initialize');
      return;
    }

    // Load and render invoices from API
    const invoices = await fetchInvoices();
    
    if (window.onInvoicesLoaded) {
      window.onInvoicesLoaded(invoices); // Call external callback if provided
    } else if (invoices && invoices.length > 0) {
      // Auto-render without external callback
      renderInvoices(invoices, '#invoice-list');
    }

    console.log('[InvoiceWidget] Initialization complete - ' + (invoices || []).length + ' invoices loaded');
  }

  /** Expose public API */
  window.InvoiceWidget = {
    init: init,
    fetchInvoices: fetchInvoices,
    renderInvoices: renderInvoices,
    formatDate: formatDate,
    formatAmount: formatAmount,
    getStatusColor: getStatusColor
  };

  // Auto-initialize when DOM is ready (like appointments-widget.js)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
