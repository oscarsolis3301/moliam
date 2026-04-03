# MISSION BOARD — Deployed by Ada on 2026-04-03 — authorized by Roman
# YAGAMI TASKS — moliam.com v3 Production Sprint (Iterations 4-6)

## CONTEXT
You are working on CSS files and JS modules for the Moliam agency landing page.
Project: /Users/clark/moliam — Cloudflare Pages project. Ada handles deploys.
Current state: iterations 1-3 are done. We need polish and new features NOW.

## YOUR TASKS (do them IN ORDER)

### TASK 1: Design System Cleanup (Iteration 4)
File: `public/css/styles.css` + `public/css/design-tokens.css`

Changes needed:
1. Add these new CSS custom properties to `:root` in design-tokens.css:
   ```css
   --gradient-hero: linear-gradient(135deg, #0B0E14 0%, #1a1040 30%, #0d2137 60%, #0B0E14 100%);
   --gradient-card: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1));
   --shadow-card-hover: 0 20px 60px rgba(59,130,246,0.2), 0 0 40px rgba(139,92,246,0.1);
   --font-display: 'Inter', system-ui, sans-serif;
   --font-body: 'Inter', system-ui, sans-serif;
   --space-xs: 4px;
   --space-sm: 8px;
   --space-md: 16px;
   --space-lg: 24px;
   --space-xl: 48px;
   --space-2xl: 96px;
   ```
2. In styles.css, add smooth scroll-triggered fade-in animations:
   ```css
   .reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
   .reveal.visible { opacity: 1; transform: translateY(0); }
   ```

### TASK 2: Scroll Animation Controller (Iteration 4)
File: `public/js/script.js`

Add an IntersectionObserver that adds class "visible" to elements with class "reveal" when they enter viewport:
```javascript
// Scroll reveal animation
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
```

### TASK 3: Navigation Enhancement (Iteration 5)
File: `public/css/nav-glass.css` + `public/js/nav-interactions.js`

Changes needed:
1. Add a scroll-based background opacity change to the nav — starts transparent, becomes solid after 100px scroll
2. Add active section highlighting — as user scrolls, the current section's nav link gets a blue underline
3. Add smooth scroll-to-section on nav link click
4. Make the mobile hamburger menu work (if not already) with a slide-in panel

### TASK 4: Footer Redesign (Iteration 5)
File: `public/css/footer-glass.css`

Changes needed:
1. 4-column footer layout: Company | Services | Resources | Contact
2. Social media icons row (LinkedIn, Twitter/X, Instagram) — use Unicode/emoji for now
3. "© 2026 Moliam. AI-Powered Operations." bottom bar
4. Subtle gradient line separator at top of footer
5. Newsletter signup input + button in the Contact column

## GIT WORKFLOW
After EACH task:
```bash
cd ~/moliam
git add -A
git commit -m "v3 iter4: [description of what changed]"
git push origin main
```

## RULES
- Do NOT touch `public/index.html` — Mavrick is editing that file. You only edit CSS and JS files
- Do NOT touch `public/hq.html` or `public/portfolio.html`
- Keep CSS organized — one concern per file
- Test that your JS has no syntax errors before committing
- When done with ALL 4 tasks, say "YAGAMI TASKS COMPLETE" in chat
