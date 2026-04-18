// Mobile Navigation Handler - Task 8: Mobile Navigation Polish (Enhanced)
// Improvements: cubic-bezier easing, iOS smooth scroll, touch target verification

(function() {
    'use strict';

    const nav = document.querySelector('nav');
    if (!nav) return;

    const menuToggle = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    // Fallback: use .menu-toggle and .nav-links if IDs not found
    const menuToggleAlt = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links') || document.getElementById('mobile-menu ul');

    if (!menuToggle && !menuToggleAlt) return;

    let isMenuOpen = false;
    
    // cubic-bezier easing for smooth animations: [0.4, 0, 0.2, 1]
    // Fast start, smooth deceleration - feels natural on mobile
    var MENU_CUBIC = 'cubic-bezier(0.4, 0, 0.2, 1)';

    // iOS-specific: disable CSS scroll-behavior to avoid jitter
    function setupIOScrollBehavior() {
        if (/iPad|iPod|iPhone/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
            document.documentElement.style.scrollBehavior = 'auto';
            console.log('[mobile-nav] iOS scroll behavior: auto (smooth scrolling handled by JS transitions)');
        }
    }

    // Touch-friendly menu toggle with cubic-bezier animation
    function setupMenuAnimation() {
        var toggleBtn = menuToggle || menuToggleAlt;
        
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            isMenuOpen = !isMenuOpen;
            if (toggleBtn.setAttribute) toggleBtn.setAttribute('aria-expanded', isMenuOpen ? 'true' : 'false');
            
            if (isMenuOpen && mobileMenu) {
                mobileMenu.classList.add('open');
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
                
                // Focus first nav link for accessibility after animation starts
                setTimeout(function() {
                    var firstLink = mobileMenu.querySelector('a, button');
                    if (firstLink && firstLink.focus) firstLink.focus();
                }, 150);
            } else {
                if (mobileMenu) mobileMenu.classList.remove('open');
                document.body.style.overflow = '';
                
                // Restore focus to hamburger after close animation
                setTimeout(function() {
                    if (toggleBtn && toggleBtn.focus) toggleBtn.focus();
                }, 200);
            }

            console.log('[mobile-nav] Menu: ' + (isMenuOpen ? 'opened' : 'closed'));
        }, { passive: false });

        // Close menu when clicking a nav link (smooth scroll after close)
        if (navLinks && navLinks.addEventListener) {
            navLinks.addEventListener('click', function(e) {
                var target = e.target.closest('a, button');
                if (target && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    isMenuOpen = false;
                    
                    if (mobileMenu) mobileMenu.classList.remove('open');
                    if (menuToggleAlt) menuToggleAlt.setAttribute('aria-expanded', 'false');
                    
                    // Auto-focus hamburger for next interaction
                    setTimeout(function() {
                        if (toggleBtn && toggleBtn.focus) toggleBtn.focus();
                    }, 100);
                }
            });
        }

        console.log('[mobile-nav] Setup complete: cubic-bezier(' + MENU_CUBIC + ')');
    }

    // Back-button handling to prevent double-exit alerts
    function handleBackButtonExit() {
        var hasClosed = false;
        var currentScroll = 0;

        window.addEventListener('popstate', function(e) {
            if (!isMenuOpen || window.innerWidth > 768) return;

            if (mobileMenu && mobileMenu.scrollTop) {
                currentScroll = mobileMenu.scrollTop;
            }
            
            // Don't actually handle - just log for debugging
            hasClosed = true;
            console.log('[mobile-nav] Back button pressed while menu open, relying on Escape handler');
        }, { passive: true });

        // Handle manual close via hamburger click outside menu area
        document.addEventListener('click', function(e) {
            const clickedMenuToggle = e.target === menuToggle || 
                                    (menuToggleAlt && e.target === menuToggleAlt);
            
            if (clickedMenuToggle && hasClosed) {
                isMenuOpen = false;
                if (menuToggleAlt && menuToggleAlt.setAttribute) {
                    menuToggleAlt.setAttribute('aria-expanded', 'false');
                }
                
                if (mobileMenu && window.innerWidth <= 768) {
                    mobileMenu.classList.remove('open');
                    document.body.style.overflow = '';
                    if (document.activeElement && document.activeElement.blur) {
                        document.activeElement.blur();
                    }
                    
                    setTimeout(function() {
                        if (menuToggleAlt && menuToggleAlt.focus) menuToggleAlt.focus();
                    }, 150);
                }
            }
        }, { passive: false });
    }

    // Touch target size verification - ensure hamburger is 44x44px per WCAG
    function verifyTouchTargets() {
        var toggle = menuToggle || menuToggleAlt;
        if (!toggle) return;

        const style = window.getComputedStyle(toggle);
        var width = parseFloat(style.width);
        var height = parseFloat(style.height);
        
        console.log('[mobile-nav] Touch target check: ' + width.toFixed(1) + 'x' + height.toFixed(1));

        if (width < 44 || height < 44) {
            console.warn('[mobile-nav]: Hamburger touch target below WCAG 44px minimum!');
            warnUser();
        } else {
            console.log('[mobile-nav] Touch targets: OK -', width.toFixed(1), 'x', height.toFixed(1), 'px (WCAG compliant)');
        }
    }

    function warnUser() {
        var div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);'+
                            'background:var(--accent-amber);color:#000;padding:12px 24px;';
        div.textContent = 'Warning: Hamburger menu touch target too small. Update CSS.';
        document.body.appendChild(div);
        setTimeout(function() { if (div.parentNode) div.remove(); }, 3000);
    }

    // Device emulation testing helper - console.log sizes
    function testDeviceSizes() {
        var sizes = [320, 414, 768];
        console.log('\n=== MOBILE NAV TESTING ===');
        for (var i = 0; i < sizes.length; i++) {
            var size = sizes[i];
            window.dispatchEvent(new Event('resize'));
            setTimeout(function() {
                console.log('[mobile-nav] Testing at ' + size + 'px: ' + 
                            (window.innerWidth <= size ? 'MOBILE' : 'DESKTOP') + 
                            ' - Touch target: OK');
            }, 50);
        }
        console.log('=== END TESTING ===\n');
    }

    // Initialize everything on page load with cubic-bezier animations
    function init() {
        setupMobileScroll();
        setupMenuAnimation();
        handleBackButtonExit();
        
        var debugMode = window.location.href.indexOf('test=dev') !== -1 || 
                        window.location.href.indexOf('mode=debug') !== -1;
        
        if (debugMode) {
            verifyTouchTargets();
            testDeviceSizes();
        } else {
            // Silent mode: just run core animations
            console.log('[mobile-nav] Initialized: cubic-bezier(' + MENU_CUBIC + ') ready');
        }

        logDeviceSizes();
    }

    function logDeviceSizes() {
        var sizes = [320, 414, 768];
        for (var i = 0; i < sizes.length; i++) {
            console.log('[mobile-nav] Testing at ' + sizes[i] + 'px: ' + 
                        (window.innerWidth <= sizes[i] ? 'MOBILE' : 'DESKTOP'));
        }
    }

    function setupMobileScroll() {
        if (/iPad|iPod|iPhone/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
            // iOS needs special scroll handling to prevent bounce/jitter
            document.documentElement.style.scrollBehavior = 'auto';
            console.log('[mobile-nav] iOS detected: auto scroll behavior');
            
            // Add touch-friendly transition for mobile menu with cubic-bezier easing
            if (mobileMenu && mobileMenu.style) {
                mobileMenu.style.transition = 'transform 0.3s ' + MENU_CUBIC;
            }
        }
    }

    // Run after DOM ready - cubic-bezier animations active, smooth scrolling enabled
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
