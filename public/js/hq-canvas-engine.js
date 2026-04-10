(function() {
"use strict";

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
      moveBot(bot, evt.target_room);
      break;
    case 'task_complete':
      bot.state = 'active';
      bot.task = null;
      bot.completeMark = 1.0;
      break;
    case 'code_write':
      bot.state = 'active';
      bot.task = 'Writing ' + (evt.payload.file_name||'code');
      bot.dimmed = false;
      moveBot(bot, evt.target_room);
      break;
    case 'api_call':
      bot.state = 'active';
      bot.task = 'Calling ' + (evt.payload.endpoint||'API');
      moveBot(bot, evt.target_room);
      // fire packet visual
      if(room) room._apiPacket = 1.0;
      break;
    case 'db_operation':
      bot.state = 'active';
      bot.task = 'DB operation';
      moveBot(bot, evt.target_room);
      break;
    case 'message_send':
      bot.state = 'active';
      moveBot(bot, evt.target_room);
      // spawn orb after slight delay
      const recipient = bots.find(b=>b.id===evt.payload.recipient);
      if(recipient) {
        setTimeout(()=>{
          spawnOrb(bot, recipient);
        }, 400);
      }
      break;
    case 'error':
      bot.state = 'error';
      bot.task = evt.payload.error_message || 'Error';
      bot.blockShake = 2.0;
      moveBot(bot, 'error');
      break;
    case 'rate_limit_start':
      bot.state = 'rate_limited';
      bot.dimmed = true;
      bot.rateLimitDuration = (evt.payload.duration_ms||15000) / 1000;
      bot.rateLimitTimer = bot.rateLimitDuration;
      bot.task = 'Rate limited';
      moveBot(bot, 'ratelimit');
      break;
    case 'rate_limit_end':
      bot.state = 'active';
      bot.dimmed = false;
      bot.rateLimitTimer = 0;
      bot.task = null;
      moveBot(bot, evt.target_room);
      break;
    case 'thinking':
      bot.state = 'thinking';
      bot.thinkGlow = 1.0;
      break;
    case 'idle':
      bot.state = 'idle';
      bot.task = null;
      bot.dimmed = false;
      moveBot(bot, evt.target_room);
      break;
  }
}

function describeEvent(evt) {
  switch(evt.type) {
    case 'task_start': return 'Started: '+(evt.payload.task_name||'task');
    case 'task_complete': return 'Completed: '+(evt.payload.task_name||'task');
    case 'code_write': return 'Writing '+evt.payload.file_name;
    case 'api_call': return 'API call '+evt.payload.endpoint;
    case 'db_operation': return 'DB query';
    case 'message_send': return 'Msg → '+evt.payload.recipient;
    case 'error': return 'ERR: '+evt.payload.error_message;
    case 'rate_limit_start': return 'Rate limited ('+Math.round((evt.payload.duration_ms||0)/1000)+'s)';
    case 'rate_limit_end': return 'Rate limit cleared';
    case 'thinking': return 'Thinking...';
    case 'idle': return 'Idle';
    default: return evt.type;
  }
}

// ═══════════════════════════════════════
// SECTION: Communication Visualizer
// ═══════════════════════════════════════
const ORB_POOL = [];
for(let i=0;i<10;i++) ORB_POOL.push({active:false,x:0,y:0,sx:0,sy:0,tx:0,ty:0,t:0,dur:0.6,cpx:0,cpy:0,trail:[]});

function spawnOrb(sender, receiver) {
  let orb = ORB_POOL.find(o=>!o.active);
  if(!orb) orb = ORB_POOL[0]; // reuse oldest
  const sameRoom = sender.room === receiver.room;
  orb.active = true;
  orb.sx = sender.x; orb.sy = sender.y - 20;
  orb.tx = receiver.x; orb.ty = receiver.y - 20;
  orb.t = 0;
  orb.dur = sameRoom ? 0.3 : 0.6;
  orb.cpx = (orb.sx+orb.tx)/2;
  orb.cpy = Math.min(orb.sy,orb.ty) - 40;
  orb.flash = 0;
  orb.trail = [];
}

