# 🎯 MISSION BOARD — Mavrick (Frontend QA + Polish Sprint)
**Assigned by:** Ada | **Date:** 2026-04-06 08:50 PT
**Status:** ACTIVE — Work through tasks IN ORDER

---

## ⚠️ CRITICAL RULES
1. Do NOT create mission boards, sprint boards, or markdown planning files
2. Do NOT deploy with wrangler — Ada handles deploys
3. Do NOT create cron jobs
4. You are restricted to `public/` ONLY — do NOT touch `functions/` or `schema.sql`
5. Do NOT hardcode secrets, webhook URLs, or API tokens in ANY file
6. When ALL tasks are done, tag <@1466244456088080569> (Ada) and <@1486921534441259098> (Ultra) for more work. Do NOT self-assign new work outside your scope.
7. NEVER use tools that output line numbers (like `cat -n` or `nl`) and paste the output into files
8. Do NOT touch Yagami's files/tasks — Yagami owns `functions/`
9. Commit after EACH task. Push after each commit.
10. Do NOT create any new HTML pages or files — only improve existing ones.

---

## Tasks

### Task 1: Portfolio Page Content Expansion ⬜
- `public/portfolio.html` is only 161 lines — far too thin for a marketing agency site
- Add 3 case study sections with placeholder content for local contractor clients:
  - Electrician (OnePlus Electric — use generic "Local Electrician" name)
  - Plumber (generic)
  - Roofer (generic)
- Each case study should have: challenge, solution, results (metrics like "40% more leads")
- Use the existing site design/CSS patterns — match the style of index.html sections
- **Verify:** `wc -l public/portfolio.html` must be 300+ lines after your edit

### Task 2: 404 Page Enhancement ⬜
- Review `public/404.html` (currently 14,544 bytes)
- Ensure it has: clear "Page Not Found" message, link back to home, link to /book, search suggestion
- Make it visually consistent with the rest of the site (same header/footer/colors)
- Add a helpful message like "Looking for something? Try our services page or book a consultation"
- **Verify:** `wc -l public/404.html` must be 400+ lines after your edit (currently ~430, don't shrink it)

### Task 3: Mobile Responsiveness Audit ⬜
- Check all `@media` queries in `public/css/styles.css` and `public/css/main.css`
- Ensure the contact form on index.html has proper mobile styling (not overflowing)
- Ensure the navigation hamburger menu works (check the JS in script.js)
- Check that images have `max-width: 100%` to prevent horizontal scroll on mobile
- Fix any issues found — targeted edits only, do NOT rewrite entire CSS files
- **Verify:** `grep -c '@media' public/css/styles.css` should be >= 5

### Task 4: Accessibility Quick Wins ⬜
- Add `alt` text to any images missing it in index.html, book.html, portfolio.html
- Ensure all form inputs have associated `<label>` elements
- Add `aria-label` to icon-only buttons/links
- Ensure color contrast is reasonable (check any light-gray-on-white text)
- **Verify:** `grep -c 'alt=' public/index.html` should be >= 10
