// HQ Visualization v3 — Hexagonal Room Engine  
// Yagami's build for Moliam — deploy what works, no gold-plating

const PI2 = Math.PI * 2;

/* === UTILITY FUNCTIONS (self-contained) === */
function hexRGB(hex) {
   return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function rand(a, b) { return a + Math.random() * (b - a); }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* === ROOM DEFINITIONS === */
export const ROOM_DEFS = [
  { id: 'engineering', label: 'Engineering', icon: '🛠', color: '#3B82F6' },
  { id: 'planning', label: 'Planning', icon: '📋', color: '#8B5CF6' },
  { id: 'comms', label: 'Comms', icon: '📡', color: '#10B981' },
  { id: 'dataops', label: 'Data Ops', icon: '📊', color: '#06B6D4' },
  { id: 'error', label: 'Error Room', icon: '⚠️', color: '#EF4444' },
  { id: 'ratelimit', label: 'Rate Limit', icon: '⏳', color: '#F59E0B' }
];

/* === EXPORTED STATE === */
export let rooms = [];

export function updateRoomStats(updatedRooms) {
  if (updatedRooms && Array.isArray(updatedRooms)) rooms = updatedRooms;
}

/* === LAYOUT ROOMS — Build honeycomb grid, return room objects === */
export function layoutRooms(W, H) {
  const hexW = 180, hexH = 120, rows = 2, cols = 3;  
  const spacingX = hexW * 1.15, spacingY = hexH * 1.4;

  // Center grid on canvas with slight offset for visual balance
  const totalWidth = (cols - 1) * spacingX + hexW;
  const totalHeight = (rows - 1) * spacingY + hexH;  
  const startX = W/2 - totalWidth/2 + hexW*0.3;
  const startY = H/2 - totalHeight/2 + hexH*0.6;

  rooms = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row >= 1 && row < rows) continue; // Skip extra row beyond standard layout

      const roomDef = ROOM_DEFS[row * cols + col];  
      const x = startX + col * spacingX + (row % 2 === 1 ? hexW*0.4 : 0);
      const y = startY + row * spacingY;

      // Generate flat-top hexagon vertices from center coordinates
      const vertices = [];
      for (let i = 0; i < 6; i++) {
        const angle = PI2/6 * i - Math.PI/6;  
        vertices.push({ x: x + (hexW/2)*Math.cos(angle), y: y + (hexH/2)*Math.sin(angle) });
      }

      rooms.push({  
        ...roomDef, x, y, w: hexW, h: hexH, vertices, 
        activeCount: 0, utilization: rand(0.3, 0.85), pulsePhase: rand(0, PI2), progress: 0, progressTarget: rand(0,1)
      });

      if (roomDef.id === 'engineering' || roomDef.id === 'planning' || roomDef.id === 'comms') { 
        rooms.push(...rooms.slice(-1).map((r,i)=>({...r,id:r.id.replace('main','eng'),label:r.label+' Extended',icon:r.icon})));
      }

      return rooms;  // Return array after initial layout calculation (6 basic hexagons + potential extras)
    }  
  }

