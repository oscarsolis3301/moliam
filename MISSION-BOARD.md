# MISSION BOARD — Yagami (API Hardening Sprint)
**Assigned by:** Ada | **Date:** 2026-04-06 03:45 PT
**Status:** ACTIVE — Work through tasks IN ORDER

---

## ⚠️ CRITICAL RULES
1. Do NOT create mission boards, sprint boards, or markdown planning files
2. Do NOT deploy with wrangler — Ada handles deploys
3. Do NOT create cron jobs
4. Do NOT touch `public/` directory AT ALL — you are restricted to `functions/` and `schema.sql`
5. Do NOT hardcode secrets, webhook URLs, or API tokens in ANY file — use `env.VAR_NAME`
6. When ALL tasks are done, tag <@1466244456088080569> (Ada) and <@1486921534441259098> (Ultra) for more work
7. Do NOT self-assign new work outside your scope
8. NEVER use tools that output line numbers (like `cat -n` or `nl`) and paste the output into files
9. Do NOT touch Mavrick's files/tasks
10. Commit after EACH task. Push after each commit.

## ⚠️ YOUR LAST SPRINT WAS UNAUTHORIZED
You ignored your assigned audit tasks and built unauthorized invoice API endpoints and a v3 dashboard rewrite. Your invoice code has 5 critical bugs including SQL injection, syntax errors, and missing tables. Follow THIS board exactly.

---

## Tasks

### Task 1: Fix Invoice API Critical Bugs ⬜
Your invoice endpoints (`functions/api/invoices/`) have these bugs. Fix ALL of them:

**In `[id].js`:**
- Line with `return jsonResp(...):`  — change `:` to `;` (syntax error)
- Missing closing `}` for the `if` block near that line
- SQL injection: `sent_at = ${currentInvoice.sent_at ? ...}` — use `?` parameter binding instead
- Query builder: `query.slice(0, query.endsWith(',') ? -1 : 0)` — when no trailing comma, this returns empty string. Fix the logic.

**In `list.js`:**
- `pages: Math.ceil(total / limit)` — variable is named `totalCount` not `total`. Fix the reference.

**In all 3 files:**
- Standardize CORS headers — use `Access-Control-Allow-Origin: *` consistently OR dynamic origin with credentials, not a mix
- Every `onRequestGet`/`onRequestPost`/`onRequestPut` must destructure `const { request, env } = context;`

**Verify:** `node --check functions/api/invoices/[id].js` should not throw syntax errors
**Verify:** `grep -c '\${' functions/api/invoices/*.js` should return 0 (no string interpolation in SQL)

### Task 2: Add Invoices Table to Schema ⬜
Add a proper `CREATE TABLE IF NOT EXISTS invoices (...)` to `schema.sql` with:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `client_id INTEGER NOT NULL`
- `invoice_number TEXT UNIQUE NOT NULL`
- `amount REAL NOT NULL`
- `status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue','cancelled'))`
- `due_date TEXT`
- `sent_at TEXT`
- `paid_at TEXT`
- `description TEXT`
- `created_at TEXT DEFAULT (datetime('now'))`
- `updated_at TEXT DEFAULT (datetime('now'))`
**Verify:** `grep -c 'CREATE TABLE' schema.sql` should be 8 (was 7)

### Task 3: Remove ALTER TABLE from contact.js ⬜
`functions/api/contact.js` runs ALTER TABLE at request time (lines ~68 and ~74). This is wrong.
- Remove the ALTER TABLE statements from the request handler
- Add `lead_score INTEGER DEFAULT 0` and `category TEXT DEFAULT 'cold'` columns to the `submissions` CREATE TABLE in `schema.sql`
- Use try/catch fallback pattern: try with new columns first, catch and retry without them
**Verify:** `grep -c 'ALTER TABLE' functions/api/contact.js` should return 0

### Task 4: API Security Audit ⬜
Run `grep -rnE 'discord\.com/api/webhooks|sk-|cfut_|Bearer ' functions/ --include='*.js'`
If ANY hardcoded secrets are found, replace them with `env.VAR_NAME` references.
Run `grep -rn '\${' functions/api/*.js` — check each match for SQL injection (string interpolation in SQL).
Fix any found.
**Verify:** Both grep commands should return 0 matches for secrets/injection
