/**
 * Shared drawing utilities for all frontend modules
 * Dedupe: These functions exist in duplicates across hero-interactions.js and script-main.js
 */

// ─── Round rect helper (used by 2× files) ───
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y,r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ─── Error cone (exclamation mark) ───
function drawError(ctx, x, y, w, h) {
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
    const ly = y+34+((i*8)%(h-46));
    ctx.fillStyle = 'rgba(239,68,68,0.2)';
    ctx.fillRect(x+4, ly, 10+(i*13%50), 1);
  }
  ctx.restore();
}

// ─── Rate limit couch helper ───
function drawRateLimit(ctx, x, y, w, h) {
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

// ─── Color dimmer utility ───
function dimColor(hex, factor) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round((num >> 16 & 255) * (1 - factor)));
  const g = Math.max(0, Math.round((num >> 8 & 255) * (1 - factor)));
  const b = Math.max(0, Math.round((num & 255) * (1 - factor)));
  return `rgb(${r},${g},${b})`;
}

// ─── Time formatter ───
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ─── Popover management ───
function showBotPopover(bot, cx, cy) {
  const pop = $('#popover');
  if (!pop) return;
  pop.style.cssText = `left:${cx+15}px;top:${cy-60}px;display:block;background:#1e293b;color:#f8fafacc;border-color:${bot.color || '#3b82f6'}`;
  pop.innerHTML = `<strong>${bot.name || 'Bot'}</strong><br>Status: ${statusText(bot.state)}<br>Latency: ${bot.latency || '?'}ms<br>Last action: ${formatTime(bot.lastAction)}`;
}

function showRoomPopover(room, cx, cy) {
  const pop = $('#popover');
  if(!pop)return;
  pop.style.cssText=`left:${cx+15}px;top:${cy-60}px;display:block;background:#1e293b;color:#f8fafacc`;
  pop.innerHTML = `<strong>${room.name}</strong><br>Status: Active<br>Agents: ${room.agentCount || 1}<br>Last heartbeat: ${formatTime(room.lastHeartbeat)}`;
}

function hidePopover() {
  const pop = $('#popover');
  if (pop) pop.style.display = 'none';
}

function positionPopover(cx, cy) {
  const pop = $('#popover');
  if (!pop) return;
  
  let left = cx + 15;
  const width = 200; 
  
  if (left + width > window.innerWidth - 10) {
    left = cx - 15 - width;
  }

  pop.style.left = left + 'px';
  pop.style.top = (cy - 60) + 'px';
}

function statusText(state) {
  switch(state) {
    case 'running': return 'Processing tasks...';
    case 'idle': return 'Waiting for work';
    case 'error': return 'Error state';
    case 'rate_limited': return 'Rate limited';
    default: return (state || 'Unknown');
  }
}

// ─── Export globally for backward compat ───
if (typeof window !== 'undefined') {
  window.drawError = drawError;
  window.drawRateLimit = drawRateLimit;
  window.roundRect = roundRect;
  window.dimColor = dimColor;
  window.formatTime = formatTime;
  window.showBotPopover = showBotPopover;
  window.showRoomPopover = showRoomPopover;
  window.hidePopover = hidePopover;
  window.positionPopover = positionPopover;
}
