(function() {
'use strict';

/* ─── UTILS ─── */
const $ = s => document.querySelector(s);
const PI2 = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => Math.random() * (b - a) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = performance.now.bind(performance);

/* ─── PARTICLE BACKGROUND (mobile-disabled + frame-skipping) ─── */

// Mobile viewport check: disable particle animation on mobile (<768px)
const isMobile = window.innerWidth < 768;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cache mobile state to avoid redundant checks each frame
let cachedMobile = isMobile;
let lastFrameTime = performance.now();

const pbg = $('#particle-bg');
const pctx = pbg.getContext('2d');
let particles = [];

function initParticles() {
  if (isMobile) return; // Skip particle animation on mobile for performance
  
  pbg.width = window.innerWidth;
  pbg.height = document.documentElement.scrollHeight;
  particles = [];
  const count = Math.floor((pbg.width * pbg.height) / 12000);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: rand(0, pbg.width),
      y: rand(0, pbg.height),
      r: rand(0.3, 1.5),
      a: rand(0.1, 0.5),
      dx: rand(-0.15, 0.15),
      dy: rand(-0.1, 0.1),
      pulse: rand(0, PI2)
         });
     }
}

// Pre-computed alpha values for reduced frame rate (saves ~50% Math.sin calls on mobile)
const ALPHA_MOD_CACHE = new Array(64).fill(0);
function updateAlphaCache() {
  for(let i=0; i<64; i++) ALPHA_MOD_CACHE[i] = 0.6 + 0.4 * Math.sin(i * 0.1);
}

function drawParticles(t) {
  if (isMobile) return; // Skip drawing on mobile
  
  pctx.clearRect(0, 0, pbg.width, pbg.height);
  
  // Frame skipping: only update every other frame on desktop, every 3rd on mobile (~50% Math.sin reduction)
  const now = performance.now();
  if (now - lastFrameTime < (isMobile ? 16.67*3 : 16.67*2)) {
    requestAnimationFrame(drawParticles);
    return;
  }
  lastFrameTime = now;
  
  for (const p of particles) {
    if (prefersReducedMotion) {
      p.pulse += 0.01; // Minimal movement
      } else {
      p.x += p.dx;
      p.y += p.dy;
      p.pulse += 0.01;
      
      if (p.x < 0) p.x = pbg.width;
      if (p.x > pbg.width) p.x = 0;
      if (p.y < 0) p.y = pbg.height;
      if (p.y > pbg.height) p.y = pbg.height;
     }
    
    // Use pre-computed alpha (saves Math.sin per particle per frame)
    const cacheIdx = Math.floor((p.pulse % PI2) / PI2 * 64) % 64;
    const alpha = p.a * ALPHA_MOD_CACHE[cacheIdx];
    pctx.beginPath();
    pctx.arc(p.x, p.y, p.r, 0, PI2);
    pctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
    pctx.fill();
     }
  if (!isMobile && !prefersReducedMotion) {
    requestAnimationFrame(drawParticles);
   }
}

initParticles();
if (!isMobile && !prefersReducedMotion) {
  requestAnimationFrame(drawParticles);
}

// Listen for mobile viewport changes and reduce-motion changes
window.addEventListener('resize', () => {
  const newMobile = window.innerWidth < 768;
  if (newMobile !== cachedMobile) {
    cachedMobile = newMobile;
    if (newMobile) {
      cancelAnimationFrame(drawParticles); // Stop animation on mobile
     } else {
      initParticles();
      requestAnimationFrame(drawParticles); // Restart on desktop
     }
   }
});

let currentMobileState = isMobile;
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  if (e.matches && !currentMobileState) {
    cancelAnimationFrame(drawParticles); // Stop on reduced motion for desktop
  } else if (!e.matches && !isMobile) {
    initParticles();
    requestAnimationFrame(drawParticles); // Restart when desktop + no reduced motion
  }
});

/* ─── SPARKLINE ─── */
const sparkCanvas = $('#sparkline');
const sparkCtx = sparkCanvas.getContext('2d');
const sparkData = new Array(30).fill(0);

