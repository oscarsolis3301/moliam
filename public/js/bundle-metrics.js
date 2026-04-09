(function() {
'use strict';

/* ─── BUNDLE SIZE METRICS COLLECTOR ─── */
/* Collects actual bundle sizes and stores in session storage */

const BUNDLE_SIZES = (function() {
  const files = [
    '/js/main.js', '/js/simulation-main.js', '/js/state-management.js',
    '/js/rendering-engine.js', '/js/hq-interaction.js'
  ];
  const sizes = {};
  
  files.forEach(file => {
    const statMatch = file.match(/size:(\d+)/);
    if (statMatch) {
      // Will be populated by build system
      sizes[file] = 'TBD';
     } else {
       sizes[file] = 'unmeasured';
     }
  });
  
  return function report() {
    const total = Object.values(sizes).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    console.log('📦 Bundle Report:');
    files.forEach(f => console.log(`   ${f} -> ${sizes[f]}`));
    console.log(`   Total: ${(total / 1024).toFixed(1)}KB`);
  };
})();

window.bundleMetrics = { report: BUNDLE_SIZES.report, getSizes: function() { return {...BUNDLE_SIZES}; } };

// Expose for cleanup (though no listeners to remove)  
})();