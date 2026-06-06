# moliam-portfolio

Complete project archive — everything needed to run the moliam site lives in this folder.

## Entry points

| File | Purpose |
|---|---|
| `index.html` | Playground — collection of browser games |
| `portfolio.html` | Main portfolio (React + interactive demos) |
| `projects.html` | Projects index |
| `services.html` | Services & subscriptions (Lumi) |

Just open any of the `.html` files in a browser. No build step required.

## Folder layout

```
moliam-portfolio/
├── index.html              ← playground homepage
├── portfolio.html          ← main portfolio
├── projects.html           ← projects index
├── services.html           ← services / Lumi
│
├── moliam-styles.css       ← shared base styles (used by all pages)
├── playground.css          ← index.html only
├── services.css            ← services.html only
├── styles.css              ← portfolio.html only
│
├── playground.js           ← vanilla JS for index.html
├── services.js             ← vanilla JS for services.html
├── pokedex-data.js         ← data for the pokedex demo
│
├── app.jsx                 ← (legacy entry, kept for reference)
├── projects.jsx            ← React app for projects.html
├── tweaks-panel.jsx        ← in-page tweak controls
│
├── components/             ← React components used by portfolio.html
│   ├── app.jsx
│   ├── hero.jsx
│   ├── about.jsx
│   ├── work.jsx
│   ├── resume.jsx
│   ├── contact.jsx
│   ├── demo-tank.jsx
│   ├── demo-maze.jsx
│   ├── demo-bottle.jsx
│   └── demo-pokedex.jsx
│
├── logo.jpg                ← site logo
│
├── screenshots/            ← preview captures from design iterations
└── source-materials/       ← original uploads, references, image assets
```

## Notes

- All HTML files reference siblings with relative paths, so the folder is portable —
  move it anywhere, zip it, host it, and links stay intact.
- React + Babel are loaded from `unpkg` CDN. An internet connection is required
  for `portfolio.html` and `projects.html` to render.
- `source-materials/` contains the raw uploads (logos, mockups, PDFs) used while
  designing — safe to remove if you only need the runnable site.
