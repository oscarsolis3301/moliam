# 🎯 MISSION BOARD — Mavrick (Frontend & Performance)
## Sprint: Performance + Mobile Polish
## Priority: HIGH | Updated: 2026-04-05 19:00

---

### RULES
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT touch functions/ or API code — Yagami handles that
- ONLY work in public/ directory (HTML, CSS, images, static files)
- Read DESIGN.md before making UI changes
- Commit after each task, do NOT push
- When ALL tasks done, write MAVRICK COMPLETE to ~/MISSION-COMPLETE.txt

---

### TASK 1: Compress Large Images ⬜ HIGH
The image audit found logo.png at 622KB and favicon-512.png at 262KB.
- Use sips to compress: `sips -s format png -s formatOptions 80 public/logo.png --out public/logo.png`
- Target: logo.png under 100KB, favicon-512 under 50KB
- Generate WebP versions of all PNG images: `sips -s format com.google.webp FILE --out FILE.webp`
- Add `<picture>` elements with WebP sources + PNG fallback for hero images
- Verify pages still render correctly after compression
- Commit: "perf: compress images, add WebP variants"

### TASK 2: Mobile Responsive Audit ⬜ HIGH
Test every page at 375px width (mobile):
- Run: `grep -rn '@media' public/css/*.css` to see existing breakpoints
- Check index.html: hero section, services grid, testimonials, contact form, footer
- Check book.html: Calendly embed responsiveness
- Check portfolio.html, privacy.html, terms.html
- Fix any overflow, text too small, buttons too close together
- Ensure tap targets are at least 44x44px
- Commit: "fix: mobile responsive fixes"

### TASK 3: Page Load Performance ⬜ MEDIUM
- Add `loading="lazy"` to all images below the fold
- Add `fetchpriority="high"` to hero/above-fold images
- Minify inline CSS if any is over 5KB
- Add `<link rel="preconnect" href="https://fonts.googleapis.com">` if Google Fonts used
- Check for render-blocking resources
- Commit: "perf: lazy loading, preconnect, above-fold priority"

### TASK 4: Accessibility Pass ⬜ MEDIUM
- Ensure all images have descriptive alt text (not just "image" or empty)
- Ensure all form inputs have associated labels
- Check color contrast on key text (use computed styles)
- Add aria-labels to icon-only buttons
- Ensure skip-to-content link exists
- Commit: "a11y: accessibility improvements"
