/* ══════════════════════════════════════════════════════════
   Hero Section — Basic Interaction Handler
   Handles scroll animations, mobile-responsive behavior, and click events
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── DOM refs ─── */
  var heroSection = document.getElementById('hero');
  var scrollIndicator = document.querySelector('.scroll-indicator');
  var ctaGroup = document.querySelector('.cta-group');

  /* ─── Scroll Handler ─── */
  if (window.innerWidth >= 1024) {
    window.addEventListener('scroll', function () {
      var scrolled = window.scrollY;
      var heroHeight = heroSection ? heroSection.offsetHeight : 600;
      
      if (scrolled < heroHeight * 0.5 && scrollIndicator) {
        scrollIndicator.style.opacity = '1';
        scrollIndicator.style.transform = 'translateY(0)';
      }
    }, { passive: true });
  }

  /* ─── CTA Button Handlers (Keyboard accessible) ─── */
  function initCTAHandlers() {
    if (!ctaGroup) return;
    
    var buttons = ctaGroup.querySelectorAll('a[href]');
    
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      
      // Add keyboard support for any clickable elements
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.click();
        }
      });
    }
  }

  /* ─── Mobile Menu Close Handler ─── */
  function bindMobileMenuClose() {
    var closeBtn = document.getElementById('mobile-menu-close');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        var menu = document.getElementById('mobile-menu');
        if (menu) {
          menu.style.display = 'none';
          closeBtn.setAttribute('aria-expanded', 'false');
          
          // Announce to screen readers
          var statusEl = document.getElementById('menu-status');
          if (statusEl) {
            statusEl.textContent = 'Navigation menu closed';
            setTimeout(function () {
              if (statusEl && statusEl.textContent === 'Navigation menu closed') {
                statusEl.textContent = '';
              }
            }, 2000);
          }
          
          // Return focus to hamburger
          var hamburger = document.getElementById('hamburger-btn');
          if (hamburger) {
            setTimeout(function () {
              hamburger.focus();
            }, 100);
          }
        }
      });
    }

    // Close mobile menu when clicking outside on the overlay
    var navLinks = document.querySelectorAll('.mobile-menu-overlay a');
    for (var j = 0; j < navLinks.length; j++) {
      var link = navLinks[j];
      
      // Make links focusable and announce on select
      link.setAttribute('tabindex', '0');
      
      link.addEventListener('click', function () {
        var menu = document.getElementById('mobile-menu');
        if (menu) {
          menu.style.display = 'none';
          var closeBtn = document.getElementById('mobile-menu-close');
          if (closeBtn) {
            closeBtn.focus();
          }
          
          // Announce navigation selection
          var statusEl = document.getElementById('menu-status');
          if (statusEl && this.textContent.trim()) {
            statusEl.textContent = 'Navigating to: ' + this.textContent.trim();
            setTimeout(function () {
              if (statusEl && statusEl.textContent.indexOf(this.textContent.trim()) > -1) {
                statusEl.textContent = '';
              }
            }, 3000);
          }
        }
      });
    }

    // Tab key navigation within mobile menu
    document.addEventListener('keydown', function tabKeyHandler(e) {
      var activeMenu = document.getElementById('mobile-menu');
      if (!activeMenu || activeMenu.style.display === 'none') return;
      
      if (e.key === 'Tab') {
        var visibleLinks = Array.from(activeMenu.querySelectorAll('a, button')).filter(function(el) {
          return el.offsetParent !== null && getComputedStyle(el).display !== 'none';
        });
        
        if (visibleLinks.length === 0) return;
        
        var firstLink = visibleLinks[0];
        var lastLink = visibleLinks[visibleLinks.length - 1];
        var activeEl = document.activeElement;
        
        if (e.shiftKey && activeEl === firstLink) {
          e.preventDefault();
          lastLink.focus();
        } else if (!e.shiftKey && activeEl === lastLink) {
          e.preventDefault();
          firstLink.focus();
        }
      }
    });
  }

  /* ─── FAQ Accordion Enhancements (if present) ─── */
  function initFAQAccordion() {
    var faqQuestions = document.querySelectorAll('.faq-question');
    
    if (!faqQuestions || faqQuestions.length === 0) return;
    
    for (var i = 0; i < faqQuestions.length; i++) {
      var qaBtn = faqQuestions[i];
      var panel = qaBtn.nextElementSibling;
      
      // Add aria attributes if not present
      if (!qaBtn.hasAttribute('aria-expanded')) {
        qaBtn.setAttribute('aria-expanded', 'false');
      }
      
      if (panel && panel.className.indexOf('faq-answer') > -1) {
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', qaBtn.getAttribute('id') || 'faq-question-' + i);
      }
      
      // Keyboard support for accordion
      qaBtn.addEventListener('click', function (e) {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        
        this.setAttribute('aria-expanded', String(!expanded));
        
        if (!expanded && panel) {
          panel.style.maxHeight = panel.scrollHeight + 'px';
          setTimeout(function () {
            a11yAnnounce(this.textContent.trim() + ' expanded');
          }, 300);
        } else if (panel) {
          panel.style.maxHeight = '0';
          a11yAnnounce(this.textContent.trim() + ' collapsed');
        }
      });
      
      qaBtn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === 'Space') {
          e.preventDefault();
          this.click();
        }
      });
    }
  }

  /* ─── ARIA Live Announcements Helper ─── */
  function a11yAnnounce(msg, assertive) {
    var liveRegion = document.getElementById('menu-status');
    
    if (liveRegion) {
      liveRegion.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
      liveRegion.textContent = msg;
      
      setTimeout(function () {
        if (liveRegion && liveRegion.textContent === msg) {
          liveRegion.textContent = '';
        }
      }, 3000);
    } else {
      if (typeof console !== 'undefined') {
        console.log('[A11y] ' + msg);
      }
    }
  }

  /* ─── Initialization ─── */
  function init() {
    initCTAHandlers();
    bindMobileMenuClose();
    initFAQAccordion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
