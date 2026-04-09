/**
 * Communication & Visualization System - Orbs, HUD, Interaction
 * Extracted from inline script - sections 346-829
 */

// ═══════════════════════════════════════
// SECTION: Communication Visualizer
// ═══════════════════════════════════════

const ORB_POOL = [];
for(let i=0;i<10;i++) ORB_POOL.push({active:false,x:0,y:0,sx:0,sy:0,tx:0,ty:0,t:0,dur:0.6,cpx:0,cpy:0,trail:[]});

/**
 * Spawn communication orb between sender and receiver bots
 * Creates animated visual connection showing active messages
 */
function spawnOrb(sender, receiver) {
  let orb = ORB_POOL.find(o=>!o.active);
  if(!orb) orb = ORB_POOL[0]; // recycle oldest inactive orb
  
  const sameRoom = sender.room === receiver.room;
  orb.active = true;
  orb.sx = sender.x; 
  orb.sy = sender.y - 20;
  orb.tx = receiver.x; 
  orb.ty = receiver.y - 20;
  orb.t = 0;
  orb.dur = sameRoom ? 0.3 : 0.6; // faster animation if in same room
  orb.cpx = (orb.sx+orb.tx)/2;
  orb.cpy = Math.min(orb.sy,orb.ty) - 40;
  orb.flash = 0;
  orb.trail = [];
}

/**
 * Update all active orbs in the pool with easing animation and trail effects
 */
function updateOrbs(dt) {
  ORB_POOL.forEach(orb => {
    if(!orb.active) return;
    
    orb.t += dt * simSpeed;
    
    // Ease function for smooth Bezier-like arc movement
    const p = Math.min(orb.t / orb.dur, 1);
    const ease = p < 0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
    const inv = 1-ease;
    
    // Bezier curve calculation for smooth orbital path
    orb.x = inv*inv*orb.sx + 2*inv*ease*orb.cpx + ease*ease*orb.tx;
    orb.y = inv*inv*orb.sy + 2*inv*ease*orb.cpy + ease*ease*orb.ty;
    
    // Trail effect - history of positions for visual connection
    orb.trail.push({x:orb.x, y:orb.y, a:0.3});
    if(orb.trail.length>15) orb.trail.shift();
    
    if(p >= 1) {
      orb.flash = 1.0;
      orb.active = false;
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

  // Update DOM elements with real-time stats
  document.getElementById('s-online').textContent = online;
  document.getElementById('s-tasks').textContent = tasks;

  const errEl = document.getElementById('s-errors');
  errEl.textContent = errors;
  errEl.className = 'value' + (errors>0?' error':'');

  const rlEl = document.getElementById('s-rate');
  rlEl.textContent = rateLimited;
  rlEl.className = 'value' + (rateLimited>0?' amber':'');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { updateHUD, spawnOrb, updateOrbs };
}
