# 🌐 Moliam — AI-Powered Digital Marketing Agency

> **AI Operations for Orange County Contractors**
> Website builds, GBP optimization, Google LSA management — all powered by AI agents.

**Live:** [moliam.pages.dev](https://moliam.pages.dev)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Pages](#pages)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Design System](#design-system)
- [Pricing](#pricing)
- [Setup & Development](#setup--development)
- [Deployment](#deployment)

---

## Overview

Moliam is a digital marketing agency website targeting **Orange County contractors** (roofers, plumbers, HVAC, electricians, etc.). The site showcases AI-powered marketing services, handles lead capture, manages client dashboards, and includes a full booking/pre-qualification system.

**Key capabilities:**
- 🚀 Custom website builds delivered in under 72 hours
- 📍 Google Business Profile (GBP) optimization for local search
- 📞 Google Local Service Ads (LSA) setup and management
- 🤖 AI agent-powered operations (automated lead scoring, client dashboards)
- 📊 Client portal with project tracking and updates

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Hosting** | Cloudflare Pages |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **API** | Cloudflare Pages Functions (serverless) |
| **Frontend** | Vanilla HTML / CSS / JavaScript |
| **Build Step** | None — static files served directly from `public/` |
| **Auth** | Session-based (bcrypt + httpOnly cookies) |
| **Notifications** | Discord webhooks |

**No frameworks. No bundlers. No Node runtime.** Just static assets + edge functions.

---

## Pages

| Path | File | Description |
|------|------|-------------|
| `/` | `index.html` | Landing page — hero, services, pricing, portfolio, contact form |
| `/portfolio` | `portfolio.html` | Case studies and project showcase |
| `/book` | `book.html` | Booking / pre-qualification flow for new leads |
| `/login` | `login.html` | Client & admin authentication |
| `/dashboard` | `dashboard.html` | Client portal — project status, updates, messaging |
| `/admin` | `admin.html` | Admin panel — client management, project CRUD, updates |
| `/hq` | `hq.html` | Internal AI Operations HQ (bot status, rooms) |
| `/privacy` | `privacy.html` | Privacy policy |
| `/terms` | `terms.html` | Terms of service |
| `/404` | `404.html` | Custom 404 error page |

---

## API Endpoints

All endpoints live under `/api/` via Cloudflare Pages Functions (`functions/` directory).

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check — API version, D1 status, table counts, integrity checks |
| `POST` | `/api/contact` | Contact form submission — validates, stores in D1, sends Discord webhook |
| `GET` | `/api/prequalify` | Returns pre-qualification form criteria (min budget, industries) |
| `POST` | `/api/prequalify` | Submit pre-qualification data — scores lead 0–100 based on budget, timeline, industry fit |
| `GET` | `/api/bookings` | List appointments |
| `POST` | `/api/bookings` | Create a new booking appointment |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Authenticate with email/password, returns session cookie |
| `GET` | `/api/auth/me` | Get current authenticated user from session |
| `POST` | `/api/auth/logout` | Destroy session, clear cookie |

### Dashboard (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard` | Returns projects + recent updates for current user (clients see own, admins see all) |
| `GET` | `/api/dashboard-seed` | Seed demo data for development |

### Admin (Admin Role Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/clients` | List all clients with project counts |
| `POST` | `/api/admin/clients` | Create/onboard a new client |
| `GET/PUT/DELETE` | `/api/admin/clients/:id` | Get, update, or deactivate a specific client |
| `GET` | `/api/admin/projects` | List all projects with client info |
| `POST` | `/api/admin/projects` | Create a new project for a client |
| `GET/PUT/DELETE` | `/api/admin/projects/:id` | Get, update, or delete a specific project |
| `POST` | `/api/admin/updates` | Add an update/milestone to a project |
| `GET` | `/api/admin/seed` | Seed admin data for development |

---

## Database Schema

**Database:** Cloudflare D1 (`moliam-db`)
**Binding:** `MOLIAM_DB`

### Core Tables

| Table | Purpose |
|-------|---------|
| `submissions` | Contact form submissions |
| `users` | User accounts (admin + client roles) |
| `sessions` | Auth sessions (token-based, expiring) |
| `projects` | Client projects (website, GBP, LSA, retainer) |
| `project_updates` | Timeline entries per project (updates, milestones, deliverables, reports, invoices) |

### Booking System

| Table | Purpose |
|-------|---------|
| `prequalifications` | Lead scoring data (budget, timeline, industry, qualification score 0–100) |
| `appointments` | Booked meetings with status tracking and reminders |
| `booking_audit_log` | Full audit trail of booking lifecycle events |
| `calendar_settings` | Calendar provider config (Calendly/Cal.com) |
| `reschedule_queue` | Auto-rescheduling for no-shows |

### Legacy / Dashboard

| Table | Purpose |
|-------|---------|
| `client_profiles` | Token-based client profiles |
| `client_messages` | Client ↔ agency messaging |
| `client_activity` | Agent activity log per client |

**Schema files:**
- `migrate-v2.sql` — Auth, users, sessions, projects, project_updates
- `schema-bookings.sql` — Full booking/pre-qualification system
- `schema-dashboard.sql` — Client profiles, messages, activity

---

## Design System

Moliam uses a **dark-mode-first** aesthetic — premium, technical, and trustworthy. Think Linear meets Vercel with a warm blue-purple gradient accent.

### Color Palette

**Backgrounds**
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-deep` | `#0B0E14` | Page background |
| `--bg-building` | `#111827` | Card backgrounds |
| `--bg-room` | `#1F2937` | Secondary surfaces |
| `--glass-bg` | `rgba(17,24,39,0.6)` | Glassmorphism overlays |

**Accents**
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-blue` | `#3B82F6` | Primary CTA, links |
| `--accent-purple` | `#8B5CF6` | Secondary accent, gradients |
| `--accent-green` | `#10B981` | Success, positive states |
| `--accent-amber` | `#F59E0B` | Warning, pending |
| `--accent-red` | `#EF4444` | Error, destructive |
| `--accent-cyan` | `#06B6D4` | Info, tertiary |

**Text**
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#F9FAFB` | Headings |
| `--text-secondary` | `#9CA3AF` | Body text |
| `--text-dim` | `#6B7280` | Labels, metadata |

### Typography

- **Font:** Inter (Google Fonts), weights 300–900
- **Mono:** JetBrains Mono / Fira Code
- **Hero h1:** `clamp(40px, 6vw, 72px)`, weight 900, letter-spacing `-0.03em`
- **Section h2:** `clamp(28px, 4vw, 44px)`, weight 800
- **Body:** 14–16px, weight 400, line-height 1.6

### Key Components

- **Cards:** Glassmorphism (`backdrop-filter: blur`), 20px radius, 1px glass border, glow on hover
- **Buttons:** Gradient primary (blue → purple), glass secondary, hover lifts with shadow
- **Navigation:** Fixed 56px top bar, frosted glass background, gradient logo text
- **Inputs:** Subtle glass background, blue focus ring

### Design Tokens

All tokens defined in `public/css/design-tokens.css` — includes colors, spacing scale (4–96px), radii, shadows, transitions, and z-index layers.

---

## Pricing

### 🌐 Website Development
- **Setup:** $600 one-time
- **Maintenance:** $150/month
- Custom design, mobile-responsive, SEO-optimized
- Delivered in under 72 hours

### 📍 Google Business Profile (GBP)
- **Monthly:** $300/month
- Profile optimization, weekly posts, review management
- Local search visibility improvement

### 📞 Local Service Ads (LSA)
- **Setup:** $500 one-time
- **Management:** $400/month
- Google Guaranteed badge, lead tracking, bid optimization

### 🚀 Full Retainer
- **Monthly:** $1,500/month
- All services included (Website + GBP + LSA)
- Priority support, dedicated account management

---

## Setup & Development

### Prerequisites

- [Node.js](https://nodejs.org/) (18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Cloudflare account with Pages + D1 access

### 1. Clone & Install

```bash
git clone <repo-url> moliam
cd moliam
npm install
```

### 2. Configure Wrangler

The `wrangler.toml` is already configured. Update the D1 database ID if creating a new instance:

```toml
name = "moliam"
compatibility_date = "2024-12-01"
pages_build_output_dir = "./public"

[[d1_databases]]
binding = "MOLIAM_DB"
database_name = "moliam-db"
database_id = "<your-database-id>"
```

### 3. Create & Migrate D1 Database

```bash
# Create the database
wrangler d1 create moliam-db

# Apply migrations
wrangler d1 execute moliam-db --file=./migrate-v2.sql
wrangler d1 execute moliam-db --file=./schema-bookings.sql
wrangler d1 execute moliam-db --file=./schema-dashboard.sql
```

### 4. Set Secrets

```bash
# Discord webhook for contact form notifications
wrangler pages secret put DISCORD_WEBHOOK_URL
```

### 5. Local Development

```bash
wrangler pages dev ./public
```

This starts a local dev server with D1 bindings and Pages Functions at `http://localhost:8788`.

---

## Deployment

```bash
# Deploy to Cloudflare Pages
wrangler pages deploy ./public
```

The site deploys to `moliam.pages.dev`. No build step — files in `public/` are served directly. Functions in `functions/` are automatically deployed as Pages Functions.

### Production Environment Variables

Set via the Cloudflare Dashboard under **Pages → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Webhook URL for contact form notifications |

---

## Project Structure

```
moliam/
├── public/                  # Static site root (served directly)
│   ├── index.html           # Landing page
│   ├── portfolio.html       # Portfolio showcase
│   ├── book.html            # Booking flow
│   ├── login.html           # Auth page
│   ├── dashboard.html       # Client portal
│   ├── admin.html           # Admin panel
│   ├── hq.html              # AI Operations HQ
│   ├── privacy.html         # Privacy policy
│   ├── terms.html           # Terms of service
│   ├── 404.html             # Error page
│   ├── css/                 # Stylesheets
│   │   ├── design-tokens.css
│   │   ├── main.css
│   │   ├── hero-section.css
│   │   ├── nav-glass.css
│   │   ├── footer-glass.css
│   │   └── scroll-indicator.css
│   ├── js/                  # Client-side JavaScript
│   │   ├── main.js
│   │   ├── script.js
│   │   ├── hero-interactions.js
│   │   ├── nav-interactions.js
│   │   ├── contact-form.js
│   │   └── portfolio-interactions.js
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
├── functions/               # Cloudflare Pages Functions (API)
│   └── api/
│       ├── health.js
│       ├── contact.js
│       ├── prequalify.js
│       ├── bookings.js
│       ├── dashboard.js
│       ├── dashboard-seed.js
│       ├── auth/
│       │   ├── login.js
│       │   ├── logout.js
│       │   └── me.js
│       └── admin/
│           ├── clients.js
│           ├── clients/[id].js
│           ├── projects.js
│           ├── projects/[id].js
│           ├── updates.js
│           └── seed.js
├── migrate-v2.sql           # Auth & project schema
├── schema-bookings.sql      # Booking system schema
├── schema-dashboard.sql     # Client dashboard schema
├── wrangler.toml            # Cloudflare config
├── DESIGN.md                # Full design system spec
└── package.json
```

---

## License

Proprietary — © 2025 Moliam. All rights reserved.