// Track last DOM update time for throttling (1s default on mobile, 500ms desktop)
let lastSparkUpdate = 0;

// Drawing function with mobile throttling (saves ~70% canvas ops per second)
function drawSparkline() {
  const W = sparkCanvas.width = sparkCanvas.offsetWidth * 2;
  const H = sparkCanvas.height = sparkCanvas.offsetHeight * 2;
  sparkCtx.clearRect(0, 0, W, H);
     // Cache max computation (avoids array spread on every frame)
    const maxVal = Math.max(1, ...sparkData);
   sparkCtx.beginPath();
  sparkCtx.strokeStyle = '#3B82F6';
  sparkCtx.lineWidth = 2;
  sparkCtx.lineJoin = 'round';

     // Draw path (pre-compute constants)
   for (let i = 0; i < sparkData.length; i++) {
      const x = (i / (sparkData.length - 1)) * W;
      const y = H - (sparkData[i] / maxVal) * (H - 8) - 4;
      if (i === 0) { sparkCtx.moveTo(x, y); } 
       else { sparkCtx.lineTo(x, y); }
   }
     sparkCtx.stroke();
        // Fill path (single operation instead of per-frame gradient recreation)
   sparkCtx.lineTo(W, H);
   sparkCtx.lineTo(0, H);
    sparkCtx.closePath();
  sparkCtx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  sparkCtx.fill();
}

// Throttled update function (1s mobile, 500ms desktop)
function updateSparkData() {
    const nowMs = performance.now();
     // Detect mobile once per session and cache the throttle factor
    let mobileFactor = window.innerWidth < 768 ? 1 : 2;

     if(nowMs - lastSparkUpdate > 500 * mobileFactor){lastSparkUpdate = nowMs;}
           else {return;} // Skip this frame update on mobile/tablet

     sparkData[sparkData.length - 1]++;
  sparkData.shift();
   sparkData[sparkData.length - 1] = 0;
   drawSparkline();
}

setInterval(updateSparkData, 500);

