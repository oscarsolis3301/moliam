/* ============================================
   MOLIAM — Accessible Popover System
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  ensurePopoverAccessibility();
  setupPopoverKeyboardNavigation();
  announceToScreenReader('Popovers ready. Click to view details. Press Escape to close.');
  console.log(`%cMOLIAM Accessible Popover System Loaded`, 'color: #10b981; font-weight: bold;');
});

function ensurePopoverAccessibility() {
  // Find existing popover elements and enhance them
  const popovers = document.querySelectorAll('.popover, .pop-header');
  
  popovers.forEach(popEl => {
    if (!popEl.getAttribute('role')) {
      popEl.setAttribute('role', 'dialog');
      popEl.setAttribute('aria-modal', 'true');
      popEl.setAttribute('aria-labelledby', `${popEl.id}-title`);
    }
  });

  // Ensure aria-live region exists for notifications
  let liveRegion = document.getElementById('status-notifications');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'status-notifications';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(liveRegion);
  }
}

function setupPopoverKeyboardNavigation() {
  // Convert onclick handlers to proper keyboard event listeners on close buttons
  const closeButtons = document.querySelectorAll('.pop-close');
  
  closeButtons.forEach(btn => {
    if (!btn.getAttribute('tabindex')) {
      btn.setAttribute('tabindex', '0');
    }
    
    if (!btn.hasAttribute('aria-label')) {
      btn.setAttribute('aria-label', 'Close');
    }

    // Handle Enter and Space keys
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  // Add Escape key handler to close popovers (global)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideAllPopovers();
      returnToTriggerElement();
    }
  });
}

function hideAllPopovers() {
  const popovers = document.querySelectorAll('.popover, .pop-title');
  popovers.forEach(popEl => {
    if (popEl.style) {
      popEl.style.display = 'none';
    }
  });
  
  // Remove focus trapping and return focus to canvas or trigger
  releaseFocusFromPopover();
  announceToScreenReader('All popovers closed.');
}

function hidePopove() {
  const popEls = document.querySelectorAll('.popover');
  if (popEls.length > 0) {
    popEls[0].style.display = 'none';
  } else {
    const popTitle = document.querySelector('.pop-title');
    if (popTitle && popTitle.parentElement) {
      popTitle.parentElement.style.display = 'none';
    }
  }
  
  hideAllPopovers();
}

// Keep existing window.hidePopover for backward compatibility
window.hidePopover = hidePopover;

function releaseFocusFromPopover() {
  // Remove focus trap listeners
  document.removeEventListener('keydown', focusTrapHandler);
  
  // Return focus to canvas or trigger element if available
  const canvas = document.getElementById('hq-canvas');
  if (canvas) {
    canvas.focus();
  }
}

let focusTrapHandler = null;

function handleFocusTrap(e) {
  const currentPopover = e.target.closest('.popover, .pop-header');
  if (!currentPopover) return;
  
  if (e.key === 'Tab') {
    const focusableElements = Array.from(
      currentPopover.querySelectorAll('button, [tabindex], a')
    ).filter(el => el.offsetParent !== null); // Only visible
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
  
  // Also handle Escape to close
  if (e.key === 'Escape') {
    this.hideAllPopovers();
    const trigger = document.activeElement;
    if (trigger && trigger.tagName === 'CANVAS') {
      trigger.focus();
    }
  }
}

function announceToScreenReader(message) {
  // Use consistent ID: fix typo "status-notations" → "status-notifications"
  let liveRegion = document.getElementById('status-notifications');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'status-notifications';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(liveRegion);
  }
  
  liveRegion.textContent = message;
  
  // Clear after 3 seconds to avoid spam
  setTimeout(() => {
    if (liveRegion && liveRegion.textContent === message) {
      liveRegion.textContent = '';
     }
  }, 3000);
}

// Enhanced focus trap with proper ARIA role support and cleanup
function setupPopoverFocusTrap(popoverSelector) {
  const popover = document.querySelector(popoverSelector || '.popover');
  if (!popover) return;

  // Remove old handlers
  document.removeEventListener('keydown', focusTrapHandler);
   
  // Setup new focus trap with proper ARIA handling
  function handleFocusTrap(e) {
    const isEscape = e.key === 'Escape';
    
     // Close popover on Escape
    if (isEscape) {
      hideAllPopovers();
       return;
     }

    if (e.key !== 'Tab') return;
    
    const focusableElements = Array.from(
      popover.querySelectorAll('button, [tabindex="0"], a[href]')
    ).filter(el => el.offsetParent !== null);
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
     }
   
   // Ensure ARIA roles for screen reader announcements are proper
  if (popover.getAttribute('role') !== 'dialog' && !popover.getAttribute('aria-modal')) {
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'true');
    announceToScreenReader('Modal dialog opened. Press Escape to close.');
   }
  }

  document.addEventListener('keydown', handleFocusTrap);
}

// Ensure all popovers have proper ARIA support on load
function ensureAllPopoversAccessible() {
  const popoverElements = document.querySelectorAll('.popover, [role="dialog"]');
  
  popoverElements.forEach(el => {
    if (!el.getAttribute('aria-modal')) {
      el.setAttribute('aria-modal', 'true');
     }
    if (!el.getAttribute('aria-labelledby')) {
      const titleId = el.getAttribute('id') + '-title';
      el.setAttribute('aria-labelledby', titleId);
     }
  });

   // Ensure ARIA live region exists for announcements
  if (!document.getElementById('accessibility-status-region')) {
    const statusRegion = document.createElement('div');
    statusRegion.id = 'accessibility-status-region';
    statusRegion.setAttribute('aria-live', 'assertive');
    statusRegion.setAttribute('aria-atomic', 'true');
    statusRegion.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(statusRegion);
   }
}

window.announceAccessibilityStatus = function(message) {
  const region = document.getElementById('accessibility-status-region');
  if (region) {
    region.textContent = message;
    setTimeout(() => {
      if (region && region.textContent === message) {
        region.textContent = '';
       }
     }, 3000);
   } else {
    createAccessibilityRegion(message);
   }
 };

function createAccessibilityRegion(initialMessage = null) {
  const region = document.createElement('div');
  region.id = 'accessibility-status-region';
  region.setAttribute('aria-live', 'assertive');
  region.setAttribute('aria-atomic', 'true');
  region.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(region);

  if (initialMessage) {
    region.textContent = initialMessage;
    setTimeout(() => {
      if (region && region.textContent === initialMessage) {
        region.textContent = '';
       }
     }, 3000);
   }
 }

function returnToTriggerElement() {
  // Return focus to canvas element when closing popovers
  const canvas = document.getElementById('hq-canvas');
  if (canvas) {
    requestAnimationFrame(() => {
      canvas.focus();
      canvas.click({ clientX: 0, clientY: 0 });
    });
  }
}
