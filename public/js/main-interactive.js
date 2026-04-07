(function() {
'use strict';

/* Enable JS-enhanced reveal animations */
document.documentElement.classList.add('js-reveal');

/* ─── UTILS ─── */
const $ = s => document.querySelector(s);
const PI2 = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => Math.random() * (b - a) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = performance.now.bind(performance);

/* ─── PARTICLE BACKGROUND ─── */
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
requestAnimationFrame(drawParticles);
window.addEventListener('resize', () => { initParticles(); });

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

/* ─── UPTIME ─── */
const startTime = Date.now();
function updateUptime() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  $('#uptime').textContent = `${h}:${m}:${s}`;
}
setInterval(updateUptime, 1000);

/* ─── STATS COUNTERS ─── */
function animateCounter(el, target, duration = 1500) {
  const start = performance.now();
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = Math.floor(eased * target);
    el.textContent = val;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const taskStat = $('#stat-tasks');
if (taskStat) animateCounter(taskStat, 50, 2000);

/* ─── HQ CANVAS VISUALIZATION ─── */
const hqCanvas = $('#hq-canvas');
if (!hqCanvas) return;
const ctx = hqCanvas.getContext('2d');

let width = hqCanvas.width = hqCanvas.offsetWidth * 2;
let height = hqCanvas.height = hqCanvas.offsetHeight * 2;
hqCanvas.style.width = hqCanvas.offsetWidth + 'px';
hqCanvas.style.height = hqCanvas.offsetHeight + 'px';

const bots = [];
const botColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
const botNames = ['Builder', 'Optimizer', 'AdRunner', 'Analyzer', 'Reporter'];

for (let i = 0; i < 5; i++) {
  bots.push({
    x: width * 0.2 + (i % 3) * width * 0.4,
    y: height * 0.3 + Math.floor(i / 3) * height * 0.4,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: 18 + i * 3,
    color: botColors[i],
    name: botNames[i],
    tasksDone: Math.floor(Math.random() * 20) + 5,
    status: 'active'
  });
}

function drawHQ() {
  ctx.fillStyle = 'rgba(11, 14, 20, 0.1)';
  ctx.fillRect(0, 0, width, height);

  bots.forEach(bot => {
    bot.x += bot.vx;
    bot.y += bot.vy;

    if (bot.x < bot.radius || bot.x > width - bot.radius) bot.vx *= -1;
    if (bot.y < bot.radius || bot.y > height - bot.radius) bot.vy *= -1;

    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.radius, 0, PI2);
    ctx.fillStyle = bot.color;
    ctx.fill();
    ctx.strokeStyle = '#F9FAFB';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F9FAFB';
    ctx.font = 'bold 11px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bot.name[0], bot.x, bot.y);
  });

  bots.forEach((b1, i) => {
    bots.slice(i + 1).forEach(b2 => {
      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(59, 130, 246, ${1 - dist / 100 * 0.5})`;
        ctx.lineWidth = 1;
        ctx.moveTo(b1.x, b1.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.stroke();
      }
    });
  });

  requestAnimationFrame(drawHQ);
}
requestAnimationFrame(drawHQ);

/* ─── ACTIVITY FEED ─── */
const activityFeed = $('#activity-feed');
if (activityFeed) {
  let itemIdx = 0;
  const activities = [
    'Website audit complete', 'GBP post scheduled', 'Ad campaign optimized',
    'Lead score calculated', 'Report generated'
  ];
  setInterval(() => {
    const text = `${activities[itemIdx % activities.length]} — ${new Date().toLocaleTimeString()}`;
    itemIdx++;
    activityFeed.innerHTML = `<div style="font-size:13px; color:#9CA3AF;">${text}</div>` + activityFeed.innerHTML;
    if (activityFeed.children.length > 5) activityFeed.lastChild.remove();
  }, 4000);
}

/* ─── BOT STATUS PANEL ─── */
const botStatusPanel = $('#bot-status-panel');
if (botStatusPanel) {
  let botIdx = 0;
  setInterval(() => {
    const bot = bots[botIdx % 5];
    botIdx++;
    bot.tasksDone++;
    bot.status = pick(['active', 'processing', 'idle']);
  }, 2000);
}

/* ─── BOT TOOLTIP ─── */
const tooltip = $('#bot-tooltip');
if (tooltip) {
  hqCanvas.addEventListener('mousemove', e => {
    const rect = hqCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * 2;
    const y = (e.clientY - rect.top) * 2;

    let clickedBot = null;
    bots.forEach(bot => {
      const dx = bot.x - x;
      const dy = bot.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < bot.radius) {
        clickedBot = bot;
      }
    });

    if (clickedBot) {
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 15) + 'px';
      tooltip.style.top = (e.clientY + 15) + 'px';
      $('#tt-name').textContent = clickedBot.name;
      $('#tt-role').textContent = `Task: ${clickedBot.status}`;
      $('#tt-task').textContent = `${clickedBot.tasksDone} done`;
      $('#tt-uptime').textContent = updateUptime().split(':')[0] + ':xx';
      $('#tt-avatar').style.backgroundColor = clickedBot.color;
    } else {
      tooltip.style.display = 'none';
    }
  });
}

/* ─── REVEAL ANIMATION ─── */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

})();