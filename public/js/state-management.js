/**
 * State Management & Event System
 * Extracted from inline script - sections 87-346
 */

// ═══════════════════════════════════════
// SECTION: State Management
// ═══════════════════════════════════════

/**
 * Initialize bots with seed positions in rooms
 * Sets up bot state machines and assigns seats
 */
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
  // Assign seats after initialization
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

/**
 * Move bot to target room - handles pathing through corridor system
 */
function moveBot(bot, targetRoomId) {
  if(bot.room === targetRoomId && !bot.moving) return;
  const srcRoom = getRoomById(bot.room);
  const dstRoom = getRoomById(targetRoomId);
  if(!srcRoom || !dstRoom) return;

  // Free seat in current room
  srcRoom.seats.forEach(s => { 
    if(s.taken===bot.id) s.taken=null; 
  });

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

/**
 * Update bot movement delta based on time - handles path progression
 */
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

/**
 * Demo event sequence for animation - cycles through common operations
 */
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

/**
 * Get next event from demo sequence - rotates automatically
 */
function getNextEvent() {
  const evt = DEMO_SEQUENCE[demoIdx % DEMO_SEQUENCE.length];
  demoIdx++;
  return {...evt, timestamp: Date.now()};
}

/**
 * Process received event - update both bot state and room logs
 */
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

/**
 * Translate event type into human-readable description
 */
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initBots, moveBot, updateBotMovement, processEvent, getNextEvent };
}
