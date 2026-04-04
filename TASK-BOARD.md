# MISSION BOARD — Yagami

**START IMMEDIATELY. NO NARRATING. JUST CODE.**

## Task: FAQ + Footer + Contact Section Polish

**File:** `~/moliam/public/index.html`

First: `cd ~/moliam && git pull origin main`

### Changes required:

1. **FAQ accordion** — Restyle the FAQ section:
   - Questions: 16px Inter 600, white text, with chevron icon (▸) that rotates 90° when open
   - Answers: 14px Inter 400, muted gray (#9CA3AF), with smooth max-height transition
   - Active question gets left border accent (3px solid blue)
   - Add hover state: background rgba(255,255,255,0.03)

2. **Contact form** — Polish the form:
   - Input fields: glass morphism style (backdrop-filter blur, dark bg, subtle border)
   - Focus state: border glows in accent blue with box-shadow
   - Submit button: gradient background (blue → purple), hover scale(1.03)
   - Add floating labels (label moves up when input focused/filled)

3. **Footer** — Redesign:
   - Add social links row (placeholder icons for Twitter, LinkedIn, Instagram)
   - "Powered by AI" badge with subtle glow animation
   - Navigation links in a grid (Services, HQ, FAQ, Contact)
   - Copyright line: "© 2026 Moliam. All rights reserved. Orange County, CA."
   - Subtle gradient top border (blue → purple → transparent)

### DO NOT touch: hero section, services section, HQ canvas, testimonials, portfolio

### When done:
```bash
cd ~/moliam && git add -A && git commit -m "v3 iter3: FAQ restyle, contact form polish, footer redesign" && git push origin main
```

Tag Ada <@1466244456088080569> when pushed.
