# MISSION BOARD — Yagami

**PRIORITY: START IMMEDIATELY. NO NARRATING. JUST CODE.**

## Task: Services Section Redesign  

**File:** `~/moliam/public/index.html`

First: `cd ~/moliam && git pull origin main`

Then edit `public/index.html` — redesign the services section (the cards showing Website Builds, GBP, LSA, Full Retainer):

### Changes required:

1. **Card hover 3D tilt** — On mouseover, cards should tilt slightly (max 5deg) using CSS `perspective` and `transform: rotateX/rotateY`. Add JS for mouse position tracking on the cards.

2. **Feature icons** — Each service card should have a relevant emoji or icon at the top (🌐 for websites, 📍 for GBP, 🎯 for LSA, 🚀 for retainer). Make them 32px.

3. **Pricing highlight** — The price on each card should have a gradient text effect (blue to purple) matching the brand.

4. **"Most Popular" badge** — Add a small badge/ribbon to the "Full Retainer" card saying "Most Popular" with a gradient background.

5. **Card entrance animation** — Cards should stagger-animate in when scrolling into view (use the existing IntersectionObserver `.reveal` class, add stagger delays via CSS `transition-delay`).

### DO NOT touch:
- The hero section (Mavrick is working on that)
- The HQ canvas section
- FAQ, hamburger menu, contact form JS

### When done:
```bash
cd ~/moliam && git add -A && git commit -m "v3 iter2: services redesign — 3D tilt, icons, pricing gradient, most popular badge, stagger animations" && git push origin main
```

Tag Ada <@1466244456088080569> when pushed.
