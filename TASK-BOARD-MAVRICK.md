# MISSION BOARD — Deployed by Ada on 2026-04-03 — authorized by Roman
# MAVRICK TASKS — moliam.com v3 Production Sprint (Iterations 4-6)

## CONTEXT
You are working on /Users/clark/moliam/public/index.html — the Moliam agency landing page.
The site is a Cloudflare Pages project. Ada handles deploys. You handle code changes.
Current state: iterations 1-3 are done (hero typing effect, services 3D tilt, testimonials, FAQ).
We need iterations 4-6 NOW. Each must be a visible, meaningful upgrade.

## YOUR TASKS (do them IN ORDER)

### TASK 1: Hero Section Overhaul (Iteration 4)
File: `public/index.html` — edit the `#hero` section and its CSS

Changes needed:
1. Make the h1 font-size bigger: `clamp(48px, 7vw, 84px)` instead of current `clamp(40px, 6vw, 72px)`
2. Add a subtle animated gradient mesh background to the hero using CSS — a slow-moving radial gradient that shifts between deep blue, purple, and dark teal
3. Make the CTA button ("Book a Demo") glow more intensely: `box-shadow: 0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(139,92,246,0.3)`
4. Add a floating badge above the h1: `<div class="trust-badge">🏆 Trusted by OC Contractors</div>` styled as a small pill with amber border
5. Below the tagline, add 3 small stat counters in a row: "72hr Delivery" | "5.0★ Client Rating" | "24/7 AI Monitoring" — each with a small icon

### TASK 2: Contact Form Enhancement (Iteration 4b)
File: `public/index.html` — edit the contact/CTA section

Changes needed:
1. Add a phone number field to the contact form
2. Add a service dropdown: Website Build, GBP Optimization, LSA Management, Full Retainer
3. Style the form inputs with focus states that glow blue
4. Add form validation visual feedback (red border on empty required fields)

### TASK 3: Pricing Section Upgrade (Iteration 5 prep)
File: `public/index.html` — find or create the pricing section

Create/improve a pricing section with 3 tiers:
- **Starter**: $600 one-time + $150/mo — Website build + monthly support
- **Growth**: +$300/mo — Add GBP optimization (month 2)
- **Scale**: +$500 setup + $400/mo — Add LSA management (month 3)
- **Full Retainer**: $1,500/mo — Everything included
Highlight the "Growth" tier as "Most Popular"
Each card: glass background, gradient border on hover, clear feature list with checkmarks

## GIT WORKFLOW
After EACH task:
```bash
cd ~/moliam
git add -A
git commit -m "v3 iter4: [description of what changed]"
git push origin main
```

## RULES
- Do NOT touch `public/js/` files — those are separate modules, don't break them
- Do NOT touch `public/hq.html` or `public/portfolio.html`
- Keep all changes in `public/index.html` (inline styles are fine for now)
- Test your HTML is valid: no unclosed tags, no orphaned script blocks
- When done with ALL 3 tasks, say "MAVRICK TASKS COMPLETE" in chat
