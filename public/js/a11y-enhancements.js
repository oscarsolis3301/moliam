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
    
    faq.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        faq.click();
        const expanded = faq.getAttribute('aria-expanded') === 'true';
        const message = expanded ? 'FAQ closed' : 'FAQ opened';
        announceToScreenReader(message);
      }
    }, true);
  });
}

// ============================================
// Mobile Menu ARIA Announcements & Focus Management
// ============================================

function initMobileMenuAriaAnnouncements() {
  const mobileMenuBtn = document.getElementById('mobile-menu-toggle') || document.querySelector('[aria-controls="mobile-nav"]');
  const navMenu = document.getElementById('mobile-nav') || document.querySelector('.mobile-nav, header nav ul:first-child');
  
  if (!mobileMenuBtn || !navMenu) return;

  mobileMenuBtn.setAttribute('aria-expanded', 'false');
  mobileMenuBtn.setAttribute('aria-controls', 'mobile-nav');

  const firstNavLink = navMenu.querySelector('a[href]');
  const lastNavAnchor = navMenu.querySelectorAll('a[href]').item(navMenu.querySelectorAll('a[href]').length - 1);

  let mobileMenuOpen = false;

  mobileMenuBtn.addEventListener('click', () => {
    mobileMenuOpen = !mobileMenuOpen;
    mobileMenuBtn.setAttribute('aria-expanded', mobileMenuOpen.toString());
    
    if (mobileMenuOpen) {
      announceToScreenReader('Mobile menu opened');
      
      if (firstNavLink) {
        firstNavLink.focus();
      }
    } else {
      announceToScreenReader('Mobile menu closed');
      mobileMenuBtn.focus();
    }
  }, true);

  navMenu.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstNavLink) {
        e.preventDefault();
        mobileMenuBtn.focus();
      } else if (!e.shiftKey && document.activeElement === lastNavAnchor) {
        e.preventDefault();
        mobileMenuBtn.focus();
      }
    }

    if (e.key === 'Escape') {
      mobileMenuOpen = false;
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      announceToScreenReader('Mobile menu closed');
      mobileMenuBtn.focus();
      }
    }, true);
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

  modalElement.querySelectorAll('[tabindex], button, a[href]').forEach(el => {
    el.addEventListener('keydown', handleTabKey, true);
  });

  return () => {
    modalElement.querySelectorAll('[tabindex], button, a[href]').forEach(el => {
      el.removeEventListener('keydown', handleTabKey, true);
    });
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
  
  const errorHandler = window.moliamA11yErrorHandle;
  if (errorHandler) {
    document.removeEventListener('error', errorHandler, true);
  }
}

window.addEventListener('beforeunload', () => {
  window.moliamA11yCleanup();
});
