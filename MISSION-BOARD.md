# 🎯 MISSION BOARD — Yagami (Backend Hardening Sprint)
**Assigned by:** Ada | **Date:** 2026-04-06 12:20 PT
**Status:** ACTIVE — Work through tasks IN ORDER

## ⚠️ YOUR LAST BOARD WAS WRONG (cross-contamination — you had Mavrick's board). This is your CORRECT board.

## RULES
- You are restricted to `functions/` and `schema.sql` ONLY — do NOT touch `public/`
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT hardcode secrets, webhook URLs, or API tokens in code — use `env.VAR_NAME`
- Do NOT touch Mavrick's files/tasks — Mavrick owns `public/`
- NEVER use tools that output line numbers (like `cat -n` or `nl`) and paste the output into files
- When ALL tasks are done, tag <@1466244456088080569> (Ada) and <@1486921534441259098> (Ultra) for more work. Do NOT self-assign new work outside your scope.
- Commit after EACH task. Push after each commit.

---

## Tasks

### ⬜ Task 1: Fix schema.sql Index Formatting
The CREATE INDEX statements at the bottom of `schema.sql` were recently corrupted — multiple statements collapsed onto single lines with literal `\n` characters. Verify the current state and ensure:
- Each `CREATE INDEX IF NOT EXISTS` is on its own line
- No literal `\n` strings in the file
- All indexes are syntactically valid SQLite
- Add these compound indexes if missing (each on its own line):
  - `CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip, endpoint);`
  - `CREATE INDEX IF NOT EXISTS idx_contacts_email_source ON contacts(email, source);`
  - `CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);`
**Verify:** `grep -c 'CREATE INDEX' schema.sql` should be >= 9

### ⬜ Task 2: Dead Code Audit in functions/
Scan ALL files in `functions/api/` for:
- Imports that reference non-existent modules — check every `import ... from` path exists: `ls functions/api/PATH`
- Functions defined but never called within the same file
- Routes/endpoints that reference D1 tables NOT in `schema.sql` — cross-check: `grep -oP '(?:FROM|INTO|UPDATE)\s+(\w+)' FILE | sort -u` against tables in schema.sql
- Any `console.log` debug statements that should be removed
Fix issues found. Document what you removed in commit messages.
**Verify:** `find functions/ -name '*.js' -exec grep -l 'import.*from' {} \;` — every import path must resolve

### ⬜ Task 3: contact.js Security Review
Review `functions/api/contact.js` (271 lines) for:
- Any SQL injection via template literals (`${...}` inside SQL strings) — must use `.bind()`
- Rate limiting logic correctness (the try/catch cleanup pattern)
- Input validation completeness (name, email, message fields)
- Error handling — ensure no raw error messages leak to client
- The `env.DISCORD_WEBHOOK_URL` fallback is currently `""` (empty string) — this is CORRECT, do NOT change it to a hardcoded URL
Make targeted fixes only. Do NOT rewrite the entire file.
**Verify:** `grep -c '${' functions/api/contact.js` — should be 0 inside SQL strings (template literal interpolation in SQL = injection)

### ⬜ Task 4: Health Endpoint
Create `functions/api/health.js` — a simple GET endpoint that returns:
```json
{"status": "ok", "timestamp": "ISO-8601", "version": "1.0"}
```
- Must destructure `context` properly: `const { env } = context;`
- No database queries needed — just return status
- Use standard Response object, not any imported helpers
**Verify:** `wc -l functions/api/health.js` should be 15-30 lines (keep it simple)
