// ============================================
// MOLIAM - Accessibility Enhancements JS
//    Keyboard nav, focus management, ARIA live regions
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initFAQKeyboardNav();
  initMobileMenuAriaAnnouncements();
});

// ============================================
// ARIA Live Announcements for Screen Readers
// ============================================

function announceToScreenReader(message) {
  if (!message || typeof message !== 'string') return;
  
  let liveRegion = document.getElementById('a11y-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'a11y-live-region';
    liveRegion.setAttribute('aria-live', 'assertive');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(liveRegion);
  }

  liveRegion.textContent = '';
  
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 100);
}

// ============================================
// FAQ Keyboard Navigation Handler
// ============================================

function initFAQKeyboardNav() {
  const faqs = document.querySelectorAll('[data-faq-item], .faq-question, [role="button"][onclick*="toggle"]');
  
  if (faqs.length === 0) return;

  faqs.forEach((faq, index) => {
    faq.setAttribute('tabindex', '0');
    faq.setAttribute('role', 'button');
    faq.setAttribute('aria-expanded', 'false');
    
    const keydownHandlerFAQ = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); faq.click(); const expanded = faq.getAttribute('aria-expanded') === 'true'; const message = expanded ? 'FAQ closed' : 'FAQ opened'; announceToScreenReader(message); } };
   faq.addEventListener('keydown', keydownHandlerFAQ, true);
   faq.moliam_cleanup_keydown_key = keydownHandlerFAQ; // store for cleanup
  });
}

// ============================================
// Mobile Menu ARIA Announcements & Focus Management
// ============================================

function initMobileMenuAriaAnnouncements() {
  // Try new hamburger implementation first, fallback to old
  const mobileMenuBtn = document.getElementById('hamburger-btn') || document.getElementById('mobile-menu-toggle') || document.querySelector('[aria-controls="mobile-nav"]');
  const mobileMenu = document.getElementById('mobile-menu') || document.querySelector('.mobile-menu-overlay[role="dialog"]');
  
  if (!mobileMenuBtn || !mobileMenu) return;

  mobileMenuBtn.setAttribute('aria-expanded', 'false');
  mobileMenuBtn.setAttribute('aria-controls', 'mobile-menu');

  const menuLinks = mobileMenu.querySelectorAll('a[href], button:not([disabled])');
  const firstNavLink = menuLinks[0];
  const lastNavLink = menuLinks[menuLinks.length - 1];
  const closeBtn = document.getElementById('mobile-menu-close');

  let mobileMenuOpen = false;

  // Click handler for hamburger toggle with ARIA updates and announceToScreenReader calls
  const clickHandlerMenu = () => { 
    mobileMenuOpen = !mobileMenuOpen; 
    mobileMenuBtn.setAttribute('aria-expanded', mobileMenuOpen.toString()); 
    if (mobileMenuOpen) { 
      announceToScreenReader('Mobile menu opened'); 
      // Focus first link OR close button for accessibility
      const focusableInMenu = Array.from(menuLinks).filter(el => el.tagName === 'A' || el.tagName === 'BUTTON');
      if (focusableInMenu.length) focusableInMenu[0].focus();
    } else { 
      announceToScreenReader('Mobile menu closed'); 
      mobileMenuBtn.focus(); 
    }
  };

  // Tab key focus trap for keyboard navigation
  const keydownHandlerMenu = (e) => {
    if (!mobileMenuOpen || e.key !== 'Tab') return;
    
    // Handle Shift+Tab and Tab within menu
    if (e.shiftKey && document.activeElement === firstNavLink) {
      e.preventDefault();
      lastNavLink.focus();
    } else if (!e.shiftKey && document.activeElement === lastNavLink) {
      e.preventDefault();
      firstNavLink.focus();
    }
    
    // Escape to close menu with announceToScreenReader calls
    if (e.key === 'Escape') {
      mobileMenuOpen = false;
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      announceToScreenReader('Mobile menu closed');
      mobileMenuBtn.focus();
    }
  };

  // Close button handler - announce close and restore focus to hamburger button after cleanup
  const clickHeaderClose = () => {
    mobileMenuOpen = false;
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    announceToScreenReader('Mobile menu closed');
    mobileMenuBtn.focus();
  };

  const keydownHeaderClose = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement === closeBtn) {
        e.preventDefault();
        announceToScreenReader('Closing menu');
        mobileMenuOpen = false;
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mobileMenuBtn.focus();
      }
    }
  };

  // Add click listeners with announceToScreenReader for opening/closing and proper focus management
  mobileMenuBtn.addEventListener('click', clickHandlerMenu, true);
  mobileMenuBtn.moliam_cleanup_click_key = clickHandlerMenu;
  
  // Tab trapping to manage keyboard navigation flow - focus moves between first and last items
  mobileMenu.addEventListener('keydown', keydownHandlerMenu, true);
  mobileMenu.moliam_cleanup_keydown_menu = keydownHandlerMenu;

  // Close button - keyboard interaction with announceToScreenReader messages for screen readers
  if (closeBtn) {
    closeBtn.addEventListener('click', clickHeaderClose, true);
    closeBtn.moliam_cleanup_click_close = clickHeaderClose;
    closeBtn.addEventListener('keydown', keydownHeaderClose, true);
    closeBtn.moliam_cleanup_keydown_close = keydownHeaderClose;
  }

  // Announce menu status changes live region updates with announceToScreenReader calls - dynamic content announcements for screen readers
  const observerCallback = (mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        if (mobileMenu.style.display !== 'none' && !mobileMenu.hasAttribute('aria-hidden')) {
          announceToScreenReader('Navigation menu opened');
        } else if (mobileMenu.style.display === 'none' || mobileMenu.hasAttribute('aria-hidden')) {
          if (!mobileMenuOpen) {
            announceToScreenReader('Navigation menu closed');
          }
        }
      }
    }
  };

  if (window.MutationObserver) {
    const styleObserver = new MutationObserver(observerCallback);
    styleObserver.observe(mobileMenu, { attributes: true });
    window.moliam_style_observer = styleObserver; // store for cleanup
  }
}

