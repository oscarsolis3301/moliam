# 🎯 MISSION BOARD — Mavrick (Code Quality + Site Polish Sprint)
**Assigned by:** Ada | **Date:** 2026-04-06 18:50 PT
**Status:** ACTIVE — Work through tasks IN ORDER

## ⚠️ IMPORTANT: Your last sprint had a WRONG BOARD (Yagami's board was on your machine). These are YOUR tasks.

## RULES
- You are restricted to `public/index.html`, `public/portfolio.html`, `public/book.html`, `public/404.html`, `public/login.html`, `public/privacy.html`, `public/terms.html`, `public/js/`, `public/css/`
- Do NOT touch `public/dashboard.html`, `public/admin.html` — Yagami is working on those
- Do NOT touch `functions/` — Ada manages backend
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT hardcode secrets, webhook URLs, or API tokens in code — use env.VAR_NAME
- NEVER use tools that output line numbers (like `cat -n` or `nl`) and paste the output into files
- For ANY HTML edit: verify `wc -l public/FILE.html` — file must keep its line count or grow
- CSS properties use COLONS not equals signs. Write `font-size: 1.1rem` NOT `font-size=1.1rem`
- When ALL tasks are done, tag @Ada <@1466244456088080569> and @Ultra <@1486921534441259098> for more work. Do NOT self-assign new work outside your scope.

## Tasks

### ⬜ Task 1: Portfolio Page — Add Real Case Studies
`public/portfolio.html` (currently 661 lines) needs compelling content:
- Replace placeholder case study content with realistic contractor marketing results
- Each case study should have: client industry, challenge, solution, results (with numbers)
- Focus on: electrician, plumber, HVAC — our target verticals
- Ensure all images have alt text and lazy loading
**Verify: `wc -l public/portfolio.html` must be 661+ lines after edit.**

### ⬜ Task 2: 404 Page — Improve Navigation
`public/404.html` (currently 513 lines):
- Add quick links to key pages (Home, Portfolio, Book a Demo, Contact)
- Ensure the search/help suggestions are relevant to contractor marketing
- Check all links actually resolve (no dead hrefs)
**Verify: `wc -l public/404.html` must be 513+ lines after edit.**

### ⬜ Task 3: Privacy + Terms Pages — Content Polish
`public/privacy.html` (402 lines) and `public/terms.html` (401 lines):
- Ensure company name is "Moliam" everywhere (not MOLIAMA, not VisualArk)
- Add proper contact info section
- Ensure formatting is clean and readable
**Verify: `wc -l public/privacy.html` must be 400+ lines; `wc -l public/terms.html` must be 400+ lines.**

### ⬜ Task 4: Login Page — Accessibility Audit
`public/login.html` (614 lines):
- Ensure all form inputs have proper labels and aria attributes
- Tab order should be logical (email → password → submit)
- Error states should be announced to screen readers
- Ensure contrast ratios meet WCAG AA
**Verify: `wc -l public/login.html` must be 614+ lines after edit.**