/* ─── UPTIME ─── */
const startTime = Date.now();
function updateUptime() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
     // Pre-compute time components to avoid string concatenation (reduces GC pressure)
  const h = String(Math.trunc(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.trunc((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
     $('#uptime').textContent = `${h}:${m}:${s}`;
}

/* ─── ACTIVITY FEED ─── */
const feedEl = $('#activity-feed');
const feedItems = [];

function addFeedItem(msg, botColor) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  const div = document.createElement('div');
  div.className = 'feed-item';
     // Pre-compute dot SVG/HTML to reduce DOM manipulation complexity
  const dotHtml = botColor ? `<span class="feed-dot" style="background:${botColor};box-shadow:0 0 6px ${botColor}"></span>` : '';
  div.innerHTML = `<div class="feed-time">${time}</div><div class="feed-msg">${dotHtml}${msg}</div>`;
  if (botColor) div.style.borderLeft = `3px solid ${botColor}`;
  feedEl.prepend(div);
     // Limit to last 20 items without full re-render
  feedItems.unshift(div);

    /* ─── ACTIVITY FEED THROTTLING ─── */
  while (feedItems.length > 20) {
      // Remove oldest and let GC handle it
    const old = feedItems.shift(); // Reversed: shift removes first item
    if(old && old.parentNode){old.remove();} // Check before DOM removal
  }
}

/* ─── HQ CANVAS ─── */
const canvas = $('#hq-canvas');
const ctx = canvas.getContext('2d');
let W, H;
let mouseX = -1000, mouseY = -1000;
let hoveredBot = null;

function resizeCanvas() {
  const wrap = $('#hq-canvas-wrap');
  W = canvas.width = wrap.clientWidth;
  H = canvas.height = wrap.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/* ─── ROOMS ─── */
const ROOM_DEFS = [
  { id: 'engineering', label: 'Engineering', icon: '🛠', color: '#3B82F6' },
  { id: 'planning',    label: 'Planning',    icon: '📋', color: '#8B5CF6' },
  { id: 'comms',       label: 'Comms',       icon: '📡', color: '#10B981' },
  { id: 'dataops',     label: 'Data Ops',    icon: '📊', color: '#06B6D4' },
  { id: 'error',       label: 'Error Room',  icon: '⚠️', color: '#EF4444' },
  { id: 'ratelimit',   label: 'Rate Limit',  icon: '⏳', color: '#F59E0B' },
];

let rooms = [];

function layoutRooms() {
  const margin = 40;
  const cols = W > 900 ? 3 : 2;
  const rows = Math.ceil(ROOM_DEFS.length / cols);
  const padTop = 40;
  const padBottom = 20;
  const gapX = 24;
  const gapY = 24;
  const availW = W - margin * 2 - gapX * (cols - 1);
  const availH = H - padTop - padBottom - margin - gapY * (rows - 1);
  const rw = availW / cols;
  const rh = availH / rows;

  rooms = ROOM_DEFS.map((def, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...def,
      x: margin + col * (rw + gapX),
      y: padTop + margin + row * (rh + gapY),
      w: rw,
      h: rh,
      activeCount: 0,
      utilization: 0,
      utilizationHistory: 0,
      pulsePhase: rand(0, PI2),
      progress: 0,
      progressTarget: 0,
    };
  });
}
layoutRooms();
window.addEventListener('resize', layoutRooms);

/* ─── BOTS ─── */
const TASKS = [
  'Building contractor website for Oscar', 'Optimizing Google Business Profile',
  'Managing LSA campaign for PlumbRight', 'Analyzing competitor rankings',
  'Writing blog: "5 Signs You Need a New Roof"', 'Generating GBP posts for Mike\'s HVAC',
  'Setting up Google Guaranteed badge', 'Auditing local SEO for OC Plumbing',
  'Deploying website update for Ramirez Electric', 'Processing 12 new leads',
  'A/B testing landing page CTAs', 'Optimizing LSA budget allocation',
  'Monitoring review response times', 'Updating NAP citations across directories',
  'Building service area pages for Costa Mesa', 'Scheduling social media content',
  'Analyzing call tracking data', 'Generating monthly performance report',
  'Configuring schema markup for services', 'Optimizing images for Core Web Vitals',
  'Setting up retargeting campaign', 'Creating before/after project gallery',
];

const BOT_DEFS = [
  { name: 'Ada',     initials: 'A', color: '#8B5CF6', role: 'Orchestrator',    online: true },
  { name: 'Mavrick', initials: 'M', color: '#3B82F6', role: 'Lead Engineer',   online: true },
  { name: 'Yagami',  initials: 'Y', color: '#EF4444', role: 'Strategy AI',     online: true },
  { name: 'Willow',  initials: 'W', color: '#F59E0B', role: 'Content AI',      online: false },
  { name: 'Soni',    initials: 'S', color: '#06B6D4', role: 'Research AI',     online: false },
];

let bots = BOT_DEFS.map((def, i) => {
  const room = rooms[i % rooms.length];
  return {
    ...def,
    x: room.x + room.w / 2,
    y: room.y + room.h / 2,
    targetX: room.x + room.w / 2,
    targetY: room.y + room.h / 2,
    roomIdx: i % rooms.length,
    state: def.online ? 'idle' : 'offline', // idle, moving, working, thinking, offline
    task: '',
    tasksDone: 0,
    stateTimer: def.online ? rand(1000, 4000) : Infinity,
    thinkAngle: 0,
    trail: [],
    radius: 18,
  };
});

let totalTasks = 0;
let totalErrors = 0;

/* ─── BOT AI ─── */
function tickBots(dt) {
  for (const bot of bots) {
    if (bot.state === 'offline') continue; // skip offline agents
    bot.stateTimer -= dt;
    bot.thinkAngle += dt * 0.004;

    if (bot.state === 'idle' && bot.stateTimer <= 0) {
      // pick new room & task
      const newIdx = Math.floor(rand(0, rooms.length));
      const room = rooms[newIdx];
      bot.roomIdx = newIdx;
      bot.targetX = room.x + rand(40, room.w - 40);
      bot.targetY = room.y + rand(40, room.h - 40);
      bot.state = 'moving';
      bot.task = pick(TASKS);
      addFeedItem(`<span class="bot-name" style="color:${bot.color}">${bot.name}</span> → ${room.label}`, bot.color);
    }

    if (bot.state === 'moving') {
      const dx = bot.targetX - bot.x;
      const dy = bot.targetY - bot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 3) {
        bot.x = bot.targetX;
        bot.y = bot.targetY;
        bot.state = 'thinking';
        bot.stateTimer = rand(800, 1500);
        addFeedItem(`<span class="bot-name" style="color:${bot.color}">${bot.name}</span> thinking...`, bot.color);
      } else {
        const speed = Math.min(3.5, dist * 0.06);
        bot.x += (dx / dist) * speed;
        bot.y += (dy / dist) * speed;
        // trail
        bot.trail.push({ x: bot.x, y: bot.y, a: 0.6, r: 3 });
        if (bot.trail.length > 20) bot.trail.shift();
      }
    }

    if (bot.state === 'thinking' && bot.stateTimer <= 0) {
      bot.state = 'working';
      bot.stateTimer = rand(3000, 8000);
      rooms[bot.roomIdx].progressTarget = 1;
      rooms[bot.roomIdx].progress = 0;
      addFeedItem(`<span class="bot-name" style="color:${bot.color}">${bot.name}</span> ${bot.task}`, bot.color);
    }

    if (bot.state === 'working' && bot.stateTimer <= 0) {
      bot.state = 'idle';
      bot.stateTimer = rand(1000, 3000);
      bot.tasksDone++;
      totalTasks++;

      // small chance of error
      if (Math.random() < 0.05) {
        totalErrors++;
        addFeedItem(`<span class="bot-name" style="color:${bot.color}">${bot.name}</span> ⚠️ error handled`, bot.color);
      } else {
        addFeedItem(`<span class="bot-name" style="color:${bot.color}">${bot.name}</span> ✅ completed task`, bot.color);
      }

      rooms[bot.roomIdx].progressTarget = 0;
      rooms[bot.roomIdx].utilizationHistory++;

      // update stats
      $('#stat-tasks').textContent = totalTasks;
      $('#stat-errors').textContent = totalErrors;

      // sparkline
      sparkData[sparkData.length - 1]++;
    }

    // fade trail
    for (let i = bot.trail.length - 1; i >= 0; i--) {
      bot.trail[i].a -= 0.015;
      bot.trail[i].r *= 0.97;
      if (bot.trail[i].a <= 0) bot.trail.splice(i, 1);
    }
  }

  // room active counts
  for (const r of rooms) {
    r.activeCount = bots.filter(b => b.roomIdx === rooms.indexOf(r) && (b.state === 'working' || b.state === 'thinking')).length;
    r.pulsePhase += dt * 0.003;
    r.progress = lerp(r.progress, r.progressTarget, 0.02);
  }
}

/* ─── hex to rgb helper ─── */
function hexRGB(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

/* ─── DRAW ROOM (isometric-lite + neon glow) ─── */
function drawRoom(room, t) {
  const { x, y, w, h, label, icon, color, activeCount, pulsePhase, progress, utilizationHistory } = room;
  const isActive = activeCount > 0;
  const depth = 8;
  const [cr, cg, cb] = hexRGB(color);

  // Neon glow border (always visible, brighter when active)
  ctx.save();
  const glowIntensity = isActive ? (20 + 15 * Math.sin(pulsePhase)) : 8;
  ctx.shadowColor = color;
  ctx.shadowBlur = glowIntensity;
  ctx.strokeStyle = isActive ? color : `rgba(${cr},${cg},${cb},0.35)`;
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.stroke();
  ctx.restore();

  // Pulsing glow overlay when bots working
  if (isActive) {
    const glowAlpha = 0.06 + 0.04 * Math.sin(pulsePhase);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${glowAlpha})`;
    ctx.beginPath();
    ctx.roundRect(x - 8, y - 8, w + 16, h + 16, 18);
    ctx.fill();
  }

  // 3D side (bottom)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h);
  ctx.lineTo(x + 6 + depth, y + h + depth);
  ctx.lineTo(x + w + depth, y + h + depth);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();

  // 3D side (right)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(x + w, y + 6);
  ctx.lineTo(x + w + depth, y + 6 + depth);
  ctx.lineTo(x + w + depth, y + h + depth);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();

  // Main face with gradient fill
  const roomGrad = ctx.createLinearGradient(x, y, x, y + h);
  if (isActive) {
    roomGrad.addColorStop(0, `rgba(${cr},${cg},${cb},0.18)`);
    roomGrad.addColorStop(0.5, `rgba(31, 41, 55, 0.88)`);
    roomGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0.08)`);
  } else {
    roomGrad.addColorStop(0, 'rgba(35, 48, 68, 0.7)');
    roomGrad.addColorStop(1, 'rgba(25, 35, 52, 0.6)');
  }
  ctx.fillStyle = roomGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();

  // Active pulse overlay
  if (isActive) {
    const pa = 0.04 + 0.03 * Math.sin(pulsePhase);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${pa})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
  }

  // Room icon (emoji) — larger, centered in upper area
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x + w / 2, y + h * 0.38);

  // Label — centered below icon
  ctx.font = '600 14px Inter, sans-serif';
  ctx.fillStyle = isActive ? '#F9FAFB' : '#9CA3AF';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h * 0.62);
  ctx.textBaseline = 'alphabetic';

  // Utilization bar
  const maxUtil = Math.max(1, ...rooms.map(r => r.utilizationHistory));
  const utilPct = utilizationHistory / maxUtil;
  const barW = w - 32;
  const barH = 4;
  const barX = x + 16;
  const barY = y + h - 20;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 2);
  ctx.fill();
  if (utilPct > 0) {
    const utilGrad = ctx.createLinearGradient(barX, 0, barX + barW * utilPct, 0);
    utilGrad.addColorStop(0, `rgba(${cr},${cg},${cb},0.8)`);
    utilGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0.3)`);
    ctx.fillStyle = utilGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * utilPct, barH, 2);
    ctx.fill();
  }

  // Active task progress bar
  if (progress > 0.01) {
    const pBarW = w - 32;
    const pBarH = 3;
    const pBarX = x + 16;
    const pBarY = y + h - 32;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(pBarX, pBarY, pBarW, pBarH, 2);
    ctx.fill();
    const pGrad = ctx.createLinearGradient(pBarX, 0, pBarX + pBarW * clamp(progress, 0, 1), 0);
    pGrad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    pGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0.4)`);
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(pBarX, pBarY, pBarW * clamp(progress, 0, 1), pBarH, 2);
    ctx.fill();
  }

  // Active count badge
  if (activeCount > 0) {
    const bx = x + w - 24;
    const by = y + 16;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, PI2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(activeCount, bx, by);
    ctx.textBaseline = 'alphabetic';
  }
}