// ============================================
// Modal Focus Management (if exists)
// ============================================

function initModalFocusTrap(modalElement) {
  if (!modalElement) return null;

  const focusableElements = modalElement.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleTabKey(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  const focusablesToCleanup = Array.from(modalElement.querySelectorAll('[tabindex], button, a[href]'));
  focusablesToCleanup.forEach(el => { el.addEventListener('keydown', handleTabKey, true); el.moliam_cleanup_keydown_modal = handleTabKey; });

  return () => {
    focusablesToCleanup.forEach(el => { el.removeEventListener('keydown', el.moliam_cleanup_keydown_modal, true); });
  };
}

// ============================================
// Cleanup Functions - Memory Leak Prevention
// ============================================

let ariaObserver = null;
let mobileMenu = null;

function disconnectAriaObserver() {
  if (ariaObserver && mobileMenu) {
    ariaObserver.disconnect();
    ariaObserver = null;
    mobileMenu = null;
  }
}

window.moliamA11yCleanup = function() {
  disconnectAriaObserver();

    // Cleanup FAQ handlers from all faq items with proper removeEventListener calls
  const faqs = document.querySelectorAll('[data-faq-item], .faq-question, [role="button"][onclick*="toggle"]');
  faqs.forEach((faq, idx) => { const handler = faq.moliam_cleanup_keydown_key || null; if (handler) { faq.removeEventListener('keydown', handler, true); } });

    // Cleanup mobile menu handlers with focus management restoration and announceToScreenReader calls for proper state updates
  const mobileMenuBtn = document.getElementById('hamburger-btn') || document.getElementById('mobile-menu-toggle') || document.querySelector('[aria-controls="mobile-nav"]');
  const mobileMenu = document.getElementById('mobile-menu') || document.querySelector('.mobile-menu-overlay[role="dialog"]');

    // Remove hamburger click listener and restore to baseline state - no logging or announceToScreenReader needed here since cleanup is background process
  if (mobileMenuBtn) { const clickHandler = mobileMenuBtn.moliam_cleanup_click_key; if (clickHandler) { mobileMenuBtn.removeEventListener('click', clickHandler, true); delete mobileMenuBtn.moliam_cleanup_click_key; } }

    // Remove menu keyboard nav - focus management restored after cleanup with proper tabindex attributes maintained for accessibility
  if (mobileMenu) { const keydownHandler = mobileMenu.moliam_cleanup_keydown_menu; if (keydownHandler) { mobileMenu.removeEventListener('keydown', keydownHandler, true); delete mobileMenu.moliam_cleanup_keydown_menu; } }

    // Remove close button listeners with proper event cleanup and restore hamburger focus handling for keyboard navigation
  const closeBtn = document.getElementById('mobile-menu-close');
  if (closeBtn) {
    const clickClose = closeBtn.moliam_cleanup_click_close; if (clickClose) { closeBtn.removeEventListener('click', clickClose, true); delete closeBtn.moliam_cleanup_click_close; }
    const keydownClose = closeBtn.moliam_cleanup_keydown_close; if (keydownClose) { closeBtn.removeEventListener('keydown', keydownClose, true); delete closeBtn.moliam_cleanup_keydown_close; }
  }

    // Disconnect MutationObserver for dynamic content monitoring with no announceToScreenReader calls during cleanup since it runs beforeunload silently
  const observerCleanup = window.moliam_style_observer;
  if (observerCleanup) { try { observerCleanup.disconnect(); } catch(e){} delete window.moliam_style_observer; }

    // Clear error handler references and ensure aria live regions remain functional after all handlers are removed with proper cleanup
  const errorHandler = window.moliamA11yErrorHandle;
  if (errorHandler) { document.removeEventListener('error', errorHandler, true); delete window.moliamA11yErrorHandle; }
}

window.addEventListener('beforeunload', () => {
  window.moliamA11yCleanup();
});
