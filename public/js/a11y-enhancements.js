// Accessibility Enhancements - Core ARIA and Keyboard Navigation
(function() {
    'use strict';

    class AccessibilityEnhancements {
        constructor() {
            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupAccessibility());
            } else {
                this.setupAccessibility();
            }
        }

        setupAccessibility() {
            // Add ARIA live region for dynamic content updates
             const liveRegion = document.createElement('div');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            liveRegion.id = 'a11y-live-region';
            document.body.appendChild(liveRegion);

             // Keyboard navigation for skip links
            this.setupSkipLinks();

             // Focus trap for modals/pickers
            this.setupFocusTrap();

             // Reduce motion preference
            this.setupReduceMotion();
        }

        setupSkipLinks() {
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Skip to main content';
            skipLink.tabIndex = 0;
            document.body.insertBefore(skipLink, document.body.firstChild);

             const skipContent = document.createElement('a');
             skipContent.href = '#hud';
             skipContent.className = 'skip-link';
             skipContent.textContent = 'Skip to sidebar';
             skipContent.tabIndex = 0;
            document.body.appendChild(skipContent);
        }

        setupFocusTrap() {
            this.focusTrap = (container) => {
                 const focusable = container.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

 );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                container.addEventListener('keydown', (e) => {
                    if (e.key !== 'Tab') return;
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                   } else if (!e.shiftKey && document.activeElement === last) {
                       e.preventDefault();
                       first.focus();
                    }
                });
           };
       }

        setupReduceMotion() {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (prefersReduced.matches) {
                document.documentElement.classList.add('reduce-motion');
             }
            prefersReduced.addEventListener('change', (e) => {
                if (e.matches) {
                    document.documentElement.classList.add('reduce-motion');
                 } else {
                    document.documentElement.classList.remove('reduce-motion');
                 }
            });
       }

        announce(message) {
           const liveRegion = document.getElementById('a11y-live-region');
           if (liveRegion) {
               liveRegion.textContent = message;
             }
         }

        getLiveRegion() {
            return document.getElementById('a11y-live-region');
          }
     }

    const MoliamA11y = new AccessibilityEnhancements();
    window.a11y = MoliamA11y;
})();