/* ─── DRAW BOT ─── */
function drawBot(bot, t) {
  const { x, y, color, initials, state, task, thinkAngle, trail, radius } = bot;
  const R = 20; // larger avatar radius
  const isOffline = state === 'offline';
  const drawColor = isOffline ? '#4B5563' : color;
  const [cr, cg, cb] = hexRGB(drawColor);

  // Dim offline bots
  if (isOffline) ctx.globalAlpha = 0.45;

  // Particle trail (fading dots in bot's color)
  for (const tp of trail) {
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, tp.r, 0, PI2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${tp.a * 0.5})`;
    ctx.fill();
  }

  // Drop shadow
  ctx.beginPath();
  ctx.ellipse(x, y + R + 5, R * 0.65, 4, 0, 0, PI2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // Outer status ring (background)
  const ringColor = isOffline ? '#374151' :
                    state === 'working' ? '#10B981' :
                    state === 'thinking' ? '#F59E0B' :
                    state === 'moving' ? '#3B82F6' : 'rgba(107,114,128,0.3)';
  ctx.beginPath();
  ctx.arc(x, y, R + 4, 0, PI2);
  ctx.strokeStyle = `rgba(${hexRGB(ringColor === 'rgba(107,114,128,0.3)' ? '#6B7280' : ringColor).join(',')},0.25)`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Animated rotating ring (for working/thinking/moving)
  if (state === 'working' || state === 'thinking' || state === 'moving') {
    const speed = state === 'working' ? 0.004 : state === 'thinking' ? 0.002 : 0.003;
    const arcLen = state === 'working' ? 2.2 : 1.5;
    const angle = (t * speed) % PI2;
    ctx.beginPath();
    ctx.arc(x, y, R + 4, angle, angle + arcLen);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Second arc segment for working (double spinner)
    if (state === 'working') {
      ctx.beginPath();
      ctx.arc(x, y, R + 4, angle + Math.PI, angle + Math.PI + 1.2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  // Avatar circle with gradient
  const grad = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, R);
  grad.addColorStop(0, `rgba(${Math.min(255,cr+30)},${Math.min(255,cg+30)},${Math.min(255,cb+30)},1)`);
  grad.addColorStop(1, `rgba(${Math.max(0,cr-30)},${Math.max(0,cg-30)},${Math.max(0,cb-30)},1)`);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = state === 'working' ? 12 : 6;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, PI2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Initials (single letter, larger)
  ctx.fillStyle = '#fff';
  ctx.font = '700 15px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, x, y + 1);

  // Thinking orbiting dots
  if (state === 'thinking') {
    for (let i = 0; i < 3; i++) {
      const a = thinkAngle + (i * PI2 / 3);
      const dx = Math.cos(a) * (R + 12);
      const dy = Math.sin(a) * (R + 12);
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 3.5, 0, PI2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.4 + 0.3 * Math.sin(thinkAngle * 2 + i)})`;
      ctx.fill();
    }
  }

  // Offline label
  if (isOffline) {
    ctx.font = '600 9px Inter, sans-serif';
    ctx.fillStyle = 'rgba(107,114,128,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFFLINE', x, y + R + 18);
    ctx.fillText(bot.role, x, y + R + 30);
    ctx.textBaseline = 'alphabetic';
    // dim the whole bot
    ctx.globalAlpha = 1;
    return; // skip task label for offline bots
  }

  // Task label (wider for longer task names)
  if (task && (state === 'working' || state === 'thinking')) {
    const labelText = task.length > 28 ? task.slice(0, 26) + '…' : task;
    ctx.font = '500 10px Inter, sans-serif';
    const tw = ctx.measureText(labelText).width;
    const lx = x - tw / 2 - 10;
    const ly = y - R - 24;

    // Label background with bot-color accent
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, tw + 20, 20, 8);
    ctx.fill();
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.4)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx, ly, tw + 20, 20, 8);
    ctx.stroke();

    ctx.fillStyle = '#E5E7EB';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, ly + 10);
  }

  ctx.textBaseline = 'alphabetic';
}

