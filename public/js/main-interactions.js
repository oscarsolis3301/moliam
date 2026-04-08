/**
 * Moliam HQ Canvas + Particle System + Hamburger Menu Handler
 * Handles: particle background, real-time AI operations visualization, bot animations
 */
(function() {
  'use strict';

  /* ─── PARTICLES BACKGROUND ─── */
  const pbg = $('#particle-bg');
  const pctx = pbg.getContext('2d');
  let particles = [];

  function initParticles() {
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

  function drawParticles(t) {
    pctx.clearRect(0, 0, pbg.width, pbg.height);
    for (const p of particles) {
      p.x += p.dx;
      p.y += p.dy;
      p.pulse += 0.01;
      if (p.x < 0) p.x = pbg.width;
      if (p.x > pbg.width) p.x = 0;
      if (p.y < 0) p.y = pbg.height;
      if (p.y > pbg.height) p.y = 0;
      const alpha = p.a * (0.6 + 0.4 * Math.sin(p.pulse));
      pctx.beginPath();
      pctx.arc(p.x, p.y, p.r, 0, PI2);
      pctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
      pctx.fill();
    }
    requestAnimationFrame(drawParticles);
  }

  initParticles();
  window.addEventListener('resize', () => { initParticles(); });

  /* ─── SPARKLINE UTILITY ─── */
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
    sparkCtx.strokeStyle = '#3B82F6';
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

  /* ─── UPTIME COUNTER ─── */
  const startTime = Date.now();
  function updateUptime() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    $('#uptime').textContent = `${h}:${m}:${s}`;
  	}
  let updateUptimeIntervalId;
  updateUptimeIntervalId = setInterval(updateUptime, 1000);

   /* ─── ACTIVITY FEED LOGIC ─── */
  const feedEl = $('#activity-feed');
  const feedItems = [];

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

  /* ─── HQ CANVAS INITIALIZATION ─── */
  const canvas = $('#hq-canvas');
  const ctx = canvas.getContext('2d');
  let W, H;
  let mouseX = -1000, mouseY = -1000;
  let hoveredBot = null;

  function resizeCanvas() {
    const wrap = $('#hq-canvas-wrap');
    const dpr = window.devicePixelRatio || 1;
    let displayW = wrap.clientWidth || wrap.offsetWidth || window.innerWidth;
    let displayH = wrap.clientHeight || wrap.offsetHeight || 400;
    if (displayH < 50) displayH = Math.min(400, window.innerHeight * 0.5);
    if (displayW < 50) displayW = window.innerWidth;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = displayW;
    H = displayH;
  }

  /* ─── ROOMS DEFINITION ─── */
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
    const isMobile = W < 600;
    const margin = isMobile ? 12 : 40;
    const cols = W > 900 ? 3 : (isMobile ? 3 : 2);
    const rows = Math.ceil(ROOM_DEFS.length / cols);
    const padTop = isMobile ? 12 : 40;
    const padBottom = isMobile ? 8 : 20;
    const gapX = isMobile ? 8 : 24;
    const gapY = isMobile ? 8 : 24;
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

  /* ─── BOTS INITIALIZATION ─── */
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

  window.__moliam_cleanup_main_interactions__ = function() {
    if (typeof updateUptimeIntervalId !== 'undefined' && updateUptimeIntervalId) {
      clearInterval(updateUptimeIntervalId);
     }
   };

})();

