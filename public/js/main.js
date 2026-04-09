import { sparklineColor, botColors, statusColors, feedItemColors } from './colors.js';

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

/* ─── PARTICLE BACKGROUND (mobile-disabled) ─── */

// Mobile viewport check: disable particle animation on mobile (<768px)
const isMobile = window.innerWidth < 768;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pbg = $('#particle-bg');
let hasCanvas = !!pbg;
if (hasCanvas) {
  const pctx = pbg.getContext('2d');
  
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
}

function drawParticles(t) {
  if (isMobile) return; // Skip drawing on mobile
  
  pctx.clearRect(0, 0, pbg.width, pbg.height);
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
      if (p.y > pbg.height) p.y = 0;
    }
    
    const alpha = p.a * (0.6 + 0.4 * Math.sin(p.pulse));
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

// Store listeners for cleanup
let resizeHandler;
let mediaQueryChangeHandler;

// Listen for mobile viewport changes and reduce-motion changes
let currentMobile = isMobile;
let currentReducedMotion = prefersReducedMotion;

resizeHandler = () => {
  const newMobile = window.innerWidth < 768;
  if (newMobile !== currentMobile) {
    currentMobile = newMobile;
    if (currentMobile) {
      cancelAnimationFrame(drawParticles); // Stop animation on mobile
    } else {
      initParticles();
      requestAnimationFrame(drawParticles); // Restart on desktop
    }
  }
};
window.addEventListener('resize', resizeHandler);

const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

mediaQueryChangeHandler = (e) => {
  const newReducedMotion = e.matches;
  if (newReducedMotion !== currentReducedMotion) {
    currentReducedMotion = newReducedMotion;
    if (newReducedMotion) {
      cancelAnimationFrame(drawParticles); // Stop on reduced motion
    } else if (!isMobile) {
      initParticles();
      requestAnimationFrame(drawParticles); // Restart when not mobile and not reduced motion
    }
  }
};
mediaQuery.addEventListener('change', mediaQueryChangeHandler);

/* ─── SPARKLINE ─── */
const sparkCanvas = $('#sparkline');
const sparkCtx = sparkCanvas.getContext('2d');
const sparkData = new Array(30).fill(0);
let sparkIdx = 0;

function drawSparkline() {
  const W = sparkCanvas.width = sparkCanvas.offsetWidth * 2;
  const H = sparkCanvas.height = sparkCanvas.offsetHeight * 2;
  sparkCtx.clearRect(0, 0, W, H);
  const max = Math.max(1, ...sparkData);
  sparkCtx.beginPath();
  sparkCtx.strokeStyle = sparklineColor;
  sparkCtx.lineWidth = 2;
  sparkCtx.lineJoin = 'round';
  for (let i = 0; i < sparkData.length; i++) {
    const x = (i / (sparkData.length - 1)) * W;
    const y = H - (sparkData[i] / max) * (H - 8) - 4;
    i === 0 ? sparkCtx.moveTo(x, y) : sparkCtx.lineTo(x, y);
  }
  sparkCtx.stroke();
  // fill under
  sparkCtx.lineTo(W, H);
  sparkCtx.lineTo(0, H);
  sparkCtx.closePath();
  sparkCtx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  sparkCtx.fill();
}

/* ─── UPTIME ─── */
const startTime = Date.now();
let updateUptimeIntervalId;
try {
    function updateUptime() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const s = String(Math.floor(elapsed % 60)).padStart(2, '0');
             $('#uptime').textContent = `${h}:${m}:${s}`;
         }
    updateUptimeIntervalId = setInterval(updateUptime, 1000);
} catch (e) { console.error('Uptime interval error:', e); }

/* cleanup handler for uptime interval */
window.moliamMainCleanup = window.moliamMainCleanup || (() => {});
const originalCleanup = window.moliamMainCleanup;
window.moliamMainCleanup = function() {
      // Remove resize listener (was added on line 99 with window.addEventListener('resize', resizeHandler))
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      // Remove media query change listener (was added on line 115 with mediaQuery.addEventListener('change', mediaQueryChangeHandler))  
    if (mediaQueryChangeHandler) mediaQuery.removeEventListener('change', mediaQueryChangeHandler);
    if (updateUptimeIntervalId) clearInterval(updateUptimeIntervalId);
    if (originalCleanup) originalCleanup();
};

