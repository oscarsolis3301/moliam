# 🎯 MISSION BOARD — HQ Visualization v3 (Parallel Build)

**Priority:** CRITICAL — Start immediately
**Deadline:** Complete your assigned file within this session

---

## YOUR TASK

Check your machine hostname to know your role:
- `hostname` = `Mavrick` → You are **Mavrick**. Build `~/moliam/public/hq-rooms.js`
- `hostname` = `Yagami` → You are **Yagami**. Build `~/moliam/public/hq-bots.js`

**DO NOT touch `index.html`. Write ONLY your assigned .js file.**

Ada will integrate both files into index.html after you're done.

---

## SHARED ARCHITECTURE

Both files will be loaded by the HQ canvas. They share these globals (Ada will wire them):

```javascript
// Provided by index.html — DO NOT redeclare these
// const canvas, ctx, W, H  — canvas + dimensions
// const $ = (s) => document.querySelector(s)
// const PI2 = Math.PI * 2
// function rand(a, b) { return a + Math.random() * (b - a) }
// function lerp(a, b, t) { return a + (b - a) * t }
// function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
// function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
// function hexRGB(hex) — returns [r,g,b] from '#RRGGBB'
```

---

## MAVRICK — `~/moliam/public/hq-rooms.js`

Write a self-contained ES module that exports room layout and rendering.

### Exports required:

```javascript
// Call once + on resize. Returns array of room objects.
export function layoutRooms(W, H) { ... }

// Draw one room. Called per frame.
export function drawRoom(ctx, room, t) { ... }

// Draw background grid. Called per frame before rooms.
export function drawGrid(ctx, W, H, t) { ... }

// Draw HUD bar. Called per frame after everything.
export function drawHUD(ctx, W, H, stats) { ... }
// stats = { totalTasks, totalErrors, startTime, botStates: [{name, color, state, task}] }

// Room definition array
export const ROOM_DEFS = [
  { id: 'engineering', label: 'Engineering', icon: '🛠', color: '#3B82F6' },
  { id: 'planning',    label: 'Planning',    icon: '📋', color: '#8B5CF6' },
  { id: 'comms',       label: 'Comms',       icon: '📡', color: '#10B981' },
  { id: 'dataops',     label: 'Data Ops',    icon: '📊', color: '#06B6D4' },
  { id: 'error',       label: 'Error Room',  icon: '⚠️', color: '#EF4444' },
  { id: 'ratelimit',   label: 'Rate Limit',  icon: '⏳', color: '#F59E0B' },
];
```

### Room object shape (returned by layoutRooms):

```javascript
{
  ...ROOM_DEF,         // id, label, icon, color
  x, y,               // center X/Y of hex
  w, h,               // bounding box width/height
  vertices: [{x,y}],  // 6 hex corner points (for hit testing)
  activeCount: 0,      // updated externally by bot engine
  utilization: 0,
  pulsePhase: <random>,
  progress: 0,
  progressTarget: 0,
}
```

### Visual spec:

**Rooms — Hexagonal tiles:**
- Honeycomb layout, 2 rows × 3 columns, centered in canvas
- Each hex: flat-top orientation, ~180px wide
- Fill: dark glass (`rgba(15,20,30,0.8)`) with accent-color tint when active
- Border: 1.5px in room color, glows brighter when active (pulsing shadowBlur)
- Icon centered upper area (28px font), label centered below (14px Inter 600)
- Utilization bar at bottom (gradient fill in room color)
- Active count badge top-right (circle with number)
- Progress bar when task active

**Grid background:**
- Subtle dot grid (dots every 40px, `rgba(100,140,200,0.06)`)
- Faint radial gradient from center (slightly lighter center, dark edges)
- NO floating particles — clean and minimal

**HUD overlay (top 36px of canvas):**
- Left: "⚡ MOLIAMA HQ" (16px Inter 700, white)
- Center: "Tasks: N | Errors: N | Uptime: MM:SS" (12px Inter 400, gray)
- Right: Live clock HH:MM:SS (12px Inter 400, muted blue)
- Thin horizontal line separator below (rgba white 0.1)

### Verification before saying done:
```bash
node -c ~/moliam/public/hq-rooms.js
# Must print "Syntax OK"
```

Commit: `cd ~/moliam && git add public/hq-rooms.js && git commit -m "feat: hq-rooms.js — hexagonal room engine for HQ v3" && git push origin main`

---

## YAGAMI — `~/moliam/public/hq-bots.js`

Write a self-contained ES module that exports bot logic and rendering.

### Exports required:

```javascript
// Initialize bots. Call once + on re-layout. rooms = array from layoutRooms()
export function initBots(rooms) { ... }

// Tick bot AI. dt = ms since last frame. Returns feed messages array.
// Each message: { text: 'HTML string', color: '#hex' }
export function tickBots(dt, rooms) { ... }

// Draw one bot. Called per frame.
export function drawBot(ctx, bot, t) { ... }

// Draw connection lines between bots in same room. Called per frame.
export function drawConnections(ctx, bots, t) { ... }

// The bot array (mutable, updated by tickBots)
export let bots = [];

// Totals (mutable, updated by tickBots)
export let totalTasks = 0;
export let totalErrors = 0;

// Bot definitions
export const BOT_DEFS = [
  { name: 'Mavrick', initials: 'M', color: '#3B82F6', role: 'Lead Engineer' },
  { name: 'Yagami',  initials: 'Y', color: '#EF4444', role: 'Strategy AI' },
  { name: 'Ada',     initials: 'A', color: '#8B5CF6', role: 'Analytics Engine' },
  { name: 'Willow',  initials: 'W', color: '#06B6D4', role: 'Content AI' },
  { name: 'Reaper',  initials: 'R', color: '#F59E0B', role: 'Ops Manager' },
];

export const TASKS = [
  'Building contractor website for Oscar', 'Optimizing Google Business Profile',
  'Managing LSA campaign for PlumbRight', 'Analyzing competitor rankings',
  'Writing blog: "5 Signs You Need a New Roof"', 'Generating GBP posts',
  'Setting up Google Guaranteed badge', 'Auditing local SEO for OC Plumbing',
  'Deploying website update', 'Processing 12 new leads',
  'A/B testing landing page CTAs', 'Optimizing LSA budget allocation',
  'Monitoring review response times', 'Updating NAP citations',
  'Building service area pages', 'Scheduling social media content',
  'Analyzing call tracking data', 'Generating monthly report',
  'Configuring schema markup', 'Optimizing Core Web Vitals',
  'Setting up retargeting campaign', 'Creating project gallery',
];
```

### Bot object shape (created by initBots):

```javascript
{
  ...BOT_DEF,          // name, initials, color, role
  x, y,               // current position
  targetX, targetY,    // movement target
  roomIdx,             // current room index
  state: 'idle',       // idle | moving | working | thinking
  task: '',
  tasksDone: 0,
  stateTimer: <random>,
  thinkAngle: 0,
  trail: [],           // comet trail points
  particles: [],       // working spark particles
  progressRing: 0,     // 0-1 circular progress
}
```

### Visual spec:

**Bot avatars:**
- Outer rotating status ring (R+4px): green=working, yellow=thinking, blue=moving, gray=idle
  - Working: double-arc spinner, fast rotation
  - Thinking: single arc, medium speed, 3 orbiting dots
  - Moving: single arc, medium speed
  - Idle: static faint ring
- Inner circle (R=20px): radial gradient (lighter center → darker edge in bot color)
- Single-letter initial centered (15px Inter 700, white)
- State dot (4px): positioned bottom-right of avatar, color matches state
- Role label below avatar (9px Inter 400, `rgba(255,255,255,0.4)`)

**Movement:**
- Ease-in-out interpolation (use `t*t*(3-2*t)` smoothstep, NOT linear)
- Comet trail: 4-5 fading circles behind bot during movement, in bot's color with decreasing alpha
- Drop shadow beneath bot (ellipse, rgba black 0.3)

**Working animation:**
- Emit 2-3 spark particles outward per frame (small circles, bot color, random velocity, fade out)
- Circular progress ring fills clockwise as task progresses (stateTimer → 0)
- Task label above bot: dark pill with accent border, text in white

**Bot connections:**
- When 2+ bots share a room: thin pulsing line between them
- Line color: blend of both bots' colors (or just white at 0.08 alpha)
- Small "⚡" icon at midpoint

### Utility functions you'll need (define inside your file):
```javascript
function hexRGB(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
const PI2 = Math.PI * 2;
```

### Verification before saying done:
```bash
node -c ~/moliam/public/hq-bots.js
# Must print "Syntax OK"
```

Commit: `cd ~/moliam && git add public/hq-bots.js && git commit -m "feat: hq-bots.js — bot engine + animations for HQ v3" && git push origin main`

---

## RULES FOR BOTH AGENTS

1. Write ONLY your assigned .js file — do NOT edit index.html or each other's file
2. Use `export` on all public functions/variables (ES module syntax)
3. Define your own utility functions inside your file (hexRGB, rand, etc.) — don't assume globals
4. All rendering uses the `ctx` parameter passed to your draw functions — never access canvas directly
5. Run `node -c` syntax check BEFORE committing
6. Commit and push when done
7. If something is unclear, make a reasonable choice and document it in a comment
8. NO narrating what you're about to do — just write the code and say "done" when finished
