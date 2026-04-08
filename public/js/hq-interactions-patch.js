/* ─── MEMORY LEAK FIXES & CLEANUP ───────────────────── */

// Fix 1: Track uptime interval and clear it on navigation/unload
let uptimeIntervalId = null;
if (window.__moliamUptimeInterval__) {
  clearInterval(uptimeIntervalId || window.__moliamUptimeInterval__);
}
const originalSetInterval = window.setInterval;
window.setInterval = function(fn, delay) {
  if (delay === 1000 && typeof fn === 'function' && fn.toString().includes('updateUptime')) {
    uptimeIntervalId = originalSetInterval.call(window, fn, delay);
    return uptimeIntervalId;
  }
  return originalSetInterval.apply(this, arguments);
};

// Fix 2: Store cleanup registry on window
window.__moliamCleanup__ = window.__moliamCleanup__ || [];

// Add to registry function
window.registerMoliamCleanup = function(fn) {
  window.__moliamCleanup__.push(fn);
};

// Fix 3: Clean up intervals and event listeners before page unloads
window.registerMoliamCleanup(function() {
  if (uptimeIntervalId) {
    clearInterval(uptimeIntervalId);
    uptimeIntervalId = null;
  }
  
  // Clear other moliam intervals
  if (window.__moliamSparkInterval__) {
    try { clearInterval(window.__moliamSparkInterval__()); } catch(e){}
  }
  if (window.__moliamStatusPanelInterval__) {
    try { clearInterval(window.__moliamStatusPanelInterval__()); } catch(e){}
  }
  
  // Remove canvas event listeners  
  const canvas = document.getElementById('hq-canvas');
  if (canvas) {
    const handlersToRemove = [canvas._onMouseMoveHandler, canvas._onDeleteHandler];
    if (handlersToRemove.length > 0) {
      window.__moliamCleanup__.forEach(function(fn) {
        try { fn(); } catch(e){}
      });
    }
  }
});

// Register cleanup on page unload for PWA compatibility
window.addEventListener('beforeunload', function() {
  window.__moliamCleanup__.forEach(function(fn) {
    try { fn(); } catch(e){}
  });
});
