// ============================================
// MOLIAM - Accessibility Enhancements JS
//    Keyboard nav, focus management, ARIA live
//   ============================================

document.addEventListener('DOMContentLoaded', () => {
  initFAQKeyboardNav();
  initMobileMenuAriaAnnouncements();
  console.log(`%cMOLIAM a11y Enhancements Loaded`, 'color: #22c55e; font-weight: bold;');
});

// ============================================
// FAQ Accordion - Keyboard Navigation + aria-expanded toggling
// ============================================

function initFAQKeyboardNav() {
  const faqButtons = Array.from(document.querySelectorAll('.faq-question'));
  
  if (faqButtons.length === 0) return;

  faqButtons.forEach((btn, idx) => {
    // Ensure keyboard interaction is enabled
    btn.setAttribute('tabindex', '0');
    btn.dataset.faqIndex = String(idx);

    // Handle Enter and Space
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        faqButtons[idx + 1]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        faqButtons[idx - 1]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        faqButtons[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        faqButtons[faqButtons.length - 1].focus();
      }
    });

    // Handle click to toggle
    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const newExpanded = !isExpanded;
      btn.setAttribute('aria-expanded', String(newExpanded));
      
      if (newExpanded) {
        announceToScreenReader(`FAQ expanded: ${btn.textContent.trim()}`);
      } else {
        announceToScreenReader(`FAQ collapsed: ${btn.textContent.trim()}`);
      }
    });
  });
}

// ============================================
// ARIA Live Announcements for Screen Readers
// ============================================

function announceToScreenReader(message) {
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
// Mobile Menu Overlay - ARIA updates for screen readers
// ============================================

function initMobileMenuAriaAnnouncements() {
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (!mobileMenu) return;

  // Watch for menu open/close to update aria attributes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.attributeName === 'style') {
        const display = mobileMenu.style.display;
        const isOpen = display !== 'none';

        // Update aria-expanded on hamburger button
        const hamburgerBtn = document.getElementById('hamburger-btn');
        if (hamburgerBtn) {
          hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
        }

        if (isOpen && window.innerWidth < 768) {
          announceToScreenReader('Mobile menu opened. Tab to navigate links. Press Escape or the close button to close.');
          
          // Focus first link after a brief delay
          const firstLink = mobileMenu.querySelector('a, button');
          if (firstLink) {
            setTimeout(() => firstLink.focus(), 150);
          }
        } else if (!isOpen) {
          announceToScreenReader('Mobile menu closed.');
          
          // Return focus to hamburger
          const hamburgerBtn = document.getElementById('hamburger-btn');
          if (hamburgerBtn) {
            setTimeout(() => hamburgerBtn.focus(), 150);
          }
        }
      }
    });
  });

  observer.observe(mobileMenu, { attributes: true, attributeFilter: ['style'] });
}

// ============================================
// Focus Trap Utility for Modals/Overlays
// ============================================

window.moliamFocusTrap = (element, onEscape) => {
  const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusables = Array.from(element.querySelectorAll(focusableSelectors));
  
  if (focusables.length === 0) return;

  const firstFocusable = focusables[0];
  const lastFocusable = focusables[focusables.length - 1];

  document.addEventListener('keydown', function handleTab(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  });

  document.addEventListener('keydown', function handleEscape(e) {
    if (e.key === 'Escape') {
      onEscape?.();
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
    }
  });

  firstFocusable.focus();
};

// ============================================
// Error Handling for async content loads
// ============================================

window.moliamA11yErrorHandle = (event) => {
  if (event.target.tagName === 'IFRAME' || event.target.tagName === 'IMG') {
    announceToScreenReader(`Element failed to load: ${event.target.alt || 'unknown element'}`);
  }
};

window.addEventListener('error', window.moliamA11yErrorHandle, true);

console.log(`%c===========================================
MOLIAM Accessibility System Ready
%c FAQ accordion keyboard nav ✓ (Arrow keys + Enter/Space)
%c ARIA live announcements for screen readers ✓
%c Mobile menu focus management ✓
%c Error fallback handling ✓
%c===========================================`,
  'color: #22c55e; font-weight: bold;',
  'color: #f59e0b; font-size: 12px;',
  'color: #8B5CF6; font-size: 11px;');
