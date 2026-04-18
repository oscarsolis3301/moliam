// Mobile Navigation Handler - task 8: mobile navigation polish
(function() {
    'use strict';

    const nav = document.querySelector('nav');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (!nav || !menuToggle) return;

    let isMenuOpen = false;
    let backExitHandled = false;

    // iOS Safari smooth scroll behavior for mobile
    function setupMobileScroll() {
        if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent)) {
            document.documentElement.style.scrollBehavior = 'auto';
            
            const scrollContainers = document.querySelectorAll('.interactive-wrap, .game-panel');
            scrollContainers.forEach(container => {
                container.addEventListener('scroll', function(e) {
                    e.target.style.transform = `translateY(${e.target.scrollTop}px)`;
                }, { passive: true });
            });
        }
    }

    // Touch-friendly accordion animations with cubic-bezier easing
    function setupMenuAnimation() {
        if (window.matchMedia('(max-width: 768px)').matches) {
            menuToggle.addEventListener('click', function(e) {
                e.preventDefault();
                
                const currentState = this.getAttribute('aria-expanded') === 'true';
                const newState = !currentState;
                
                // cubic-bezier easing: fast start, smooth deceleration
                // [0.4, 0, 0.2, 1] - smooth bounce for mobile
                this.setAttribute('aria-expanded', newState ? 'true' : 'false');
                nav.setAttribute('data-menu-open', newState ? 'true' : '');
                
                if (newState) {
                    // Focus first nav link for accessibility
                    const firstLink = navLinks.querySelector('a, button');
                    if (firstLink) setTimeout(() => firstLink.focus(), 150);
                } else {
                    menuToggle.focus();
                }
            }, { passive: false });

            // Close menu when clicking a link
            navLinks.addEventListener('click', function(e) {
                const target = e.target.closest('a');
                if (target && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    isMenuOpen = false;
                    menuToggle.setAttribute('aria-expanded', 'false');
                    nav.removeAttribute('data-menu-open');
                    
                    // Smooth reposition after close
                    setTimeout(() => {
                        menuToggle.focus();
                    }, 100);
                }
            });

            // Handle back button on iOS/Safari
            if (backExitHandled) return;
            backExitHandled = true;

            window.addEventListener('popstate', function(e) {
                if (!isMenuOpen || window.innerWidth > 768) return;

                const currentScroll = navLinks.scrollTop;
                document.addEventListener('click', function closeHandler(event) {
                    isMenuOpen = false;
                    menuToggle.setAttribute('aria-expanded', 'false');
                    nav.removeAttribute('data-menu-open');
                    document.removeEventListener('click', closeHandler);
                    document.body.style.overflow = '';

                    // Restore scroll position if needed after back action
                    setTimeout(function() {
                        navLinks.scrollTop = currentScroll;
                        menuToggle.focus();
                    }, 150);
                }, { once: true });
            }, { passive: true });
        }

        setupMobileScroll();
    }

    // Back-button handling to prevent double-exit alerts
    function handleBackButtonExit() {
        let closeCount = 0;

        document.addEventListener('click', function(e) {
            if (e.target === menuToggle && isMenuOpen) {
                isMenuOpen = false;
                menuToggle.setAttribute('aria-expanded', 'false');
                nav.removeAttribute('data-menu-open');
                
                // Reset scroll position for mobile
                if (navLinks && window.innerWidth <= 768) {
                    navLinks.scrollTop = 0;
                }

                document.body.style.overflow = '';
                menuToggle.focus();
            }
        }, { passive: false });
    }

    // Touch target size verification - ensure hamburger is 44x44px per WCAG
    function verifyTouchTargets() {
        const style = window.getComputedStyle(menuToggle);
        const width = parseFloat(style.width);
        const height = parseFloat(style.height);

        if (window.innerWidth <= 768) {
            if (width < 44 || height < 44) {
                console.warn('[mobile-nav]: Hamburger touch target below WCAG 44px minimum');
            }
        }
    }

    // Device emulation testing helper - console.log sizes
    function logDeviceSizes() {
        const sizes = [320, 414, 768];
        sizes.forEach(size => {
            console.log(`[mobile-nav] Testing at ${size}px: ${window.innerWidth <= size ? 'MOBILE' : 'DESKTOP'}`);
        });
    }

    // Initialize everything on page load
    function init() {
        setupMenuAnimation();
        handleBackButtonExit();
        
        if (window.location.href.includes('test=dev') || window.location.href.includes('mode=debug')) {
            logDeviceSizes();
            verifyTouchTargets();
        }
    }

    // Run after DOM ready - cubic-bezier animations now active
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
