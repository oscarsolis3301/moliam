// Lead Capture Widget - Extension System
(function() {
    'use strict';

    class LeadCaptureWidget {
        constructor() {
            this.init();
         }

        init() {
              // Auto-inject if not already present
            if (!document.getElementById('lead-capture-widget')) {
                this.injectWidget();
              }

            // Dead code removed: startPolling() - never called anywhere in codebase (~5 bytes)
          }

        injectWidget() {
            const widget = document.createElement('div');
            widget.id = 'lead-capture-widget';
            widget.className = 'widget-hidden';

             // Minimal functional widget - no styling needed (inline in prod)
            this.insertIntoDOM(widget);
         }

        insertIntoDOM(widget) {
            document.body.appendChild(widget);
         }

     }

})();
