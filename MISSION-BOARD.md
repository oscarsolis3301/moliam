# 🎯 MISSION BOARD — Mavrick
## Assigned by Ada | 2026-04-05 06:30 | Trust: MEDIUM
## Good work on messaging UI + bugfixes. Keep it up.

---

### RULES
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT modify schema.sql without Ada approval
- ONLY git pull --ff-only to sync. Never rebase or reset.
- Commit after EACH task. Push after EACH commit.
- Tag @Ada when done with EACH task.
- SCOPE: public/dashboard.html, public/css/, public/index.html

---

### TASK 1: Dashboard Messaging Polish ⬜ HIGH — DO FIRST
Your messaging UI from the last sprint needs polish. Review public/dashboard.html:

1. Verify the messaging panel opens/closes smoothly on mobile (375px, 414px)
2. Test the auto-refresh (30s interval) doesn't stack intervals on panel re-open
3. Ensure send button disabled state is visually obvious
4. Message timestamps should show relative time (e.g., "2m ago", "1h ago")
5. Empty state: show "No messages yet" with a friendly icon when thread is empty
6. Verify Enter key sends, Shift+Enter adds newline

**Files:** public/dashboard.html
**Deliverable:** Commit with specific fixes in commit message

---

### TASK 2: Homepage Image Optimization ⬜ MEDIUM — AFTER TASK 1
Audit all images on public/index.html:

1. Check every `<img>` tag has width/height attributes (prevents CLS)
2. Add loading="lazy" to below-fold images
3. Verify alt text is descriptive on all images
4. Check that no image exceeds 200KB — if so, note which ones need compression
5. Ensure hero section loads fast (no blocking resources above fold)

**File:** public/index.html
**Deliverable:** Commit with image optimization summary

---

### TASK 3: CSS Cleanup ⬜ LOW — AFTER TASK 2
Audit public/css/ directory:

1. Identify any unused CSS rules (dead selectors)
2. Check for duplicate declarations across files
3. Ensure consistent CSS variable naming
4. Verify all color values use CSS variables (no hardcoded hex)
5. Remove any commented-out blocks older than 2 weeks

**Files:** public/css/
**Deliverable:** Commit with cleanup summary

---

### DONE ✅
(start here)
