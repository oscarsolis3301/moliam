# AGENTS.md — Moliam Project

## Project Overview
Moliam is an AI-powered digital marketing agency website + client dashboard.
- **Repo**: oscarsolis3301/moliam
- **Hosting**: Cloudflare Pages + D1 database
- **Domain**: moliam.pages.dev
- **Stack**: Vanilla HTML/CSS/JS, CF Pages Functions (serverless)

## Architecture
```
public/
  index.html          — Main landing page (all inline CSS/JS extracted to css/main.css and js/main.js)
  dashboard.html      — Client portal (stats, messages, activity feed)
  portfolio.html      — Portfolio/case studies
  404.html            — Error page
  css/main.css        — Extracted site styles
  js/main.js          — Extracted site scripts
  _headers            — Security headers (CSP, X-Frame, etc)
  robots.txt          — SEO
  sitemap.xml         — SEO
functions/
  api/contact.js      — Contact form handler (D1 + Discord webhook + email)
  api/dashboard.js    — Client dashboard API (auth, stats, messages)
  api/dashboard-seed.js — Demo data seeder
wrangler.toml         — CF Pages config + D1 binding
DESIGN.md             — Visual design system (READ THIS BEFORE ANY UI WORK)
DESIGN-DASHBOARD.md   — Dashboard-specific design patterns (READ FOR DASHBOARD WORK)
```

## Design System
**CRITICAL: Before writing ANY CSS or HTML, read these files:**
- `DESIGN.md` — Overall visual language, color palette, typography, component styles
- `DESIGN-DASHBOARD.md` — Dashboard-specific patterns (data cards, tables, charts)

The design reference files in `~/agent-design-systems/design-md/` contain 55 world-class design systems.
Use these as inspiration:
- **Linear** (`linear.app/DESIGN.md`) — For dashboard UI patterns, dark precision
- **Vercel** (`vercel/DESIGN.md`) — For landing page, clean SaaS aesthetic
- **Supabase** (`supabase/DESIGN.md`) — For developer dashboard, data-rich layouts
- **Stripe** (`stripe/DESIGN.md`) — For payment/pricing sections, premium feel

## Code Standards
1. **No frameworks** — Vanilla HTML/CSS/JS only
2. **Dark theme first** — Background: #0B0E14, glassmorphism cards
3. **Inter font** — All text uses Inter from Google Fonts
4. **Mobile-first** — Responsive breakpoints at 768px and 480px
5. **Accessibility** — ARIA labels, skip links, keyboard navigation
6. **Performance** — Lazy loading, minimal JS, no render-blocking resources
7. **Security** — CSP headers, CORS restricted to moliam.pages.dev, honeypot on forms

## Git Workflow
- Commit after EACH task with descriptive message: "v3 [category]: [description]"
- Do NOT push — Ada handles merging and deployment
- Do NOT create cron jobs or schedulers
- Do NOT modify files outside your assigned scope

## D1 Database
Binding: MOLIAM_DB (database_id: c0f36156)
Tables: submissions, leads, rate_limits, client_profiles, client_messages, client_activity

## Key URLs
- Live site: https://moliam.pages.dev
- Client dashboard: https://moliam.pages.dev/dashboard
- Contact API: POST /api/contact
- Dashboard API: GET/POST /api/dashboard
- Calendly: https://calendly.com/visualark/demo

