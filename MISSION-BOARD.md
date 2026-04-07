# 🎯 MISSION BOARD — Yagami (Dashboard + Admin Polish Sprint)
**Assigned by:** Ada | **Date:** 2026-04-06 17:15 PT
**Status:** ACTIVE — Work through tasks IN ORDER

## RULES
- You are restricted to `public/dashboard.html` and `public/admin.html` ONLY
- Do NOT touch `functions/`, `schema.sql`, `public/index.html`, `public/portfolio.html`, `public/book.html`, `public/404.html`, `public/login.html`, `public/privacy.html`, `public/terms.html`
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT touch Mavrick's files/tasks (Mavrick is working on index, portfolio, book, 404)
- Do NOT hardcode secrets, webhook URLs, or API tokens in code — use env.VAR_NAME
- NEVER use tools that output line numbers (like `cat -n` or `nl`) and paste the output into files
- When ALL tasks are done, tag @Ada and @Ultra for more work. Do NOT self-assign new work outside your scope.

## Tasks

### ⬜ Task 1: Dashboard Dark Theme Consistency
`public/dashboard.html` needs consistent dark theme styling:
- Ensure all cards/panels use the same dark background palette (bg #0B0E14 or #1F2937)
- Consistent border colors (rgba(55, 65, 81, 0.5) or #374151)
- Consistent border-radius (14px for cards)
- Text colors: primary #F9FAFB, secondary #9CA3AF
- ADD/FIX CSS variables inside the existing `<style>` block — do NOT add new style blocks outside `<style>` tags
**CRITICAL: CSS properties use COLONS not equals signs. Write `font-size: 1.1rem` NOT `font-size=1.1rem`.**
**Verify: `wc -l public/dashboard.html` must remain 1900+ lines after edit.**

### ⬜ Task 2: Dashboard — Mobile Responsiveness
Make the dashboard usable on tablets (768px-1024px):
- Sidebar should collapse to a hamburger menu below 768px
- Cards should stack vertically on small screens
- Tables should be horizontally scrollable on mobile
- Touch-friendly button/link sizes (min 44x44px)
**ADD media queries inside the existing `<style>` block.**
**Verify: `wc -l public/dashboard.html` must remain 1900+ lines after edit.**

### ⬜ Task 3: Admin Panel — Loading States
`public/admin.html` needs better UX for data loading:
- Add skeleton loading placeholders for tables and cards
- Add a spinner/loading indicator for API calls
- Add error state displays (friendly error messages when API fails)
- All new CSS goes inside the existing `<style>` block
**Verify: `wc -l public/admin.html` must remain 1800+ lines after edit.**

### ⬜ Task 4: Admin Panel — Data Table Enhancements
Improve the admin data tables in `public/admin.html`:
- Add sortable column headers (click to sort asc/desc)
- Add pagination controls (Previous/Next, page numbers)
- Add a search/filter input above tables
- Keep it client-side only — no new API calls needed
**Verify: `wc -l public/admin.html` must remain 1800+ lines after edit.**

## Commit after EACH task. Include line count verification in commit message.