/* ACTIVITY FEED -- HQ CANVAS */


function addFeedItem(msg, botColor) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  const div = document.createElement('div');
  div.className = 'feed-item';
  const dotHtml = botColor ? `<span class="feed-dot" style="background:${botColor};box-shadow:0 0 6px ${botColor}"></span>` : '';
  div.innerHTML = `<div class="feed-time">${time}</div><div class="feed-msg">${dotHtml}${msg}</div>`;
  if (botColor) div.style.borderLeft = `3px solid ${botColor}`;
  feedEl.prepend(div);
  feedItems.unshift(div);
  while (feedItems.length > 20) {
    const old = feedItems.pop();
    old.remove();
  }
}

/* ─── HQ CANVAS ─── */
/* ─── ROOMS — */
import { roomColors } from './style-definitions.js';

const ROOM_DEFS = [
    { id: 'engineering', label: 'Engineering', icon: '🛠', color: roomColors.eng ineering },
    { id: 'planning',    label: 'Planning',    icon: '📋', color: roomColors.pl anning },
    { id: 'comms',       label: 'Comms',       icon: '📡', color: roomColors.com ms },
    { id: 'dataops',     label: 'Data Ops',    icon: '📊', color: roomColors.datao ps },
    { id: 'error',       label: 'Error Room',  icon: '⚠️', color: roomColors.er ror },
    { id: 'ratelimit',   label: 'Rate Limit',  icon: '⏳', color: roomColors. rateLimit },
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

/* ─── ROOMS LAYOUT RESIZE LISTENER */
let layoutRoomsResizeHandler = () => layoutRooms();
window.addEventListener('resize', layoutRoomsResizeHandler);

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
{name: 'Ada',     initials: 'A', color: botColors.Ada,     role: 'Orchestrator',    online: true },
    { name: 'Mavrick', initials: 'M', color: botColors.Mavrick,   role: 'Lead Engineer',   online: true },
    { name: 'Yagami',  initials: 'Y', color: botColors.Yagami,  role: 'Strategy AI',     online: true },
    { name: 'Willow',  initials: 'W', color: botColors.Willow,  role: 'Content AI',      online: false },
    { name: 'Soni',    initials: 'S', color: botColors.Soni,    role: 'Research AI',     online: false },
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
  ctx.fillStyle = isActive ? statusColors.textBright : statusColors.textDisabled;
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
                    state === 'thinking' ? statusColors.thinking :
                    state === 'moving' ? statusColors.moving : statusColors.offlineFallback;
  ctx.beginPath();
  ctx.arc(x, y, R + 4, 0, PI2);
  ctx.strokeStyle = `rgba(${hexRGB(ringColor === statusColors.offlineFallback ? '#6B7280' : ringColor).join(',')},0.25)`;
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

    ctx.fillStyle = statusColors.grayLight;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, ly + 10);
  }

  ctx.textBaseline = 'alphabetic';
}

/* ─── HOVER DETECTION ─── */
// CRITICAL FIX: Select canvas element before using it (lines 695,702 previously failed)
let canvas = $('#canvas'); // Added missing element selection
let canvasMouseMoveHandler, canvasMouseLeaveHandler;

if (canvas) {
  canvasMouseMoveHandler = (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    hoveredBot = null;
    for (const bot of bots) {
      const dx = mouseX - bot.x;
      const dy = mouseY - bot.y;
      if (dx * dx + dy * dy < (24) ** 2) {
        hoveredBot = bot;
        break;
        }
      }

    const tooltip = $('#bot-tooltip');
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
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
        $('#tt-uptime').textContent = `${m}:${s}`;
      } else {
      tooltip.classList.remove('visible');
      }
    };

    canvas.addEventListener('mousemove', canvasMouseMoveHandler);

    canvasMouseLeaveHandler = () => {
      hoveredBot = null;
         $('#bot-tooltip').classList.remove('visible');
    };

    canvas.addEventListener('mouseleave', canvasMouseLeaveHandler);

    // Expose cleanup for this canvas event listeners
    window.__moliam_cleanup_canvas__ = function() {
      if (canvas) {
        canvas.removeEventListener('mousemove', canvasMouseMoveHandler);
        canvas.removeEventListener('mouseleave', canvasMouseLeaveHandler);
      }
    };
}

