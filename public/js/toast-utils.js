// Toast Utility - Enhanced Error Handling and Retry Logic (Task 9)

(function() {
    'use strict';

     // Toast Manager for centralized error display and notifications
    window.ToastUtils = { 
        containerId: 'toast-container',
        
          // Create toast container if not exists
        ensureContainer: function() {
            var container = document.getElementById(this.containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = this.containerId;
                container.className = 'toast-container';
                document.body.appendChild(container);
            }
            return container;
         },

          // Create toast notification with type, message, and auto-dismiss
        create: function(type, message) {
            var container = this.ensureContainer();
            var toast = document.createElement('div');
            
            toast.className = 'toast ' + (type || 'info');
            if (message) toast.textContent = message;
            
            // Add close button
            var closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.innerHTML = '×';
            closeBtn.setAttribute('aria-label', 'Close notification');
            closeBtn.addEventListener('click', function() { 
                if (toast.parentNode) toast.remove(); 
            });
            
            // Click anywhere on toast to dismiss (except button)
            toast.addEventListener('click', function(e) {
                if (e.target === toast || e.target.parentNode === container && !e.target.classList.contains('toast-close')) {
                    if (toast.parentNode) toast.remove();
                }
            });
            
             // Auto-dismiss after delay (default 4000ms)
            var dismissDelay = type === 'loading' ? Infinity : 4000;
            
            toast.appendChild(closeBtn);
            container.appendChild(toast);

              // Return object with methods for extended control
            return {
                element: toast,
                dismissDelay: dismissDelay,
                timeoutId: setTimeout(function() {
                    if (toast.parentNode) toast.remove();
                 }, dismissDelay),
                
                  // Manual dismiss
                dismiss: function() { 
                    clearTimeout(this.timeoutId); 
                    if (toast.parentNode) toast.remove(); 
                 },
                
                   // Dismiss and requeue for retry (if error type)
                retry: function(retryCount, maxRetries) {
                    this.dismiss();
                    if ((retryCount || 0) < (maxRetries || 3)) {
                        console.log('[ToastUtils] Retry ' + retryCount + '/' + (maxRetries||'N/A'));
                         // Trigger custom retry event that callers can listen to
                        document.dispatchEvent(
                             new CustomEvent('toast-retry', { detail: { message: message, type: type }}));
                     }
                 }
            };
         },

          // Convenience methods for common types
        success: function(msg) { return this.create('success', msg); },
        error: function(msg) { return this.create('error', msg); },
        info: function(msg) { return this.create('info', msg); },
        warning: function(msg) { var t = this.create('warning', msg); t.timeoutId = setTimeout(function() { if (t.element.parentNode) t.element.remove(); }, 6000); return t; },
        
          // Loading toast - doesn't auto-dismiss, returns manual dismiss handle
        loading: function(msg) { 
            var t = this.create('loading', msg || 'Loading...'); 
            return t; 
         }
    };

    console.log('[ToastUtils] Enhanced error handling ready');
})();
