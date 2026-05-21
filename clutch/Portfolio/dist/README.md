# moliam — Cloudflare Pages deploy

Self-contained, drop-in deploy for **Cloudflare Pages**. Just the Playground
and the Portfolio — nothing else.

## Deploy

1. Compress this `dist/` folder (or its contents) into a zip, OR
2. Drag-and-drop the **contents** of this folder into Cloudflare Pages →
   "Direct upload".

## Routes

| Path              | Serves                          |
|-------------------|---------------------------------|
| `/`               | the Playground (index.html)     |
| `/play`           | redirects → `/`                 |
| `/playground`     | redirects → `/`                 |
| `/portfolio`      | Oscar Solis portfolio (served from portfolio.html) |
| `/portfolio.html` | 301 → `/portfolio` (Cloudflare auto)               |

`_redirects` and `_headers` are Cloudflare-Pages native files — do not rename.

## What's inside

- `index.html` + `playground.js` + `playground.css` + `moliam-styles.css` — the Playground
- `portfolio.html` + `styles.css` + `tweaks-panel.jsx` + `components/` — the Portfolio
- `pokedex-data.js` — shared by the Pokédex demo in the Portfolio
- `logo.png`, `favicon-32.png`, `favicon-64.png`, `favicon-192.png`, `apple-touch-icon.png` — site-wide brand mark + favicons
- `_headers`, `_redirects` — Cloudflare config

If Cloudflare reports skipped files, check the zip excludes `__MACOSX/`,
`.DS_Store`, and any hidden dev folders.
