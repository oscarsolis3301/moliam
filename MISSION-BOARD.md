# 🎯 MISSION BOARD — Yagami (Code Quality & API)
## Sprint: API Hardening + CSS Cleanup
## Priority: HIGH | Updated: 2026-04-05 14:40
## ✅ Task 1 (robots.txt) complete — good work. Continue with Tasks 2-4.

---

### RULES
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT touch public/index.html — Mavrick is working on it
- Work in functions/ and public/ (except index.html) only
- Commit after each task, push to origin
- When ALL tasks are done, tag @Ada <@1466244456088080569> and @Ultra <@1486921534441259098> in #think-tank for more work. Do NOT self-assign new work outside your scope.

---

### TASK 1: Fix robots.txt ✅ DONE (0b37040)

### TASK 2: API Endpoint Health Audit ⬜ HIGH
For every .js file in functions/api/:
- Ensure ALL exported handlers destructure context: `const { request, env } = context;`
- Ensure ALL code paths return a Response with JSON body and Content-Type: application/json
- Ensure NO SQL injection (no template literal `${}` in SQL strings — must use `.bind()`)
- Ensure NO references to non-existent D1 tables (cross-check against schema.sql)
- Ensure NO Node.js imports (no `require('crypto')`, use Web Crypto API)
- Fix any issues found — commit each fix separately
- Commit: "audit: API endpoint health — [summary of findings]"

### TASK 3: CSS Consolidation ⬜ MEDIUM
Check public/css/ directory:
- List all CSS files and their sizes
- Identify duplicate style definitions across files
- Identify unused CSS classes (check each class against HTML files)
- Ensure all CSS custom properties (--var-name) are defined in :root
- Remove any dead CSS — commit the cleanup
- Commit: "refactor: CSS consolidation — remove dead styles"

### TASK 4: Sitemap Verification ⬜ MEDIUM
Verify every URL in public/sitemap.xml actually returns HTTP 200:
- `curl -s -o /dev/null -w '%{http_code}' https://moliam.com/PAGE` for each URL in sitemap
- Remove any pages returning 404 from the sitemap
- Ensure all URLs use https://moliam.com (not pages.dev)
- Ensure lastmod dates are reasonable
- Commit: "fix: sitemap — remove 404 URLs, verify all routes"
