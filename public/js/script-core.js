

  bgDeep:'#0B0E14', bgBuilding:'#111827', bgRoom:'#1F2937', borderRoom:'#374151',
  blue:'#3B82F6', purple:'#8B5CF6', green:'#10B981', amber:'#F59E0B',
  red:'#EF4444', cyan:'#06B6D4', textPri:'#F9FAFB', textSec:'#9CA3AF', textDim:'#6B7280'
};

const ROOM_DEFS = [
  {id:'engineering', name:'ENGINEERING', floor:1, col:0, accent:COLORS.blue},
  {id:'planning',    name:'PLANNING',    floor:1, col:1, accent:COLORS.purple},
  {id:'comms',       name:'COMMS',       floor:1, col:2, accent:COLORS.green},
  {id:'data',        name:'DATA OPS',    floor:0, col:0, accent:COLORS.amber},
  {id:'error',       name:'ERROR ROOM',  floor:0, col:1, accent:COLORS.red},
  {id:'ratelimit',   name:'RATE LIMIT LOUNGE', floor:0, col:2, accent:'#9a7a2a'}
];

const BOT_DEFS = [
  {id:'mavrick', name:'Mavrick', color:'#3B82F6',  machine:'MINI-01'},
  {id:'yagami',  name:'Yagami',  color:'#EF4444',  machine:'MINI-02'},
  {id:'ada',     name:'Ada',     color:'#8B5CF6',  machine:'Raspberry Pi'}
];

const MOVE_SPEED = 120; // px/sec base

let simSpeed = 1;
let canvas, ctx, dpr;
let rooms = [];
let bots = [];
let orbs = [];
let popover = {visible:false, type:null, id:null};
let lastTime = 0;
let hudTimer = 0;

// ═══════════════════════════════════════
// SECTION: Layout Calculator
// ═══════════════════════════════════════
let layout = {};

function calcLayout() {
  const W = canvas.width / dpr;
  const H = (canvas.height / dpr);
  const isMobile = W <= 768;
  const margin = isMobile ? 12 : 20;
  const gap = isMobile ? 4 : 8;
  const corridorH = isMobile ? 30 : 40;
  const cols = 3, rows = 2;
  const totalGapX = gap * (cols - 1);
  const rw = ((W - margin*2) - totalGapX) / cols;
  const totalGapY = gap;
  const rh = ((H - margin*2) - corridorH - totalGapY) / rows;
  const corridorY = margin + rh + gap/2;

  layout = {W, H, margin, gap, corridorH, rw, rh, corridorY};

  rooms = ROOM_DEFS.map(def => {
    const x = margin + def.col * (rw + gap);
    const floorIdx = def.floor; // 1=top, 0=bottom
    const y = floorIdx === 1 ? margin : margin + rh + corridorH + gap;
    const seats = [];
    for(let s=0; s<4; s++) {
      seats.push({x: x + 20 + s * (rw-40)/3, y: y + rh - 50, taken:null});
     }
    return {...def, x, y, w:rw, h:rh, seats, eventLog:[]};
   });
}

function getRoomById(id) { return rooms.find(r=>r.id===id); }

// ═══════════════════════════════════════
// SECTION: State Management
// ═══════════════════════════════════════
function initBots() {
  bots = BOT_DEFS.map((def,i) => {
    const startRoom = rooms[i % rooms.length];
    const seat = startRoom.seats[0];
    return {
      ...def,
      x: seat.x, y: seat.y,
      targetX: seat.x, targetY: seat.y,
      room: startRoom.id,
      prevRoom: startRoom.id,
      state: 'idle',
      task: null,
      moving: false,
      path: [],
      pathIdx: 0,
      legPhase: 0,
      breathPhase: Math.random()*Math.PI*2,
      eventLog: [],
      seatIdx: 0,
      thinkGlow: 0,
      blockShake: 0,
      retryAngle: 0,
      rateLimitTimer: 0,
      rateLimitDuration: 0,
      dimmed: false
    };
  });
  // Assign seats
  bots.forEach((b,i) => {
    const room = getRoomById(b.room);
    if(room && room.seats[i%room.seats.length]) {
      room.seats[i%room.seats.length].taken = b.id;
    }
  });
}

// ═══════════════════════════════════════
// SECTION: Bot Movement & Pathfinding
// ═══════════════════════════════════════
function moveBot(bot, targetRoomId) {
  if(bot.room === targetRoomId && !bot.moving) return;
  const srcRoom = getRoomById(bot.room);
  const dstRoom = getRoomById(targetRoomId);
  if(!srcRoom || !dstRoom) return;

  // Free seat in current room
  srcRoom.seats.forEach(s => { if(s.taken===bot.id) s.taken=null; });

  // Find open seat in destination
  let seatIdx = dstRoom.seats.findIndex(s=>!s.taken);
  if(seatIdx===-1) seatIdx = 0;
  dstRoom.seats[seatIdx].taken = bot.id;

  const dest = dstRoom.seats[seatIdx];
  const corridorYMid = layout.margin + layout.rh + layout.corridorH/2;

  // Build path: current → corridor → destination
  bot.path = [];
  // Exit current room to corridor
  bot.path.push({x: srcRoom.x + srcRoom.w/2, y: corridorYMid});
  // Walk along corridor to destination column
  bot.path.push({x: dstRoom.x + dstRoom.w/2, y: corridorYMid});
  // Enter destination room
  bot.path.push({x: dest.x, y: dest.y});

  bot.pathIdx = 0;
  bot.moving = true;
  bot.prevRoom = bot.room;
  bot.room = targetRoomId;
}

