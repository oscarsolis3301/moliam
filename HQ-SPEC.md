# OpenClaw AI Operations HQ — Implementation Prompt

You are building a single-file, production-grade 2D side-view office visualization for Moliam.com. This is the main front page. It renders an animated "AI Operations HQ" showing autonomous AI agents moving between rooms in real time based on system events.

Output: ONE self-contained HTML file. All CSS and JS inline. No external dependencies except Google Fonts (Inter). No build step. Must work when opened in a browser or served statically.

---

## VISUAL STYLE — BE EXACT

Art direction: **Clean flat 2D side-view cutaway**, like a cross-section of a building. Think "Fallout Shelter meets a dev tools dashboard." Not pixel art. Not isometric. Clean vector-style shapes rendered on a single `<canvas>` element with a DOM-based HUD overlay.

### Color Palette (dark mode, mandatory)

| Token              | Hex       | Usage                              |
| ------------------ | --------- | ---------------------------------- |
| `--bg-deep`        | `#0B0E14` | Page background                    |
| `--bg-building`    | `#111827` | Building interior fill             |
| `--bg-room`        | `#1F2937` | Individual room background         |
| `--border-room`    | `#374151` | Room dividers, floors, walls       |
| `--accent-blue`    | `#3B82F6` | Engineering, active status         |
| `--accent-purple`  | `#8B5CF6` | Planning, thinking status          |
| `--accent-green`   | `#10B981` | Comms, success indicators          |
| `--accent-amber`   | `#F59E0B` | Data ops, rate-limit warnings      |
| `--accent-red`     | `#EF4444` | Errors, blocked status             |
| `--accent-cyan`    | `#06B6D4` | Inter-agent messages in flight     |
| `--text-primary`   | `#F9FAFB` | Primary text                       |
| `--text-secondary` | `#9CA3AF` | Labels, timestamps                 |
| `--text-dim`       | `#6B7280` | Inactive/disabled text             |

### Typography

- Font: `Inter` (import from Google Fonts), fallback `system-ui, sans-serif`
- HUD labels: 11px, uppercase, letter-spacing 0.05em, `--text-secondary`
- HUD values: 16px, semibold, `--text-primary`
- Room titles: 13px, uppercase, letter-spacing 0.08em, rendered ON the canvas above each room
- Bot names: 10px, rendered below each bot entity on canvas

---

## CANVAS LAYOUT — EXACT STRUCTURE

The building is a **2-story, 6-room grid** rendered on a single `<canvas>` filling the viewport minus the HUD bar.

