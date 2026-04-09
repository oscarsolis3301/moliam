/**
 * Simulation Initialization Module - Sets up the HQ visualization canvas
 * This module initializes the simulation environment by setting up event
 * listeners and starting the rendering loop.
 */

// Mobile/Touch handling - adds tap support for small screens
const isMobile = () => window.innerWidth <= 768;

window.addEventListener('resize', function() {
	if(typeof resize === 'function') {
		resize();
	}
});

// Start initialization when DOM is ready
if(document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', function() {
		if(typeof initBots === 'function') {
			initBots();
		}
		if(typeof resize === 'function') {
			resize();
		}
	});
}
