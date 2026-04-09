/**
 * Moliam Error Handling System
 * Centralized error boundaries, logging, and recovery mechanisms
 */

(function() {'use strict';

/* Global error state tracking */
let errorQueue = [];
let errorHandler = null;
let maxErrorHistory = 50;

/* Initialize error monitor on startup */
function initErrorSystem() {
  // Capture window errors
  window.addEventListener('error', function(err) {
    handleBrowserError(err);
  }, true);

  // Capture promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    handlePromiseRejection(e);
  });

  // Track fetch errors globally
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    try {
      return originalFetch.apply(this, args)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response;
        })
        .catch(error => {
          handleServerError(args[0], error);
          throw error;
        });
    } catch (err) {
      handleBrowserError(err);
      throw err;
    }
  };

  // Initialize visual bell for errors
  initErrorBell();
  
  console.log('✓ Error handling system initialized');
}

/* Handle browser exceptions */
function handleBrowserError(err) {
  const errorInfo = {
    type: 'browser',
    message: err.message || String(err),
    filename: err.filename || location.href,
    lineno: err.lineno || 0,
    colno: err.colno || 0,
    timestamp: Date.now()
  };

  queueError(errorInfo);
  updateErrorBell(errorInfo);
}

/* Handle promise rejections */
function handlePromiseRejection(e) {
  if (e.reason && e.reason.message) {
    const errorInfo = {
      type: 'promise',
      message: e.reason.message,
      timestamp: Date.now()
    };
    queueError(errorInfo);
  }
}

/* Handle server errors from fetch */
function handleServerError(url, error) {
  const errorInfo = {
    type: 'server',
    url: url,
    message: error.message,
    timestamp: Date.now()
  };
  queueError(errorInfo);
  notifyDeveloper(errorInfo);
}

/* Queue error in history */
function queueError(errorInfo) {
  errorQueue.push(errorInfo);
  if (errorQueue.length > maxErrorHistory) {
    errorQueue.shift();
  }

  // Notify any registered error handlers
  if (errorHandler) {
    errorHandler({...errorInfo}, errorQueue.length);
  }
}

/* Error bell in UI */
function initErrorBell() {
  let bell = document.getElementById('moliam-error-bell');
  if (!bell) {
    bell = document.createElement('button');
    bell.id = 'moliam-error-bell';
    bell.setAttribute('aria-label', 'Error notifications');
    bell.setAttribute('title', 'Error notifications');
    bell.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:10000;padding:8px 12px;border-radius:6px;background:#EF4444;color:white;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(239,68,68,0.4);transition:all .2s;';
    document.body.appendChild(bell);

    bell.addEventListener('click', function() {
      showErrorHistory();
    });
  }

  window.moliamErrorBell = bell;
}

/* Update error bell with new errors */
function updateErrorBell(errorInfo) {
  if (!window.moliamErrorBell) return;

  const countSpan = window.moliamErrorBell.querySelector('.error-count');
  if (countSpan) {
    countSpan.textContent = '+1';
    window.moliamErrorBell.style.borderColor = '#EF4444';
    setTimeout(() => {
      window.moliamErrorBell.style.borderColor = '';
    }, 300);
  } else {
    const countIndicator = document.createElement('span');
    countIndicator.className = 'error-count';
    countIndicator.textContent = '+1';
    countIndicator.style.color = '#FFD4D4';
    window.moliamErrorBell.appendChild(countIndicator);
  }

  // Clear after 30 seconds if no new errors
  setTimeout(() => {
    clearErrorBell();
  }, 30000);
}

/* Clear error bell */
function clearErrorBell() {
  if (window.moliamErrorBell && window.moliamErrorBell.querySelector('.error-count')) {
    const count = window.moliamErrorBell.querySelector('.error-count');
    count.textContent = '0';
  }
}

/* Show history of errors to user */
function showErrorHistory() {
  if (errorQueue.length === 0) {
    alert('No recent errors. All systems nominal.');
    return;
  }

  let message = `Error History (${errorQueue.length})\n\n`;
  errorQueue.slice(-10).forEach((err, i) => {
    const min = new Date(err.timestamp).getMinutes();
    const sec = String(new Date(err.timestamp).getSeconds()).padStart(2,'0');
    message += `${i+1}. [${min}:${sec}] ${err.message}\n`;
  });

  alert(message);
}

/* Notify developer of critical errors */
function notifyDeveloper(errorInfo) {
  // Log to console for development
  if (location.hostname === 'localhost' || location.hostname.endsWith('.pages.dev')) {
    console.error('[MOLIAM ERROR]', errorInfo.message, errorInfo);
  }

  // Send to admin endpoint if configured
  const adminEndpoint = window.MOLIAM_ADMIN_ERROR_URL;
  if (adminEndpoint) {
    fetch(adminEndpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        timestamp: errorInfo.timestamp,
        type: errorInfo.type,
        message: errorInfo.message,
        location: window.location.href
      })
    }).catch(() => {});// Fail silently
  }
}

/* Register custom error handler */
function registerErrorHandler(handler) {
  if (typeof handler !== 'function') {
    throw new Error('handler must be a function');
  }
  errorHandler = handler;
}

/* Get current error queue status */
function getErrorStatus() {
  return {
    totalErrors: errorQueue.length,
    recentErrors: errorQueue.slice(-20),
    clear: function() {
      errorQueue = [];
      clearErrorBell();
    }
  };
}

/* Cleanup for SPA navigation or beforeunload */
function destroyErrorSystem() {
  const bell = window.moliamErrorBell;
  if (bell && bell.parentNode) {
    bell.parentNode.removeChild(bell);
  }
  errorHandler = null;
  
  // Restore original fetch
  if (window.fetch && window.fetch.__moliam_patched) {
    const originalFetch = window.fetch.__moliam_original;
    if (originalFetch) {
      window.fetch = originalFetch;
    }
  }

  console.log('✓ Error system cleaned up');
}

/* Expose API */
window.MoliamErrorMonitor = {
  registerErrorHandler,
  getErrorStatus,
  showAllErrors: showErrorHistory,
  destroy: destroyErrorSystem
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', initErrorSystem);

})();
