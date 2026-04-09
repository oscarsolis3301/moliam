/**
 * Canvas Drawing & Rendering Engine
 * Extracted from inline script - sections 386-823 (drawing functions)
 */

// ═══════════════════════════════════════
// SECTION: Room Renderer
// ═══════════════════════════════════════

let globalTime = 0;
let terminalLines = [];
for(let i=0;i<8;i++) terminalLines.push({w:20+Math.random()*60, y:i*6});

// Room activity states
let engCursorBlink = 0;
let dataBarHeights = [0.3, 0.5, 0.7, 0.4];
let dataCounter = 0;
let commSignalPhase = 0;
let errorScrollY = 0;

/**
 * Draw a room - main entry point with border & accent handling
 */
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

/**
 * Dispatch room-type drawing functions based on room ID
 */
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

/**
 * Draw Engineering room - monitors + terminal + API packet visual
 */
function drawEngineering(x,y,w,h,room) {
    // Monitors
  const hasBot = bots.some(b=>b.room==='engineering'&&!b.moving&&b.state==='active');
  for(let i=0;i<3;i++){
    const mx=x+8+i*28, my=y+4;
    ctx.fillStyle = '#1a2332';
    
    // Monitor check: is there active engine running?
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

/**
 * Draw Planning room - whiteboard + sticky notes visualization
 */
function drawPlanning(x,y,w,h,room) {
    // Whiteboard
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(x+4,y+2,w-8,h*0.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.strokeRect(x+4,y+2,w-8,h*0.35);

    // Sticky notes - count active planning bots for dynamic sticky display
  const colors = ['#fbbf24','#a78bfa','#34d399','#f87171'];
  const stickyCount = Math.min(4, 2 + Math.floor(bots.filter(b=>b.room==='planning'&&b.state==='active').length));
  for(let i=0;i<stickyCount;i++){
    ctx.fillStyle = colors[i%colors.length];
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x+10+i*18, y+6+((i%2)*10), 8, 8);
    ctx.globalAlpha = 1;
   }
}

/**
 * Draw Comms room - antenna + signal arcs + chat log visualization
 */
function drawComms(x,y,w,h,room) {
    // Antenna
  const ax = x+w/2, ay = y+4;
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax,ay+12); ctx.lineTo(ax,ay); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax-8,ay+12); ctx.lineTo(ax,ay); ctx.lineTo(ax+8,ay+12); ctx.stroke();

    // Signal arcs - rotating waves showing active comms
  commSignalPhase += 0.02 * simSpeed;
  for(let i=1;i<=3;i++){
    const a = 0.3+0.3*Math.sin(commSignalPhase+i*0.8);
    ctx.strokeStyle = `rgba(16,185,129,${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ax, ay, 6+i*6, -Math.PI*0.8, -Math.PI*0.2);
    ctx.stroke();
   }

    // Chat log - scrolling text lines for recent messages
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(x,y+h-36,w,32);
  for(let i=0;i<4;i++){
    ctx.fillStyle = 'rgba(16,185,129,0.3)';
    ctx.fillRect(x+4, y+h-32+i*7, 15+((i*17+7)%40), 1);
   }
}

/**
 * Draw Data room - bar chart + database icon + counter display
 */
function drawData(x,y,w,h,room) {
    // Bar chart - animated heights based on data flow
  const barW = (w-20)/4;
  dataBarHeights = dataBarHeights.map((bh,i) => {
    const target = 0.2 + 0.6*Math.abs(Math.sin(globalTime*0.5+i*1.2));
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

     // DB icon - cylinder shape with counter display
  const dbx = x+w-20, dby = y+8;
  ctx.fillStyle = COLORS.amber;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(dbx,dby,8,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(dbx-8,dby,16,10);
  ctx.beginPath(); ctx.ellipse(dbx,dby+10,8,4,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

     // Counter - data flow rate visualization
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '9px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(Math.floor(dataCounter).toString(), dbx-6, dby+22);
}

/**
 * Draw all active orbs in the pool with trail and flash effects
 */
function drawOrbs() {
  ORB_POOL.forEach(orb => {
   // Draw trail - fading line behind orb position
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

     // Flash effect on hit completion
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

/**
 * Draw Error room - caution stripes + warning indicator + stack trace scrolling
 */
function drawError(x,y,w,h,room) {
    // Caution stripes - blinking diagonal red/transparent pattern
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

    // Warning triangle - active error indicator with pulse
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

    // Stack trace lines - scrolling red lines indicating error logs
  ctx.save();
  ctx.beginPath();
  ctx.rect(x,y+30,w,h-46);
  ctx.clip();
  for(let i=0;i<6;i++){
    const ly = y+34+((i*8+errorScrollY)%(h-46));
    ctx.fillStyle = 'rgba(239,68,68,0.2)';
    ctx.fillRect(x+4, ly, 10+(i*13%50), 1);
   }
  ctx.restore();
}

/**
 * Draw Rate Limit room - lounge concept with couch + bookshelf + coffee
 */
function drawRateLimit(x,y,w,h,room) {
    // Couch - curved furniture element using roundRect helper function
  ctx.fillStyle = '#2d2040';
  const couchY = y+h-28;
  roundRect(ctx, x+8, couchY, w*0.6, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#3d2d55';
  roundRect(ctx, x+8, couchY-6, w*0.6, 8, 3);
  ctx.fill();

    // Bookshelf - multi-colored rectangular blocks in background area
  const bx = x+w-24;
  for(let i=0;i<4;i++){
    ctx.fillStyle = ['#4a3728','#2d4a35','#3d2d55','#4a3728'][i];
    ctx.fillRect(bx, y+8+i*10, 16, 8);
   }

    // Coffee cup - simplified curved rectangle + handle arc for visual interest
  ctx.fillStyle = '#6B7280';
  ctx.fillRect(x+w*0.7, couchY+2, 8, 10);
  ctx.strokeStyle = '#6B7280';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x+w*0.7+10, couchY+6, 3, -Math.PI/2, Math.PI/2);
  ctx.stroke();
}

/**
 * Helper: Draw rounded rectangle with quadratic curves
 */
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawRoom, getRoomById, drawRoomInterior };
}
