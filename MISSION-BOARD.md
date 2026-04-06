# 🎯 MISSION BOARD — Mavrick (SEO + Content Sprint)
**Assigned by:** Ada | **Date:** 2026-04-06 10:35 PT
**Status:** ACTIVE — Work through tasks IN ORDER

## RULES
- You are restricted to `public/` ONLY — do NOT touch `functions/` or `schema.sql`
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create cron jobs
- Do NOT touch Yagami's files/tasks
- Do NOT hardcode secrets, webhook URLs, or API tokens in code — use env.VAR_NAME
- NEVER use tools that output line numbers (like `cat -n` or `nl`) and paste the output into files
- When ALL tasks are done, tag @Ada and @Ultra for more work. Do NOT self-assign new work outside your scope.

## Great work last sprint! ✅
You completed all 4 frontend QA tasks cleanly. Portfolio expansion, 404 enhancement, mobile responsiveness, and WCAG compliance — all solid work.

## Tasks

### ⬜ Task 1: SEO Meta Tags Audit + Fix (ALL pages)
Every HTML page in `public/` needs proper meta tags. For EACH page, verify and ADD (do NOT replace/rewrite the file):
- `<title>` — unique, keyword-rich, under 60 chars
- `<meta name="description">` — unique, 150-160 chars, with call to action
- `<meta name="keywords">` — 5-8 relevant keywords
- Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:description`
- Canonical URL: `<link rel="canonical" href="https://moliam.com/PAGE">`
- All URLs must point to `moliam.com` (NOT `moliam.pages.dev`)

**ADD tags inside the existing `<head>` — do NOT replace or rewrite the entire file.**
**Verify after each file: `wc -l public/FILE.html` must be EQUAL OR GREATER than before your edit.**

Pages to audit: index.html, portfolio.html, book.html, 404.html, privacy.html, terms.html, login.html
Skip: admin.html, dashboard.html, hq.html, og-image.html, dashboard-qr.html (internal pages)

### ⬜ Task 2: JSON-LD Structured Data
Add JSON-LD schema markup to `public/index.html` (inside `<head>`):
- `Organization` schema with name, url, logo, contactPoint, sameAs (social links)
- `LocalBusiness` schema with address (Orange County, CA), telephone, priceRange
- `WebSite` schema with SearchAction

Add `Service` schema to `public/portfolio.html` for each case study.
Do NOT touch the existing JSON-LD if any — ADD alongside it.
**Verify: `wc -l public/index.html` must be 3528+ lines after edit.**

### ⬜ Task 3: Content Expansion — Privacy Policy
`public/privacy.html` is only 229 lines. Expand it to a proper privacy policy:
- Data collection practices (contact form, cookies, analytics)
- How data is used and stored
- Third-party services (Cloudflare, Calendly)
- User rights (access, deletion, opt-out)
- Contact information for privacy inquiries
- CCPA compliance section (California business)
Target: 400+ lines.
**Verify: `wc -l public/privacy.html` must be 400+ lines after edit.**

### ⬜ Task 4: Content Expansion — Terms of Service
`public/terms.html` is only 232 lines. Expand to proper ToS:
- Service description and scope
- Payment terms and pricing
- Intellectual property rights
- Limitation of liability
- Termination policy
- Governing law (California)
Target: 400+ lines.
**Verify: `wc -l public/terms.html` must be 400+ lines after edit.**

## Commit after EACH task. Include line count verification in commit message.
