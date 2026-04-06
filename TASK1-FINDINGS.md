# Task 1: Image Audit & Compression

## Summary

- **Total images found**: 8
- **Images over 200KB**: 2 (flagged for compression)
- **Orphaned files** (not referenced, non-favicon): apple-touch-icon.png, moliam-star.jpg, og-image.svg

### Large Images (>200KB) - Need Compression

| File | Size | Referenced in HTML | Notes |
|------|------|-------------------|-------|
| `logo.png` | 622.0KB | ✅ Yes (index.html, dashboard-qr.html, login.html) | Primary brand asset, needs optimization |
| `favicon-512.png` | 261.5KB | ❌ No | Orphaned - can be removed |

### Orphaned Images (Not Referenced in Any HTML)

| File | Size | Recommendation |
|------|------|----------------|
| `apple-touch-icon.png` | 40.3KB | Used by Safari, keep but verify it's referenced |
| `moliam-star.jpg` | 33.7KB | Not used anywhere - can remove |
| `og-image.svg` | 3.2KB | Referenced in meta tags but file doesn't exist (should be PNG) |

### Recommendations

1. **Compress `logo.png`** to reduce from 622KB to ~50-100KB (use TinyPNG or similar tool)
2. **Remove orphaned files**: moliam-star.jpg, favicon-512.png  
3. **Create missing og-image.png** and reference it properly in og:image meta tag
4. Add `width`/`height` attributes to all `<img>` tags to prevent CLS layout shift

---
*Task 1 complete. Committed.*