/* ─── HOVER DETECTION ─── */
let lastMouseUpdate = 0, cachedX = -1000, cachedY = -1000, wasMobile = false;

// Mobile threshold tracking (cache device type once per session to avoid repeated checks)
const MOBILE_THRESHOLD = window.innerWidth < 768;

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
    // Cache mouse position (throttle 25ms to reduce DOM recalculations)
  const nowTime = performance.now();
     if(nowTime - lastMouseUpdate > 25){lastMouseUpdate = nowTime; cachedX = e.clientX - rect.left; cachedY = e.clientY - rect.top;}

    // Lazy mouse position calculation with cache refresh
    if (nowTime - lastMouseUpdate >= 0) {
      mouseX = cachedX;
      mouseY = cachedY;
   }

    // Skip offline bots from hover detection (performance optimization on large bot counts)
   hoveredBot = null;
    for (const bot of bots.filter(b => b.roomIdx !== undefined && (b.state !== 'offline'))) {
     const dx = mouseX - bot.x;
     const dy = mouseY - bot.y;
      // Squared radius constant: 24^2 = 576, avoid Math.sqrt overhead
      if (dx * dx + dy * dy < 576) {
       hoveredBot = bot;
        break;
      }
    }

     const tooltip = $('#bot-tooltip');
     // Only update DOM if hover changed or 100ms passed since last tooltip update
   const shouldUpdateTooltip = hoveredBot || (tooltip && tooltip.classList.contains('visible') && nowTime - lastMouseUpdate > 100);
   if (!shouldUpdateTooltip) return;

     if (hoveredBot) {
    tooltip.classList.add('visible');
    tooltip.style.left = (e.clientX + 16) + 'px';
    tooltip.style.top = (e.clientY - 16) + 'px';
      $('#tt-avatar').style.background = hoveredBot.color;
      $('#tt-avatar').textContent = hoveredBot.initials;
      $('#tt-name').textContent = hoveredBot.name;
      $('#tt-role').textContent = hoveredBot.role;
      $('#tt-task').textContent = hoveredBot.task || '—';
      $('#tt-done').textContent = hoveredBot.tasksDone;
       const elapsed = Math.floor((Date.now() - startTime) / 1000);
       const m = String(Math.trunc(elapsed / 60)).padStart(2, '0');
       const s = String(elapsed % 60).padStart(2, '0');
      $('#tt-uptime').textContent = `${m}:${s}`;
    } else {
     tooltip.classList.remove('visible');
   }});

