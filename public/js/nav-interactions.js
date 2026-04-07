/* ============================================
   MOLIAM - Navigation Interactions JS
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initHamburgerMenu();
  initializeNavLinkHighlighter();
  setupMobileMenuTransitions();
  addKeyboardAccessibility();
  console.log(`%cMOLIAM Navigation System Loaded`, 'color: #a855f7; font-weight: bold;');
});

// ============================================
// Hamburger Menu State Management
// ============================================

let isMenuOpen = false;
let menuCloseHandler = null;

function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');
  
  if (!hamburgerBtn || !navMenu) return;
  
  hamburgerBtn.addEventListener('click', () => {
    toggleMobileMenu(hamburgerBtn, navMenu);
    updateAriaLabel(hamburgerBtn, isMenuOpen);
    if (isMenuOpen && window.innerWidth < 768) {
      trapFocusInMobileMenu();
      announceToScreenReader('Mobile menu opened. Use Tab to navigate. Press Escape to close.');
    }
  });
  
  // Close menu when clicking external link on mobile
  document.querySelectorAll('nav a[data-link]').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768 && isMenuOpen) {
        toggleMobileMenu(hamburgerBtn, navMenu);
        releaseFocusFromMobileMenu();
        updateAriaLabel(hamburgerBtn, false);
        announceToScreenReader('Mobile menu closed.');
      }
    });
  });
  
  // Add keyboard handling for hamburger button - Enter and Space
  hamburgerBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hamburgerBtn.click();
    }
  });
  
  // Handle Escape key to close menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen && window.innerWidth < 768) {
      hamburgerBtn.click();
      hamburgerBtn.focus();
      updateAriaLabel(hamburgerBtn, false);
      announceToScreenReader('Mobile menu closed. Focus returned to menu button.');
    }
  });

  // Click outside to close (but handle focus properly)
  document.addEventListener('click', (e) => {
    if (window.innerWidth < 768 && isMenuOpen && 
        !hamburgerBtn.contains(e.target) && 
        !navMenu.contains(e.target)) {
      hamburgerBtn.click();
      updateAriaLabel(hamburgerBtn, false);
    }
  });
}

function toggleMobileMenu(hamburgerBtn, navMenu) {
  const mobileToggle = hamburgerBtn.closest('.mobile-menu-toggle');
  
  if (mobileToggle) {
    isMenuOpen = !isMenuOpen;
    
    // Animation classes for slide-in effect
    if (isMenuOpen) {
      mobileToggle.classList.add('menu-open');
      navMenu.style.transform = 'translateY(0)';
    } else {
      mobileToggle.classList.remove('menu-open');
      navMenu.style.transform = 'translateY(-100%)';
    }
  }
}

function updateAriaLabel(hamburgerBtn, isOpen) {
  if (!hamburgerBtn) return;
  hamburgerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  hamburgerBtn.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

function announceToScreenReader(message) {
  let liveRegion = document.getElementById('menu-status');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'menu-status';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(liveRegion);
  }
  
  liveRegion.textContent = message;
  
  // Clear after 3 seconds
  setTimeout(() => {
    if (liveRegion && liveRegion.textContent === message) {
      liveRegion.textContent = '';
    }
  }, 3000);
}

function trapFocusInMobileMenu() {
  const mobileLinks = Array.from(document.querySelectorAll('#nav-menu a, #nav-menu button'));
  const firstLink = mobileLinks[0];
  const lastLink = mobileLinks[mobileLinks.length - 1];
  
  // Focus first link when menu opens
  if (firstLink) {
    setTimeout(() => firstLink.focus(), 100);
  }
  
  // Trap focus within menu
  document.addEventListener('keydown', function focusTrapHandler(e) {
    if (!isMenuOpen || window.innerWidth >= 768) return;
    
    if (e.key === 'Tab') {
      if (e.target === firstLink && !e.shiftKey) {
        e.preventDefault();
        lastLink.focus();
      } else if (e.target === lastLink && e.shiftKey) {
        e.preventDefault();
        firstLink.focus();
      }
    }
    
    // Escape to close and return focus to hamburger
    if (e.key === 'Escape') {
      const hamburgerBtn = document.getElementById('hamburger-btn');
      if (hamburgerBtn) {
        hamburgerBtn.click();
        hamburgerBtn.focus();
        updateAriaLabel(hamburgerBtn, false);
      }
      document.removeEventListener('keydown', focusTrapHandler);
    }
  });
  
  menuCloseHandler = function cleanup() {
    document.removeEventListener('keydown', focusTrapHandler);
    if (menuCloseHandler) menuCloseHandler = null;
  };
}

function releaseFocusFromMobileMenu() {
  isMenuOpen = false;
  // Release focus trap
  if (menuCloseHandler) {
    menuCloseHandler();
  }
  
  // Return focus to hamburger button
  const hamburgerBtn = document.getElementById('hamburger-btn');
  if (hamburgerBtn) {
    hamburgerBtn.focus();
  }
}

// ============================================
// Nav Link Highlighter (Active State Detection)
// ============================================

function initializeNavLinkHighlighter() {
  // Get nav items and sections
  const navLinks = Array.from(document.querySelectorAll('nav a[data-link]'));
  const sections = document.querySelectorAll('section[id], header');
  
  if (navLinks.length === 0 || sections.length === 0) return;
  
  // Create observer for active state switching
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sectionId = '#' + entry.target.id;
        
        // Clear all nav links
        navLinks.forEach(link => {
          link.style.opacity = '0.85';
          link.style.color = '#fff';
        });
        
        // Activate current nav link
        const activeLink = document.querySelector(`nav a[href="${sectionId}"]`);
        if (activeLink) {
          activeLink.style.opacity = '1';
          activeLink.style.color = '#d8b4fe'; // Lavender glow
          
          // Add keyboard navigation support - ensure focus indicator on tab
          activeLink.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              window.location.hash = sectionId.substring(1);
            }
          });
        }
      }
    });
  }, { threshold: 0.3, rootMargin: '-50px 0px -50px 0px' });
  
  sections.forEach(section => observer.observe(section));
}

// ============================================
// Mobile Menu Smooth Transitions
// ============================================

function setupMobileMenuTransitions() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');
  
  if (!hamburgerBtn || !navMenu) return;
  
  // Add slide-in animation for mobile menu
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      #nav-menu {
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                    border-radius 0.4s ease-in-out;
        backdrop-filter: blur(10px);
        background: rgba(30, 41, 59, 0.95);
        padding: 1rem 0;
        z-index: 999;
      }
      
      #nav-menu.menu-open {
        max-height: 100vh;
        border-radius: 0 0 10px 10px;
      }
      
      .mobile-menu-toggle {
        display: flex !important;
        margin-right: 1rem;
      }
      
      #hamburger-btn {
        font-size: clamp(1.5rem, 4vw, 2rem);
        background: transparent;
        color: var(--accent-purple);
        border: none;
        cursor: pointer;
        transition: all 0.3s ease-in-out;
        padding: 0.5rem 0.75rem;
      }
      
      #hamburger-btn:hover {
        transform: scale(1.1);
        color: var(--accent-pink);
      }
    }
    
    @media (min-width: 769px) {
      #nav-menu {
        position: static;
        max-height: none !important;
        overflow: visible;
        backdrop-filter: none;
        background: transparent;
      }
      
      .mobile-menu-toggle {
        display: none !important;
      }
    }
  `;
  
  document.head.appendChild(style);
}

console.log(`
%c===========================================
MOLIAM Navigation System Ready
%cSticky header with glassmorphism ✓
%c hamburger menu for mobile ✓
%c link highlighter with IntersectionObserver ✓
%c smooth transitions for all devices ✓
%c Keyboard navigation: Enter/Space to activate links ✓
%c Focus trapping in mobile menu ✓
%c Escape to close mobile menu ✓
%c ARIA live announcements for screen readers ✓
%c===========================================`, 
  'color: #a855f7; font-weight: bold;',
  'color: #ec4899; font-size: 12px;',
  'color: #7c3aed; font-size: 11px;',
  'color: #e9d5ff; font-style: italic;', 
  'font-size: 13px;'
);
