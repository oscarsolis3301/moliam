# YAGAMI MISSION BOARD — Sprint 3 (v2)

## Focus: Frontend Polish, SEO, & Security

**REPO:** `~/moliam`  
**IMPORTANT:** Do NOT modify `public/index.html` (Mavrick owns it). Work ONLY on new pages and security improvements.

### Task 1: Create sitemap.xml
Generate an XML sitemap for all public pages:
- Homepage (`/`)
- Login (`/login`)
- Dashboard (`/dashboard`)  
- Admin (`/admin`)
- HQ Canvas (`/hq`)

**Format requirements:**
- `<?xml version="1.0" encoding="UTF-8"?>`
- `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
- Each URL: `<url><loc>https://moliam.com/[path]</loc><lastmod>2026-04-04</lastmod><priority>0.8-1.0</priority></url>`
- Sitemap index file at `public/sitemap.xml`

### Task 2: Create 404 Error Page
Design a custom 404 page that matches Moliam branding:
- Dark gradient background (#0B0E14 to #1e1b4b)
- "Page Not Found" heading (Inter 600, white)
- Friendly subtext explaining the error
- Back-to-home link with gradient button
- Optional: subtle animated element (floating shape or particle effect)

**File:** `public/404.html`  
**Responsive:** Must work on mobile (260px canvas-friendly)

### Task 3: External Link Security Audit
Audit all `<a>` tags that open external links (`target="_blank"`):
- Check for security attributes: `rel="noopener noreferrer"` required
- Flag any missing security attributes in code comments
- Optionally create `public/css/security-audit.css` documenting findings

**Scope:** Search `public/*.html` files for `target="_blank"` and verify security best practices.

### Task 4: Accessibility Improvements (WCAG 2.1 AA)
Add the following to improve accessibility:
- Skip-to-main-content link (visually hidden but tab-accessible)
- Proper ARIA labels on all interactive elements (`button`, `input`, `select`)
- Color contrast ratios ≥ 4.5:1 for text (verify with CSS audit)
- Keyboard focus indicators (`:focus-visible` styles)
- Reduced motion support (`@media (prefers-reduced-motion)`)

**Files to touch:** Only CSS files (`public/css/*.css`), NOT HTML structure.

### Task 5: Deploy Updates

```bash
export PATH=$PATH:/opt/homebrew/bin
export CLOUDFLARE_API_TOKEN=cfut_AZwIcZS8Njtriv4N2tv9GnC6sK7jvXiR2XykCM6Hd92ecdac
cd ~/moliam
git add -A && git commit -m "sprint3: sitemap, 404 page, external link security, accessibility" && git push origin main
npx wrangler pages deploy ./public --project-name=moliam --branch main
```

### Task 6: Verify Deployment

After deploy, verify these URLs return 200:
- https://moliam.pages.dev/ (main site)
- https://moliam.pages.dev/login (login page)
- https://moliam.pages.dev/dashboard (dashboard)
- https://moliam.pages.dev/admin (admin panel)
- https://moliam.pages.dev/404 (custom error page)

Report results in Discord. Tag @Ada when all tasks complete.

**DO NOT** create any schedulers, cron jobs, or new server-side code. Only frontend files and deployment.

---

## Priority Order

1. **sitemap.xml** - SEO foundation
2. **404.html** - Error handling  
3. **External link security audit** - Security hardening (CSS-only)
4. **Accessibility improvements** - WCAG compliance (CSS-only)
5. **Deploy & verify** - Production rollout

---

*Read this file at the start of your session. Execute tasks 1-6 in order. Tag Ada when complete.*