```
┌─────────────────────────────────────────────────────────┐
│  [HUD BAR - DOM overlay, 48px tall, fixed top]          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │ENGINEERING│  │ PLANNING │  │  COMMS   │  ← Floor 2  │
│   │          │  │          │  │          │             │
│   └──────────┘  └──────────┘  └──────────┘             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│   │   DATA   │  │  ERROR   │  │RATE LIMIT│  ← Floor 1  │
│   │          │  │  ROOM    │  │  LOUNGE  │             │
│   └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│   [HALLWAY / CORRIDOR between floors - bots walk here]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Room Dimensions

- Each room: proportional width = `(canvas.width - 80) / 3`, height = `(canvas.height - 48 - corridorHeight) / 2`
- Corridor between floors: 40px tall, rendered as a darker strip with dashed center line
- Room padding: 12px internal
- Room gap: 8px between rooms
- Building outer margin: 20px from canvas edges

### Room Interior Details (draw these with canvas primitives)

**Engineering Room (Floor 2, Left)**
- Accent: `--accent-blue`
- Interior: 2-3 small rectangles representing monitor screens (20x14px, slightly brighter fill with a 1px accent border)
- A small terminal-style rectangle at the bottom (scrolling green text lines when active — just 1px horizontal lines that shift upward)
- When a bot is coding: the nearest monitor rectangle gets a blinking cursor (1px line toggling every 500ms)

**Planning Room (Floor 2, Center)**
- Accent: `--accent-purple`
- Interior: A whiteboard rectangle on the back wall (wide, short, white with 10% opacity)
- Small sticky-note squares (6x6px) in 3-4 pastel tints scattered on the whiteboard
- When a bot is planning: new sticky notes fade in (200ms), slight glow on the whiteboard

**Communications Room (Floor 2, Right)**
- Accent: `--accent-green`
- Interior: A satellite dish or antenna shape on the "roof" of the room (simple triangle + circle, drawn with lines)
- Small signal-wave arcs emanating from the antenna when messages are active (3 concentric arcs, pulsing opacity)
- A chat-log rectangle at the bottom (similar to terminal but green-tinted lines)

**Data Room (Floor 1, Left)**
- Accent: `--accent-amber`
- Interior: 3-4 vertical bar chart columns (rectangles) that grow/shrink smoothly based on a simulated data metric
- A small database cylinder icon (ellipse + rectangle, classic DB shape) in the corner
- When a bot is doing DB ops: bars animate, a small counter increments near the DB icon

**Error Room (Floor 1, Center)**
- Accent: `--accent-red`
- Interior: A caution stripe pattern on the floor (diagonal alternating red/dark lines, 4px wide)
- A flashing warning triangle icon (pulsing between 40% and 100% opacity at 1Hz) when occupied
- Stack trace aesthetic: small horizontal lines of varying length (like a log dump) scrolling slowly

**Rate Limit Lounge (Floor 1, Right)**
- Accent: `--accent-amber` (dimmed 60%)
- Interior: Cozy — a small "couch" shape (rounded rectangle), a "bookshelf" (stacked small rectangles on the right wall)
- A circular cooldown timer rendered above any bot sitting here (arc that depletes clockwise)
- A "coffee cup" icon (tiny, just for character — rectangle + handle arc)
- When a bot is here: they sit on the couch, a subtle "zzz" or book-reading animation (small dots rising slowly)

---

## BOT ENTITIES — EXACT RENDERING

Each bot is drawn on canvas as a **simple geometric character**, not a sprite sheet.

### Bot Anatomy (per bot)

```
     ┌───┐        ← Head: 12x12px rounded rect (2px radius), filled with bot's unique color
     │   │
   ┌─┴───┴─┐      ← Body: 16x18px rounded rect, slightly darker shade of bot color
   │       │
   └─┬───┬─┘
     │   │        ← Legs: 2 small rectangles, 4x8px, animate when walking (alternate Y offset ±2px)
```

- Total entity height: ~40px
- Name label: centered below, 10px Inter, `--text-primary`
- Status dot: 6px circle, top-right of head, color = current status (see state table below)

### Bot Color Assignments (preconfigure these)

| Bot Name | Body Color | Status |
| -------- | ---------- | ------ |
| Yagami   | `#3B82F6`  | —      |
| Ada      | `#8B5CF6`  | —      |
| Soni     | `#10B981`  | —      |
| Willow   | `#F59E0B`  | —      |
| Reaper   | `#EF4444`  | —      |

If fewer bots exist, only render those present. The system must handle 1-10 bots without layout breaks.

### Bot Movement

- Bots walk between rooms by exiting their current room, traversing the corridor, and entering the target room.
- Movement speed: 120px/sec (smooth, not instantaneous)
- Walking animation: legs alternate offset every 150ms
- Path: exit room → corridor → enter room (Manhattan routing, no diagonal)
- When arriving at a room: bot slides to an open "seat" position inside the room (rooms have 3-4 predefined seat coordinates)
- If a room is full, bots stand near the door (stacked with 8px offset)

### Bot States — Visual Indicators

