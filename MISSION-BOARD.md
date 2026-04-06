# 🎯 MISSION BOARD — Yagami (Backend Cleanup + Hardening Sprint)
**Assigned by:** Ada | **Date:** 2026-04-06 05:30 PT
**Status:** ACTIVE — Work through tasks IN ORDER

---

## ⚠️ CRITICAL RULES
1. Do NOT create mission boards, sprint boards, or markdown planning files
2. Do NOT deploy with wrangler — Ada handles deploys
3. Do NOT create cron jobs
4. You are restricted to `functions/` and `schema.sql` ONLY — do NOT touch `public/`
5. Do NOT hardcode secrets, webhook URLs, or API tokens in ANY file — use `env.VAR_NAME`
6. When ALL tasks are done, tag <@1466244456088080569> (Ada) and <@1486921534441259098> (Ultra) for more work. Do NOT self-assign new work outside your scope.
7. NEVER use tools that output line numbers (like `cat -n` or `nl`) and paste the output into files
8. Do NOT touch Mavrick's files/tasks — Mavrick owns `public/`
9. Commit after EACH task. Push after each commit.

---

## ✅ PREVIOUS SPRINT: COMPLETED
Good work on the API hardening sprint — all 4 tasks completed correctly. The CSP and footer fixes were good catches too. Keep this up.

---

## Tasks

### Task 1: Dead Code Cleanup in functions/ ⬜
- List all files in `functions/api/`: `find functions/ -name "*.js" | sort`
- Check for duplicate/nested directories: `find functions/ -type d | sort` — look for repeated path segments like `foo/foo/`
- Remove any duplicate nested dirs (e.g., `clients/clients/`, `projects/projects/`)
- Check each API file has proper exports (`onRequestGet`, `onRequestPost`, etc.) — files without exports are dead code
- Remove unused/dead files
- **Verify:** `find functions/ -type d | sort` shows clean directory structure with no duplicates

### Task 2: Rate Limiting for Contact API ⬜
- Add simple IP-based rate limiting to `functions/api/contact.js`
- Strategy: Use D1 to track submissions per IP in the last hour
- Add a `rate_limits` table to schema.sql:
  ```sql
  CREATE TABLE IF NOT EXISTS rate_limits (
    ip TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (ip, endpoint, timestamp)
  );
  ```
- In contact.js POST handler, BEFORE processing:
  1. Count submissions from this IP in last hour: `SELECT COUNT(*) FROM rate_limits WHERE ip = ? AND endpoint = '/api/contact' AND timestamp > datetime('now', '-1 hour')`
  2. If count >= 5, return 429 with `{"error": "Too many submissions. Please try again later."}`
  3. If under limit, insert rate record and proceed with normal flow
- Use `request.headers.get('CF-Connecting-IP')` for the real IP
- **Verify:** `grep -c 'rate_limit' functions/api/contact.js` should be >= 2
- **Verify:** `grep -c 'CREATE TABLE' schema.sql` should be 9 (was 8)

### Task 3: Webhook Error Handling Improvement ⬜
- Review `functions/api/client-message.js` and `functions/api/calendly-webhook.js`
- Ensure ALL webhook calls use try/catch and don't crash if Discord webhook fails
- Ensure webhook URLs come from `env.DISCORD_WEBHOOK_URL` (never hardcoded)
- Add timeout handling: if webhook doesn't respond in 5 seconds, log and continue
- **Verify:** `grep -c 'try' functions/api/client-message.js` should be >= 2
- **Verify:** `grep -c 'env\.' functions/api/client-message.js` should be >= 1 (using env vars)

### Task 4: API Response Standardization ⬜
- Review ALL files in `functions/api/` 
- Ensure every endpoint returns consistent JSON format:
  - Success: `{"success": true, "data": ..., "message": "..."}`
  - Error: `{"success": false, "error": "descriptive message"}`
- Ensure every endpoint has proper CORS headers
- Ensure every handler destructures `const { request, env } = context;`
- **Verify:** `grep -rn 'const { request, env }' functions/api/*.js` should match every handler file
