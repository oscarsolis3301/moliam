# MOLIAM PLATFORM ROADMAP
## Updated: 2026-04-05 by Ada

---

## VISION
Single source of truth per client: lead → booking → onboarding → communication → invoicing → workforce — all on one contact record, one timeline.

---

## PHASE 2 — Marketing Site ✅ COMPLETE
- [x] Landing page (hero, services, testimonials, FAQ, projects)
- [x] Progressive 7-step contact form
- [x] HQ canvas visualization (agents working)
- [x] D1 database + lead scoring
- [x] Discord webhook to #leads (tags Roman)
- [x] Mobile responsive
- [x] SEO (sitemap, robots.txt, structured data)
- [x] Privacy/Terms pages
- [x] Booking page (Calendly redirect)

## PHASE 3 — Client Dashboard MVP (IN PROGRESS)
### 3A — Foundation (CURRENT SPRINT)
- [ ] QR Code API (`/api/qr`) — SVG generator
- [ ] 3D Holographic QR page (dashboard-qr.html)
- [ ] Embedded Calendly (inline widget, no redirect)
- [ ] Homepage audit + mobile fix (blank HQ canvas, oversized containers)
- [ ] Social proof enhancements

### 3B — Unified Client Portal
- [ ] **Unified contact record model** — single client record linking all touchpoints
- [ ] Client login/auth (JWT + session)
- [ ] Client dashboard home — timeline view (all interactions on one screen)
- [ ] Direct messaging system (client ↔ Moliam, webhook to Discord per client)
- [ ] Invoice generation — clients create invoices for THEIR customers
- [ ] Invoice viewing — clients see invoices from Moliam
- [ ] Embedded Calendly per-client (booking history on timeline)

### 3C — Multi-Tenant Workforce Module (from PDF spec)
- [ ] **Phase 1**: Core punch system (clock in/out, break, geofence, GPS)
- [ ] **Phase 2**: Timesheets (auto-compute, OT rules, California double-time)
- [ ] **Phase 3**: Alerts (missed clock-in, overtime warnings)
- [ ] **Phase 4**: Frontend (ClockWidget, TimesheetView, ScheduleCalendar, AlertsPanel)
- [ ] **Phase 5**: Tenant onboarding API
- [ ] **Phase 6**: Payroll export (CSV, ADP, Gusto, QuickBooks)

Tech: FastAPI + SQLAlchemy backend, React + TypeScript + Tailwind frontend
Critical rule: Every DB query MUST include tenant_id from JWT

## PHASE 4 — Automation & Growth
- [ ] Reactivation campaigns (dormant lead re-engagement)
- [ ] Automated reporting (monthly client performance PDFs)
- [ ] AI chat widget on client sites
- [ ] Review management automation

---

## AGENT ASSIGNMENTS
| Agent | Current Focus | Next Up |
|-------|--------------|---------|
| **Mavrick** (MINI-01, backend) | QR API, rate limiting | Client messaging API, invoice API |
| **Yagami** (MINI-02, frontend) | 3D QR page, sitemap | Dashboard UI, ClockWidget |
| **Ada** (orchestrator) | Homepage audit, deployment, planning | Workforce backend scaffolding |
| **Ultra** (Win desktop) | Available | Workforce frontend, complex features |

---

## EVERYTHING-CLAUDE-CODE INTEGRATION
Best practices to adopt from github.com/affaan-m/everything-claude-code:
- **Verification loops** — every agent task ends with automated verification
- **TDD workflow** — write tests before implementation for all API endpoints  
- **Security review** — automated scan on every PR/commit
- **Continuous learning** — agents extract patterns from completed work
- **Context budget** — agents manage token usage efficiently
- **Search-first** — check existing code/docs before writing new code
- **Agent harness** — structured delegation with clear boundaries
