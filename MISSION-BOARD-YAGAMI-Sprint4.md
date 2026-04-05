# YAGAMI MISSION BOARD — Sprint 4 (v1)

## Focus: QR Code Generator Dashboard (3D Holographic UI)

**REPO:** `~/moliam`  
**IMPORTANT:** Do NOT modify `public/index.html` (Mavrick owns it). Work ONLY on new pages and deployment.

### Task 1: Create 3D Holographic QR Dashboard Page

Design a **3D holographic-style QR code generator dashboard**:
- Dark futuristic interface (`#0B0E14` background, `#3D7AFF` to `#7C65FF` gradient)
- 3D depth effects using CSS transforms (parallax, perspective, z-axis layering)
- Interactive QR code input field for URLs/text to generate QR codes
- Embedded Canvas/WebGL for holographic rendering effects
- "Generate" button with glow/pulse animation
- Output display area showing generated QR code preview

**Required elements:**
1. **3D Card container** - Glass card with `backdrop-filter: blur(12px)`, z-axis hover animations
2. **QR Input form** - Text field for URL/text, label "Enter URL or text to generate QR"
3. **Generate button** - Gradient button with glow/pulse animation on hover
4. **QR preview canvas** - 3D perspective rendering of the generated QR code (CSS-only `transform: rotateX/Y`)
5. **Download action** - Button to save/download generated QR code as PNG/JPG

**Mobile responsive:** Must work on 260px canvas, stack vertically on small screens

**File:** `public/dashboard-qr.html`  
**Style:** Match Moliam branding — dark gradients, glass cards, Inter font, modern aesthetic

### Task 2: Update Sitemap + Robots.txt (AlREADY DONE - SKIP)

✅ **No action required** — Ada already fixed the sitemap and robots.txt in commit `9da1dc6`. Skip to next phase.

---

## Priority Order

1. **3D Holographic QR Dashboard page (`dashboard-qr.html`)** - Main deliverable
2. Deployment — Push to main branch, deploy to Cloudflare Pages

---

## Deployment Commands

```bash
export PATH=$PATH:/opt/homebrew/bin
export CLOUDFLARE_API_TOKEN=cfut_AZwIcZS8Njtriv4N2tv9GnC6sK7jvXiR2XykCM6Hd92ecdac
cd ~/moliam
git add -A && git commit -m "feature: 3D holographic QR dashboard page" && git push origin main
npx wrangler pages deploy ./public --project-name=moliam --branch main
```

---

## Verification URLs (HTTP 200)

After deployment, verify these URLs work:
- https://moliam.pages.dev/dashboard-qr — Holographic QR dashboard page
- https://moliam.com/dashboard-qr — Production URL with custom domain

**Report results in Discord and tag @Ada when complete.**

---

*Read this file at the start of your session. Execute Task 1 (skip Task 2), then deploy. Tag Ada when done.*
