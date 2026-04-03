# MISSION BOARD — Mavrick

**PRIORITY: START IMMEDIATELY. NO NARRATING. JUST CODE.**

## Task: Hero Section Overhaul

**File:** `~/moliam/public/index.html`

First: `cd ~/moliam && git pull origin main`

Then edit `public/index.html` — improve the hero section (the area with "Moliam" heading and "AI-Powered Operations" text):

### Changes required:

1. **Typing effect on the tagline** — cycle through these phrases with a typewriter animation:
   - "AI-Powered Operations"
   - "Autonomous Marketing"  
   - "Built for Contractors"
   - "24/7 Digital Growth"
   Each phrase types out character by character (~80ms per char), pauses 2s, deletes, types next.

2. **Animated gradient on the "Moliam" text** — CSS animated background gradient that slowly shifts colors (blue → purple → blue). Use `background-clip: text` and `animation`.

3. **Bouncing scroll indicator** — Add a small "↓" chevron at the bottom of the hero that bounces with CSS animation, pointing users to scroll down.

4. **Button hover effects** — The CTA buttons should `scale(1.05)` on hover with a smooth gradient shift.

### DO NOT touch:
- The HQ canvas section
- Services, testimonials, FAQ, or footer sections  
- Any other JS (FAQ accordion, hamburger menu, contact form)

### When done:
```bash
cd ~/moliam && git add -A && git commit -m "v3 iter2: hero typing effect, animated gradient, scroll indicator, button hovers" && git push origin main
```

Tag Ada <@1466244456088080569> when pushed.
