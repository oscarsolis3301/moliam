# MOLIAM — Product Roadmap
> Last updated: 2026-04-05 by Ada

## Vision
Single source of truth per client: lead → booking → onboarding → communication → invoicing → workforce — all on one contact record, one timeline.

---

## PHASE 2 — Marketing Site ✅ COMPLETE (9/9)
| Item | Status |
|------|--------|
| Landing page (hero, services, testimonials, FAQ, projects) | ✅ |
| Progressive 8-step contact form | ✅ |
| HQ canvas visualization (agents working) | ✅ |
| D1 database + lead scoring (0-100) | ✅ |
| Discord webhook to #leads (tags Roman) | ✅ |
| Mobile responsive | ✅ |
| SEO (sitemap, robots.txt, structured data, OG image) | ✅ |
| Privacy/Terms pages + 404 | ✅ |
| Booking page (Calendly redirect) | ✅ |

**Extras completed:** Snake logo + favicon, WCAG accessibility, CSS perf optimization, external link audit.

---

## PHASE 3 — Client Dashboard & Portal 🔄 IN PROGRESS

### 3A — Foundation (~40% done)
| Item | Status | Owner |
|------|--------|-------|
| Client auth (login/logout/sessions/roles) | ✅ Done | Ada |
| Admin panel (full CRUD, charts, bulk actions) | ✅ Done | Ada |
| Super admin role (see all tenants, edit/delete) | ✅ Done | Ada |
| Booking API (CRUD, confirm/cancel/reschedule) | ✅ Done | Agents |
| Calendly webhook receiver (HMAC verified) | ✅ Done | Agents |
| Pre-qualification scoring API | ✅ Done | Agents |
| QR Code API (`/api/qr`) — SVG generator | ✅ Done | Ada |
| 3D Holographic QR page | ❌ In progress | Yagami |
| Embedded Calendly (inline widget) | ✅ Done | Pre-sprint |

### 3B — Unified Client Portal (~30% done)
| Item | Status | Owner |
|------|--------|-------|
| Client dashboard (project view, stats, timeline) | ✅ Done | Agents |
| Messaging API (GET/POST, Discord webhook) | ✅ Done | Agents |
| Messaging UI in dashboard | ✅ Done | Ada/Mavrick |
| Invoice section in dashboard | ⬜ In progress | Mavrick |
| Unified contact record model | ❌ Not started | — |
| Invoice generation system | ❌ Not started | — |
| Per-client booking history on timeline | ❌ Not started | — |

### 3C — Multi-Tenant Workforce Module (0% done)
| Item | Status | Owner |
|------|--------|-------|
| Core punch system (clock in/out, GPS, geofence) | ❌ | — |
| Timesheets (auto-compute, CA OT rules) | ❌ | — |
| Alerts (missed clock-in, OT warnings) | ❌ | — |
| Frontend (ClockWidget, TimesheetView, Calendar) | ❌ | — |
| Tenant onboarding API | ❌ | — |
| Payroll export (CSV, ADP, Gusto, QuickBooks) | ❌ | — |

---

## PHASE 4 — Automation & Growth (0% done)
| Item | Status |
|------|--------|
| Reactivation campaigns (dormant lead re-engagement) | ❌ |
| Automated reporting (monthly client PDFs) | ❌ |
| AI chat widget on client sites | ❌ |
| Review management automation | ❌ |

---

## Agent Assignments (Active Sprint — April 2026)
| Agent | Current Task | Status |
|-------|-------------|--------|
| **Ada** | Orchestration, auth system, production deploys | ✅ Active |
| **Mavrick** | Invoice section + health widget (Task 1-2) | 🔄 Working |
| **Yagami** | 3D QR page (Task 2) | 🔄 Working |
| **Ultra** | Available for complex features | ⏸ Standby |
