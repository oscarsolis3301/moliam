
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
