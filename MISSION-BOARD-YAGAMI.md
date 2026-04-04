# YAGAMI MISSION BOARD — Sprint 2
## Focus: Performance, Mobile, & Deploy Pipeline

**REPO:** `~/moliam`
**IMPORTANT:** Do NOT modify `public/index.html` (Mavrick owns it). Work ONLY on CSS files and deployment. Do NOT create cron jobs or schedulers.

### Task 1: Create Shared Dashboard CSS
Create `public/css/dashboard.css` with shared styles for login, dashboard, and admin pages. Extract the common design tokens and components so all three pages stay consistent. Include:
- Base reset and typography
- Glass card component
- Stat card component
- Form elements
- Buttons (primary, secondary, danger)
- Table styles
- Alert/toast notifications
- Mobile breakpoints

### Task 2: Optimize CSS
In `public/css/styles.css`:
- Remove any duplicate declarations
- Combine redundant selectors
- Add `will-change` to animated elements
- Add `content-visibility: auto` to below-fold sections
- Ensure all animations use `transform` and `opacity` only (GPU-accelerated)

### Task 3: Create og-image.png
The site references `/og-image.png` but it doesn't exist. Create a simple SVG-based placeholder:
- Create `public/og-image.svg` (1200x630)
- Dark background (#0B0E14)
- "Moliam" text in gradient blue-purple
- Subtitle: "AI-Powered Operations"
- Save as both SVG and convert concept to a simple HTML-rendered PNG approach

### Task 4: Deploy Updated Site
```bash
export PATH=$PATH:/opt/homebrew/bin
export CLOUDFLARE_API_TOKEN=cfut_AZwIcZS8Njtriv4N2tv9GnC6sK7jvXiR2XykCM6Hd92ecdac
cd ~/moliam
git add -A && git commit -m "sprint2: dashboard css, perf optimizations, og-image" && git push origin main
npx wrangler pages deploy ./public --project-name=moliam --branch main
```

### Task 5: Verify Deployment
After deploy, verify these URLs return 200:
- https://moliam.pages.dev/ (main site)
- https://moliam.pages.dev/login (login page)
- https://moliam.pages.dev/dashboard (dashboard)
- https://moliam.pages.dev/admin (admin panel)

Report results in Discord.

**DO NOT** create any schedulers, cron jobs, or new HTML pages. Only CSS, images, and deployment.
