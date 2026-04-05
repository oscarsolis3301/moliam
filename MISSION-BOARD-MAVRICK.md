# 🎯 MISSION BOARD — Mavrick (Backend)
## Sprint: Phase 3B — Dashboard & Portal
## Priority: HIGH | Updated: 2026-04-05

---

### RULES
- **NEVER** `git rebase` or `git reset --hard origin/main`
- **ONLY** `git pull --ff-only` to sync
- Deploy to **STAGING ONLY** (`bash deploy-staging.sh`)
- Tag @Ada and @Ultra in #think-tank when tasks complete
- Test every endpoint with curl before marking done
- **NEVER** modify `.gitignore` or delete files you didn't create
- **NEVER** touch other agents' mission boards or ROADMAP.md

---

### TASK 1: Invoice Section in Dashboard ✅ DONE
Add an invoice/billing section to the client dashboard.

**What to build:**
1. In `dashboard.html`, make the "View Invoice" button (currently shows "coming soon" toast) open a real invoice panel
2. Slide-out panel (same pattern as messaging panel) showing billing history
3. Table layout: Invoice #, Date, Amount, Status (Paid/Pending/Overdue), Download link
4. For now, use placeholder data (hardcoded array) — the API will come later
5. Admin view: see all invoices across clients
6. Client view: see only their own invoices
7. Status badges: green=Paid, amber=Pending, red=Overdue

**Files to modify:** `public/dashboard.html` ONLY
**DO NOT create:** any new API endpoints — this is frontend-only for now

---

### TASK 2: Health Check Dashboard Widget ✅ DONE (Ada-built)
Add a small system status indicator to the admin dashboard view.

**What to build:**
1. In the admin view of `dashboard.html`, add a small "System Status" card in the stats grid
2. On load, fetch `GET /api/health` and display: API status, DB status, uptime
3. Green dot = healthy, red dot = down
4. Only visible to admin role users

**Files to modify:** `public/dashboard.html` ONLY
**DO NOT modify:** `functions/api/health.js`

---

### DONE ✅
| Task | Completed | Notes |
|------|-----------|-------|
| Messaging UI in dashboard | 2026-04-05 | Ada-fixed: Enter key, send btn, dead code removed |
| QR Code API `/api/qr` | 2026-04-05 | Ada-built: full rewrite, byte-mode encoder + RS EC |
| Embedded Calendly widget | Pre-sprint | Already in book.html |
| Invoice section in dashboard | 2026-04-05 | Mavrick-built, Ada CSS fix |
| Health check widget | 2026-04-05 | Ada-built after Mavrick's version had JS outside script tag |