/* ─── AMBIENT HQ PARTICLES */
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

let resizeHandlerHQ = () => initHQParticles();
window.addEventListener('resize', resizeHandlerHQ);

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
  ctx.fillStyle = statusColors.textBright;
  ctx.font = '700 16px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ AI Operations HQ', 40, 30);
  ctx.fillStyle = statusColors.textMuted;
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

/* Track frameId for proper cleanup - fixes memory leak on tab visibility changes */
let frameId = null;

function startMainLoop() {
  if (frameId) cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(mainLoop);
}

startMainLoop();

/* ─── SPARKLINE UPDATER ─── */
let sparklineIntervalId = setInterval(() => {
  sparkData.push(sparkData[sparkData.length - 1]);
  sparkData.shift();
  sparkData[sparkData.length - 1] = 0;
  drawSparkline();
}, 5000);

/* Expose cleanup for maintenance */
window.__moliam_cleanup_maintenance__ = function() {
  if (sparklineIntervalId) {
    clearInterval(sparklineIntervalId);
    sparklineIntervalId = null; // Clear reference to prevent double-cleanup
   }
  if (typeof window.__moliam_cleanup_main__ === 'function') window.__moliam_cleanup_main__();
};

/* ─── UPDATE BOT STATUS PANEL ─── */

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
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    // Check for HTTP errors before parsing
    if (!res.ok) {
      const statusText = res.statusText || 'Unknown error';
      console.error('Contact form submission failed:', res.status, statusText);
      throw new Error(`HTTP ${res.status}: ${statusText}`);
    }
    
    // Validate JSON response before parsing
    const text = await res.text();
    if (!text) {
      console.error('Contact form received empty response');
      throw new Error('Empty response from server');
    }
      
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse response:', text);
      throw new Error(`Invalid response format: ${parseErr.message}`);
    }
      
    if (!parsed || typeof parsed.success === 'undefined') {
      console.warn('Response missing success field, treating as error');
      throw new Error('Malformed response: missing success field');
    }
        
    if (parsed.success) {
      status.style.color = statusColors.online;
      status.textContent = '✓ Message sent! We\\&#39;ll be in touch.';
      form.reset();
    } else {
      console.error('Contact form backend error:', parsed.message || parsed);
      throw new Error(parsed.message || 'Unknown backend error'); // Show to user
    }
  } catch (err) {
    console.error('Form submission error:', err);
    status.style.color = statusColors.error;
    status.textContent = 'Something went wrong. Please try again.';
    // Log error for monitoring if we have a tracking endpoint
    if (window.__MOLIUM_ERROR_TRACKER) {
      window.__MOLIUM_ERROR_TRACKER({ type: 'contact-form', error: err.message, timestamp: Date.now() });
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }
});

/* ─── INITIAL FEED ─── */
addFeedItem('⚡ Moliam HQ initialized — all systems nominal', feedItemColors.init);
    addFeedItem('🤖 5 AI agents deployed and ready', feedItemColors.deployed);
    addFeedItem('📊 Connected to analytics pipeline', feedItemColors.analytics);
    addFeedItem('🌐 Website builder engine loaded', feedItemColors.loaded);

/* ─── FAQ ACCORDION ─── */
(function() {
  const faqItems = document.querySelectorAll('.faq-item');
  const faqListeners = []; // Store listeners for cleanup
  
  faqItems.forEach(function(item) {
    const question = item.querySelector('.faq-question');
    const handleClick = function() {
      const isActive = item.classList.contains('active');
      faqItems.forEach(function(i) { 
        i.classList.remove('active'); 
        if (i.querySelector('.faq-question')) 
          i.querySelector('.faq-question').setAttribute('aria-expanded', 'false'); 
      });
      if (!isActive) { 
        item.classList.add('active'); 
        question.setAttribute('aria-expanded', 'true'); 
      }
    };
    
    question.addEventListener('click', handleClick);
    // Store reference for cleanup: [element, 'click', handler]
    faqListeners.push({element: question, event: 'click', handler: handleClick, index: FAQAccordionIndex++});
  });
  
  // Expose cleanup function
  window.__moliam_cleanup_faq__ = function() {
    faqListeners.forEach(function(l) { 
      if (l.element && l.handler) { 
        l.element.removeEventListener(l.event, l.handler); 
        delete l.element; 
        delete l.handler; 
      }
    });
    faqItems.length = 0; // Clear array reference
    window['FAQAccordionIndex'] = undefined;
  };
})();

