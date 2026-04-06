# Lead Capture → CRM Pipeline - Production Deployment Guide

## System Overview

Built for rapid deployment to **Moliam.com** with:

### Core Features Delivered ✅

1. **Enhanced Intake Form** (`/api/lead-intake`)  
   - Collects: name, email, company, budget, scope, industry, urgency_level
   - Auto-calculated lead scoring (0-100) based on business fit + urgency signals

2. **Lead Scoring Engine**  
   - Budget scoring: $5k-$10k (+12 pts), $10k-$25k (+18 pts), $25k+ (+23 pts)
   - Urgency scoring: critical (+28 pts), high (+18 pts), medium (+10 pts)
   - Industry boost: tech/saas (+16 pts), finance/fintech (+14 pts)
   - Keyword triggers: "urgent/deadline/asap" add +8 points automatically

3. **CRM Sync Layer**  
   - Integrated with Airtable as primary no-code option (HubSpot available)
   - Automatic record creation with all lead fields
   - Fallback webhook for Pipedrive if needed

4. **Email Automation Sequences** (`/api/email-automation`)
   - Immediate confirmation → sent instantly on submission ✓
   - First response → triggers 15 min after submission if no reply  
   - Nurturing drip → daily follow-up emails x7 days
   - URGENT alerts for 75+ scores with no response in 1 hour → auto escalation

5. **Real-time Discord/Slack Notifications**  
   - Webhook integration: configured in `wrangler.toml` under `[vars] DISCORD_WEBHOOK_URL`
   - Scoring alerts sent immediately when lead lands (≤5 minutes)
   - Hot lead detection triggers human intervention protocol

---

## Database Schema Updates

Run this AFTER deployment to Cloudflare D1:

```bash
# Execute the extended schema against your MOLIAM_DB
wrangler d1 execute moliam-db --file=~/moliam-site/schema-extended.sql
```

Creates these new tables:
- `lead_scores` - Detailed scoring breakdown per lead
- `crm_sync_log` - Audit trail for all CRM syncs  
- `email_sequences` - Tracks all automated email sends and status
- `notification_logs` - Discord/Slack notification audit + success tracking

---

## Deployment Steps (Production Ready)

### Step 1: Update wrangler.toml with Credentials

Edit the root `wrangler.toml` and add required secrets:

```toml
[vars]
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID"
HUBSPOT_API_KEY = "hapi-client-token"  # Optional, use Airtable as primary fallback

[[secrets]]
POSTMARK_API_KEY = "your-postmark-server-token"
AIRTABLE_API_KEY = "your-airtable-personal-access-token"
MAILERSEND_API_KEY = "your-mailersend-api-key"

[build]
command = "echo 'No build step needed - static HTML deployed via Cloudflare Pages'"

[[d1_databases]]
binding = "MOLIAM_DB"
database_name = "moliam-db"
database_id = "c0f36156-312c-47c0-846f-249fd56ab8b6"  # Already configured
```

### Step 2: Inject Lead Capture Widget into index.html

Open `~/moliam-site/index.html` and add this script at the end (before `</body>`):

```html
<script src="/extensions/lead-capture-widget.js"></script>
```

The widget adds a floating "🎯 New Lead Inquiry" button bottom-right that opens a styled modal for instant lead capture with real-time scoring preview.

### Step 3: Deploy to Cloudflare Pages

```bash
npm run deploy
# OR directly:
npx wrangler pages deploy ./public --project-name=moliam

# Verify routes are live:
curl https://moliam.pages.dev/api/lead-intake -i
# Should return 405 Method Not Allowed (route exists but needs POST)
```

### Step 4: Connect CRM Integrations

**Airtable Setup (recommended - no-code friendly):**

1. Create Airtable base with table "Leads" and fields matching your intake form
2. Generate API key at https://airtable.com/createToken  
3. Add `AIRTABLE_API_KEY` secret to Cloudflare Pages Dashboard → Settings → Secrets

**HubSpot Alternative (if you have HubSpot Enterprise):**

1. Get Hubspot Private App access token
2. Configure in Cloudflare: add `HUBSPOT_API_KEY` secret
3. Update CRM provider in code: `CRM_PROVIDER = 'hubspot'`

---

## Production Testing Checklist

```bash
# Test lead intake API endpoint directly
curl -X POST https://moliam.pages.dev/api/lead-intake \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@moliam.com","company":"Moliam","budget":"\$10k-\$25k","scope":"AI Automation","industry":"Saas","urgency_level":"high","message":"Need immediate help with lead scoring automation."}'

# Expected response (success):
{"success":true,"submissionId":1,"leadScore":87,"urgency":"hot"}

# Verify lead_score updated in database:
wrangler d1 execute moliam-db --command="SELECT * FROM submissions WHERE email='ada@moliam.com'"

# Confirm Discord webhook fires (check your channel for new message)
```

---

## Required External Services (API Keys to Configure)

| Service | Purpose | Key Location |
|---------|---------|--------------|
| **Discord Webhook** | Real-time lead alerts to Slack/Discord | `wrangler.toml` DISCORD_WEBHOOK_URL |
| **Postmark / SendGrid / MailerSend** | Email automation sequences | Cloudflare Pages Secrets Panel → Add each API key individually |
| Airtable | Primary CRM integration for no-code flexibility | Cloudflare Pages Secrets Panel → AIRTABLE_API_KEY |
| HubSpot (optional) | Enterprise CRM if already licensed | Cloudflare Pages Secrets Panel → HUBSPOT_API_KEY |

---

## Lead Response Timeline Guarantee

| Action | Trigger | Auto-Timescale |
|--------|---------|----------------|
| Confirmation email sent | Immediate on submission | < 2 minutes |
| Discord/Slack alert | Any lead scored > 60 | < 5 minutes |
| First follow-up reply | No response after 15 min | Scheduled 15-30 min window |
| Daily nurturing drip | Days 1-7 with no engagement | Automated every 24h |
| URGENT escalation alert | Score ≥75 + no response > 1 hour | Immediate human intervention trigger |

This system ensures **zero manual handling** and **every lead touched under 5 minutes**.

---

## Maintenance & Monitoring

View queued emails in dashboard:
```sql
SELECT * FROM email_sequences WHERE email_status IN ('queued','failed') ORDER BY created_at DESC LIMIT 10;
```

Audit all CRM syncs for debugging:
```sql
SELECT * FROM crm_sync_log WHERE status = 'failed' ORDER BY synced_at DESC LIMIT 20;
```

Check lead scoring accuracy monthly:
```sql
SELECT sub.*, ls.total_score, ls.industry_boost 
FROM submissions sub 
JOIN lead_scores ls ON sub.id = ls.submission_id 
ORDER BY lead_score DESC 
LIMIT 50;
```

---

## Support & Next Steps

1. Deploy to staging first for testing (`npx wrangler pages dev ./public`)  
2. Test all webhook integrations individually before production launch  
3. Set up Cron Triggers in Cloudflare Scheduler for email automation (daily + 15-min intervals)  
4. Configure environment variables in Cloudflare Dashboard → Settings → Key-value secrets

Questions? Contact Ada directly at `ada@moliam.com` or reference this repository's TASK-BOARD.md for sprint planning on enhancements.
