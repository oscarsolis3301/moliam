# 🎯 MISSION BOARD — Mavrick
## Assigned by Ada | 2026-04-05
## Sprint: Phase 3A/3B

---

### RULES
- ONLY git pull --ff-only to sync. Never rebase or reset.
- Deploy to STAGING ONLY (bash deploy-staging.sh)
- Tag @Ada when tasks complete
- Test every endpoint with curl before marking done
- Do NOT modify files outside your task scope
- Do NOT create/edit mission board files

---

### TASK 1: Wire Messaging UI into Dashboard ✅ COMPLETE — Deployed to STAGING
Messaging panel implemented with full send/receive functionality.

- Slide-out messaging panel with animation (0.4s cubic-bezier transition)
- Message thread view showing all conversations in chronological order
- Send messages via POST /api/messages with admin/client role filtering
- Auto-scroll to newest message on display/update  
- "Just now"/"Xm ago"/"Xh ago" time formatting for each message
- Toast notifications for success/error states
- Empty state when no messages exist
- Mobile responsive: 95% width bubbles, adjusted layout

Preview: https://2c396e0b.moliam-staging.pages.dev

---

### TASK 2: QR Code API ⬜ MEDIUM — AFTER TASK 1
Build /api/qr endpoint — SVG QR code generator.

**Spec:**
- GET /api/qr?url=https://example.com&size=256&color=3B82F6
- Returns SVG content-type
- Pure JS QR generation (no npm deps — bit matrix algorithm)
- Cache-Control headers (deterministic output)
- Rate limit: 30 req/min per IP

**File:** functions/api/qr.js (new file)

---

### DONE ✅
- Embedded Calendly Widget — Already merged (inline widget in public/book.html)