let FAQAccordionIndex = 0; // Counter for unique listener tracking

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

  // Close on Escape key - add handler ref for cleanup
  var escapeHandler = function(e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      btn.classList.remove('open');
      menu.classList.remove('open');
      document.body.style.overflow = '';
     }
   };
  document.addEventListener('keydown', escapeHandler);

  // Expose cleanup for this block
  window.__moliam_cleanup_hamburger__ = function() {
    document.removeEventListener('keydown', escapeHandler);
  };
})();

/* ─── A11y: KBD NAVIGATION FOR SPEED BUTTONS ─── */
(function() {
  const speedBtns = document.querySelectorAll('.speed-btn');
  if (!speedBtns.length) return;

  // Store listeners for proper cleanup - array of [element, type, handler]
  const speedListeners = [];

  speedBtns.forEach(function(btn) {
    btn.setAttribute('tabindex', '0'); // make tabbable
    btn.setAttribute('role', 'button'); // explicit role

    function handleClick() {
      const newSpeed = parseInt(btn.dataset.speed, 10);
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      updateSimulationSpeed(newSpeed);

      // Update live region for screen readers
      const speedLabel = getSpeedLabel(newSpeed);
      announceToLiveRegion('⚡ Simulation speed: ' + speedLabel);
    }

    function handleKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    }

    btn.addEventListener('click', handleClick);
    btn.addEventListener('keydown', handleKeydown);

    // Store refs for cleanup
    speedListeners.push([btn, 'click', handleClick]);
    speedListeners.push([btn, 'keydown', handleKeydown]);
  });

  // Track the actual speed multiplier for proper cleanup/referencing
  window.simulationSpeedMultiplier = window.simulationSpeedMultiplier || 1;
  
  function updateSimulationSpeed(speed) {
    window.simulationSpeedMultiplier = speed;
   }

  function getSpeedLabel(speed) {
    if (speed === 0) return 'Paused';
    if (speed === 1) return 'Normal (1x)';
    if (speed === 2) return 'Fast (2x)';
    if (speed === 5) return 'Turbo (5x)';
    return 'Unknown';
  }

  // Proper cleanup function
  window.__moliam_cleanup_speed_buttons__ = function() {
    for (const [elem, type, handler] of speedListeners) {
      elem.removeEventListener(type, handler);
    }
    speedListeners.length = 0;
  };
})();

/* ─── A11y: FULLSCREEN BUTTON HANDLER ─── */
(function() {
  const fsBtn = document.getElementById('fs-btn');
  if (!fsBtn) return;

  // Make sure button has proper ARIA attributes
  fsBtn.setAttribute('aria-pressed', 'false');

  let isFullscreen = false;

  function handleFullscreenClick() {
    isFullscreen = !isFullscreen;

    if (isFullscreen) {
      document.exitFullscreen().then(function() {
        fsBtn.textContent = '🖥 Fullscreen';
        fsBtn.setAttribute('aria-pressed', 'false');
        announceToLiveRegion('Exited fullscreen mode');
        isFullscreen = false;
      }).catch(function() {
        // User denied or error, update button text anyway since canvas doesn't exist
        fsBtn.textContent = '⚠ Canvas not accessible';
        isFullscreen = false;
        announceToLiveRegion('Fullscreen not available on this device');
      });
    } else {
      const canvasEl = document.getElementById('canvas');
      if (!canvasEl) {
        fsBtn.textContent = '⚠ Canvas not accessible';
        isFullscreen = false;
        announceToLiveRegion('Fullscreen not available - canvas missing');
        return;
      }
      canvasEl.requestFullscreen().then(function() {
        fsBtn.textContent = '⏹ Exit Fullscreen';
        fsBtn.setAttribute('aria-pressed', 'true');
        announceToLiveRegion('Entering fullscreen mode. Press Escape to exit.');
      }).catch(function(err) {
        console.error('Fullscreen error:', err);
        fsBtn.textContent = '🖥 Fullscreen';
        isFullscreen = false;
        announceToLiveRegion('Unable to enter fullscreen mode');
      });
    }
  }

  const clickHandlerRef = handleFullscreenClick;
  fsBtn.addEventListener('click', clickHandlerRef);

  // Expose cleanup for this block - store ref separately for proper removal
  window.__moliam_cleanup_fullscreen__ = function() {
    fsBtn.removeEventListener('click', clickHandlerRef);
  };
})();

