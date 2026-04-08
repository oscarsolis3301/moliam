/* ============================================================================
   MOLIAM - Navigation Utilities (Small helper functions)
   =============================================================================

   Purpose: Handle navigation transitions that should be in external JS files.
            This is Task 1 from the mission board: extract inline JS to separate files.

   Contains:
   - Portfolio link click handler
   - Any future lightweight navigation utilities
   
   Note: Keep this file under 10KB for performance. If it grows, split into multiple files.
    ============================================================================ */

(function() {
  'use strict';

  const NAV_TARGET_ATTR = 'data-nav-target';
  const MOBILE_MENU_ID = 'mobile-menu';

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', function() {
     initNavigationLinkHandlers();
     setupMobileMenuKeyboardHandler();
   });

  /**
    * Handle external navigation from data attributes (replaces onclick handlers)
    * Replaces inline onClick="window.location.href='/portfolio.html'" with proper handler
    */
  function initNavigationLinkHandlers() {
    // Portfolio link - was using inline onclick, now uses data attribute
    const portfolioLinks = document.querySelectorAll('a[' + NAV_TARGET_ATTR + ']');

    for (let i = 0; i < portfolioLinks.length; i++) {
      const link = portfolioLinks[i];
      const targetUrl = link.getAttribute(NAV_TARGET_ATTR);

       if (targetUrl) {
         link.addEventListener('click', function(e) {
            e.preventDefault();
             // Open in new tab if it's a cross-domain or external portfoliowork
           window.open(targetUrl, '_blank');
            return true;
          });
        }
    }

    console.log('%cMOLIAM Navigation Utils Loaded', 'color: #7c3aed; font-size: 12px; font-weight: bold;');
  }

  /**
   * Keyboard handling for mobile menu close button
   */
  function setupMobileMenuKeyboardHandler() {
    const closeBtn = document.getElementById('mobile-menu-close');

    if (closeBtn) {
      closeBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
           closeBtn.click();
         }
       });
    }

    // Handle mobile menu transitions on Escape key at window level
     document.addEventListener('keydown', handleMobileMenuEscape);
  }

  /**
   * Global Escape key handler for closing mobile menu
   */
  function handleMobileMenuEscape(e) {
      if (e.key === 'Escape') {
        const modalMenu = document.getElementById(MOBILE_MENU_ID);

       if (modalMenu && window.innerWidth < 768) {
         // Check if menu is in open state by checking if it's no longer display:none
         var computedStyle = window.getComputedStyle(modalMenu);
          if (computedStyle.getPropertyValue('display') !== 'none' && modalMenu.classList.contains('open')) {
             modalMenu.classList.remove('open');
            document.querySelector('#hamburger-btn').setAttribute('aria-expanded', 'false');
            document.activeElement.blur();

           console.log('[MOLIAM] Mobile menu closed via Escape key');
         }
        }
     }
  }

})();
