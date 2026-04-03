/* ============================================
   MOLIAM - Interactive JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
   // Page load animation
  initLoadingAnimation();
  
   // Scroll reveal effects
  setupScrollReveal();
  
   // Smooth scroll navigation
  initializeSmoothScroll();
  
   // Form validation and submission
  setupFormHandling();
  
   // Particle effect on buttons/clicks
  createMagnetEffects();
  
   // IntersectionObserver for active states
  observeActiveSections();
});

// Loading animation on page load
function initLoadingAnimation() {
  const hero = document.querySelector('header');
  if (hero) {
    hero.style.opacity = '0';
    hero.style.transform = 'translateY(20px)';
       // eslint-disable-next-line no-new
      new Promise(resolve => setTimeout(resolve, 150)).then(() => {
        hero.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        hero.style.opacity = '1';
      hero.style.transform = 'translateY(0)';
      });
   }
}

// Scroll reveal effects - elements fade in when scrolling into view
function setupScrollReveal() {
  const revealElements = document.querySelectorAll('.card, h2, h1');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0) scale(1)';
          entry.target.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  
  revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px) scale(0.95)';
      observer.observe(el);
   });
}

// Smooth scroll to sections when clicking nav links
function initializeSmoothScroll() {
  document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      
      if (targetSection) {
        const headerHeight = document.querySelector('.navbar').offsetHeight;
        const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - headerHeight;
          
         window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
          // Add active state to nav link
        document.querySelectorAll('nav a').forEach(link => link.style.opacity = '0.85');
         this.style.opacity = '1';
      }
    });
  });
}

// Form handling with validation and feedback
function setupFormHandling() {
  const form = document.querySelector('form');
  if (!form) return;
  
  // Input field enhancements
  form.querySelectorAll('input, textarea').forEach(field => {
     
      // Add visual indicator when focused
    field.addEventListener('focus', () => {
      field.parentElement.classList.add('focused');
    });
    
    field.addEventListener('blur', () => {
      field.parentElement.classList.remove('focused');
    });
    
     // Validation feedback - don't show errors until user tries to submit
    field.addEventListener('input', validateField);
  });
  
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    let isValid = true;
    const inputs = this.querySelectorAll('input, textarea');
       inputs.forEach(input => validateField(input));
       if (form.checkValidity()) {
        // Simulate form submission with loading state
         const submitBtn = form.querySelector('button[type="submit"]');
         const originalText = submitBtn.textContent;
         submitBtn.textContent = 'Sending...';
         submitBtn.disabled = true;
          submitBtn.style.opacity = '0.7';
        
        // Simulate network delay with success message
          new Promise(resolve => setTimeout(resolve, 1500)).then(() => {
            alert('Thank you for your message! We will be in touch soon.');
             form.reset();
             submitBtn.textContent = originalText;
             submitBtn.disabled = false;
             submitBtn.style.opacity = '1';
          });
      } else {
        isValid = false;
      }
  });
}

function validateField(field) {
   const parent = field.parentElement;
     let isValid = false;
  
  if (field.type === 'email') {
      isValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(field.value);
  } else if (field.type === 'text' && field.id === 'name') {
       isValid = field.value.trim().length >= 2;
  } else {
      isValid = field.validity.valid && field.value.trim().length > 0;
   }
  
  if (!isValid && field.value.length > 0) {
    parent.classList.add('error');
    field.style.borderColor = '#ef4444';
  } else {
    parent.classList.remove('error');
    field.style.borderColor = '';
  }
  return isValid;
}

// Create magnet effects on buttons and cards - mouse tracking for hover glow
function createMagnetEffects() {
   const magneticElements = document.querySelectorAll('.btn-main, .card');
  
  magneticElements.forEach(element => {
     element.addEventListener('mousemove', (e) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
      
      // Calculate distance from center for subtle rotation effect
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      
       // Subtle shift towards mouse cursor (up to 5px)
      element.style.transform = `translate(${Math.min(deltaX, 10, 5)}px, ${Math.min(deltaY, 10, 5)}px) scale(1.02)`;
    });
    
     element.addEventListener('mouseleave', () => {
      element.style.transform = 'none';
    });
  });
}

// IntersectionObserver to highlight current section in nav
function observeActiveSections() {
   const sections = document.querySelectorAll('.section, header');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
         // Find corresponding nav link and activate it
        const sectionId = '#' + entry.target.id;
        const navLink = document.querySelector(`nav a[href="${sectionId}"]`);
        
         if (navLink) {
          document.querySelectorAll('nav a').forEach(link => {
            link.style.opacity = '0.85';
             link.style.color = '#fff';
           });
           navLink.style.opacity = '1';
           navLink.style.color = '#d8b4fe';
         }
       
      }
    });
  }, { threshold: 0.3, rootMargin: '-50px 0px -50px 0px' });
  
  sections.forEach(section => observer.observe(section));
}

// Add particle effect on clicks globally
document.addEventListener('click', (e) => {
   // Create ripple effect on buttons/cards
  const target = e.target.closest('.btn-main, .card');
  if (target && !target.classList.contains('processing')) {
     target.classList.add('clicked');
    setTimeout(() => target.classList.remove('clicked'), 150);
  }
});

// Console Easter Egg - Developer message in console
console.log(`
%c===========================================%n 
%cMOLIAM Agency Website%n 
%cBuilt with ❤️ using modern web technologies%n 
%s“Where creativity meets intelligence”%n
%c===========================================%n`, 
"color: #a855f7; font-weight: bold; font-size: 14px",
"color: #ec4899; font-weight: bold; font-size: 16px",
"color: #7c3aed; font-size: 12px;",
"color: #e9d5ff; font-style: italic;",
"font-size: 13px;"
);