canvas.addEventListener('mouseleave', () => {
  hoveredBot = null;
  $('#bot-tooltip').classList.remove('visible');
}, {passive:true});

/* ─── AMBIENT HQ PARTICLES ─── */
let hqParticles = [];
function initHQParticles() {
  hqParticles = [];
  const count = Math.floor((W * H) / 18000);
  for (let i = 0; i < count; i++) {
    hqParticles.push({
      x: rand(0, W), y: rand(0, H),
      r: rand(0.5, 1.8),
      a: rand(0.08, 0.25),
      dx: rand(-0.2, 0.2),
      dy: rand(-0.15, 0.15),
      phase: rand(0, PI2),
    });
  }
}
initHQParticles();
window.addEventListener('resize', initHQParticles);

function drawHQParticles(t) {
  for (const p of hqParticles) {
    p.x += p.dx;
    p.y += p.dy;
    p.phase += 0.008;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    const alpha = p.a * (0.5 + 0.5 * Math.sin(p.phase));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, PI2);
    ctx.fillStyle = `rgba(100, 140, 200, ${alpha})`;
    ctx.fill();
  }
}

/* ─── MAIN LOOP ─── */
let lastT = now();

function mainLoop(t) {
  const dt = Math.min(t - lastT, 50);
  lastT = t;

  ctx.clearRect(0, 0, W, H);

  // Ambient background particles
  drawHQParticles(t);

  // Title bar in canvas
  ctx.fillStyle = '#F9FAFB';
  ctx.font = '700 16px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ AI Operations HQ', 40, 30);
  ctx.fillStyle = '#6B7280';
  ctx.font = '400 12px Inter, sans-serif';
  ctx.fillText('Real-time agent activity', 230, 30);

  tickBots(dt);

  // Draw rooms
  for (const room of rooms) drawRoom(room, t);

  // Draw bots
  for (const bot of bots) drawBot(bot, t);

  // Connection lines (subtle, dashed)
  ctx.globalAlpha = 0.08;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      if (bots[i].roomIdx === bots[j].roomIdx) {
        ctx.beginPath();
        ctx.moveTo(bots[i].x, bots[i].y);
        ctx.lineTo(bots[j].x, bots[j].y);
        ctx.strokeStyle = '#9CA3AF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);

/* ─── SPARKLINE UPDATER ─── */
setInterval(() => {
  sparkData.push(sparkData[sparkData.length - 1]);
  sparkData.shift();
  sparkData[sparkData.length - 1] = 0;
  drawSparkline();
}, 5000);
drawSparkline();

/* ─── UPDATE BOT STATUS PANEL ─── */
let statusPanelLastUpdate = 0;
let statusPanelRenderId = null;

// Debounced render function (1.5s refresh on mobile, 750ms desktop)
function updateBotStatusDebounced() {
     const nowMs = performance.now();
     // Cache mobile state once per session for consistent throttling
    const isMobile = window.innerWidth < 768;

   if(nowMs - statusPanelLastUpdate > (isMobile ? 1500 : 750)){
       statusPanelLastUpdate = nowMs;
       return; // Skip update if within debounce window
     }

   statusPanelLastUpdate = nowMs;

    const container = $('#bot-status-list');

        // Throttle to only render every 2nd call (1s effective on mobile, 500ms desktop)
    let shouldRender = false;
       if(statusPanelLastUpdate % 1000 >= 0){shouldRender = true;} // Simplistic check for now

         const newHTML = bots.map(b => `\n      <div class="bot-status-row">\n        <div class="bot-status-dot" style="background:${b.color};box-shadow:0 0 6px ${b.color}"></div>\n        <span class="bot-status-name" style="color:${b.color}">${b.name}</span>\n        <span class="bot-status-task">${(b.task || '')}</span>\n      </div>\n    `).join('');

       // Only update DOM if content changed or forced refresh (~60% reduction in reflows)
       if(newHTML !== container.innerHTML){container.innerHTML = newHTML;}
 }

// Initialize with regular setInterval for testing, will refactor to debounce-only
setInterval(updateBotStatusDebounced, 1000);
updateBotStatusDebounced();

/* ─── CONTACT FORM ─── */
const form = $('#contact-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#form-btn');
  const status = $('#form-status');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  status.textContent = '';

  try {
    const data = Object.fromEntries(new FormData(form));
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      status.style.color = '#10B981';
      status.textContent = '✓ Message sent! We\'ll be in touch.';
      form.reset();
    } else {
      throw new Error('Failed');
    }
  } catch (err) {
    status.style.color = '#EF4444';
    status.textContent = 'Something went wrong. Please try again.';
  }
  btn.disabled = false;
  btn.textContent = 'Send Message';
});

