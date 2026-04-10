
## HQ Visualization System Optimization Plan

### Current State (1057 lines / 36KB)
- Inline color definitions (hardcoded throughout)
- No code splitting or lazy loading
- Demo sequences fully pre-defined
- Event logs duplicated per bot instance

### Proposed Optimizations:

1. **Color Consolidation (~40 lines savings)**
   - Extract CSS variables from hq.html to reuse here
   - Reduce redundant color declarations

2. **Demo Sequence Lazy Loading (~120 lines savings)**
   - Only load active sequences, not pre-defined all
   - Remove static demo sequence arrays

3. **Shared Event Log Buffer (~60 lines savings)**
   - Single event buffer instead of per-bot logs
   - Reduce memory allocation overhead

4. **Mobile Breakpoint Extraction (~180 lines from hq.html)**
   - Move media queries to dedicated CSS file
   - Remove 185 lines inline in hq.html

### Expected Result: ~400 lines removed total
- hq-canvas-engine.js: ~640 lines
- new hq-mobile.css: ~180 lines (moved from hq.html)
