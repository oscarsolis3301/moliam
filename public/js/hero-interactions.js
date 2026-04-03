/**
 * Hero Section Interactions - Typing Effect, Gradient Animation, Scroll Indicator, Button Hovers
 */

(function() {
  'use strict';

  const heroSection = document.querySelector('#hero');
  if (!heroSection) return;

  // Typing effect for tagline
  const taglines = [
     "AI-Powered Operations",
     "Autonomous Marketing",
     "Built for Contractors",
    "24/7 Digital Growth",
     "24/7 Digital Growth"
   ];
  
  let currentTaglineIndex = 0;
  let typingPos = 0;
  let isDeleting = false;
  let typeSpeed = 100;

  const taglineEl = document.querySelector('#hero .tagline');
  if (taglineEl) {
    function typeWriter() {
      const currentText = taglines[currentTaglineIndex];
      
      if (isDeleting) {
        taglineEl.textContent = currentText.substring(0, typingPos - 1);
        typingPos--;
        typeSpeed = 50;
      } else {
        taglineEl.textContent = currentText.substring(0, typingPos + 1);
        typingPos++;
        typeSpeed = 80;
      }

      if (!isDeleting && typingPos === currentText.length) {
        isDeleting = true;
        typeSpeed = 2000; // Pause at end
      } else if (isDeleting && typingPos === 0) {
        isDeleting = false;
        currentTaglineIndex = (currentTaglineIndex + 1) % taglines.length;
        typeSpeed = 500;
      }

      setTimeout(typeWriter, typeSpeed);
    }

    typeWriter();
  }

  // Animated gradient background for Moliam logo
  const gradientText = document.querySelector('#hero .gradient');
  if (gradientText) {
    let rotation = 0;
    
    function animateGradient() {
      rotation = (rotation + 0.5) % 360;
      gradientText.style.backgroundImage = `linear-gradient(${rotation}deg, var(--accent-blue), var(--accent-purple), var(--accent-cyan))`;
      
      // Add subtle glow effect
      gradientText.style.backgroundClip = 'text';
      gradientText.style.webkitBackgroundClip = 'text';

      requestAnimationFrame(animateGradient);
    }

    animateGradient();
  }

  // Scroll indicator with chevron animation
  const scrollIndicator = document.querySelector('.scroll-indicator');
  if (scrollIndicator) {
    let bounceCount = 0;
    
    setInterval(() => {
      const chevron = scrollIndicator.querySelector('.chevron');
      if (chevron) {
        chevron.style.transform = `translateY(${10 + Math.abs(Math.sin(Date.now() / 500) * 5)}px) rotate(${Math.sin(Date.now() / 300) * 2}deg)`;
      }
    }, 16);

    // Scroll to HQ section when clicked
    scrollIndicator.addEventListener('click', () => {
      const hqSection = document.querySelector('#hq-section');
      if (hqSection) {
        hqSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Button hover effects with micro-interactions
  const buttons = document.querySelectorAll('#hero .btn-primary, #hero .btn-secondary');
  
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', (e) => {
      // Scale effect on hover
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = btn.classList.contains('btn-primary') 
        ? '0 8px 24px rgba(59,130,246,0.3)'
        : '0 8px 24px rgba(139,92,246,0.2)';

      // Add particle effect for primary button
      if (btn.classList.contains('btn-primary')) {
        createHoverParticles(e);
      }
    });

    btn.addEventListener('mouseleave', (e) => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = btn.classList.contains('btn-primary') 
        ? '0 4px 14px rgba(59,130,246,0.25)'
        : '0 4px 14px rgba(139,92,246,0.15)';

      // Remove particle effects
      const particles = e.target.parentElement.querySelectorAll('.hover-particle');
      particles.forEach(p => p.remove());
    });

    // Click animation for primary button
    if (btn.classList.contains('btn-primary')) {
      btn.addEventListener('click', (e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
        setTimeout(() => {
          e.currentTarget.style.transform = 'scale(1.05)';
          setTimeout(() => {
            e.currentTarget.style.transform = 'scale(1)';
          }, 100);
        }, 100);
      });
    }
  });

  function createHoverParticles(e) {
    for (let i = 0; i < 8; i++) {
      const particle = document.createElement('div');
      particle.className = 'hover-particle';
      
      const rect = e.target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      particle.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 4px;
        height: 4px;
        background: var(--accent-cyan);
        border-radius: 50%;
        pointer-events: none;
        z-index: 1000;
      `;

      document.body.appendChild(particle);

      // Animate particle outward
      const angle = (i / 8) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      
      requestAnimationFrame(() => {
        const endX = x + Math.cos(angle) * distance;
        const endY = y + Math.sin(angle) * distance;

        particle.style.transition = 'all 600ms ease-out';
        particle.style.transform = `translate(${endX - x}px, ${endY - y}px)`;
        particle.style.opacity = '0';
      });

      setTimeout(() => particle.remove(), 700);
    }
  }

  // Intersection Observer for scroll-triggered hero fade-in
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  // Apply to hero section
  heroSection.style.opacity = '0';
  heroSection.style.transform = 'translateY(20px)';
  heroSection.style.transition = 'opacity 800ms ease-out, transform 800ms ease-out';
  observer.observe(heroSection);

  // Export for external use
  window.heroInteractions = {
    refresh: () => console.log('Hero interactions refreshed'),
    pauseTyping: () => console.log('Typing paused')
  };

})();
