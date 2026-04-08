// Mobile Menu Navigation Helper - extract onclick handlers
(function() {
  'use strict';
  
  const portfolioLink = document.querySelector('.mobile-menu-overlay a[href="#portfolio"]');
  if (portfolioLink) {
    // Remove inline onclick and add proper event listener
    portfolioLink.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = '/portfolio.html';
    });
    // Make keyboard accessible
    portfolioLink.setAttribute('tabindex', '0');
    portfolioLink.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = '/portfolio.html';
      }
    });
  }
  
  // Also extract onclick from navbar hamburger menu for accessibility
  const hamburgerBtn = document.getElementById('hamburger-btn');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function() {
      this.setAttribute('aria-expanded', 
        this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'
      );
      const mobileMenu = document.getElementById('mobile-menu');
      if (mobileMenu) {
        mobileMenu.style.display = 
          mobileMenu.style.display === 'none' ? 'flex' : 'none';
      }
    });
    
    // Keyboard support for hamburger
    hamburgerBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  }
  
  // Close mobile menu button keyboard handler
  const menuCloseBtn = document.getElementById('mobile-menu-close');
  if (menuCloseBtn) {
    menuCloseBtn.addEventListener('click', function() {
      hideMobileMenu();
    });
    
    menuCloseBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        hideMobileMenu();
      }
    });
  }
  
  function hideMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (hamburgerBtn) {
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    }
    
    if (mobileMenu) {
      mobileMenu.style.display = 'none';
    }
  }
})();

