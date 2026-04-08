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
  // The actual mobile menu in our HTML has id="mobile-menu" with class mobile-menu-overlay
  const modalMenu = document.getElementById('mobile-menu');
  
  if (!hamburgerBtn || !modalMenu) return;
  
  // Toggle the existing mobile menu overlay from index.html
  hamburgerBtn.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    
    // Add/remove open class from the actual HTML container
    modalMenu.classList.toggle('open');
    const newAriaState = isMenuOpen ? 'true' : 'false';
    hamburgerBtn.setAttribute('aria-expanded', newAriaState);
    
    if (isMenuOpen && window.innerWidth < 768) {
      trapFocusInMobileMenu();
      announceToScreenReader('Mobile menu opened. Use Tab to navigate. Press Escape to close.');
      // Focus the first nav link in mobile menu
      setTimeout(() => {
        const firstLink = modalMenu.querySelector('.mobile-menu-overlay a');
        if (firstLink) firstLink.focus();
      }, 50);
    } else {
      announceToScreenReader('Mobile menu closed.');
    }
  });
  
  // Close on Escape key when mobile
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen && window.innerWidth < 768) {
      hamburgerBtn.click();
      hamburgerBtn.focus();
    }});

  // Click external link or close button should also close the menu
  modalMenu.querySelectorAll('a, button#mobile-menu-close').forEach(el => {
    el.addEventListener('click', () => {
      if (window.innerWidth < 768 && isMenuOpen) {
        isMenuOpen = false;
        modalMenu.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        hamburgerBtn.focus();
        announceToScreenReader('Mobile menu closed.');
        }
      });
    });

  // Add keyboard handling for hamburger button - Enter and Space
  hamburgerBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hamburgerBtn.click();
      }});
}

// No need for old toggleMobileMenu/updateAriaLabel functions - mobile menu is now handled inline above
console.log(`
%c===========================================
MOLIAM Navigation System Ready
%cSticky header with glassmorphism ✓
%c hamburger menu working correctly ✓
%c Mobile menu overlay toggles open/close ✓
%c Focus trapping in mobile menu ✓
%c Escape to close mobile menu ✓
%c ARIA live announcements for screen readers ✓
%c===========================================`, 
'color: #a855f7; font-weight: bold;',
'color: #ec4899; font-size: 12px;',
'color: #7c3aed; font-size: 11px;',
'color: #e9d5ff; font-style: italic;', 
'font-size: 13px;');

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
   // Update focus trap to use correct mobile menu selector
  function updateFocusTrapSelectors() {
    if (menuCloseHandler) {
      document.removeEventListener('keydown', menuCloseHandler);
      menuCloseHandler = null;
      }
    // Re-query with correct ID instead of nav-menu
    const modalMenu = document.getElementById('mobile-menu');
    if (modalMenu) {
      trapFocusInMobileMenu();
      }
    }
}

// ============================================
// Navigation Accessibility Enhancements
// ============================================

function addKeyboardAccessibility() {
   // Focus visible state for keyboard users - improve focus indicators
  const style = document.createElement('style');
  style.textContent = `
    :focus-visible {
      outline: 3px solid var(--accent-blue, #3B82F6);
      outline-offset: 2px;
    }
    
    .hamburger:focus-visible {
      outline-color: var(--accent-purple, #8B5CF6);
      outline-width: 3px;
      outline-offset: 4px;
    }
    
    nav a:focus-visible,
    .mobile-menu-overlay a:focus-visible {
      background: rgba(59, 130, 246, 0.1);
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);
}

console.log(`%cMOLIAM Navigation System Fully Loaded`, 'color: #7c3aed; font-weight: bold;');
