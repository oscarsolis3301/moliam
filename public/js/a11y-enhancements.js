// ============================================
// MOLIAM - Accessibility Enhancements JS
//    Keyboard nav, focus management, ARIA live regions
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initFAQKeyboardNav();
  initMobileMenuAriaAnnouncements();
  console.log(`%cMOLIAM a11y Enhancements Loaded`, 'color: #22c55e; font-weight: bold;');
});

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
// Cleanup Functions - Memory Leak Prevention
// ============================================

function disconnectAriaObserver() {
  if (ariaObserver && mobileMenu) {
    ariaObserver.disconnect();
    ariaObserver = null;
  }
}

window.moliamA11yCleanup = function() {
  disconnectAriaObserver();
  document.removeEventListener('error', window.moliamA11yErrorHandle, true);
}
