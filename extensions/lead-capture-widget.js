// Lead Capture Widget - Extension System
(function() {
    'use strict';

    class LeadCaptureWidget {
        constructor() {
            this.init();
        }

        init() {
            console.log('[LeadCapture] Widget initialized');

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
            console.log('[LeadCapture] Widget inserted into DOM');
        }

        startPolling() {
            // Simple polling for lead capture events
            let tick = 0;
            const interval = setInterval(() => {
                tick++;

                if (tick % 60 === 0) {
                    console.log(`[LeadCapture] Pulse: ${tick}`);
                }

                this.checkForNewLeads();
            }, 1000);

            // Auto-cleanup every 15 minutes
            setTimeout(() => {
                clearInterval(interval);
                console.log('[LeadCapture] Widget auto-shutdown after 15min');
            }, 15 * 60 * 1000);
        }

        checkForNewLeads() {
            // Placeholder for future lead detection logic
            return null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new LeadCaptureWidget());
    } else {
        new LeadCaptureWidget();
    }
})();