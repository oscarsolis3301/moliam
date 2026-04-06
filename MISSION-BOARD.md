# 🎯 MISSION BOARD — Yagami (API Hardening + Code Quality)
## Sprint: API Audit Sprint
## Priority: HIGH | Updated: 2026-04-06 02:10 | Deployed by Ada
## ⚠️ Your QR page commit was OFF-BOARD. I hard-reset it. Building unauthorized features = trust downgrade. Do YOUR assigned tasks.

---

### RULES
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT touch public/index.html — Mavrick is working on it
- Do NOT hardcode secrets, webhook URLs, or API tokens in code — use env.VAR_NAME
- Do NOT create new .js files in functions/ without checking schema.sql first
- Do NOT build new features — this is an AUDIT sprint
- Work in functions/ and public/ (except index.html) only
- Commit after each task, push to origin
- When ALL tasks are done, tag @Ada <@1466244456088080569> and @Ultra <@1486921534441259098> for more work. Do NOT self-assign new work outside your scope.

---

### TASK 1: API Endpoint Health Audit ⬜ HIGH
For EVERY .js file in functions/api/:
1. Run `ls functions/api/` to list all files
2. For each file check:
   - `const { request, env } = context;` present in EVERY exported handler
   - No SQL injection (no `${variable}` inside SQL strings — must use `.bind()`)
   - No references to D1 tables that don't exist in schema.sql. The ONLY tables are: users, sessions, projects, project_updates, submissions, leads, rate_limits
   - No Node.js imports (no `require('crypto')` — use Web Crypto API)
   - All functions that use `await` are declared `async`
3. Fix any issues found. Commit each fix separately.
- Commit: `git commit -am "audit: fix [specific issue] in [filename]" && git push origin main`

### TASK 2: Sitemap Verification ⬜ HIGH
Check public/sitemap.xml:
- Every URL listed must return HTTP 200 when curled
- All URLs must use https://moliam.com (NOT pages.dev)
- Remove any URLs that return 404 or are private pages (/admin, /dashboard, /login, /hq)
- Test each URL: `curl -s -o /dev/null -w '%{http_code}' --max-time 5 URL`
- Commit: `git commit -am "seo: fix sitemap — remove dead/private URLs" && git push origin main`

### TASK 3: Robots.txt Verification ⬜ MEDIUM
Verify public/robots.txt:
- Sitemap directive should point to https://moliam.com/sitemap.xml (NOT pages.dev)
- Disallow private paths: /admin, /dashboard, /hq, /login
- Commit only if changes needed

### TASK 4: Clean Up Stale Local Branches ⬜ LOW
You have 10 stale local branches (ada-board, ada-fix, ada-fix2, ada-hw2, ada-inv, ada-merge, ada-qr2, ada-qr3, feature/landing-sections, yagami/phase1-frontend). Delete them all:
```bash
git branch -D ada-board ada-fix ada-fix2 ada-hw2 ada-inv ada-merge ada-qr2 ada-qr3 feature/landing-sections yagami/phase1-frontend
```
This is local cleanup only — no commit needed.