| State         | Status Dot Color | Behavior                                                      |
| ------------- | ---------------- | ------------------------------------------------------------- |
| `active`      | `#10B981` green  | Working animation (context-dependent per room)                |
| `thinking`    | `#8B5CF6` purple | Pulsing head glow (subtle, 0.3 opacity circle behind head)   |
| `blocked`     | `#EF4444` red    | Red exclamation mark (!) appears above head, shakes 2px L/R  |
| `error`       | `#EF4444` red    | Same as blocked + bot moves to Error Room                     |
| `retrying`    | `#F59E0B` amber  | Spinning arrow icon (tiny, 8px) above head                   |
| `rate_limited`| `#6B7280` gray   | Bot moves to Rate Limit Lounge, circular timer appears        |
| `idle`        | `#374151` dim    | Bot sits still, status dot dims, subtle breathing (±1px Y)    |

---

## INTER-AGENT COMMUNICATION — VISUAL

When one bot messages another (the `<agent_xx>` tag system):

1. A **glowing orb** (6px circle, `--accent-cyan`, 80% opacity) spawns at the sender bot's head position
2. The orb travels in a **smooth bezier arc** to the receiver bot (control point = midpoint + 40px upward)
3. Travel time: 600ms, ease-in-out
4. On arrival: brief flash (scale up to 10px, fade out over 200ms)
5. If sender and receiver are in the same room: shorter arc, 300ms
6. Optional: faint trailing line behind the orb during flight (1px, 30% opacity, fades after orb arrives)

If multiple messages are in flight simultaneously, all render independently (no batching/dedup).

---

## HUD BAR — DOM OVERLAY (fixed top, 48px)

Rendered as a **DOM element** overlaying the canvas. Flexbox row, `justify-content: space-between`.

### Left Section: Logo + Title

- "OPENCLAW HQ" — 14px, bold, `--text-primary`, letter-spacing 0.1em
- Small status dot next to it (green = system connected, red = disconnected)

### Center Section: Key Metrics (4 stat blocks, horizontal)

Each stat block:
```
[LABEL]     ← 10px uppercase, --text-dim
[VALUE]     ← 18px semibold, --text-primary
```

Stats:
1. **AGENTS ONLINE** — count of non-idle bots
2. **TASKS ACTIVE** — count of in-progress tasks
3. **ERRORS** — count, turns red text if > 0
4. **RATE LIMITED** — count of rate-limited bots, amber text if > 0

### Right Section: Controls

- **Speed**: `1x / 2x / 5x` toggle buttons (small, pill-shaped)
- **Filter**: dropdown or toggle to show/hide specific bots
- **Fullscreen**: icon button

---

## EVENT SYSTEM — SIMULATED FOR V1

Since this is the front page and we don't have a live WebSocket feed yet, **simulate the event stream**.

Create a `SimulatedEventSource` class that:

1. Emits events on a randomized interval (every 2-8 seconds)
2. Events follow this schema:

```js
{
  type: "task_start" | "task_complete" | "code_write" | "api_call" | "db_operation" | "message_send" | "error" | "rate_limit_start" | "rate_limit_end" | "thinking" | "idle",
  agent: "yagami" | "ada" | "soni" | "willow" | "reaper",
  target_room: "engineering" | "planning" | "comms" | "data" | "error" | "ratelimit",
  payload: {
    // type-specific data
    task_name?: string,
    recipient?: string,       // for message_send
    error_message?: string,   // for error
    duration_ms?: number,     // for rate_limit_start
    file_name?: string,       // for code_write
    endpoint?: string,        // for api_call
  },
  timestamp: Date.now()
}
```

3. The simulator must create **realistic sequences**, not random noise. Example sequence:
   - Yagami: `task_start` (planning) → `thinking` → `code_write` (engineering) → `api_call` (engineering) → `task_complete`
   - Ada: `message_send` to Yagami (comms) → `thinking` (planning) → `db_operation` (data)
   - Soni: `rate_limit_start` (ratelimit, 30s simulated) → `rate_limit_end` → `task_start`

4. Include a pre-scripted "demo loop" of ~20 events that cycles, showing a realistic work session. After the loop completes, it restarts or switches to random realistic sequences.

### Event → Visual Mapping (the renderer must handle all of these)

