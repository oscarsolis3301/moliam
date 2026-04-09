/**
 * Moliam Optimization Core
 * Centralized resource management, interval cleanup, event lifecycle
 */

(function() {'use strict';

/* Global resource tracker */
const ResourceMonitor = {
  intervals: [],
  timeouts: [],
  listeners: [[]],
  observer: null,

  addInterval(id, handler, ms) {
    const intervalId = setInterval(handler, ms);
    this.intervals.push({id, intervalId});
    return intervalId;
   },

  addTimeout(id, handler, delay) {
    const timeoutId = setTimeout(() => { handler(); }, delay);
    this.timeouts.push({id, timeoutId});
    return timeoutId;
   },

  addEventListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
     // Store cleanup reference on element
    if (target instanceof Element || target === window || target === document) {
      const key = `__moliam_listener_${event}_${handler.name || Math.random().toString(36).slice(2)}`;
      target[key] = {removeEventListenerFn: handler};

      // Auto-register cleanup function with ResourceMonitor
      this.listeners[0].push(function() {
        if (target.removeEventListener) {
          target.removeEventListener(event, handler, options);
        }
       });
     }
   },

  clearAllIntervals() {
    this.intervals.forEach(item => {
      try { clearInterval(item.intervalId); } catch(e){}
    });
    this.intervals = [];

   },

  cancelAllTimeouts() {
    this.timeouts.forEach(item => {
      try { clearTimeout(item.timeoutId); } catch(e){}
    });
    this.timeouts = [];

   },

  cleanupAllListeners() {
    this.listeners.flat().forEach(cleaner => {
      if (typeof cleaner === 'function') {
        try { cleaner(); } catch(e){}
       }
     });

   },

  destroy() {
    this.clearAllIntervals();
    this.cancelAllTimeouts();
    this.cleanupAllListeners();
    if (this.observer && typeof this.observer.disconnect === 'function') {
      this.observer.disconnect();
     }
   }
};

/* Global cleanup registration */
window.moliamResourceCleanup = function() {

  ResourceMonitor.destroy();
  
   // Notify all registered cleanup callbacks  
  if (window.moliamMainCleanup) window.moliamMainCleanup();

  if (window.moliamA11yCleanup) window.moliamA11yCleanup();

  if (window.MoliamErrorMonitor && typeof window.MoliamErrorMonitor.destroy === 'function') {
    window.MoliamErrorMonitor.destroy();
  }


};

/* Register cleanup for beforeunload */
window.addEventListener('beforeunload', () => {
  if (window.moliamResourceCleanup) {
    resourceMon = false; // prevent double cleanup during unload
  }
}, true);

let resourceMon = true;

/* Initialize global error boundaries */
if (window.MoliamErrorMonitor && typeof window.MoliamErrorMonitor.registerErrorHandler === 'function') {
  const errorHandler = function(error, queueLength) {
    if (!resourceMon && !error.message.includes('beforeunload')) return;
    
     // Only show bell for real errors, not cleanup
    if (['fetch-error', 'server-error'].includes(error.type)) {
      // Handle quietly during cleanup
     } else {
       // Show error in console only during dev
      if (window.location.hostname === 'localhost' || window.MOLIAM_DEV_MODE) {
        console.error('[Moliam Error]', error.message);
       }
     }
   };
  window.MoliamErrorMonitor.registerErrorHandler(errorHandler);
}



})();
