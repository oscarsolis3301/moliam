/* ============================================
   MOLIAM - Navigation Interactions JS
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initHamburgerMenu();
  initializeNavLinkHighlighter();
  setupMobileMenuTransitions();
  console.log(`%cMOLIAM Navigation System Loaded`, 'color: #a855f7; font-weight: bold;');
});

// ============================================
// Hamburger Menu State Management
// ============================================

function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('nav-menu');
  
  if (!hamburgerBtn || !navMenu) return;
  
  // Track mobile menu state
  let isMenuOpen = false;
  
  hamburgerBtn.addEventListener('click', () => {
    toggleMobileMenu(hamburgerBtn, navMenu);
    updateAriaLabel(hamburgerBtn, isMenuOpen);
  });
  
  // Close menu when clicking external link on mobile
  document.querySelectorAll('nav a[data-link]').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768 && isMenuOpen) {
        toggleMobileMenu(hamburgerBtn, navMenu);
        updateAriaLabel(hamburgerBtn, false);
      }
    });
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
          
          // Add underline animation on hover for mobile
          activeLink.addEventListener('mouseenter', () => {
            activeLink.style.borderBottom = '2px solid #a855f7';
          });
          activeLink.addEventListener('mouseleave', () => {
            activeLink.style.borderBottom = 'none';
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
%chamburger menu for mobile ✓
%clink highlighter with IntersectionObserver ✓
%csmooth transitions for all devices ✓
%c===========================================`, 
  'color: #a855f7; font-weight: bold;',
  'color: #ec4899; font-size: 12px;',
  'color: #7c3aed; font-size: 11px;',
  'color: #e9d5ff; font-style: italic;',
  'font-size: 13px;'
);
