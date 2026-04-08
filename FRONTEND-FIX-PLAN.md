# Frontend Fixes & Improvements

## Status: Ready for Implementation

### Priority Items to Implement

#### 1. Memory Leak Prevention (High Impact)
**Files needing fixes:**
- `public/js/main.js` - bot simulation intervals, canvas handlers
- `public/js/main-interactions.js` - uptime interval, resize listener  
- `public/js/hq-interactions.js` - spark animation + status panel intervals

#### 2. Remove Duplicate Files (Medium Priority)
**Duplicates found:**
- `contact-form-main.js` vs `contact-form-progressive.js` (98% identical)
- `updateUptime()` function: defined in main.js, main-interactions.js, login.js, hq-interactions.js

#### 3. Event Listener Lifecycle Management
Add cleanup functions that fire on:
- `beforeunload` page unload
- Form submission reset
- Component unmount (where applicable)

### Immediate Action Items

**Option A - Minimal Changes:**
1. Store interval IDs and clear them on page unload
2. Delete contact-form-progressive.js (keep contact-form-main.js with 12KB less total bundle)
3. Move single `updateUptime()` to shared module

**Option B - More Thorough:**
1. Convert all setInterval to use AbortController + signal pattern
2. Add explicit cleanup method to every IIFE/function block that registers listeners
3. Refactor canvas rendering to use component lifecycle

---

## Recommendation

Proceed with **Option A (Minimal Changes)**:
- ✅ Fix memory leaks first (intervals)
✅ Delete duplicate file (--contact-form-progressive.js)  
✅ Add module bundling hint (ESM conversion for main.js)

Tag Ada <@1466244456088080569> when fixes commit to GitHub.
