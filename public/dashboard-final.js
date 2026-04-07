let currentInvoicesData = [];

function calculateInvoiceSummary(invoices) {
  // Calculate total billed, paid, outstanding from invoices array
  const summary = invoices.reduce((acc, inv) => {
    const amount = parseFloat(inv.amount) || 0;
    acc.total += amount;
    if (inv.status === 'paid') {
      acc.paid += amount;
    } else if (inv.status && inv.status !== 'paid' && inv.status !== null && inv.status !== 'draft') {
      acc.outstanding += amount;
    }
    return acc;
  }, { total: 0, paid: 0, outstanding: 0 });

  return summary;
}

let globalSummary = { total: 0, paid: 0, outstanding: 0 };

function calculateAndStoreSummary(invoices) {
  globalSummary = calculateInvoiceSummary(invoices);
  return globalSummary;
}

function openInvoicePanel(data) {
  if (data && data.invoices && data.invoices.length > 20) {
    globalSummary = calculateAndStoreSummary(data.invoices);
    const totalBilled = globalSummary.total || 0;
    
    // Find the latest invoice's due_date for display
    const lastInvoice = data.invoices[data.invoices.length - 1];
    const maxDate = lastInvoice.due_date ? new Date(lastInvoice.due_date).toLocaleDateString() : 'N/A';
    
    const panel = document.getElementById('invoicePanel');
    const body = document.body;
    
    // Build clean invoice HTML
    let invoicesHtml = '';
    for (let i = 0; i < data.invoices.length; i++) {
      const inv = data.invoices[i];
      const invDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A';
      const invStatusClass = (inv.status || '').toLowerCase();
      const invAmount = parseFloat(inv.amount) || 0;
      
      invoicesHtml += '<div class="invoice-card">\n';
      invoicesHtml += '    <div class="invoice-meta-line">\n';
      invoicesHtml += '        <span>' + (inv.period || inv.created_at) + '</span>\n';
      invoicesHtml += '        <span class="invoice-date">' + invDate + '</span>\n';
      invoicesHtml += '    </div>\n';
      invoicesHtml += '    <div class="invoice-period">Status: <span class="invoice-status-badge invoice-status-' + invStatusClass + '">' + (inv.status || 'Unknown').toUpperCase() + '</span></div>\n';
      invoicesHtml += '    <div style="margin-top:8px;display:flex;justify-content:space-between;">\n';
      invoicesHtml += '        <span>Amount:</span><span class="invoice-amount">$' + invAmount.toLocaleString() + '</span>\n';
      invoicesHtml += '    </div>\n';
      invoicesHtml += '</div>\n';
    }

    panel.innerHTML = '<div class="invoice-overlay" onclick="closeInvoicePanel()"></div><div class="invoice-container"><div class="invoice-header"><h3>💳 Billing History</h3><button class="invoice-close" onclick="closeInvoicePanel()">×</button></div>\n<div class="invoice-body">' + invoicesHtml + '</div>\n</div>';
    body.appendChild(panel);
    setTimeout(() => panel.classList.add('open'), 10);
  }

  if (globalSummary) {
    const panel = document.getElementById('invoicePanel');
    const bodyEl = document.querySelector('.invoice-body');
    if (bodyEl && data.invoices === undefined) {
      // Calculate summary for display
      const invs = currentInvoicesData || [];
      const totalBilled = invs.reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
      let paidAmount = 0;
      let outstandingAmount = 0;
      for (let i = 0; i < invs.length; i++) {
        const s = invs[i].status || '';
        const amt = parseFloat(invs[i].amount) || 0;
        if (s === 'paid') paidAmount += amt;
        else if (s !== '' && s !== null && s !== 'draft' && s !== 'pending') outstandingAmount += amt;
      }

      // Build summary HTML
      const summariesHTML = '<div class="summary-bar" style="background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(139,92,246,0.1));border-radius:14px;padding:18px;margin-bottom:16px;border:1px solid rgba(59,130,246,0.3);display:flex;gap:12px;align-items:center;">\n';
      summariesHTML += '  <div style="text-align:center;"><div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">Total Billed</div><div style="color:#6EE7B7;font-weight:700">$' + totalBilled.toLocaleString() + '</div></div>\n';
      summariesHTML += '  <div style="height:40px;width:2px;background:rgba(59,130,246,0.3);"></div>\n';
      summariesHTML += '  <div style="text-align:center;"><div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:8px;">Paid: $' + paidAmount.toLocaleString() + '</div><div style="color:#10B981;font-weight:700">Outstanding: $' + outstandingAmount.toLocaleString() + '</div></div>\n';
      summariesHTML += '</div>';

      bodyEl.innerHTML = summariesHTML;
    }
  }
}

function fetchInvoices() {
  return fetch('/api/invoices?limit=50', { credentials: 'include' })
    .then(r => r.json())
    .then(data => {
      if (data.success && data.invoices) {
        currentInvoicesData = data.invoices.filter(inv => ['paid', 'pending', 'overdue'].includes(inv.status));
        return currentInvoicesData;
      }
      return [];
    })
    .catch(e => {
      console.warn('Could not fetch invoices:', e);
      return [];
    });
}

function closeInvoicePanel() {
  const panel = document.getElementById('invoicePanel');
  if (panel) {
    panel.classList.remove('open');
    setTimeout(() => panel.remove(), 400);
  }
}

window.openInvoicePanel = openInvoicePanel;
window.closeInvoicePanel = closeInvoicePanel;
