# MISSION BOARD — Yagami — Sprint 5 — 2026-04-05

## ROLE
Frontend engineer + SEO. Execute tasks IN ORDER. Tag Ada <@1466244456088080569> after EACH task.

## REPO
cd ~/moliam && git pull origin main FIRST.

## ⚠️ IMPORTANT
Your last sprint had unauthorized board files. Those have been cleaned up.
Follow THIS board ONLY. Do NOT create your own mission boards or sprint files.

## TASK 1: Sitemap Audit & Fix
Run: `curl -s https://moliam.com/sitemap.xml`
For EVERY URL in the sitemap, verify it returns 200:
```bash
for url in $(curl -s https://moliam.com/sitemap.xml | grep '<loc>' | sed 's|.*<loc>||;s|</loc>.*||'); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  echo "$code $url"
done
```
- Remove any URL that returns non-200
- Ensure ALL URLs use moliam.com (not moliam.pages.dev)
- Ensure no private routes (/admin, /dashboard, /login)
Commit: "fix(seo): audit and clean sitemap URLs"

## TASK 2: Meta Tags & Open Graph Audit
Check index.html for:
- Title tag (50-60 chars, includes "Moliam")
- Meta description (150-160 chars, compelling CTA)
- OG title, OG description, OG image, OG url (must be https://moliam.com)
- Twitter card tags
- Canonical URL (must be https://moliam.com)
Fix anything missing or pointing to wrong domain.
Commit: "fix(seo): meta tags and OG audit"

## TASK 3: Schema.org Structured Data
Add LocalBusiness JSON-LD to index.html <head>:
```json
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "Moliam",
  "description": "AI-powered digital marketing for local contractors",
  "url": "https://moliam.com",
  "areaServed": "Orange County, CA",
  "priceRange": "$$"
}
```
Commit: "feat(seo): add LocalBusiness schema markup"

## TASK 4: Performance Quick Wins
- Ensure all images have width/height attributes (prevents CLS)
- Add loading="lazy" to below-fold images
- Check for unused CSS (any styles not referenced by HTML elements)
- Ensure fonts have display=swap
Commit: "perf: image attrs, lazy loading, font-display"

## TASK 5: Push to Origin
```bash
git push origin main
```

## RULES
- Pull first: `git pull origin main --rebase`
- Do NOT modify functions/api/ files — Mavrick's scope
- Do NOT deploy with wrangler — Ada handles deploys
- Do NOT create mission boards, sprint boards, or markdown planning files
- Do NOT create cron jobs
- Syntax check every file before committing
- ALL URLs must use moliam.com, never moliam.pages.dev
