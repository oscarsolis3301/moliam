// ════════════════════════════════════════
// Accessibility Enhancements for HQ Canvas
// Keyboard navigation, focus management, ARIA live regions
// ════════════════════════════════════════

(function() {
  'use strict';

  const KEYBOARD = {
    TAB: 'Tab',
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight'
  };

  // Accessibility flags
  let keyboardFocusIndex = -1;
  let isKeyboardNavigation = false;

  /** Create ARIA live region for event announcements */
  function createAriaLiveRegion() {
    if (document.getElementById('aria-live-region')) return;
    
    const liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-relevant', 'additions text');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);

    // Expose global announcement function
    window.announceToAccessibility = function(message) {
      if (liveRegion) {
        liveRegion.textContent = message;
        liveRegion.textContent = ''; // Clear after announcement cycles
      }
    };
  }

  /** Keyboard event handler for canvas navigation */
  function handleKeyboardEvents(e) {
    // Only handle if canvas is focused or we're using keyboard nav
    if (document.activeElement !== canvas && !isKeyboardNavigation) return;

    switch(e.key) {
      case KEYBOARD.ARROW_UP:
        if (keyboardFocusIndex > -1) {
          e.preventDefault();
          keyboardFocusIndex = Math.max(0, keyboardFocusIndex - 1);
          focusBotAtIndex(keyboardFocusIndex);
          announceToAccessibility(`Focus moved to ${getBotDisplayName(keyboardFocusIndex)}. Press Enter for details.`);
        }
        break;

      case KEYBOARD.ARROW_DOWN:
        e.preventDefault();
        keyboardFocusIndex = Math.min(bots.length - 1, keyboardFocusIndex + 1);
        focusBotAtIndex(keyboardFocusIndex);
        announceToAccessibility(`Focus moved to ${getBotDisplayName(keyboardFocusIndex)}. Press Enter for details.`);
        break;

      case KEYBOARD.ARROW_LEFT:
        e.preventDefault();
        if (keyboardFocusIndex >= 0 && bots[keyboardFocusIndex]) {
          const b = bots[keyboardFocusIndex];
          // Move the bot by changing its target position
          if (!b.moving) {
            b.targetX = Math.max(layout.margin, Math.min(layout.W - layout.margin, b.x - 30));
            announceToAccessibility(`Bot ${b.name} moving left.`);
          }
        }
        break;

      case KEYBOARD.ARROW_RIGHT:
        e.preventDefault();
        if (keyboardFocusIndex >= 0 && bots[keyboardFocusIndex]) {
          const b = bots[keyboardFocusIndex];
          if (!b.moving) {
            b.targetX = Math.max(layout.margin, Math.min(layout.W - layout.margin, b.x + 30));
            announceToAccessibility(`Bot ${b.name} moving right.`);
          }
        }
        break;

      case KEYBOARD.ENTER:
        if (keyboardFocusIndex >= 0 && bots[keyboardFocusIndex]) {
          e.preventDefault();
          const bot = bots[keyboardFocusIndex];
          showBotPopover(bot, bots[keyboardFocusIndex].x + 20, bobs[keyboardFocusIndex].y - 30);
          announceToAccessibility(`Showing details for ${bot.name}. Use Escape to close.`);
        }
        break;

      case KEYBOARD.ESCAPE:
        if (keyboardFocusIndex > -1) {
          e.preventDefault();
          keyboardFocusIndex = -1;
          isKeyboardNavigation = false;
          canvas.style.borderColor = '';
          hidePopover();
          announceToAccessibility('Keyboard navigation mode disabled.');
        }
        break;

      case KEYBOARD.TAB:
        // Enable keyboard nav on tab to canvas
        isKeyboardNavigation = true;
        if (keyboardFocusIndex === -1) {
          keyboardFocusIndex = 0;
          focusBotAtIndex(0);
          announceToAccessibility(`Dashboard ready. Use arrow keys to navigate between bots.`);
        }
        break;
    }
  }

  /** Get bot name for accessibility announcements */
  function getBotDisplayName(index) {
    if (bots[index]) {
      return `${bots[index].name}, status: ${bots[index].state}`;
    }
    return 'unknown';
  }

  /** Focus a bot at the given index */
  function focusBotAtIndex(index) {
    if (index < 0 || !bots[index]) return;
    
    keyboardFocusIndex = index;
    canvas.style.borderColor = COLORS.accentBlue;
    canvas.focus({ preventScroll: true });
    
    const bot = bots[keyboardFocusIndex];
    announceToAccessibility(`${bot.name} is now focused. State: ${bot.state}. Press Enter for details, Escape to close.`);
  }

  /** Initialize accessibility features */
  function initAccessibility() {
    // Create ARIA live region
    createAriaLiveRegion();

    // Make canvas keyboard-interactable
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'HQ Dashboard: Interactive visualization. Use arrow keys to navigate between bots.');

    // Setup global keyboard handler
    window.addEventListener('keydown', handleKeyboardEvents);

    // Cleanup on module unload
    if (window.moliam_cleanup_func) {
      window.removeEventListener('keydown', handleKeyboardEvents);
    }

    console.log('Accessibility enhancements initialized. Tab to canvas to begin navigation.');
  }

  /** Expose cleanup function for page unload */
  window.__moliam_cleanup_a11y__ = function() {
    if (window.__moliam_cleanup_hq_interaction__) {
      window.__moliam_cleanup_hq_interaction__();
    }
  };

  // Initialize immediately on module load
  initAccessibility();

})();
