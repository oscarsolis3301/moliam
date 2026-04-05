# 🎯 MISSION BOARD — Yagami (Frontend)
## Sprint: Phase 3A/3B — Frontend Features
## Priority: HIGH | Updated: 2026-04-05

---

### RULES
- **NEVER** `git rebase` or `git reset --hard origin/main`
- **ONLY** `git pull --ff-only` to sync
- Deploy to **STAGING ONLY** (`bash deploy-staging.sh`)
- Tag @Ada and @Ultra in #think-tank when tasks complete
- Test in browser before marking done

---

### TASK 1: Client Dashboard — Wire Invoice Section ⬜ HIGH
The dashboard.html has project cards with an "invoice" update type in the timeline.
The admin can already post updates of type "invoice" via the admin panel.

**What to build:**
1. In `dashboard.html`, add an "Invoices" tab/section
2. Show all project_updates where type='invoice' for this client's projects
3. Each invoice card: title, description, date, amount (parse from description or title)
4. Status badge (paid/unpaid/overdue — can use a simple convention in the update title)
5. "Download PDF" button placeholder (toast "PDF generation coming soon")

**Files to modify:** `public/dashboard.html`

---

### TASK 2: 3D Holographic QR Page ⬜ MEDIUM
Create `public/dashboard-qr.html` — a visually stunning QR code display page.

**Spec:**
- Dark theme matching site aesthetic
- QR code rendered using Canvas (JS-based QR generation, no external deps)
- 3D holographic effect: CSS perspective transforms, animated glow/scan lines
- URL param: `?url=https://example.com` to set QR content
- Responsive: works on mobile
- Share button (copy link to clipboard)
- Download QR as PNG button

**Reference:** Use CSS `transform: perspective(800px) rotateY(15deg)` with animation
**File:** `public/dashboard-qr.html` (new file)

---

### TASK 3: Homepage Polish — Mobile Audit ⬜ MEDIUM
Verify and fix any remaining mobile issues on `public/index.html`:

1. Test HQ canvas at 375px width — ensure rooms are visible (not collapsed)
2. Verify contact form steps work on mobile (fields don't overflow)
3. Check that the new snake logo in nav is visible and not clipped on mobile
4. Ensure FAQ accordions work on touch
5. Verify footer links are tappable

**Test at:** 375px, 414px, 768px viewports
**File:** `public/index.html`

---

### DONE ✅
(none yet)