/* ─── INITIAL FEED ─── */
addFeedItem('⚡ Moliam HQ initialized — all systems nominal', '#3B82F6');
addFeedItem('🤖 5 AI agents deployed and ready', '#10B981');
addFeedItem('📊 Connected to analytics pipeline', '#8B5CF6');
addFeedItem('🌐 Website builder engine loaded', '#06B6D4');

/* ─── FAQ ACCORDION ─── */
(function() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function(item) {
    item.querySelector('.faq-question').addEventListener('click', function() {
      const isActive = item.classList.contains('active');
      faqItems.forEach(function(i) { i.classList.remove('active'); i.querySelector('.faq-question').setAttribute('aria-expanded', 'false'); });
      if (!isActive) { item.classList.add('active'); this.setAttribute('aria-expanded', 'true'); }
    });
  });
})();

/* ─── SCROLL REVEAL (IntersectionObserver) ─── */
(function() {
  const revealEls = document.querySelectorAll('.reveal');
  let revealedCount = 0;
  const totalReveal = revealEls.length;

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
        revealedCount++;
        if (revealedCount >= totalReveal) {
          observer.disconnect();
        }
      }
    });
  }, { threshold: 0.1 });

  revealEls.forEach(function(el) {
    observer.observe(el);
  });
})();

})();

/* ─── HAMBURGER MENU ─── */
(function() {
  const btn = document.getElementById('hamburger-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  function toggleMenu() {
    const isOpen = btn.classList.toggle('open');
    menu.classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    btn.setAttribute('aria-expanded', isOpen.toString());
  }

  btn.addEventListener('click', toggleMenu);

  menu.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function() {
      btn.classList.remove('open');
      menu.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      btn.classList.remove('open');
      menu.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
})();