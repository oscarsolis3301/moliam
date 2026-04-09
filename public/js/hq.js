// ═══════════════════════════════════════
// HQ Dashboard JavaScript - Extracted from hq.html
// All inline JS moving external for self-improvement.
// ═══════════════════════════════════════

(function() {
  'use strict';

  // SECTION: Configuration & Constants
   const COLORS = {
      bgDeep:'#0B0E14', bgBuilding:'#111827', bgRoom:'#1F2937', borderRoom:'#374151',
      accentBlue:'#3B82F6', accentPurple:'#8B5CF6', accentGreen:'#10B981',
      accentAmber:'#F59E0B', accentRed:'#EF4444', accentCyan:'#06B6D4',
      textPrimary:'#F9FAFB', textSecondary:'#9CA3AF', textDim:'#6B7280'
   };
   
   const ROOM_DEFS = [
      { id:'engineering', name:'ENGINEERING', floor:2, col:0, accent:COLORS.accentBlue },
      { id:'planning',    name:'PLANNING',    floor:2, col:1, accent:COLORS.accentPurple },
      { id:'comms',       name:'COMMS',       floor:2, col:2, accent:COLORS.accentGreen },
      { id:'data',        name:'DATA',        floor:1, col:0, accent:COLORS.accentAmber },
      { id:'error',       name:'ERROR ROOM',  floor:1, col:1, accent:COLORS.accentRed },
      { id:'ratelimit',   name:'RATE LIMIT LOUNGE', floor:1, col:2, accent:'#9A7B2A' },
   ];
   
   const BOT_DEFS = [
      { id:'yagami', name:'Yagami', color:'#3B82F6' },
      { id:'ada',    name:'Ada',    color:'#8B5CF6' },
      { id:'soni',   name:'Soni',   color:'#10B981' },
      { id:'willow', name:'Willow', color:'#F59E0B' },
      { id:'reaper', name:'Reaper', color:'#EF4444' },
   ];
   
   const STATUS_COLORS = {
      active:COLORS.accentGreen, thinking:COLORS.accentPurple, blocked:COLORS.accentRed,
      error:COLORS.accentRed, retrying:COLORS.accentAmber, rate_limited:COLORS.textDim, idle:'#374151'
   };

   let speedMultiplier = 1;
   let now = 0;

   // SECTION: Canvas Setup
   const canvas = document.getElementById('c');
   const ctx = canvas.getContext('2d');
   let W, H, dpr;
   let layout = { rooms: {}, corridor: {} };

   function resize() {
      dpr = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight - 48;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      recalcLayout();
   }

   function recalcLayout() {
      const margin = 20, gap = 8, corridorH = 40;
      const rw = (W - margin * 2 - gap * 2) / 3;
      const rh = (H - margin * 2 - corridorH) / 2;
      const corridorY = margin + rh;
      layout.corridor = { x: margin, y: corridorY, w: W - margin*2, h: corridorH, midY: corridorY + corridorH/2 };
      ROOM_DEFS.forEach(def => {
         const row = def.floor === 2 ? 0 : 1;
         const x = margin + def.col * (rw + gap);
         const y = row === 0 ? margin : margin + rh + corridorH;
         layout.rooms[def.id] = {
            x, y, w: rw, h: rh, def,
            seats: [
               { x: x + rw*0.2, y: y + rh*0.6 },
               { x: x + rw*0.4, y: y + rh*0.6 },
               { x: x + rw*0.6, y: y + rh*0.6 },
               { x: x + rw*0.8, y: y + rh*0.6 },
            ],
            doorX: x + rw/2,
            doorY: row === 0 ? y + rh : y,
         };
      });
   }

// Store resize handler for cleanup
let windowResizeHandlerRef = () => resize();

window.addEventListener('resize', windowResizeHandlerRef);
resize();

// Expose cleanup function
window.__moliam_cleanup_hq_js__ = function() {
  if (typeof windowResizeHandlerRef === 'function') {
    window.removeEventListener('resize', windowResizeHandlerRef);
  }
};


   const state = {
      bots: {},
      orbs: [],
      orbPool: [],
      roomEffects: {},
      tasks: {},
      globalEvents: [],
   };

   BOT_DEFS.forEach(def => {
      const startRooms = ['engineering','planning','comms','data','engineering'];
      const rm = startRooms[BOT_DEFS.indexOf(def)];
      const seat = layout.rooms[rm].seats[BOT_DEFS.indexOf(def) % 4];
      state.bots[def.id] = {
         ...def, x: seat.x, y: seat.y, targetX: seat.x, targetY: seat.y,
         room: rm, prevRoom: rm, status: 'idle', task: null, events: [],
         walkPhase: 0, walkTimer: 0, moving: false, path: [],
         breathOffset: Math.random() * Math.PI * 2,
         rateLimitEnd: 0, dimmed: false,
      };
   });

   ROOM_DEFS.forEach(def => {
      state.roomEffects[def.id] = {
         terminalLines: Array.from({length:8}, () => Math.random()*0.6+0.2),
         terminalScroll: 0, barHeights: [0.3,0.5,0.7,0.4], barTargets: [0.3,0.5,0.7,0.4],
         stickyNotes: [{x:0.2,y:0.3,c:'#FFD700'},{x:0.5,y:0.2,c:'#FF69B4'},{x:0.7,y:0.35,c:'#87CEEB'}],
         stickyOpacity: 1, whiteboardGlow: 0, signalPulse: 0,
         chatLines: Array.from({length:6}, () => Math.random()*0.5+0.2),
         warningPulse: 0, cursorBlink: 0, dbCounter: 0, cooldowns: {},
         apiPackets: [], caution: 0, activeMonitor: -1,
      };
   });

   // Pre-allocate orb pool
   for (let i = 0; i < 10; i++) {
      state.orbPool.push({ active: false, x:0, y:0, sx:0, sy:0, tx:0, ty:0, t:0, dur:600, trail:[] });
   }

   function getOrbFromPool() {
      let orb = state.orbPool.find(o => !o.active);
      if (!orb) { orb = state.orbPool[0]; }
      orb.active = true; orb.t = 0; orb.trail = [];
      return orb;
   }

   function addBotEvent(botId, type, desc) {
      const bot = state.bots[botId];
      if (!bot) return;
      const ts = new Date();
      const entry = { time: ts, type, desc, ts: ts.toTimeString().slice(0,8) };
      bot.events.unshift(entry);
      if (bot.events.length > 50) bot.events.length = 50;
      state.globalEvents.unshift({ ...entry, agent: botId });
      if (state.globalEvents.length > 100) state.globalEvents.length = 100;
   }

})();