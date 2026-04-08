function drawError(x,y,w,h) {
   // Error cone (exclamation mark)
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

   // Stack trace lines
  ctx.save();
  ctx.beginPath();
  ctx.rect(x,y+30,w,h-46);
  ctx.clip();
  for(let i=0;i<6;i++) {
    const ly = y+34+((i*8+errorScrollY)%(h-46));
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
const isMobile = () => window.innerWidth <= 768;
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

canvas.addEventListener('pointermove', (e) => {
  if(!isMobile()) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left);
  const my = (e.clientY - rect.top);

  let hovering = false;
  for(const bot of bots) {
    if(mx >= bot.x-10 && mx <= bot.x+26 && my >= bot.y-30 && my <= bot.y+44) {
      canvas.style.cursor = 'pointer';
      hovering = true;
      break;
     }
   }
  if(!hovering) {
    for(const room of rooms) {
      const marginBuffer = isMobile() ? 30 : 15;
      if(mx >= room.x-marginBuffer && mx <= room.x+room.w+marginBuffer && my >= room.y-marginBuffer && my <= room.y+room.h+marginBuffer) {
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
});

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
resize();
initBots();

// Exit animation loop cleanly on page unload
function shutdownHQ() {
  cancelAnimationFrame(animationId);
}
window.__moliam_cleanup__ = shutdownHQ;

// ══════════════════════
// SECTION: Main Loop
// ═══════════════════════════════════════
let animationId;
let frameTs = 0; // track timestamp between loops

function frame() {
  const newTime = performance.now();
  const dt = frameTs > 0 ? Math.min((newTime-frameTs)/1000, 0.1) : 0.016;
  frameTs = newTime;
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

  animationId = requestAnimationFrame(frame);
}

// Start loop once on init
if (typeof finalInit === 'undefined') {
  frameTs = performance.now();
  requestAnimationFrame(frame);
}
updateHUD();
