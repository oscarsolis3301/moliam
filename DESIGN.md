# DESIGN.md — Moliam Visual Design System

## 1. Visual Theme & Atmosphere
Moliam is a dark-mode-first AI agency. The aesthetic is premium, technical, and trustworthy — 
like a high-end SaaS dashboard crossed with a mission control center. Think Linear meets Vercel 
with a warm blue-purple gradient accent. Every element should feel precise, deliberate, and alive.

## 2. Color Palette & Roles

### Backgrounds
| Token | Hex | Role |
|-------|-----|------|
| --bg-deep | #0B0E14 | Page background, deepest surface |
| --bg-building | #111827 | Card backgrounds, elevated surfaces |
| --bg-room | #1F2937 | Secondary cards, sidebar |
| --bg-room-active | #263044 | Hover/active card states |
| --glass-bg | rgba(17, 24, 39, 0.6) | Glassmorphism overlays |

### Accents
| Token | Hex | Role |
|-------|-----|------|
| --accent-blue | #3B82F6 | Primary CTA, links, active states |
| --accent-purple | #8B5CF6 | Secondary accent, gradients |
| --accent-green | #10B981 | Success, online status, positive |
| --accent-amber | #F59E0B | Warning, pending, attention |
| --accent-red | #EF4444 | Error, critical, destructive |
| --accent-cyan | #06B6D4 | Info, tertiary accent |

### Text
| Token | Hex | Role |
|-------|-----|------|
| --text-primary | #F9FAFB | Headings, important text |
| --text-secondary | #9CA3AF | Body text, descriptions |
| --text-dim | #6B7280 | Labels, timestamps, metadata |

### Borders & Glass
| Token | Value | Role |
|-------|-------|------|
| --glass-border | rgba(255, 255, 255, 0.08) | Card borders, dividers |
| --glass-highlight | rgba(255, 255, 255, 0.04) | Subtle surface highlights |

## 3. Typography Rules
- **Font**: Inter (Google Fonts) — weights 300-900
- **Hero h1**: clamp(40px, 6vw, 72px), weight 900, letter-spacing -0.03em
- **Section h2**: clamp(28px, 4vw, 44px), weight 800
- **Card h3**: 18px, weight 700
- **Body**: 14-16px, weight 400, line-height 1.6
- **Labels**: 11-12px, weight 600, uppercase, letter-spacing 0.08em
- **Code/data**: font-variant-numeric: tabular-nums

## 4. Component Stylings

### Buttons
- **Primary**: gradient(135deg, --accent-blue, --accent-purple), 14px 32px padding, 12px radius
- **Hover**: translateY(-2px), box-shadow 0 8px 30px rgba(59,130,246,0.4)
- **Secondary**: glass-bg background, 1px glass-border, backdrop-filter blur(10px)

### Cards
- Background: var(--glass-bg)
- Border: 1px solid var(--glass-border)
- Border-radius: 20px
- Padding: 32px 28px
- Hover: border-color rgba(59,130,246,0.3), box-shadow glow

### Inputs
- Background: rgba(255,255,255,0.05)
- Border: 1px solid var(--glass-border)
- Focus: border-color var(--accent-blue), box-shadow 0 0 0 3px rgba(59,130,246,0.1)
- Radius: 12px, padding 14px 16px

### Navigation
- Fixed top bar, 56px height
- Background: rgba(11, 14, 20, 0.85) with backdrop-filter blur(20px)
- Logo: gradient text (blue → purple)

## 5. Layout Principles
- Max content width: 1200px
- Section padding: 120px vertical, 24px horizontal
- Card grid: repeat(auto-fit, minmax(260px, 1fr)), gap 24px
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 120px

## 6. Depth & Elevation
- **Level 0**: Page background (#0B0E14)
- **Level 1**: Cards (glass-bg + glass-border)
- **Level 2**: Active cards (glow + elevated shadow)
- **Level 3**: Modals/tooltips (shadow-lg: 0 20px 60px rgba(0,0,0,0.5))
- **Glow effects**: Colored box-shadows (blue/purple/green) at 0.15 opacity

## 7. Dos and Donts
### Do
- Use glassmorphism for all card surfaces
- Apply subtle hover transitions (300ms cubic-bezier)
- Use gradient text for brand elements
- Keep text concise and scannable
- Use emoji as section icons (⚡🌐📊🚀)

### Dont