function updateBotMovement(bot, dt) {
  if(!bot.moving || bot.path.length === 0) return;

  const target = bot.path[bot.pathIdx];
  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const speed = MOVE_SPEED * simSpeed;
  const step = speed * dt;

  if(dist < step + 1) {
    bot.x = target.x;
    bot.y = target.y;
    bot.pathIdx++;
    if(bot.pathIdx >= bot.path.length) {
      bot.moving = false;
      bot.path = [];
    }
  } else {
    bot.x += (dx/dist) * step;
    bot.y += (dy/dist) * step;
  }

  bot.legPhase += dt * 10 * simSpeed;
}

// ═══════════════════════════════════════
// SECTION: Event Simulation Engine
// ═══════════════════════════════════════
const TASK_NAMES = [
  'Deploy edge function','Optimize DB queries','Train sentiment model',
  'Process webhook batch','Generate social report','Update DNS records',
  'Scrape competitor data','Build dashboard widget','Refactor auth flow',
  'Sync CRM contacts','Analyze ad performance','Write API docs'
];
const ENDPOINTS = ['/api/v1/agents','/api/v1/tasks','/api/webhooks','/api/metrics','/api/deploy'];
const FILES = ['agent.ts','router.py','config.yaml','handler.js','pipeline.rs','index.html'];

const DEMO_SEQUENCE = [
  {type:'task_start',agent:'ada',target_room:'planning',payload:{task_name:'Plan daily operations'}},
  {type:'thinking',agent:'ada',target_room:'planning',payload:{}},
  {type:'message_send',agent:'ada',target_room:'comms',payload:{recipient:'mavrick',message:'Start deployment pipeline'}},
  {type:'task_start',agent:'mavrick',target_room:'planning',payload:{task_name:'Deploy edge function'}},
  {type:'code_write',agent:'mavrick',target_room:'engineering',payload:{file_name:'deploy.ts'}},
  {type:'thinking',agent:'yagami',target_room:'planning',payload:{}},
  {type:'db_operation',agent:'yagami',target_room:'data',payload:{query:'SELECT * FROM metrics'}},
  {type:'api_call',agent:'mavrick',target_room:'engineering',payload:{endpoint:'/api/v1/deploy'}},
  {type:'message_send',agent:'yagami',target_room:'comms',payload:{recipient:'ada',message:'Metrics synced'}},
  {type:'task_complete',agent:'mavrick',target_room:'engineering',payload:{task_name:'Deploy edge function'}},
  {type:'error',agent:'yagami',target_room:'error',payload:{error_message:'Connection timeout to DB replica'}},
  {type:'rate_limit_start',agent:'yagami',target_room:'ratelimit',payload:{duration_ms:15000}},
  {type:'code_write',agent:'ada',target_room:'engineering',payload:{file_name:'optimizer.py'}},
  {type:'api_call',agent:'ada',target_room:'engineering',payload:{endpoint:'/api/metrics'}},
  {type:'task_start',agent:'mavrick',target_room:'planning',payload:{task_name:'Refactor auth flow'}},
  {type:'rate_limit_end',agent:'yagami',target_room:'data',payload:{}},
  {type:'db_operation',agent:'yagami',target_room:'data',payload:{query:'INSERT INTO logs'}},
  {type:'thinking',agent:'mavrick',target_room:'planning',payload:{}},
  {type:'code_write',agent:'mavrick',target_room:'engineering',payload:{file_name:'auth.ts'}},
  {type:'task_complete',agent:'ada',target_room:'engineering',payload:{task_name:'Plan daily operations'}},
  {type:'message_send',agent:'ada',target_room:'comms',payload:{recipient:'mavrick',message:'All systems nominal'}},
  {type:'idle',agent:'ada',target_room:'planning',payload:{}},
  {type:'task_complete',agent:'mavrick',target_room:'engineering',payload:{task_name:'Refactor auth flow'}},
  {type:'idle',agent:'mavrick',target_room:'engineering',payload:{}},
  {type:'task_start',agent:'yagami',target_room:'planning',payload:{task_name:'Generate social report'}},
  {type:'api_call',agent:'yagami',target_room:'engineering',payload:{endpoint:'/api/v1/agents'}},
  {type:'message_send',agent:'yagami',target_room:'comms',payload:{recipient:'ada',message:'Report complete'}},
  {type:'idle',agent:'yagami',target_room:'data',payload:{}}
];

let demoIdx = 0;
let nextEventTime = 2000;
let eventAccum = 0;

function getNextEvent() {
  const evt = DEMO_SEQUENCE[demoIdx % DEMO_SEQUENCE.length];
  demoIdx++;
  return {...evt, timestamp: Date.now()};
}

function processEvent(evt) {
  const bot = bots.find(b => b.id === evt.agent);
  if(!bot) return;

  const logEntry = {time:Date.now(), type:evt.type, detail:describeEvent(evt)};
  bot.eventLog.unshift(logEntry);
  if(bot.eventLog.length > 50) bot.eventLog.pop();

  const room = getRoomById(evt.target_room);
  if(room) {
    room.eventLog.unshift(logEntry);
    if(room.eventLog.length > 50) room.eventLog.pop();
  }

  switch(evt.type) {
    case 'task_start':
      bot.state = 'active';
      bot.task = evt.payload.task_name || 'Unknown task';
      bot.dimmed = false;
