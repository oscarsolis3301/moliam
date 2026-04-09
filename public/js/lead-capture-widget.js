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

             // Initialize any widget features
            this.startPolling();
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

        checkForNewLeads() {
            return null;
        }
    }

})();