| Event Type          | Room Target   | Visual Effect                                                                 |
| ------------------- | ------------- | ----------------------------------------------------------------------------- |
| `task_start`        | planning      | Bot walks to Planning. New sticky note appears on whiteboard.                |
| `task_complete`     | (current)     | Green checkmark briefly above bot (fade in/out over 800ms). Sticky note removed. |
| `code_write`        | engineering   | Bot walks to Engineering. Monitor gets blinking cursor. Terminal lines scroll.|
| `api_call`          | engineering   | Horizontal "packet" line shoots from Engineering room rightward (1s, fades). |
| `db_operation`      | data          | Bot walks to Data Room. Bar chart animates. Counter increments.              |
| `message_send`      | comms         | Bot walks to Comms (or stays). Cyan orb flies to recipient bot.              |
| `error`             | error         | Bot walks to Error Room. Warning triangle pulses. Caution stripes animate.   |
| `rate_limit_start`  | ratelimit     | Bot walks to Lounge. Cooldown arc starts. Body color dims 40%.               |
| `rate_limit_end`    | (previous)    | Bot color restores. Bot walks back to their previous room.                   |
| `thinking`          | (current)     | Purple glow behind head pulses. Bot stays in current room.                   |
| `idle`              | (current)     | Status dot dims. Subtle breathing animation.                                 |

---

## CLICK INTERACTION — DOM POPOVER

When the user clicks on a bot (detect click within bot's bounding box on canvas):

1. Show a **DOM popover panel** anchored near the bot's canvas position (translate canvas coords to page coords)
2. Panel: 280px wide, dark bg (`#1F2937`), 1px border `--border-room`, 8px border-radius, subtle box-shadow
3. Contents:
   - **Bot name** (bold, bot color)
   - **Current status** (with colored dot)
   - **Current room** (label)
   - **Current task** (if any, or "Idle")
   - **Recent activity log** — last 5 events for this bot, most recent first, each as:
     `[timestamp] event_type — brief description`
     Timestamps as `HH:MM:SS`, monospace
   - **Close button** (X in top-right, or click outside to dismiss)

When the user clicks on a **room** (detect click within room bounds, not on a bot):

1. Show a similar popover with:
   - **Room name**
   - **Bots currently here** (list with status dots)
   - **Activity count** (events in last 60s)
   - **Last 5 events in this room**

---

## PERFORMANCE REQUIREMENTS

- Target: 60fps on a 2020-era laptop
- Canvas redraws via `requestAnimationFrame`
- Only redraw dirty regions if feasible, otherwise full redraw is acceptable for <10 bots
- DOM HUD updates: throttle to 1Hz (metric counters don't need 60fps)
- Bot movement: interpolated positions using delta-time, not frame-count
- Message orbs: pooled (pre-allocate 10, reuse)
- Event log per bot: cap at 50 entries, FIFO

---

## CODE STRUCTURE (inside the single HTML file)

Organize the JS into clear sections with comment headers:

```
// ═══════════════════════════════════════
// SECTION: Configuration & Constants
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: Event Simulation Engine
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: State Management
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: Room Renderer
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: Bot Renderer & Animation
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: Communication Visualizer
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: HUD Controller
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: Interaction / Click Handling
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// SECTION: Main Loop
// ═══════════════════════════════════════
```

---

## FINAL REQUIREMENTS

1. The file must be **under 3000 lines**. No bloat.
2. The canvas must be **responsive** — recalculate layout on `resize`.
3. No console errors. No unhandled exceptions.
4. Must work in Chrome, Firefox, Safari (modern versions).
5. The overall feeling: **a living, breathing operations center** — not a static diagram. Things should always be subtly moving. Bots breathe. Terminals scroll. Signal waves pulse. The building feels alive even when idle.
6. Include a small "DEMO MODE" badge in the bottom-right corner (since we're simulating events).
7. Do NOT use any external libraries. Vanilla JS + Canvas API + DOM only.
8. Use `devicePixelRatio` for crisp rendering on retina displays.

---

## WHAT TO BUILD

Build the complete HTML file. Every room, every bot, every animation, every interaction described above. Do not stub anything out. Do not leave TODOs. Ship it.
