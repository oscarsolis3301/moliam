# 🎯 MISSION BOARD — Mavrick (Backend)
## Sprint: Phase 3A/3B — Backend APIs
## Priority: HIGH | Updated: 2026-04-05

---

### RULES
- **NEVER** `git rebase` or `git reset --hard origin/main`
- **ONLY** `git pull --ff-only` to sync
- Deploy to **STAGING ONLY** (`bash deploy-staging.sh`)
- Tag @Ada and @Ultra in #think-tank when tasks complete
- Test every endpoint with curl before marking done

---

### TASK 1: Wire Messaging UI into Dashboard ⬜ HIGH
The messaging API already exists at `/api/messages` (GET list, POST send).
The dashboard.html has a "Message" button that shows "coming soon" toast.

**What to build:**
1. In `dashboard.html`, replace the "coming soon" toast with a real messaging panel
2. Slide-out panel or tab showing message thread (GET /api/messages with credentials)
3. Text input + send button (POST /api/messages)
4. Auto-refresh every 30s or on new message
5. Admin view: dropdown to select client, see all conversations
6. Client view: see only their messages with Moliam

**Files to modify:** `public/dashboard.html` (add messaging UI section + JS)
**DO NOT modify:** `functions/api/messages.js` (already working)

---

### TASK 2: QR Code API ⬜ MEDIUM
Build `/api/qr` endpoint that generates QR codes as SVG.

**Spec:**
- GET `/api/qr?url=https://example.com&size=256&color=3B82F6`
- Returns SVG content-type
- Pure JS QR generation (no npm deps — use bit matrix algorithm)
- Cache-Control headers (QR codes are deterministic)
- Rate limit: 30 req/min per IP

**File:** `functions/api/qr.js`

---

### TASK 3: Embedded Calendly Widget ⬜ MEDIUM
Replace the Calendly redirect with an inline embed on `book.html`.

**Current:** `<a href="https://calendly.com/visualark/demo">` redirect
**Target:** Inline Calendly widget using their embed script
```html
<div class="calendly-inline-widget" data-url="https://calendly.com/visualark/demo" style="min-width:320px;height:700px;"></div>
<script src="https://assets.calendly.com/assets/external/widget.js" async></script>
```

**File:** `public/book.html`

---

### DONE ✅
(none yet)