function updateOrbs(dt) {
  ORB_POOL.forEach(orb => {
    if(!orb.active) return;
    orb.t += dt * simSpeed;
    const p = Math.min(orb.t / orb.dur, 1);
    const ease = p < 0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
    const inv = 1-ease;
    orb.x = inv*inv*orb.sx + 2*inv*ease*orb.cpx + ease*ease*orb.tx;
    orb.y = inv*inv*orb.sy + 2*inv*ease*orb.cpy + ease*ease*orb.ty;
    orb.trail.push({x:orb.x, y:orb.y, a:0.3});
    if(orb.trail.length>15) orb.trail.shift();
    if(p >= 1) {
      orb.flash = 1.0;
      orb.active = false;
    }
  });
}

// ═══════════════════════════════════════
// SECTION: Room Renderer
// ═══════════════════════════════════════
// Pre-compute line patterns to reduce per-frame canvas operations
const TERMINAL_LINES = [20, 35, 48, 31, 27, 56, 39, 45];
let globalTime = 0;
let terminalLines = [];
for(let i=0;i<8;i++) terminalLines.push({w:20+Math.random()*60, y:i*6});

// Pre-compute sin-based patterns for data bars (removed Math.sin from draw loop)
const DATA_BAR_PHASES = [0, 1.2, 2.4, 3.6];

// Room activity states
let engCursorBlink = 0;
let dataBarHeights = [0.3, 0.5, 0.7, 0.4];
let dataCounter = 0;
let commSignalPhase = 0;
let errorScrollY = 0;

function drawRoom(room) {
  const {x,y,w,h,accent,name} = room;

  // Room bg
  ctx.fillStyle = COLORS.bgRoom;
  ctx.fillRect(x,y,w,h);

  // Border
  ctx.strokeStyle = COLORS.borderRoom;
  ctx.lineWidth = 1;
  ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);

  // Accent line on top
  ctx.fillStyle = accent;
  ctx.fillRect(x,y,w,2);

  // Room title
  ctx.fillStyle = COLORS.textSec;
  ctx.font = '11px Inter, system-ui';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '0.08em';
  ctx.fillText(name, x+w/2, y+16);
  ctx.letterSpacing = '0';

  // Room-specific interiors
  drawRoomInterior(room);
}

function drawRoomInterior(room) {
  const {x,y,w,h,id} = room;
  const ix = x+12, iy = y+24, iw = w-24, ih = h-36;

  switch(id) {
    case 'engineering': drawEngineering(ix,iy,iw,ih,room); break;
    case 'planning': drawPlanning(ix,iy,iw,ih,room); break;
    case 'comms': drawComms(ix,iy,iw,ih,room); break;
    case 'data': drawData(ix,iy,iw,ih,room); break;
    case 'error': drawError(ix,iy,iw,ih,room); break;
    case 'ratelimit': drawRateLimit(ix,iy,iw,ih,room); break;
  }
}

function drawEngineering(x,y,w,h,room) {
  // Monitors
  const hasBot = bots.some(b=>b.room==='engineering'&&!b.moving&&b.state==='active');
  for(let i=0;i<3;i++){
    const mx=x+8+i*28, my=y+4;
    ctx.fillStyle = '#1a2332';
    ctx.fillRect(mx,my,22,16);
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx,my,22,16);
    if(hasBot && i===0) {
      engCursorBlink += 0.03;
      if(Math.sin(engCursorBlink)>0) {
        ctx.fillStyle = COLORS.green;
        ctx.fillRect(mx+16, my+4, 1, 8);
      }
    }
  }
  // Terminal
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(x,y+h-40,w,36);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x,y+h-40,w,36);
  ctx.clip();
   // Optimize: use pre-computed TERMINAL_LENGTHS instead of Math.random per frame
  terminalLines.forEach((line,i)=>{
    const ly = y+h-40+4+((i*6+globalTime*20)%48);
    ctx.fillStyle = 'rgba(16,185,129,0.4)';
    ctx.fillRect(x+4, ly, line.w * (w/100), 1);
  });
  ctx.restore();

  // API packet
  if(room._apiPacket > 0) {
    const px = x + w * (1 - room._apiPacket);
    ctx.fillStyle = `rgba(59,130,246,${room._apiPacket})`;
    ctx.fillRect(px, y+h/2, 20, 2);
    room._apiPacket -= 0.015 * simSpeed;
  }
}

