# YAGAMI TASK BOARD v2 — Event Engine + Interaction Logic
# Owner: Yagami (MINI-02)
# DO NOT touch ~/moliam/public/index.html yet — Mavrick is editing it.
# Write your code in a SEPARATE file: ~/moliam/yagami-improvements.js

## TASK 1: Write an improved Event Simulation Engine
Create ~/moliam/yagami-improvements.js with JUST the JavaScript code (no HTML wrapper).

The current DEMO_SEQUENCE has only 28 events. Write a better one:

### Requirements:
- 40+ events in the demo sequence
- Events must form logical CHAINS per bot, not random:
  - Ada chain: task_start(planning) -> thinking -> message_send(to mavrick) -> code_write(engineering) -> api_call -> task_complete
  - Mavrick chain: task_start(planning) -> code_write(engineering) -> code_write(engineering) -> api_call -> db_operation(data) -> task_complete
  - Yagami chain: db_operation(data) -> thinking -> error -> (goes to error room) -> rate_limit_start -> rate_limit_end -> db_operation(data) -> task_complete
- Each bot has personality:
  - Ada: mostly planning + comms, she orchestrates
  - Mavrick: mostly engineering + code_write, he builds
  - Yagami: mostly data + db_operation, he analyzes
- Use realistic task names: "Deploy Cloudflare worker", "Optimize SQL query", "Train BERT classifier", "Process webhook batch", "Generate analytics report", "Refactor auth middleware", "Sync CRM pipeline", "Build React component"
- Use realistic file names: "worker.ts", "auth.py", "pipeline.rs", "dashboard.tsx", "schema.sql"
- Use realistic endpoints: "/api/v1/deploy", "/api/webhooks/process", "/api/metrics/daily", "/api/agents/health"
- Include at least 2 inter-agent message chains (Ada tells Mavrick something, Mavrick responds later)

### Format:
Write ONLY the DEMO_SEQUENCE array and a generateRandomEvent() function. Example:

```javascript
// IMPROVED EVENT ENGINE by Yagami
const DEMO_SEQUENCE = [
  {type:'task_start', agent:'ada', target_room:'planning', payload:{task_name:'Plan sprint priorities'}},
  // ... 40+ events
];

function generateRandomEvent(bots) {
  // Generate a realistic random event based on bot personalities
  // Returns a single event object
}
```

## TASK 2: Write improved popover content generators
In the same file, write these functions:

```javascript
function generateBotPopoverHTML(bot) {
  // Returns HTML string for bot popover with:
  // - Bot name in bot's color, bold
  // - Machine name (MINI-01, MINI-02, Raspberry Pi)
  // - Current status with colored dot
  // - Current task with description (not just "active")
  // - "Thought process" section — show what the bot is thinking based on current state:
  //   - If coding: "Implementing [filename] — analyzing dependencies..."
  //   - If planning: "Evaluating approach for [task]..."
  //   - If in error: "Diagnosing: [error_message] — checking logs..."
  //   - If rate limited: "Cooling down — [timer]s remaining"
  //   - If sending message: "Coordinating with [recipient] about [task]"
  // - Messages sent/received counters
  // - Last 8 events in activity log with monospace timestamps (HH:MM:SS)
}

function generateRoomPopoverHTML(room, bots) {
  // Returns HTML string for room popover with:
  // - Room name in room accent color
  // - List of bots here with colored dots and their current task
  // - Events per minute rate
  // - Room utilization (how long occupied in last 5 min)
  // - Last 8 events
}
```

## TASK 3: Write keyboard shortcut handler
```javascript
function setupKeyboardShortcuts() {
  // 1, 2, 3 keys -> speed 1x, 2x, 5x (update buttons visually too)
  // F -> fullscreen toggle
  // Space -> pause/resume simulation (toggle a global `paused` flag)
  // Escape -> close popover
}
```

## RULES:
1. Write ALL code to ~/moliam/yagami-improvements.js
2. Pure JavaScript only — no HTML, no CSS
3. Use the same variable names as the main file (bots, rooms, COLORS, simSpeed, globalTime, etc.)
4. When done, create ~/moliam/YAGAMI-DONE.md listing what you wrote
5. Do NOT edit index.html — Ada will merge your code in
