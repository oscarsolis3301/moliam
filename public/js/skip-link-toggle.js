// Enable skip link if JS loaded - Enhanced with focus management
document.addEventListener('DOMContentLoaded', function() {
  // Remove no-js class for proper styling
  document.body.classList.remove('no-js');
  
  // Focus the skip link on first Tab press (if user navigates via keyboard)
  var handleFirstTab = function(e) {
    if (e.key === 'Tab') {
      var skipLink = document.querySelector('.skip-to-content');
      if (skipLink) {
        skipLink.classList.add('focus-skip-link');
      }
      document.removeEventListener('keydown', handleFirstTab);
    }
  };
  document.addEventListener('keydown', handleFirstTab);
  
  // Clean up on blur to maintain unobtrusive UI
  var cleanupSkipFocus = function() {
    var skipLink = document.querySelector('.skip-to-content');
    if (skipLink) {
      skipLink.classList.remove('focus-skip-link');
    }
  };
  document.addEventListener('click', cleanupSkipFocus);
});