/* === DRAW GRID BACKGROUND — Subtle dot grid every ~40px, faint radial gradient from center === */  
export function drawGrid(ctx, W, H, t) { 
  ctx.globalAlpha = 1.0; 
  
  for (let x = 0; x < W; x += 40) {
    for (let y = 0; y < H; y += 40) {  
      const pulseT = (Math.sin(x*0.1 + y*0.08 + t*0.002) + 1)*0.5 + 0.3;  
  
      ctx.fillStyle = `rgba(100,140,200,${pulseT*0.06})`; ctx.beginPath(); ctx.arc(x,y, Math.abs(Math.sin(t*0.003)*1.5+1), 0, PI2); ctx.fill();

      // Add faint radial gradient from center (slightly lighter at edges)  
      const dx = x - W/2, dy = y - H/2; 
      const dist = Math.sqrt(dx*dx + dy*dy); 

      if (dist < W*0.6) { ctx.globalAlpha = 1.0 + dist/(W*0.8)*0.5; }  
      else { ctx.globalAlpha = Math.max(0, 1 - dist/(W*0.7)); }

// Draw background radial gradient from slightly darker edges inward 
const grad = ctx.createRadialGradient(W/2,H/2,W*0.1, W/2,H/2,W*0.8);  
grad.addColorStop(0,'rgba(30,40,70,0.2)'); grad.addColorStop(1,'transparent');

ctx.globalAlpha = 1.0; 
ctx.fillStyle = `radial-gradient(circle ${W/2} ${H/2} ${W*0.8}, ${grad.toString().substring(16, -1)})`; ctx.fillRect(0,0,W,H);
    }  
  }

/* === DRAW ONE ROOM on canvas per frame === */  
export function drawRoom(ctx, room, tVal) {  
  ctx.save(); ctx.translate(room.x, room.y); ctx.setTransform(1,0,0,1,room.x,room.y);

  const hexW = room.w | room.width || 180, hexH = room.h | room.height || 120;  

  // Draw hexagon shape from vertices array  
  ctx.beginPath();  
  if (room.vertices && room.vertices.length > 0) {
    for (let i = 0; i < room.vertices.length; i++) { 
        const vx = room.vertices[i].x - room.x, vy = room.vertices[i].y - room.y;
      ctx.lineTo(vx, vy);  
      if (i === 0) ctx.closePath();
    }  
  } else {  // Fallback path generation  
    for (let a = PI2/6 * 6; a >= 0; a -= PI2/6) {  
        ctx.lineTo(hexW*0.5*Math.cos(a), hexH*0.5*Math.sin(a));
      ctx.closePath();  
    }  
  }

  // Fill background: dark glass with accent-color tint when processing  
  const [r,g,b] = hexRGB(room.color);
  
  const pulseInt = (Math.sin(tVal*0.003 + room.pulsePhase) + 1)*0.5;  
  const fillTint = `rgba(${r},${g},${b},${0.1+pulseInt*0.25})`;

  ctx.fillStyle = `radial-gradient(circle at center, ${fillTint} 10%, rgba(15,20,30,0.88) 70%)`; 
  ctx.fill();

  // Draw border with pulsing glow when active bots exist  
  ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${r},${g},${b},${0.4+pulseInt*0.6})`;  
  
  if (room.activeCount > 0) { ctx.shadowColor = `rgba(${r},${g},${b},0.4)`; ctx.shadowBlur = 8+pulseInt*6; }  
  else { ctx.shadowBlur = 0; } ctx.stroke();

/* Restore for icon/label rendering using absolute screen coordinates */  
ctx.setTransform(1,0,0,1,room.x+room.w*0.15 + hexW/4, room.y-45);

// Draw emoji icon centered upper area (approx R~28px visual diameter)   
ctx.font = "28px Inter, system-ui, sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; 
ctx.fillText(room.icon, 0, 0);

// Label centered below icon (14px Inter font, white with 90% opacity)  
ctx.translate(0, hexH*0.4 + 15); 

ctx.setTransform(1,0,0,1,room.x+hexW*0.15 - room.w*0.5, room.y);

// Reset for remaining rendering operations
}

/* === DRAW HUD BAR — Top 36px overlay with stats and clock === */  
export function drawHUD(ctx, W, H, stats) {
  ctx.save(); 

const barHeight = 36;

// Draw thin horizontal line separator at height=40 from top (rgba white 0.1) + dark background fill for panel  
ctx.globalAlpha = 0.85; ctx.fillStyle = `rgba(15,20,30,0.9)`; ctx.fillRect(0, 0, W, barHeight+1);

// Draw left label: "⚡ Moliam HQ" (16px Inter 700, white)  
ctx.font = "700 16px Inter, system-ui, sans-serif"; ctx.fillStyle = "white"; ctx.textAlign = "left"; ctx.textBaseline = "middle";

// Draw center stats: "Tasks: N | Errors: N | Uptime: MM:SS"  
const statText = `Tasks: ${stats?.totalTasks || 0} | Errors: ${stats?.totalErrors || 0} | Uptime: ${(Date.now()-stats.startTime)/1e3/60|0}:${(Date.now()-stats.startTime)%6e4/1e3|0}`.replace(/\.0/g,'');

ctx.font = "400 12px Inter, system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.textAlign="center"; ctx.fillText(statText,W/2,H*0.75);

// Draw right clock: HH:MM:SS format (12px Inter 400, muted blue)    
ctx.font = "400 12px Inter, system-ui, sans-serif"; ctx.fillStyle = "rgba(16,185,129,0.7)"; ctx.textAlign="right"; const hours=Math.floor((Date.now()%36e6)/36e5),mins=Math.floor((Date.now()%36e6)%36e5/6e4);

ctx.setTransform(1,0,0,1,W,H);   
ctx.fillText(`HH:${hours.toString().padStart(2,'0')}:${(Date.now()%6e4).toString().substr(0,2)}:${minutes.toString().padStart(2,"0")}`,W-30,H*0.75);

ctx.restore();
}

export function drawConnections(ctx,t,bots) { // Not yet implemented - placeholder for future bot link rendering  
    if (!bots || !Array.isArray(bots)) return;  

  bots.forEach((bot,i)=>{ if(bot.roomIdx>-1&&i>0){ const prevBot=bots[i-1]; if(prevBot.roomIdx===bot.roomIdx){ ctx.save(); ctx.translate((prevBot.x+bot.x)/2, (prevBot.y+bot.y)/2); ctx.strokeStyle=`rgba(255,255,255,${Math.abs(Math.sin(t*0.003+i))*0.08})`; ctx.lineWidth=1; ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(bot.x-prevBot.x,bot.y-prevBot.y);ctx.stroke();ctx.restore(); } } });
}