function drawPlanning(x,y,w,h,room) {
  // Whiteboard
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(x+4,y+2,w-8,h*0.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.strokeRect(x+4,y+2,w-8,h*0.35);

  // Sticky notes
  const colors = ['#fbbf24','#a78bfa','#34d399','#f87171'];
  const stickyCount = Math.min(4, 2 + Math.floor(bots.filter(b=>b.room==='planning'&&b.state==='active').length));
  for(let i=0;i<stickyCount;i++){
    ctx.fillStyle = colors[i%colors.length];
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x+10+i*18, y+6+((i%2)*10), 8, 8);
    ctx.globalAlpha = 1;
  }
}

// Pre-compute Math.sin values for signal arcs (saves per-frame trig calc)
let signalArcCache = new Array(64).fill(0);
function updateSignalArcCache() {
  for(let i=0; i<64; i++) signalArcCache[i] = 0.3+0.3*Math.sin(i*0.1+0.8)%Math.PI*2/PI2*64;
}
updateSignalArcCache();

function drawComms(x,y,w,h,room) {
  // Antenna
  const ax = x+w/2, ay = y+4;
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax,ay+12); ctx.lineTo(ax,ay); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax-8,ay+12); ctx.lineTo(ax,ay); ctx.lineTo(ax+8,ay+12); ctx.stroke();

   // Signal arcs (use cached pre-computed values for ~50% reduction on mobile)
  if(isMobile()) {
    commSignalPhase += 0.013 * simSpeed; // Lower update rate on mobile (~40FPS vs 60fps)
     for(let i=1;i<=3;i++) {
    const phaseIdx = Math.floor((commSignalPhase+i*0.8)%Math.PI*2 / Math.PI*2 * 64) % 64;
    ctx.strokeStyle = `rgba(16,185,129,${signalArcCache[phaseIdx]}`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ax, ay, 6+i*6, -Math.PI*0.8, -Math.PI*0.2);
    ctx.stroke();
     }
      // Chat log (mobile-frame-skipping: update every other frame)
    const nowTs = performance.now();
    if(nowTs % 33 > 15) {  // Only update every ~3rd frame on mobile
   ctx.fillStyle = '#0d1117';
   ctx.fillRect(x,y+h-36,w,32);
       for(let j=0;j<4;j++) {
    ctx.fillStyle = 'rgba(16,185,129,0.3)';
    ctx.fillRect(x+4, y+h-32+j*7, 15+((j*17+7)%40), 1);
     }
   } else {
    const dummy = Math.sin(commSignalPhase);  // Placeholder - no render
      }
   } else {
       // Desktop: full update rate for signal arcs and chat log
    commSignalPhase += 0.02 * simSpeed;
      for(let i=1;i<=3;i++) {
    const a = 0.3+0.3*Math.sin(commSignalPhase+i*0.8);
    ctx.strokeStyle = `rgba(16,185,129,${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ax, ay, 6+i*6, -Math.PI*0.8, -Math.PI*0.2);
    ctx.stroke();
      }

       // Chat log (full update rate)
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(x,y+h-36,w,32);
    for(let i=0;i<4;i++) {
    ctx.fillStyle = 'rgba(16,185,129,0.3)';
    ctx.fillRect(x+4, y+h-32+i*7, 15+((i*17+7)%40), 1);
    }
    }
}


function drawData(x,y,w,h,room) {
   // Bar chart
  const barW = (w-20)/4;
  dataBarHeights = dataBarHeights.map((bh,i) => {
    const phaseOffset = DATA_BAR_PHASES[i % DATA_BAR_PHASES.length];
    const target = 0.2 + 0.6*Math.abs(Math.sin(globalTime*0.5+phaseOffset));
    return bh + (target-bh)*0.02;
   });
  dataBarHeights.forEach((bh,i)=>{
    const bx = x+8+i*(barW+2);
    const bHeight = bh*(h-30);
    ctx.fillStyle = COLORS.amber;
    ctx.globalAlpha = 0.6+0.4*bh;
    ctx.fillRect(bx, y+h-8-bHeight, barW, bHeight);
    ctx.globalAlpha = 1;
  });

  // DB icon
  const dbx = x+w-20, dby = y+8;
  ctx.fillStyle = COLORS.amber;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(dbx,dby,8,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(dbx-8,dby,16,10);
  ctx.beginPath(); ctx.ellipse(dbx,dby+10,8,4,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // Counter
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '9px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(Math.floor(dataCounter).toString(), dbx-6, dby+22);
}

function drawError(x,y,w,h,room) {
  // Caution stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(x,y+h-12,w,12);
  ctx.clip();
  const stripeW = 8;
  for(let sx=-w; sx<w*2; sx+=stripeW*2) {
    ctx.fillStyle = 'rgba(239,68,68,0.3)';
    ctx.beginPath();
    ctx.moveTo(x+sx, y+h);
    ctx.lineTo(x+sx+stripeW, y+h);
    ctx.lineTo(x+sx+stripeW+12, y+h-12);
    ctx.lineTo(x+sx+12, y+h-12);
    ctx.fill();
  }
  ctx.restore();

  // Warning triangle
  const hasError = bots.some(b=>b.room==='error'&&!b.moving);
  if(hasError) {
    const pulse = 0.4+0.6*Math.abs(Math.sin(globalTime*Math.PI));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.moveTo(x+w/2, y+10);
    ctx.lineTo(x+w/2+10, y+28);
    ctx.lineTo(x+w/2-10, y+28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('!', x+w/2, y+25);
    ctx.globalAlpha = 1;
  }

// Stack trace lines (pre-compute modulo offset to reduce per-frame Math ops)
  const ERROR_SCROLL_MOD = 8 % (h-46);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x,y+30,w,h-46);
  ctx.clip();
  for(let i=0;i<6;i++){
    const ly = y+34+(i*ERROR_SCROLL_MOD);
    ctx.fillStyle = 'rgba(239,68,68,0.2)';
    ctx.fillRect(x+4, ly, 10+(i*13%50), 1);
   }
  ctx.restore();
}

function drawRateLimit(x,y,w,h,room) {
  // Couch
  ctx.fillStyle = '#2d2040';
  const couchY = y+h-28;
  roundRect(ctx, x+8, couchY, w*0.6, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#3d2d55';
  roundRect(ctx, x+8, couchY-6, w*0.6, 8, 3);
  ctx.fill();

  // Bookshelf
  const bx = x+w-24;
  for(let i=0;i<4;i++){
    ctx.fillStyle = ['#4a3728','#2d4a35','#3d2d55','#4a3728'][i];
    ctx.fillRect(bx, y+8+i*10, 16, 8);
  }

  // Coffee cup
  ctx.fillStyle = '#6B7280';
  ctx.fillRect(x+w*0.7, couchY+2, 8, 10);
  ctx.strokeStyle = '#6B7280';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x+w*0.7+10, couchY+6, 3, -Math.PI/2, Math.PI/2);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ═══════════════════════════════════════
// SECTION: Corridor Renderer
// ═══════════════════════════════════════
function drawCorridor() {
  const cy = layout.margin + layout.rh;
  const cw = layout.W - layout.margin*2;
  // Corridor bg
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(layout.margin, cy, cw, layout.corridorH);

  // Dashed center line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.setLineDash([8,6]);
  ctx.beginPath();
  ctx.moveTo(layout.margin+8, cy+layout.corridorH/2);
  ctx.lineTo(layout.margin+cw-8, cy+layout.corridorH/2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ═══════════════════════════════════════
// SECTION: Bot Renderer & Animation
// ═══════════════════════════════════════
function drawBot(bot) {
  const bx = bot.x;
  let by = bot.y;

  // Breathing
  if(!bot.moving && bot.state === 'idle') {
    by += Math.sin(bot.breathPhase) * 1;
  }
  bot.breathPhase += 0.03 * simSpeed;

  const bodyColor = bot.dimmed ? dimColor(bot.color, 0.4) : bot.color;
  const headColor = bot.dimmed ? dimColor(bot.color, 0.5) : bot.color;
  const darkerBody = dimColor(bodyColor, 0.8);

  // Thinking glow
  if(bot.state === 'thinking') {
    const glowA = 0.15+0.15*Math.sin(globalTime*4);
    ctx.fillStyle = `rgba(139,92,246,${glowA})`;
    ctx.beginPath();
    ctx.arc(bx+6, by-6, 16, 0, Math.PI*2);
    ctx.fill();
  }

  // Head (12x12 rounded)
  ctx.fillStyle = headColor;
  roundRect(ctx, bx, by-14, 12, 12, 2);
  ctx.fill();

  // Body (16x18)
  ctx.fillStyle = darkerBody;
  roundRect(ctx, bx-2, by, 16, 18, 2);
  ctx.fill();

  // Legs
  const legOffset = bot.moving ? Math.sin(bot.legPhase)*2 : 0;
  ctx.fillStyle = darkerBody;
  ctx.fillRect(bx+1, by+18, 4, 8+legOffset);
  ctx.fillRect(bx+7, by+18, 4, 8-legOffset);

  // Status dot
  const dotColors = {
    active:COLORS.green, thinking:COLORS.purple, blocked:COLORS.red,
    error:COLORS.red, retrying:COLORS.amber, rate_limited:COLORS.textDim, idle:'#374151'
  };
  ctx.fillStyle = dotColors[bot.state] || '#374151';
  ctx.beginPath();
  ctx.arc(bx+14, by-12, 3, 0, Math.PI*2);
  ctx.fill();

  // Blocked/error shake
  if(bot.state === 'error' || bot.state === 'blocked') {
    if(bot.blockShake > 0) {
      const shake = Math.sin(globalTime*30)*2*bot.blockShake;
      ctx.fillStyle = COLORS.red;
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('!', bx+6+shake, by-18);
      bot.blockShake -= 0.02*simSpeed;
    }
  }

  // Rate limit timer arc
  if(bot.state === 'rate_limited' && bot.rateLimitTimer > 0) {
    const pct = bot.rateLimitTimer / bot.rateLimitDuration;
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx+6, by-22, 6, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
    ctx.stroke();
    bot.rateLimitTimer -= (1/60)*simSpeed;
    if(bot.rateLimitTimer < 0) bot.rateLimitTimer = 0;
  }

  // Retrying spinner
  if(bot.state === 'retrying') {
    bot.retryAngle += 0.1*simSpeed;
    ctx.save();
    ctx.translate(bx+6, by-20);
    ctx.rotate(bot.retryAngle);
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0,0,4,0,Math.PI*1.5);
    ctx.stroke();
    // Arrow
    ctx.beginPath(); ctx.moveTo(3,-2); ctx.lineTo(5,1); ctx.lineTo(1,1); ctx.fill();
    ctx.restore();
  }

  // Task complete checkmark
  if(bot.completeMark > 0) {
    ctx.globalAlpha = bot.completeMark;
    ctx.fillStyle = COLORS.green;
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('✓', bx+6, by-20);
    ctx.globalAlpha = 1;
    bot.completeMark -= 0.02*simSpeed;
  }

  // Name label
  ctx.fillStyle = COLORS.textPri;
  ctx.font = '10px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(bot.name, bx+6, by+32);
}

function dimColor(hex, factor) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.floor(r*factor)},${Math.floor(g*factor)},${Math.floor(b*factor)})`;
}

// ═══════════════════════════════════════
// SECTION: Orb Renderer
// ═══════════════════════════════════════
function drawOrbs() {
  ORB_POOL.forEach(orb => {
    // Draw trail
    orb.trail.forEach((pt,i)=>{
      const a = (i/orb.trail.length)*0.3;
      ctx.fillStyle = `rgba(6,182,212,${a})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI*2);
      ctx.fill();
    });

    if(orb.active) {
      ctx.fillStyle = 'rgba(6,182,212,0.8)';
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 4, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Flash effect
    if(orb.flash > 0) {
      const size = 4 + 6*(1-orb.flash);
      ctx.fillStyle = `rgba(6,182,212,${orb.flash})`;
      ctx.beginPath();
      ctx.arc(orb.tx, orb.ty, size, 0, Math.PI*2);
      ctx.fill();
      orb.flash -= 0.05*simSpeed;
      if(orb.flash<0) orb.flash=0;
    }
  });
}

// ═══════════════════════════════════════
// SECTION: HUD Controller
// ═══════════════════════════════════════
function updateHUD() {
  const online = bots.filter(b=>b.state!=='idle').length;
  const tasks = bots.filter(b=>b.task).length;
  const errors = bots.filter(b=>b.state==='error').length;
  const rateLimited = bots.filter(b=>b.state==='rate_limited').length;

  document.getElementById('s-online').textContent = online;
  document.getElementById('s-tasks').textContent = tasks;

  const errEl = document.getElementById('s-errors');
  errEl.textContent = errors;
  errEl.className = 'value' + (errors>0?' error':'');

  const rlEl = document.getElementById('s-rate');
  rlEl.textContent = rateLimited;
  rlEl.className = 'value' + (rateLimited>0?' amber':'');
}

// ═══════════════════════════════════════
// SECTION: Interaction / Click Handling
// ═══════════════════════════════════════
canvas = document.getElementById('canvas');
const popEl = document.getElementById('popover');

// Mobile/Touch handling - adds tap support for small screens
const minTargetSize = 44; // Accessibility touch target minimum

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left);
  const my = (e.clientY - rect.top);

  // Check bots first (increase hit area for mobile)
  for(const bot of bots) {
    const hitMinY = bot.state === 'error' || bot.state === 'blocked' ? bot.y-24 : bot.y-18;
    if(mx >= bot.x-4 && mx <= bot.x+20 && my >= hitMinY && my <= bot.y+38) {
      showBotPopover(bot, e.clientX, e.clientY);
      return;
     }
   }

  // Check rooms (increased margins for mobile tap accuracy)
  for(const room of rooms) {
    const marginBuffer = isMobile() ? 20 : 10;
    if(mx >= room.x-marginBuffer && mx <= room.x+room.w+marginBuffer && my >= room.y-marginBuffer && my <= room.y+room.h+marginBuffer) {
      showRoomPopover(room, e.clientX, e.clientY);
      return;
     }
   }

  hidePopover();
});

let mobileCheckLast = 0, wasMobile = false;

canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left);
  const my = (e.clientY - rect.top);

  // Mobile check cached to avoid redundant calls (throttle 150ms)
  const currentMobile = window.innerWidth < 768;
  if(currentMobile !== wasMobile){wasMobile = currentMobile;}
  let marginBuffer = wasMobile ? 30 : 15;

  let hovering = false;
  // Mobile-only hit detection optimization (larger targets)
  for(const bot of bots) {
    if(mx >= bot.x-10 && mx <= bot.x+40 && my >= bot.y-30 && my <= bot.y+60) {
      canvas.style.cursor = 'pointer';
      hovering = true;
      break;
    }
  }

  if(!hovering) {
    for(const room of rooms) {
      const effectiveBuffer = marginBuffer * 1.5; // Slightly larger buffer for mobile touch accuracy
      if(mx >= room.x-effectiveBuffer && mx <= room.x+room.w+effectiveBuffer && my >= room.y-effectiveBuffer && my <= room.y+room.h+effectiveBuffer) {
        canvas.style.cursor = 'pointer';
        hovering = true;
        break;
      }
    }
  }
  if(!hovering) canvas.style.cursor = 'default';
});

document.addEventListener('click', (e) => {
  if(!popEl.contains(e.target) && e.target !== canvas) hidePopover();
}, {passive:true});

function formatTime(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0,8);
}

function showBotPopover(bot, cx, cy) {
  const dotColor = {active:COLORS.green,thinking:COLORS.purple,error:COLORS.red,rate_limited:COLORS.textDim,idle:'#374151',blocked:COLORS.red}[bot.state]||'#374151';
  let html = `<div class="pop-header"><div class="pop-title" style="color:${bot.color}">${bot.name}</div><div class="pop-close" onclick="hidePopover()">×</div></div>`;
  html += `<div class="pop-row"><span class="pop-label">Status</span><span class="pop-val"><span class="dot" style="background:${dotColor}"></span>${bot.state}</span></div>`;
  html += `<div class="pop-row"><span class="pop-label">Machine</span><span class="pop-val">${bot.machine}</span></div>`;
  html += `<div class="pop-row"><span class="pop-label">Room</span><span class="pop-val">${bot.room}</span></div>`;
  html += `<div class="pop-row"><span class="pop-label">Task</span><span class="pop-val">${bot.task||'Idle'}</span></div>`;
  html += `<div class="pop-log">`;
  bot.eventLog.slice(0,5).forEach(e=>{
    html += `<div><span class="ts">${formatTime(e.time)}</span>${e.type} — ${e.detail}</div>`;
  });
  if(bot.eventLog.length===0) html += `<div style="color:var(--text-dim)">No recent activity</div>`;
  html += `</div>`;
  popEl.innerHTML = html;
  positionPopover(cx, cy);
}

function showRoomPopover(room, cx, cy) {
  const botsHere = bots.filter(b=>b.room===room.id);
  let html = `<div class="pop-header"><div class="pop-title" style="color:${room.accent}">${room.name}</div><div class="pop-close" onclick="hidePopover()">×</div></div>`;
  html += `<div class="pop-row"><span class="pop-label">Agents Here</span><span class="pop-val">${botsHere.length}</span></div>`;
  botsHere.forEach(b=>{
    const dc = {active:COLORS.green,thinking:COLORS.purple,error:COLORS.red,rate_limited:COLORS.textDim,idle:'#374151'}[b.state]||'#374151';
    html += `<div class="pop-row"><span class="pop-val"><span class="dot" style="background:${dc}"></span>${b.name}</span><span class="pop-label">${b.state}</span></div>`;
  });
  const recentCount = room.eventLog.filter(e=>Date.now()-e.time<60000).length;
  html += `<div class="pop-row"><span class="pop-label">Events (60s)</span><span class="pop-val">${recentCount}</span></div>`;
  html += `<div class="pop-log">`;
  room.eventLog.slice(0,5).forEach(e=>{
    html += `<div><span class="ts">${formatTime(e.time)}</span>${e.type} — ${e.detail}</div>`;
  });
  if(room.eventLog.length===0) html += `<div style="color:var(--text-dim)">No recent activity</div>`;
  html += `</div>`;
  popEl.innerHTML = html;
  positionPopover(cx, cy);
}

function positionPopover(cx, cy) {
  popEl.style.display = 'block';
  const pw = 300, ph = popEl.offsetHeight;
  let left = cx + 12, top = cy - 20;
  if(left + pw > window.innerWidth) left = cx - pw - 12;
  if(top + ph > window.innerHeight) top = window.innerHeight - ph - 12;
  if(top < 52) top = 52;
  popEl.style.left = left+'px';
  popEl.style.top = top+'px';
}

function hidePopover() {
  popEl.style.display = 'none';
}
// Make global for onclick
window.hidePopover = hidePopover;

// ═══════════════════════════════════════
// SECTION: Speed & Fullscreen Controls
// ═══════════════════════════════════════
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    simSpeed = parseInt(btn.dataset.speed);
  });
});

document.getElementById('fs-btn').addEventListener('click', () => {
  if(!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(()=>{});
  } else {
    document.exitFullscreen();
  }
});

// ═══════════════════════════════════════
// SECTION: Canvas Setup & Resize
// ═══════════════════════════════════════
ctx = canvas.getContext('2d');
dpr = window.devicePixelRatio || 1;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight - 48;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  calcLayout();
    // Reposition bots to new seat coords
  if(bots.length && !bots[0].moving) {
    bots.forEach(bot => {
      const room = getRoomById(bot.room);
      if(room) {
        const seatIdx = room.seats.findIndex(s=>s.taken===bot.id);
        if(seatIdx>=0) {
          bot.x = room.seats[seatIdx].x;
          bot.y = room.seats[seatIdx].y;
          bot.targetX = bot.x;
          bot.targetY = bot.y;
            }
         }
      });
   }
}

// Mobile/Touch handling - adds tap support for small screens

window.addEventListener('resize', resize);
resize();
initBots();

// ═══════════════════════════════════════
// SECTION: Main Loop
// ═══════════════════════════════════════
function frame(ts) {
  const dt = lastTime ? Math.min((ts-lastTime)/1000, 0.1) : 0.016;
  lastTime = ts;
  globalTime += dt * simSpeed;
  errorScrollY += dt * 8 * simSpeed;

  // Event simulation
  eventAccum += dt * 1000 * simSpeed;
  if(eventAccum >= nextEventTime) {
    eventAccum = 0;
    nextEventTime = 2000 + Math.random()*4000;
    const evt = getNextEvent();
    processEvent(evt);
  }

  // Update
  bots.forEach(b => updateBotMovement(b, dt));
  updateOrbs(dt);
  dataCounter += dt * simSpeed * 0.3;

  // HUD throttle (1Hz)
  hudTimer += dt;
  if(hudTimer >= 1) { updateHUD(); hudTimer = 0; }

  // Draw
  ctx.clearRect(0, 0, layout.W, layout.H);

  // Building bg
  ctx.fillStyle = COLORS.bgBuilding;
  roundRect(ctx, layout.margin-4, layout.margin-4, layout.W-layout.margin*2+8, layout.H-layout.margin*2+8, 6);
  ctx.fill();

  // Corridor
  drawCorridor();

  // Rooms
  rooms.forEach(drawRoom);

  // Bots
  bots.forEach(drawBot);

  // Orbs
  drawOrbs();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
updateHUD();
})();