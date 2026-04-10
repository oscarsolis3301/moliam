// Mobile-First Enhancement for Dashboard & Admin Pages
// Responsive improvements, touch gestures, smooth transitions

(function() {
  'use strict';

  // Smooth scroll to section with offset correction for fixed nav
  function scrollToSection(targetId) {
    const element = document.querySelector(targetId);
    if (!element) return;
    
    const navHeight = 84;
    const position = element.getBoundingClientRect().top + window.pageYOffset - navHeight;
    
    window.scrollTo({
      top: position,
      behavior: 'smooth'
    });
  }

  // Add smooth fade-in animations for dynamically loaded content
  function animateElement(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(12px)';
    
    requestAnimationFrame(() => {
      element.style.transition = 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  }

  // Add pulse animation on interactive elements
  function addPulseAnimation(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.addEventListener('click', () => {
        el.style.transform = 'scale(1.05)';
        setTimeout(() => {
          el.style.transform = '';
        }, 150);
      });
    });
  }

  // Lazy load images and sections
  function setupLazyLoad() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.card, .project-card, .stat-card').forEach(card => {
      card.style.opacity = '0';
      observer.observe(card);
    });
  }

  // Touch gestures for mobile cards (swipe to action)
  function addTouchGestures() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.querySelectorAll('.project-card').forEach(card => {
        let startX, startY;
        
        card.addEventListener('touchstart', (e) => {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
          const endX = e.changedTouches[0].clientX;
          const endY = e.changedTouches[0].clientY;
          
          const diffX = Math.abs(endX - startX);
          const diffY = Math.abs(endY - startY);
          
          if (diffX > 50 && diffY < 30) {
            card.querySelector('.btn')?.click();
          }
        }, { passive: true });
      });
    }
  }

  // Responsive table enhancements for mobile
  function enhanceMobileTables() {
    if (window.innerWidth <= 768) {
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        // Add horizontal scroll indicator on overflow
        const container = table.parentElement;
        if (container && !container.classList.contains('overflow-indicator')) {
          container.classList.add('overflow-indicator');
          
          let isOverflowing = false;
          table.addEventListener('scroll', () => {
            if (table.scrollLeft > 0) isOverflowing = true;
            else isOverflowing = false;
            
            if (isOverflowing) {
              container.style.boxShadow = 'inset -15px 0 20px -10px rgba(0,0,0,0.3)';
            } else {
              container.style.boxShadow = '';
            }
          });
        }
      });
    }
  }

  // Status badge color coding based on values
  function updateStatusBadges() {
    document.querySelectorAll('.status-badge').forEach(badge => {
      const text = badge.textContent?.toLowerCase();
      
      if (text.includes('active') || text.includes('completed')) {
        badge.className = 'status-badge status-active';
      } else if (text.includes('pending') || text.includes('paused')) {
        badge.className = 'status-badge status-pending';
      } else {
        badge.className = 'status-badge status-inactive';
      }
      
      addPulseAnimation(`.${badge.className}`);
    });
  }

  // Mobile-friendly modal/dialog with backdrop blur
  function setupModalUX() {
    const dialogs = document.querySelectorAll('dialog');
    dialogs.forEach(dialog => {
      dialog.style.backdropFilter = 'blur(12px)';
      dialog.style.webkitBackdropFilter = 'blur(12px)';
      dialog.setAttribute('aria-labelledby', dialog.querySelector('h3')?.id || 'modal-title');
    });
  }

   // Initialize everything on page load
  function init() {
    setupLazyLoad();
    updateStatusBadges();
    addTouchGestures();
    enhanceMobileTables();
    setupModalUX();
   }

   // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
