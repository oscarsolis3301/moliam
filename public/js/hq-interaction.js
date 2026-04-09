/**
 * Interaction Handlers, Animation Loop & Canvas Control
 * Extracted from inline script - sections 850-1082
 */

// Mobile/Touch handling - adds tap support for small screens
const isMobile = () => window.innerWidth <= 768;
const minTargetSize = 44; // Accessibility touch target minimum

/**
 * Set up click detection on canvas - handles bot and room interaction
 */
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left);
  const my = (e.clientY - rect.top);

     // Check bots first with larger hit area for accessibility/mobile
  for(const bot of bots) {
    const hitMinY = bot.state === 'error' || bot.state === 'blocked' ? bot.y-24 : bot.y-18;
    if(mx >= bot.x-4 && mx <= bot.x+20 && my >= hitMinY && my <= bot.y+38) {
      showBotPopover(bot, e.clientX, e.clientY);
      return;
      }
     }

  // Check rooms with increased margins for mobile tap accuracy
  for(const room of rooms) {
    const marginBuffer = isMobile() ? 20 : 10;
    if(mx >= room.x-marginBuffer && mx <= room.x+room.w+marginBuffer && my >= room.y-marginBuffer && my <= room.y+room.h+marginBuffer) {
      showRoomPopover(room, e.clientX, e.clientY);
      return;
      }
      }

   hidePopover();
});

/**
 * Handle pointer move events for hover states - mostly mobile-focused
 */
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
   // Also check rooms for hover state if not on bot
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

// Handle clicks anywhere outside canvas/popover to close popups
document.addEventListener('click', (e) => {
   if(!popEl.contains(e.target) && e.target !== canvas) hidePopover();
});

/**
 * Format timestamp to readable time string for log entries
 */
function formatTime(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0,8);
}

/**
 * Display bot details in populated popover - generates HTML with event history
 */
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

/**
 * Display room details in popover - generates HTML with listing of bots present and event log
 */
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

/**
 * Position popover at click coordinates with boundary checking
 */
function positionPopover(cx, cy) {
  popEl.style.display = 'block';
  const pw = 300, ph = popEl.offsetHeight;
  let left = cx + 12, top = cy - 20;
  
   // Boundary checks - prevent popup from going off-screen
  if(left + pw > window.innerWidth) left = cx - pw - 12;
  if(top + ph > window.innerHeight) top = window.innerHeight - ph - 12;
  if(top < 52) top = 52;
  
  popEl.style.left = left+'px';
  popEl.style.top = top+'px';
}

/**
 * Hide popover and reset display state
 */
function hidePopover() {
  popEl.style.display = 'none';
}

// Make global for onclick handlers (HTML popup close buttons)
window.hidePopover = hidePopover;

/**
 * Setup speed control - multi-touch support for accessibility on mobile
 */
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    simSpeed = parseInt(btn.dataset.speed);
      });
});

/**
 * Fullscreen toggle for immersive animation mode
 */
document.getElementById('fs-btn').addEventListener('click', () => {
  if(!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(()=>{});
     } else {
    document.exitFullscreen();
        }
});

/**
 * Canvas initialization with DPR scaling support
 */
ctx = canvas.getContext('2d');
dpr = window.devicePixelRatio || 1;

// Global resize handler - coordinates bot repositioning logic automatically
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight - 48;
  
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
   // Recalculate layout and position bots accordingly
  
   calcLayout();
   
       // Reposition bots to new seat coordinates after resize
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

// Register resize event listener and initialize immediately
window.addEventListener('resize', resize);
resize();
initBots(); // Initial bot assignment to seats

/**
 * Main animation frame loop - orchestrates all game system updates + rendering
 */
function frame(ts) {
  const dt = lastTime ? Math.min((ts-lastTime)/1000, 0.1) : 0.016;
  lastTime = ts;
  globalTime += dt * simSpeed;
  errorScrollY += dt * 8 * simSpeed;

   // Event simulation system - auto-trigger events based on timing accumulator
  eventAccum += dt * 1000 * simSpeed;
  if(eventAccum >= nextEventTime) {
    eventAccum = 0;
    nextEventTime = 2000 + Math.random()*4000;
    const evt = getNextEvent();
    processEvent(evt);
      }

    // System updates - move all active bots and process orb communications

  bots.forEach(b => updateBotMovement(b, dt));
  updateOrbs(dt);

  dataCounter += dt * simSpeed * 0.3;

   // HUD update throttled to 1Hz maximum for performance
  
   hudTimer += dt;
  if(hudTimer >= 1) { 
    updateHUD(); 
    hudTimer = 0; 
          }

       // Clear canvas and draw background building with rounded rectangle border
    
  ctx.clearRect(0, 0, layout.W, layout.H);

         // Draw main building outline
  
  ctx.fillStyle = COLORS.bgBuilding;
  roundRect(ctx, layout.margin-4, layout.margin-4, layout.W-layout.margin*2+8, layout.H-layout.margin*2+8, 6);
  ctx.fill();

       // Draw corridor separator with dashed center line
  
  drawCorridor();

     // Draw all rooms in current configuration
  
  rooms.forEach(drawRoom);

      // Draw active bots on canvas
    
  bots.forEach(drawBot);

   // Draw communication orbs between connected bots
  
  drawOrbs();

   requestAnimationFrame(frame);
}

// Start the main animation loop immediately
requestAnimationFrame(frame);
updateHUD(); // Initial HUD display update

// Export if in module context (for future enhancements)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    showBotPopover, 
    showRoomPopover, 
    positionPopover, 
    hidePopover,
    formatTime,
    resize,
    frame 
  };
}