/* ─── A11y: ARIA LIVE REGION UPDATES FOR BOT ACTIVITY ─── */
(function() {
  const liveRegion = document.getElementById('a11y-live-region');

  function announceToLiveRegion(message) {
    if (!liveRegion) return;
    liveRegion.textContent = '';
    setTimeout(function() {
      liveRegion.textContent = message;
    }, 100); // Delay ensures screen readers pick it up
  }

  // Modify addFeedItem to use ARIA live region
  window.announceBotActivity = announceToLiveRegion;

  // Expose for cleanup/reference
  window.__moliam_a11y_live_region__ = {
    element: liveRegion,
    announce: announceToLiveRegion
  };
})();

window.__moliam_cleanup_main__ = function() {
  clearInterval(updateUptimeIntervalId || 0);
  clearInterval(sparklineIntervalId || 0);
  window.removeEventListener('resize', resizeHandlerHQ);
  window.removeEventListener('resize', resizeHandler);
  
  mediaQuery.removeEventListener('change', mediaQueryChangeHandler);
      // Add missing visibility handler cleanup for battery/CPU optimization
  if (window.__moliam_visibility_handler) {
    document.removeEventListener('visibilitychange', window.__moliam_visibility_handler);
    delete window.__moliam_visibility_handler;
     }
  
    // FIX: Properly track and cleanup frameId for main loop
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  // CRITICAL FIX: Only remove canvas listeners if element exists
  if (canvas && typeof canvasMouseMoveHandler !== 'undefined' && typeof canvasMouseLeaveHandler !== 'undefined') {
    try {
      canvas.removeEventListener('mousemove', canvasMouseMoveHandler);
      canvas.addEventListener('mouseleave', canvasMouseLeaveHandler);
    } catch(e) {/* safe fail */}
  }

// Call speed button cleanup - prevent memory leaks from untracked listeners
if (typeof window.__moliam_cleanup_speed_buttons__ === 'function') {
  window.__moliam_cleanup_speed_buttons__();
}

// Call FAQ accordion cleanup - prevent memory leaks from untracked listeners
if (typeof window.__moliam_cleanup_faq__ === 'function') {
  window.__moliam_cleanup_faq__();
}

// Ensure proper cleanup of all event listeners globally
window.removeAllEventListeners = function() {
  try {
      if (typeof window.__moliam_cleanup_hamburger__ === 'function') window.__moliam_cleanup_hamburger__();
      if (typeof window.__moliam_a11y_live_region__?.element) {
        const liveRegion = window.__moliam_a11y_live_region__.element;
        delete window.__moliam_a11y_live_region__;
      }
      if (window.frameId) cancelAnimationFrame(window.frameId);
  } catch(e) {/* safe fail */}
};

// Call fullscreen cleanup - ensure button exists before trying to remove listener
if (typeof window.__moliam_cleanup_fullscreen__ === 'function') {
  const fsBtn = document.getElementById('fs-btn');
  if (fsBtn) {
    window.__moliam_cleanup_fullscreen__();
  }
}
};

// Visibility change handler: pause animation when tab hidden to save battery/CPU
window.__moliam_visibility_handler = function() {
  if (document.hidden) {
    cancelAnimationFrame(frameId); // Pause when invisible
  } else {
    frameId = requestAnimationFrame(mainLoop); // Resume when visible
  }
};
document.addEventListener('visibilitychange', window.__moliam_visibility_handler);

})();
