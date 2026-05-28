/* ═══════════════════════════════════════════════
   PLAYGROUND ENGINE
   ─ Single-active game manager
   ─ Each game implements the GameModule interface:
       constructor(stage)         // stage = HTMLElement to mount into
       start()                    // begin (or resume from pause)
       pause()                    // freeze loop / input
       reset()                    // back to a fresh state
       destroy()                  // release listeners, RAF, audio
       onScore?(fn)               // optional: emit score updates
       label                      // {score, length, ...} hud labels
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Manager: enforces "one game running at a time" ────
  const Manager = (() => {
    let active = null; // { id, mod, card }
    const cards = new Map(); // id -> { mod, card, hud }

    function register(id, mod, card, hud) {
      cards.set(id, { mod, card, hud });
    }

    function setState(card, state) {
      card.classList.remove('is-active', 'is-paused');
      if (state === 'active') card.classList.add('is-active');
      if (state === 'paused') card.classList.add('is-paused');
    }

    function activate(id) {
      const entry = cards.get(id);
      if (!entry) return;

      // pause everything else
      for (const [otherId, other] of cards) {
        if (otherId !== id) {
          try { other.mod.pause && other.mod.pause(); } catch (e) { console.warn(e); }
          if (other.card.classList.contains('is-active')) {
            setState(other.card, 'paused');
          }
        }
      }

      // start the chosen one
      try { entry.mod.start && entry.mod.start(); } catch (e) { console.warn(e); }
      setState(entry.card, 'active');
      active = { id, mod: entry.mod, card: entry.card };
      updateStatus();
    }

    function toggle(id) {
      const entry = cards.get(id);
      if (!entry) return;
      // if it's the currently-active game, pause; else activate
      if (active && active.id === id && entry.card.classList.contains('is-active')) {
        try { entry.mod.pause && entry.mod.pause(); } catch (e) {}
        setState(entry.card, 'paused');
        active = null;
        updateStatus();
      } else {
        activate(id);
      }
    }

    function updateStatus() {
      const nameEl = document.getElementById('status-active');
      const dotEl  = document.getElementById('status-dot');
      if (active) {
        const meta = active.mod.meta || {};
        if (nameEl) nameEl.textContent = meta.title || active.id;
        if (dotEl) dotEl.classList.remove('idle');
      } else {
        if (nameEl) nameEl.textContent = 'Idle';
        if (dotEl) dotEl.classList.add('idle');
      }
    }

    return { register, activate, toggle, updateStatus, get active() { return active; } };
  })();

  /* ─────────────────────────────────────────────
     SHARED HELPERS
  ───────────────────────────────────────────── */
  function makeCanvas(stage, onResize) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const c = document.createElement('canvas');
    stage.appendChild(c);
    function fit() {
      const r = stage.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
        c.style.width = r.width + 'px';
        c.style.height = r.height + 'px';
        if (onResize) try { onResize(w, h); } catch (e) {}
      }
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return { canvas: c, ctx: c.getContext('2d'), dpr, dispose: () => ro.disconnect(), refit: fit };
  }

  function setHud(hud, key, val) {
    if (!hud) return;
    const el = hud.querySelector(`[data-hud="${key}"]`);
    if (el) el.textContent = val;
  }

  /* ═══════════════════════════════════════════
     GAME 01 · NEURAL SNAKE
  ═══════════════════════════════════════════ */
  class SnakeGame {
    constructor(stage, hud) {
      this.stage = stage;
      this.hud = hud;
      this.meta = { title: 'Neural Snake' };
      const { canvas, ctx, dpr, dispose } = makeCanvas(stage);
      this.canvas = canvas; this.ctx = ctx; this.dpr = dpr; this.disposeRO = dispose;
      this.cell = 16 * dpr;
      this.running = false;
      this.raf = 0;
      this.acc = 0;
      this.last = 0;
      this.tick = 95; // ms per step
      this.bestScore = parseInt(localStorage.getItem('snake.bestScore') || '0', 10);
      this.bestLength = parseInt(localStorage.getItem('snake.bestLength') || '3', 10);
      this._reset();
      this._bind();
      this._draw();
    }
    _reset() {
      this.dir = { x: 1, y: 0 };
      this.next = { x: 1, y: 0 };
      this.snake = [{x: 8, y: 7}, {x: 7, y: 7}, {x: 6, y: 7}];
      this.food = this._spawnFood();
      this.score = 0;
      this.gameOver = false;
      this.gameOverAt = 0;
      setHud(this.hud, 'score', '000');
      setHud(this.hud, 'length', String(this.snake.length).padStart(3, '0'));
    }
    setDir(dx, dy) {
      if (this.gameOver) return;
      if (dx === 1 && this.dir.x === -1) return;
      if (dx === -1 && this.dir.x === 1) return;
      if (dy === 1 && this.dir.y === -1) return;
      if (dy === -1 && this.dir.y === 1) return;
      this.next = { x: dx, y: dy };
    }
    _gridSize() {
      return {
        cols: Math.floor(this.canvas.width / this.cell),
        rows: Math.floor(this.canvas.height / this.cell),
      };
    }
    _spawnFood() {
      const { cols, rows } = this._gridSize();
      while (true) {
        const f = { x: Math.floor(Math.random()*cols), y: Math.floor(Math.random()*rows) };
        if (!this.snake.some(s => s.x===f.x && s.y===f.y)) return f;
      }
    }
    _bind() {
      this._key = (e) => {
        if (!this.running) return;
        if (this.gameOver) {
          if (e.key === ' ' || e.key === 'Enter' || e.key === 'r' || e.key === 'R') {
            this._reset();
            e.preventDefault();
          }
          return;
        }
        const k = e.key;
        if (k === 'ArrowUp' || k === 'w' || k === 'W')    this.setDir(0, -1);
        else if (k === 'ArrowDown' || k === 's' || k === 'S')  this.setDir(0, 1);
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A')  this.setDir(-1, 0);
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.setDir(1, 0);
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(k)) e.preventDefault();
      };
      window.addEventListener('keydown', this._key);
      this._restart = () => {
        if (this.gameOver) this._reset();
      };
      this.canvas.addEventListener('click', this._restart);

      // touch swipe directions
      let tx = 0, ty = 0, td = false;
      this._tStart = (e) => {
        const t = e.touches[0]; tx = t.clientX; ty = t.clientY; td = true;
      };
      this._tMove = (e) => {
        if (!td) return;
        const t = e.touches[0];
        const dx = t.clientX - tx, dy = t.clientY - ty;
        if (Math.hypot(dx, dy) < 22) return;
        if (this.gameOver) { this._reset(); td = false; return; }
        if (Math.abs(dx) > Math.abs(dy)) this.setDir(dx > 0 ? 1 : -1, 0);
        else this.setDir(0, dy > 0 ? 1 : -1);
        td = false;
        e.preventDefault();
      };
      this._tEnd = () => { td = false; };
      this.canvas.addEventListener('touchstart', this._tStart, { passive: true });
      this.canvas.addEventListener('touchmove', this._tMove, { passive: false });
      this.canvas.addEventListener('touchend', this._tEnd, { passive: true });
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const loop = (t) => {
        if (!this.running) return;
        this.acc += t - this.last;
        this.last = t;
        while (this.acc >= this.tick) { this._step(); this.acc -= this.tick; }
        this._draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    pause() {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
    _step() {
      if (this.gameOver) return;
      this.dir = this.next;
      const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
      const { cols, rows } = this._gridSize();
      // wall collision -> game over
      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        this.gameOver = true;
        this.gameOverAt = performance.now();
        return;
      }
      // self-collision -> game over
      if (this.snake.some(s => s.x===head.x && s.y===head.y)) {
        this.gameOver = true;
        this.gameOverAt = performance.now();
        return;
      }
      this.snake.unshift(head);
      if (head.x === this.food.x && head.y === this.food.y) {
        this.score += 10;
        this.food = this._spawnFood();
        setHud(this.hud, 'score', String(this.score).padStart(3, '0'));
        setHud(this.hud, 'length', String(this.snake.length).padStart(3, '0'));
      } else {
        this.snake.pop();
      }
    }
    _draw() {
      const { ctx, canvas, cell } = this;
      ctx.fillStyle = '#060608';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      const { cols, rows } = this._gridSize();
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath(); ctx.moveTo(i*cell, 0); ctx.lineTo(i*cell, rows*cell); ctx.stroke();
      }
      for (let j = 0; j <= rows; j++) {
        ctx.beginPath(); ctx.moveTo(0, j*cell); ctx.lineTo(cols*cell, j*cell); ctx.stroke();
      }
      // walls
      ctx.strokeStyle = this.gameOver ? 'rgba(255,107,53,0.6)' : 'rgba(167,139,250,0.18)';
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.strokeRect(0.5, 0.5, cols*cell - 1, rows*cell - 1);
      // food
      ctx.fillStyle = '#ff6b35';
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 16;
      ctx.fillRect(this.food.x*cell+3, this.food.y*cell+3, cell-6, cell-6);
      ctx.shadowBlur = 0;
      // snake
      this.snake.forEach((s, i) => {
        const t = i / this.snake.length;
        ctx.fillStyle = i === 0 ? '#c4b5fd' : `rgba(167,139,250,${1 - t*0.5})`;
        if (this.gameOver && i === 0) ctx.fillStyle = '#ff6b35';
        ctx.fillRect(s.x*cell+2, s.y*cell+2, cell-4, cell-4);
      });
      // game over overlay
      if (this.gameOver) {
        const t = (performance.now() - this.gameOverAt) / 280;
        const a = Math.min(1, t);
        ctx.fillStyle = `rgba(6,6,8,${0.65 * a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = canvas.width / 2, cy = canvas.height / 2;
        ctx.fillStyle = `rgba(255,107,53,${a})`;
        ctx.font = `400 ${28*this.dpr}px "Instrument Serif", serif`;
        ctx.fillText('Game Over', cx, cy - 18*this.dpr);
        ctx.fillStyle = `rgba(232,232,237,${a})`;
        ctx.font = `500 ${13*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText(`Score  ${String(this.score).padStart(3,'0')}   ·   Length  ${String(this.snake.length).padStart(3,'0')}`, cx, cy + 10*this.dpr);
        ctx.fillStyle = `rgba(168,168,179,${0.8 * a})`;
        ctx.font = `${10*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText('PRESS  SPACE  ·  TAP  ·  CLICK   TO  RESTART', cx, cy + 34*this.dpr);
      }
    }
    destroy() {
      this.pause();
      window.removeEventListener('keydown', this._key);
      if (this._restart) this.canvas.removeEventListener('click', this._restart);
      if (this._tStart) {
        this.canvas.removeEventListener('touchstart', this._tStart);
        this.canvas.removeEventListener('touchmove', this._tMove);
        this.canvas.removeEventListener('touchend', this._tEnd);
      }
      this.disposeRO();
      this.stage.innerHTML = '';
    }
  }

  /* ═══════════════════════════════════════════
     GAME 02 · ORBITAL · click-to-spawn gravity sim
  ═══════════════════════════════════════════ */
  class OrbitalGame {
    constructor(stage, hud) {
      this.stage = stage; this.hud = hud;
      this.meta = { title: 'Orbital' };
      const { canvas, ctx, dpr, dispose } = makeCanvas(stage);
      this.canvas = canvas; this.ctx = ctx; this.dpr = dpr; this.disposeRO = dispose;
      this.bodies = [];
      this.score = 0;
      this.running = false;
      this.raf = 0;
      this._reset();
      this._bind();
      this._draw();
    }
    _reset() {
      this.bodies = [];
      this.score = 0;
      setHud(this.hud, 'score', '000');
      setHud(this.hud, 'length', '000');
    }
    _bind() {
      this._click = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * this.dpr;
        const y = (e.clientY - r.top)  * this.dpr;
        // velocity perpendicular to center
        const cx = this.canvas.width/2, cy = this.canvas.height/2;
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const speed = 0.9;
        this.bodies.push({ x, y, vx: -dy/d*speed, vy: dx/d*speed,
          r: 3 + Math.random()*3, hue: Math.random() < 0.5 ? '#a78bfa' : '#ff6b35', life: 1 });
        this.score += 1;
        setHud(this.hud, 'score', String(this.score).padStart(3, '0'));
        setHud(this.hud, 'length', String(this.bodies.length).padStart(3, '0'));
      };
      this.canvas.addEventListener('click', this._click);
    }
    start() {
      if (this.running) return;
      this.running = true;
      const loop = () => {
        if (!this.running) return;
        this._step();
        this._draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    pause() { this.running = false; cancelAnimationFrame(this.raf); }
    _step() {
      const cx = this.canvas.width/2, cy = this.canvas.height/2;
      const G = 0.18 * this.dpr;
      for (const b of this.bodies) {
        const dx = cx - b.x, dy = cy - b.y;
        const d2 = dx*dx + dy*dy + 800;
        const f = G / d2 * 1500;
        b.vx += dx * f / Math.sqrt(d2);
        b.vy += dy * f / Math.sqrt(d2);
        b.x += b.vx;
        b.y += b.vy;
      }
      // cull bodies way off screen
      this.bodies = this.bodies.filter(b =>
        b.x > -200 && b.x < this.canvas.width+200 &&
        b.y > -200 && b.y < this.canvas.height+200
      );
      if (this.bodies.length > 80) this.bodies = this.bodies.slice(-80);
      setHud(this.hud, 'length', String(this.bodies.length).padStart(3, '0'));
    }
    _draw() {
      const { ctx, canvas } = this;
      // trail-fade
      ctx.fillStyle = 'rgba(6,6,8,0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // central star
      const cx = canvas.width/2, cy = canvas.height/2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40*this.dpr);
      grad.addColorStop(0, 'rgba(196,181,253,0.85)');
      grad.addColorStop(1, 'rgba(196,181,253,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 4*this.dpr, 0, Math.PI*2);
      ctx.fill();
      // orbiting bodies
      for (const b of this.bodies) {
        ctx.shadowColor = b.hue;
        ctx.shadowBlur = 12;
        ctx.fillStyle = b.hue;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * this.dpr, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // empty-state hint
      if (this.bodies.length === 0) {
        ctx.fillStyle = 'rgba(168,168,179,0.55)';
        ctx.font = `${10*this.dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('CLICK ANYWHERE TO LAUNCH A BODY', cx, cy + 60*this.dpr);
      }
    }
    destroy() {
      this.pause();
      this.canvas.removeEventListener('click', this._click);
      this.disposeRO();
      this.stage.innerHTML = '';
    }
  }

  /* ═══════════════════════════════════════════
     GAME 03 · LATTICE · breakout-style with persistent paddle (mouse)
  ═══════════════════════════════════════════ */
  class LatticeGame {
    constructor(stage, hud) {
      this.stage = stage; this.hud = hud;
      this.meta = { title: 'Lattice' };
      const { canvas, ctx, dpr, dispose } = makeCanvas(stage, (w, h) => {
        // Re-build the level on resize: paddle stays bottom-center, ball recenters,
        // bricks re-tile to new width. Only do this if we already had a layout.
        if (this.paddle) this._reset();
      });
      this.canvas = canvas; this.ctx = ctx; this.dpr = dpr; this.disposeRO = dispose;
      this.running = false;
      this.raf = 0;
      this._reset();
      this._bind();
      this._draw();
    }
    _reset() {
      const w = this.canvas.width, h = this.canvas.height;
      this.paddle = { x: w/2, w: 70*this.dpr, h: 6*this.dpr, y: h - 18*this.dpr };
      this.ball = { x: w/2, y: h/2, vx: 2.4*this.dpr, vy: -2.4*this.dpr, r: 4*this.dpr };
      this.bricks = [];
      const cols = 8, rows = 4;
      const bw = (w - 40*this.dpr) / cols;
      const bh = 14*this.dpr;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.bricks.push({
            x: 20*this.dpr + c*bw, y: 30*this.dpr + r*(bh+4*this.dpr),
            w: bw - 4*this.dpr, h: bh, alive: true,
            hue: r < 2 ? '#a78bfa' : '#ff6b35'
          });
        }
      }
      this.score = 0;
      setHud(this.hud, 'score', '000');
      setHud(this.hud, 'length', String(this.bricks.length).padStart(3, '0'));
    }
    _bind() {
      this._move = (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.paddle.x = (e.clientX - r.left) * this.dpr;
      };
      this._tmove = (e) => {
        if (!e.touches[0]) return;
        const r = this.canvas.getBoundingClientRect();
        this.paddle.x = (e.touches[0].clientX - r.left) * this.dpr;
        e.preventDefault();
      };
      this.canvas.addEventListener('mousemove', this._move);
      this.canvas.addEventListener('touchstart', this._tmove, { passive: false });
      this.canvas.addEventListener('touchmove', this._tmove, { passive: false });
    }
    start() {
      if (this.running) return;
      this.running = true;
      const loop = () => {
        if (!this.running) return;
        this._step();
        this._draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    pause() { this.running = false; cancelAnimationFrame(this.raf); }
    _step() {
      const b = this.ball, w = this.canvas.width, h = this.canvas.height;
      b.x += b.vx; b.y += b.vy;
      if (b.x < b.r || b.x > w - b.r) b.vx *= -1;
      if (b.y < b.r) b.vy *= -1;
      if (b.y > h) { b.x = w/2; b.y = h/2; b.vx = 2.4*this.dpr; b.vy = -2.4*this.dpr; }
      // paddle
      const px = this.paddle.x - this.paddle.w/2;
      if (b.y + b.r >= this.paddle.y && b.y + b.r <= this.paddle.y + this.paddle.h &&
          b.x >= px && b.x <= px + this.paddle.w) {
        b.vy = -Math.abs(b.vy);
        const off = (b.x - this.paddle.x) / (this.paddle.w/2);
        b.vx = off * 3.2 * this.dpr;
      }
      // bricks
      for (const br of this.bricks) {
        if (!br.alive) continue;
        if (b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h) {
          br.alive = false;
          b.vy *= -1;
          this.score += 10;
          setHud(this.hud, 'score', String(this.score).padStart(3, '0'));
          const remaining = this.bricks.filter(x => x.alive).length;
          setHud(this.hud, 'length', String(remaining).padStart(3, '0'));
          if (remaining === 0) this._reset();
          break;
        }
      }
    }
    _draw() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#060608';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // bricks
      for (const br of this.bricks) {
        if (!br.alive) continue;
        ctx.fillStyle = br.hue;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(br.x, br.y, br.w, br.h);
        ctx.globalAlpha = 1;
      }
      // paddle
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(this.paddle.x - this.paddle.w/2, this.paddle.y, this.paddle.w, this.paddle.h);
      // ball
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    destroy() {
      this.pause();
      this.canvas.removeEventListener('mousemove', this._move);
      if (this._tmove) {
        this.canvas.removeEventListener('touchstart', this._tmove);
        this.canvas.removeEventListener('touchmove', this._tmove);
      }
      this.disposeRO();
      this.stage.innerHTML = '';
    }
  }

  /* ═══════════════════════════════════════════
     GAME 04 · PULSE · rhythm-tap, click circles as they shrink
  ═══════════════════════════════════════════ */
  class PulseGame {
    constructor(stage, hud) {
      this.stage = stage; this.hud = hud;
      this.meta = { title: 'Pulse' };
      const { canvas, ctx, dpr, dispose } = makeCanvas(stage);
      this.canvas = canvas; this.ctx = ctx; this.dpr = dpr; this.disposeRO = dispose;
      this.running = false;
      this.raf = 0;
      this.targets = [];
      this._reset();
      this._bind();
      this._draw();
    }
    _reset() {
      this.targets = [];
      this.score = 0;
      this.spawnAcc = 0;
      this.last = performance.now();
      setHud(this.hud, 'score', '000');
      setHud(this.hud, 'length', '000');
    }
    _bind() {
      this._click = (e) => {
        const r = this.canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * this.dpr;
        const y = (e.clientY - r.top) * this.dpr;
        for (let i = this.targets.length - 1; i >= 0; i--) {
          const t = this.targets[i];
          if (Math.hypot(x - t.x, y - t.y) <= t.r) {
            const bonus = Math.max(5, Math.floor(20 - t.age*0.8));
            this.score += bonus;
            this.targets.splice(i, 1);
            setHud(this.hud, 'score', String(this.score).padStart(3, '0'));
            return;
          }
        }
      };
      this.canvas.addEventListener('click', this._click);
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const loop = (t) => {
        if (!this.running) return;
        const dt = t - this.last; this.last = t;
        this._step(dt);
        this._draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    pause() { this.running = false; cancelAnimationFrame(this.raf); }
    _step(dt) {
      this.spawnAcc += dt;
      if (this.spawnAcc > 700) {
        this.spawnAcc = 0;
        const pad = 40*this.dpr;
        this.targets.push({
          x: pad + Math.random()*(this.canvas.width - pad*2),
          y: pad + Math.random()*(this.canvas.height - pad*2),
          r: 26*this.dpr,
          age: 0,
          life: 1800,
          hue: Math.random() < 0.5 ? '#a78bfa' : '#ff6b35',
        });
      }
      for (const t of this.targets) {
        t.age += dt;
        t.r = 26*this.dpr * (1 - t.age/t.life);
      }
      this.targets = this.targets.filter(t => t.age < t.life);
      setHud(this.hud, 'length', String(this.targets.length).padStart(3, '0'));
    }
    _draw() {
      const { ctx, canvas } = this;
      ctx.fillStyle = 'rgba(6,6,8,0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const t of this.targets) {
        const alpha = 1 - t.age/t.life;
        ctx.strokeStyle = t.hue;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2 * this.dpr;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
        ctx.stroke();
        ctx.fillStyle = t.hue;
        ctx.globalAlpha = alpha * 0.18;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.6, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (this.targets.length === 0) {
        ctx.fillStyle = 'rgba(168,168,179,0.45)';
        ctx.font = `${10*this.dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('TAP THE RINGS BEFORE THEY VANISH', canvas.width/2, canvas.height/2);
      }
    }
    destroy() {
      this.pause();
      this.canvas.removeEventListener('click', this._click);
      this.disposeRO();
      this.stage.innerHTML = '';
    }
  }

  /* ═══════════════════════════════════════════
     GAME 05 · DRIFT · WASD avoid asteroids
  ═══════════════════════════════════════════ */
  class DriftGame {
    constructor(stage, hud) {
      this.stage = stage; this.hud = hud;
      this.meta = { title: 'Drift' };
      const { canvas, ctx, dpr, dispose, refit } = makeCanvas(stage, (w, h) => {
        // keep player on the bottom row, clamped horizontally
        if (this.player) {
          this.player.x = Math.min(Math.max(this.player.x, 20*this.dpr), w - 20*this.dpr);
          this.player.y = h - 40*this.dpr;
        }
      });
      this.canvas = canvas; this.ctx = ctx; this.dpr = dpr; this.disposeRO = dispose; this.refit = refit;
      this.running = false;
      this.raf = 0;
      this.keys = { left:false, right:false };
      this.bestLevel = parseInt(localStorage.getItem('drift.bestLevel') || '0', 10);
      this.bestScore = parseInt(localStorage.getItem('drift.bestScore') || '0', 10);
      this._reset();
      this._bind();
      this._draw();
    }
    _reset() {
      const w = this.canvas.width, h = this.canvas.height;
      this.player = { x: w/2, y: h - 40*this.dpr };
      this.aster = [];
      this.score = 0;
      this.elapsed = 0;       // ms since play started
      this.spawnAcc = 0;
      this.last = performance.now();
      this.level = 1;
      this.levelFlashAt = 0;  // ms timestamp; show banner for 1.6s
      this.intro = true;      // pre-game "Avoid all circles" overlay
      this.introT = 0;
      this.gameOver = false;
      this.gameOverAt = 0;
      this.gameOverSummary = null;
      this.keys.left = false; this.keys.right = false;
      setHud(this.hud, 'score', '000');
      setHud(this.hud, 'length', 'L01');
    }
    _die() {
      const finalScore = Math.floor(this.score);
      const finalLevel = this.level;
      const isBestLevel = finalLevel > this.bestLevel;
      const isBestScore = finalScore > this.bestScore;
      if (isBestLevel) { this.bestLevel = finalLevel; localStorage.setItem('drift.bestLevel', String(finalLevel)); }
      if (isBestScore) { this.bestScore = finalScore; localStorage.setItem('drift.bestScore', String(finalScore)); }
      this.gameOver = true;
      this.gameOverAt = performance.now();
      this.gameOverSummary = {
        score: finalScore,
        level: finalLevel,
        seconds: Math.round(this.elapsed / 1000),
        bestLevel: this.bestLevel,
        bestScore: this.bestScore,
        newBest: isBestLevel || isBestScore,
      };
      this.keys.left = false; this.keys.right = false;
    }
    _difficulty() {
      // Smooth ramp. Level = floor(elapsed / 18s) + 1.
      // d ranges 0 → ~1.5 over a few minutes; never caps so it's infinite.
      const t = this.elapsed / 1000; // seconds
      const d = Math.log1p(t / 14);  // gentle, asymptote-free curve
      const newLevel = Math.floor(t / 18) + 1;
      if (newLevel !== this.level) {
        this.level = newLevel;
        this.levelFlashAt = performance.now();
      }
      return d;
    }
    _bind() {
      this._dismissIntro = () => {
        if (this.gameOver) {
          // small delay so user reads summary before accidental restart
          if (performance.now() - this.gameOverAt < 700) return;
          this._reset();
          this.intro = false;
          return;
        }
        if (this.intro) this.intro = false;
      };
      this._down = (e) => {
        if (!this.running) return;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { this.keys.left = true; this._dismissIntro(); }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { this.keys.right = true; this._dismissIntro(); }
        if (e.key === ' ' || e.key === 'Enter') this._dismissIntro();
      };
      this._up = (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
      };
      this._screenClick = () => this._dismissIntro();
      window.addEventListener('keydown', this._down);
      window.addEventListener('keyup', this._up);
      this.canvas.addEventListener('click', this._screenClick);
      // touch: tap/drag left half to go left, right half to go right
      let activeTouch = null;
      this._tStart = (e) => {
        if (!this.running) return;
        this._dismissIntro();
        const t = e.touches[0]; activeTouch = t.identifier;
        const r = this.canvas.getBoundingClientRect();
        const x = t.clientX - r.left;
        if (x < r.width/2) { this.keys.left = true; this.keys.right = false; }
        else { this.keys.right = true; this.keys.left = false; }
      };
      this._tMove = (e) => {
        for (const t of e.touches) {
          if (t.identifier !== activeTouch) continue;
          const r = this.canvas.getBoundingClientRect();
          const x = t.clientX - r.left;
          if (x < r.width/2) { this.keys.left = true; this.keys.right = false; }
          else { this.keys.right = true; this.keys.left = false; }
        }
        e.preventDefault();
      };
      this._tEnd = () => { activeTouch = null; this.keys.left = false; this.keys.right = false; };
      this.canvas.addEventListener('touchstart', this._tStart, { passive: true });
      this.canvas.addEventListener('touchmove', this._tMove, { passive: false });
      this.canvas.addEventListener('touchend', this._tEnd, { passive: true });
      this.canvas.addEventListener('touchcancel', this._tEnd, { passive: true });
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const loop = (t) => {
        if (!this.running) return;
        const dt = t - this.last; this.last = t;
        this._step(dt);
        this._draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    pause() { this.running = false; cancelAnimationFrame(this.raf); }
    _step(dt) {
      const w = this.canvas.width, h = this.canvas.height;
      if (this.gameOver) return;
      // intro: hold game state until user moves
      if (this.intro) {
        this.introT += dt;
        return;
      }
      this.elapsed += dt;
      const d = this._difficulty(); // 0 → ~1.5+ over time

      // player movement: speed scales gently with difficulty so they can keep up
      const speed = (0.36 + 0.10 * d) * this.dpr * dt;
      if (this.keys.left)  this.player.x = Math.max(20*this.dpr, this.player.x - speed);
      if (this.keys.right) this.player.x = Math.min(w - 20*this.dpr, this.player.x + speed);

      // spawn: starts every 520ms, ramps down to ~140ms minimum (still humanly possible)
      const spawnInterval = Math.max(140, 520 - 110 * d);
      this.spawnAcc += dt;
      if (this.spawnAcc > spawnInterval) {
        this.spawnAcc = 0;
        // base velocity ramps; max-fall capped so reaction window stays survivable.
        const baseV = 1.4 + 0.55 * d;        // dpr-units / frame at 60fps
        const jitter = 0.6 + 0.7 * d;
        // size grows slightly with level — keeps feel; never exceeds ~14px so gaps remain
        const baseR = 4.5 + Math.min(2.0, d * 1.2);

        // multi-spawn at higher difficulty (cluster of 1-3), but never block the lane fully
        const cluster = d > 0.85 ? 2 + (Math.random() < d - 0.85 ? 1 : 0) : 1;
        const minGap = 64 * this.dpr; // guaranteed safe corridor between cluster members
        const placed = [];
        for (let i = 0; i < cluster; i++) {
          let tries = 0, x;
          do {
            x = 22*this.dpr + Math.random()*(w - 44*this.dpr);
            tries++;
          } while (tries < 12 && placed.some(px => Math.abs(px - x) < minGap));
          placed.push(x);
          this.aster.push({
            x,
            y: -20*this.dpr - i * 30*this.dpr,
            v: (baseV + Math.random()*jitter) * this.dpr,
            // small lateral drift at higher levels for "tricky" feel; bounded
            vx: (d > 0.6 ? (Math.random() - 0.5) * (d - 0.6) * 0.8 : 0) * this.dpr,
            r: (baseR + Math.random()*4) * this.dpr,
          });
        }
      }

      for (const a of this.aster) {
        a.y += a.v;
        if (a.vx) {
          a.x += a.vx;
          if (a.x < a.r || a.x > w - a.r) a.vx *= -1; // bounce off side walls
        }
      }
      // collisions
      for (const a of this.aster) {
        if (Math.hypot(a.x - this.player.x, a.y - this.player.y) < a.r + 8*this.dpr) {
          this._die();
          return;
        }
      }
      this.aster = this.aster.filter(a => a.y < h + 30*this.dpr);
      this.score += dt * (0.02 + 0.01 * d);
      setHud(this.hud, 'score', String(Math.floor(this.score)).padStart(3, '0'));
      setHud(this.hud, 'length', `L${String(this.level).padStart(2,'0')}`);
    }
    _draw() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#060608';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // starfield — speed scales with difficulty for "speeding up" feel
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      const speedMul = this.intro ? 1 : (1 + (this._difficulty ? this._difficulty() : 0) * 1.4);
      for (let i = 0; i < 30; i++) {
        const x = (i*73 % canvas.width);
        const y = ((i*131 + (Date.now()/24) * speedMul) % canvas.height);
        ctx.fillRect(x, y, 1, 1);
      }
      // asteroids
      for (const a of this.aster) {
        ctx.fillStyle = '#ff6b35';
        ctx.shadowColor = '#ff6b35'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // ship (triangle)
      ctx.fillStyle = '#c4b5fd';
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y - 10*this.dpr);
      ctx.lineTo(this.player.x - 9*this.dpr, this.player.y + 8*this.dpr);
      ctx.lineTo(this.player.x + 9*this.dpr, this.player.y + 8*this.dpr);
      ctx.closePath();
      ctx.fill();

      // ── intro overlay: pause + instructions ──
      if (this.intro && !this.gameOver) {
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const pulse = 0.92 + 0.08 * Math.sin(this.introT * 0.004);
        ctx.fillStyle = 'rgba(6,6,8,0.62)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(168,168,179,0.7)';
        ctx.font = `${10*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText('LEVEL  01', cx, cy - 56*this.dpr);
        ctx.fillStyle = `rgba(196,181,253,${pulse})`;
        ctx.font = `400 ${30*this.dpr}px "Instrument Serif", serif`;
        ctx.fillText('Avoid all circles', cx, cy - 18*this.dpr);
        ctx.fillStyle = 'rgba(232,232,237,0.85)';
        ctx.font = `${11*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText('A · D    or    ← →    or    swipe', cx, cy + 16*this.dpr);
        ctx.fillStyle = `rgba(255,107,53,${pulse})`;
        ctx.font = `${10*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText('▸  PRESS  ANY  DIRECTION  TO  BEGIN  ◂', cx, cy + 44*this.dpr);
      }

      // ── level-up banner (1.6s) ──
      if (this.levelFlashAt) {
        const age = performance.now() - this.levelFlashAt;
        if (age < 1600) {
          const a = age < 200 ? age/200 : age > 1300 ? Math.max(0, 1 - (age-1300)/300) : 1;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = `rgba(167,139,250,${0.9 * a})`;
          ctx.font = `400 ${22*this.dpr}px "Instrument Serif", serif`;
          ctx.fillText(`Level  ${String(this.level).padStart(2,'0')}`, canvas.width/2, 38*this.dpr);
          ctx.fillStyle = `rgba(168,168,179,${0.7 * a})`;
          ctx.font = `${9*this.dpr}px "JetBrains Mono", monospace`;
          ctx.fillText('FASTER  ·  TRICKIER', canvas.width/2, 58*this.dpr);
        }
      }

      // ── game-over summary ──
      if (this.gameOver && this.gameOverSummary) {
        const s = this.gameOverSummary;
        const age = performance.now() - this.gameOverAt;
        const a = Math.min(1, age / 320);
        const cx = canvas.width / 2, cy = canvas.height / 2;
        ctx.fillStyle = `rgba(6,6,8,${0.78 * a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // header
        ctx.fillStyle = `rgba(255,107,53,${a})`;
        ctx.font = `${10*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText('▸  RUN  COMPLETE  ◂', cx, cy - 96*this.dpr);

        ctx.fillStyle = `rgba(232,232,237,${a})`;
        ctx.font = `400 ${34*this.dpr}px "Instrument Serif", serif`;
        ctx.fillText(s.newBest ? 'New personal best' : 'Game over', cx, cy - 64*this.dpr);

        // big stats row
        const colY = cy - 14*this.dpr;
        const colSpacing = 100 * this.dpr;
        const cols = [
          { lbl: 'LEVEL',    val: `L${String(s.level).padStart(2,'0')}` },
          { lbl: 'DISTANCE', val: String(s.score).padStart(3,'0') },
          { lbl: 'TIME',     val: `${s.seconds}s` },
        ];
        cols.forEach((col, i) => {
          const x = cx + (i - 1) * colSpacing;
          ctx.fillStyle = `rgba(168,168,179,${0.7 * a})`;
          ctx.font = `${9*this.dpr}px "JetBrains Mono", monospace`;
          ctx.fillText(col.lbl, x, colY - 18*this.dpr);
          ctx.fillStyle = `rgba(196,181,253,${a})`;
          ctx.font = `400 ${28*this.dpr}px "Instrument Serif", serif`;
          ctx.fillText(col.val, x, colY + 8*this.dpr);
        });

        // bests strip
        ctx.fillStyle = `rgba(168,168,179,${0.65 * a})`;
        ctx.font = `${10*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText(
          `BEST  ·  L${String(s.bestLevel).padStart(2,'0')}   ·   ${String(s.bestScore).padStart(3,'0')}`,
          cx, cy + 38*this.dpr
        );

        // restart prompt with pulse
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(age * 0.004));
        ctx.fillStyle = `rgba(255,107,53,${a * pulse})`;
        ctx.font = `${10*this.dpr}px "JetBrains Mono", monospace`;
        ctx.fillText('PRESS  ANY  DIRECTION  ·  TAP  ·  CLICK   TO  RUN  AGAIN', cx, cy + 78*this.dpr);
      }
    }
    destroy() {
      this.pause();
      window.removeEventListener('keydown', this._down);
      window.removeEventListener('keyup', this._up);
      if (this._screenClick) this.canvas.removeEventListener('click', this._screenClick);
      if (this._tStart) {
        this.canvas.removeEventListener('touchstart', this._tStart);
        this.canvas.removeEventListener('touchmove', this._tMove);
        this.canvas.removeEventListener('touchend', this._tEnd);
        this.canvas.removeEventListener('touchcancel', this._tEnd);
      }
      this.disposeRO();
      this.stage.innerHTML = '';
    }
  }

  /* ═══════════════════════════════════════════
     GAME 06 · CIPHER · hover-to-reveal letter match
  ═══════════════════════════════════════════ */
  class CipherGame {
    constructor(stage, hud) {
      this.stage = stage; this.hud = hud;
      this.meta = { title: 'Cipher' };
      const { canvas, ctx, dpr, dispose } = makeCanvas(stage);
      this.canvas = canvas; this.ctx = ctx; this.dpr = dpr; this.disposeRO = dispose;
      this.running = false;
      this.raf = 0;
      this.mouse = { x: -999, y: -999 };
      this._reset();
      this._bind();
      this._draw();
    }
    _reset() {
      const cols = 14, rows = 9;
      this.cols = cols; this.rows = rows;
      this.target = String.fromCharCode(65 + Math.floor(Math.random()*26));
      this.cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.cells.push({
            r, c,
            ch: String.fromCharCode(65 + Math.floor(Math.random()*26)),
            isTarget: false,
            revealed: 0
          });
        }
      }
      // place 3-5 of the target
      const n = 3 + Math.floor(Math.random()*3);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random()*this.cells.length);
        this.cells[idx].ch = this.target;
        this.cells[idx].isTarget = true;
      }
      this.score = 0;
      this.foundCount = 0;
      this.totalTargets = this.cells.filter(c => c.isTarget).length;
      setHud(this.hud, 'score', '000');
      setHud(this.hud, 'length', String(this.totalTargets).padStart(3, '0'));
    }
    _bind() {
      this._move = (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - r.left) * this.dpr;
        this.mouse.y = (e.clientY - r.top) * this.dpr;
      };
      this._leave = () => { this.mouse.x = -999; this.mouse.y = -999; };
      this._click = () => {
        if (!this.running) return;
        // count targets near cursor as found
        const cw = this.canvas.width / this.cols;
        const ch = this.canvas.height / this.rows;
        for (const cell of this.cells) {
          if (cell.isTarget && !cell.found) {
            const cx = cell.c * cw + cw/2;
            const cy = cell.r * ch + ch/2;
            if (Math.hypot(cx - this.mouse.x, cy - this.mouse.y) < 60*this.dpr) {
              cell.found = true;
              this.foundCount++;
              this.score += 25;
              setHud(this.hud, 'score', String(this.score).padStart(3, '0'));
              setHud(this.hud, 'length', String(this.totalTargets - this.foundCount).padStart(3, '0'));
              if (this.foundCount >= this.totalTargets) setTimeout(() => this._reset(), 600);
            }
          }
        }
      };
      this.canvas.addEventListener('mousemove', this._move);
      this.canvas.addEventListener('mouseleave', this._leave);
      this.canvas.addEventListener('click', this._click);
      // touch: track finger position, tap = click
      this._tmove = (e) => {
        if (!e.touches[0]) return;
        const r = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.touches[0].clientX - r.left) * this.dpr;
        this.mouse.y = (e.touches[0].clientY - r.top) * this.dpr;
        e.preventDefault();
      };
      this._tend = () => {
        if (!this.running) return;
        this._click();
        setTimeout(() => this._leave(), 50);
      };
      this.canvas.addEventListener('touchstart', this._tmove, { passive: false });
      this.canvas.addEventListener('touchmove', this._tmove, { passive: false });
      this.canvas.addEventListener('touchend', this._tend, { passive: true });
    }
    start() {
      if (this.running) return;
      this.running = true;
      const loop = () => {
        if (!this.running) return;
        this._draw();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    pause() { this.running = false; cancelAnimationFrame(this.raf); }
    _draw() {
      const { ctx, canvas } = this;
      ctx.fillStyle = '#060608';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cw = canvas.width / this.cols;
      const ch = canvas.height / this.rows;
      for (const cell of this.cells) {
        const cx = cell.c * cw + cw/2;
        const cy = cell.r * ch + ch/2;
        const d = Math.hypot(cx - this.mouse.x, cy - this.mouse.y);
        const reveal = Math.max(0, 1 - d / (90 * this.dpr));
        const found = cell.found ? 1 : 0;
        if (cell.isTarget && reveal > 0.05) {
          ctx.fillStyle = `rgba(167,139,250,${0.08 + reveal*0.16})`;
          ctx.fillRect(cell.c*cw, cell.r*ch, cw, ch);
        }
        ctx.font = `${12*this.dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (found) {
          ctx.fillStyle = '#ff6b35';
        } else if (cell.isTarget) {
          ctx.fillStyle = `rgba(196,181,253,${0.25 + reveal*0.7})`;
        } else {
          ctx.fillStyle = `rgba(58,58,68,${0.6 + reveal*0.3})`;
        }
        ctx.fillText(cell.ch, cx, cy);
      }
      // target prompt
      ctx.font = `${10*this.dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(168,168,179,0.7)';
      ctx.fillText(`FIND  ▸  ${this.target}`, 12*this.dpr, 18*this.dpr);
    }
    destroy() {
      this.pause();
      this.canvas.removeEventListener('mousemove', this._move);
      this.canvas.removeEventListener('mouseleave', this._leave);
      this.canvas.removeEventListener('click', this._click);
      if (this._tmove) {
        this.canvas.removeEventListener('touchstart', this._tmove);
        this.canvas.removeEventListener('touchmove', this._tmove);
        this.canvas.removeEventListener('touchend', this._tend);
      }
      this.disposeRO();
      this.stage.innerHTML = '';
    }
  }

  /* ═══════════════════════════════════════════
     REGISTRY
  ═══════════════════════════════════════════ */
  const REGISTRY = {
    snake: SnakeGame,
    orbital: OrbitalGame,
    lattice: LatticeGame,
    pulse: PulseGame,
    drift: DriftGame,
    cipher: CipherGame,
    // clutch is a link-out (no playable JS module — handled via data-href)
  };

  /* ═══════════════════════════════════════════
     IDLE PREVIEW — ambient animation in each card
  ═══════════════════════════════════════════ */
  const PreviewPainter = {
    snake(ctx, w, h, t) {
      ctx.fillStyle = '#060608'; ctx.fillRect(0,0,w,h);
      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
      const cell = 18;
      for (let x = 0; x <= w; x += cell) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for (let y = 0; y <= h; y += cell) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      // drifting snake silhouette (sine path)
      const len = 16;
      for (let i = 0; i < len; i++) {
        const px = ((t*0.06 + i*cell) % (w + cell*2)) - cell;
        const py = h*0.5 + Math.sin((t*0.003 + i*0.4)) * h*0.18;
        const a = 1 - i/len*0.6;
        ctx.fillStyle = i === 0 ? '#c4b5fd' : `rgba(167,139,250,${a*0.55})`;
        ctx.fillRect(px, py, cell-3, cell-3);
      }
      // food
      const fx = w*0.78 + Math.sin(t*0.001)*10;
      const fy = h*0.32 + Math.cos(t*0.001)*8;
      ctx.fillStyle = '#ff6b35'; ctx.shadowColor = '#ff6b35'; ctx.shadowBlur = 12;
      ctx.fillRect(fx, fy, cell-4, cell-4);
      ctx.shadowBlur = 0;
    },
    orbital(ctx, w, h, t) {
      ctx.fillStyle = 'rgba(6,6,8,0.22)'; ctx.fillRect(0,0,w,h);
      const cx = w/2, cy = h/2;
      const grad = ctx.createRadialGradient(cx,cy,0, cx,cy, 60);
      grad.addColorStop(0,'rgba(196,181,253,0.7)'); grad.addColorStop(1,'rgba(196,181,253,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill();
      const orbits = [
        {r: 60, s: 0.0014, hue:'#a78bfa', sz: 4},
        {r: 95, s: -0.0009, hue:'#ff6b35', sz: 3},
        {r: 130, s: 0.0006, hue:'#a78bfa', sz: 3.5},
      ];
      for (const o of orbits) {
        ctx.strokeStyle = 'rgba(167,139,250,0.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx,cy,o.r,0,Math.PI*2); ctx.stroke();
        const a = t * o.s;
        const x = cx + Math.cos(a)*o.r, y = cy + Math.sin(a)*o.r;
        ctx.shadowColor = o.hue; ctx.shadowBlur = 12;
        ctx.fillStyle = o.hue; ctx.beginPath(); ctx.arc(x,y,o.sz,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    },
    lattice(ctx, w, h, t) {
      ctx.fillStyle = '#060608'; ctx.fillRect(0,0,w,h);
      // bricks
      const cols = 8, rows = 3;
      const pad = 16, gap = 4;
      const bw = (w - pad*2 - gap*(cols-1))/cols;
      const bh = 11;
      for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
        ctx.fillStyle = r < 1 ? '#a78bfa' : '#ff6b35';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(pad + c*(bw+gap), 18 + r*(bh+gap), bw, bh);
      }
      ctx.globalAlpha = 1;
      // ball bouncing
      const bx = w/2 + Math.sin(t*0.0017)*(w/2 - 30);
      const by = h*0.62 + Math.abs(Math.sin(t*0.003))*30;
      ctx.fillStyle = '#fff'; ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(bx,by,4,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // paddle
      const px = w/2 + Math.sin(t*0.0017)*(w/2 - 60) - 28;
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(px, h - 14, 56, 4);
    },
    pulse(ctx, w, h, t) {
      ctx.fillStyle = 'rgba(6,6,8,0.3)'; ctx.fillRect(0,0,w,h);
      const rings = [
        {x: w*0.28, y: h*0.42, p: 0},
        {x: w*0.62, y: h*0.62, p: 700},
        {x: w*0.82, y: h*0.32, p: 1400},
      ];
      for (const r of rings) {
        const phase = ((t + r.p) % 2200) / 2200;
        const radius = 5 + phase * 32;
        const alpha = 1 - phase;
        ctx.strokeStyle = '#a78bfa'; ctx.globalAlpha = alpha;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, radius, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = '#a78bfa'; ctx.globalAlpha = alpha*0.18;
        ctx.beginPath(); ctx.arc(r.x, r.y, radius*0.55, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    drift(ctx, w, h, t) {
      ctx.fillStyle = '#060608'; ctx.fillRect(0,0,w,h);
      // starfield
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 24; i++) {
        const x = (i*53) % w;
        const y = ((i*97 + t*0.08) % h);
        ctx.fillRect(x, y, 1, 1);
      }
      // asteroids
      for (let i = 0; i < 5; i++) {
        const x = (i*67 + 30) % w;
        const y = ((i*113 + t*0.16) % (h+40)) - 20;
        const r = 4 + (i%3)*2;
        ctx.fillStyle = '#ff6b35'; ctx.shadowColor = '#ff6b35'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      // ship
      const sx = w/2 + Math.sin(t*0.0014) * (w*0.32);
      const sy = h - 18;
      ctx.fillStyle = '#c4b5fd';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx - 7, sy + 6);
      ctx.lineTo(sx + 7, sy + 6);
      ctx.closePath(); ctx.fill();
    },
    cipher(ctx, w, h, t) {
      ctx.fillStyle = '#060608'; ctx.fillRect(0,0,w,h);
      const cols = 14, rows = 6;
      const cw = w/cols, ch = h/rows;
      ctx.font = `11px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // sweeping spotlight
      const spotX = (w*0.2) + (Math.sin(t*0.0009)*0.5+0.5) * (w*0.6);
      const spotY = h*0.5 + Math.cos(t*0.0007)*h*0.2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = c*cw + cw/2, cy = r*ch + ch/2;
          const d = Math.hypot(cx - spotX, cy - spotY);
          const reveal = Math.max(0, 1 - d / 90);
          const isTarget = ((c*7 + r*3) % 11) === 4;
          if (isTarget && reveal > 0.05) {
            ctx.fillStyle = `rgba(167,139,250,${0.06 + reveal*0.18})`;
            ctx.fillRect(c*cw, r*ch, cw, ch);
          }
          const ch2 = String.fromCharCode(65 + ((c*5 + r*7 + Math.floor(t/600)) % 26));
          if (isTarget) ctx.fillStyle = `rgba(196,181,253,${0.3 + reveal*0.6})`;
          else ctx.fillStyle = `rgba(58,58,68,${0.55 + reveal*0.25})`;
          ctx.fillText(ch2, cx, cy);
        }
      }
    },
    clutch(ctx, w, h, t) {
      // Kahoot-style 4-tile lobby preview: shapes pulse in sync with a "buzzer"
      ctx.fillStyle = '#060608'; ctx.fillRect(0,0,w,h);
      // ambient glow
      const cx = w/2, cy = h/2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w,h)*0.6);
      grad.addColorStop(0, 'rgba(167,139,250,0.10)');
      grad.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

      // 2x2 shape tiles
      const pad = Math.min(w, h) * 0.08;
      const gap = 10;
      const tw = (w - pad*2 - gap) / 2;
      const th = (h - pad*2 - gap) / 2;
      const palette = ['#ff6b35', '#a78bfa', '#5dd6c4', '#f5c33b'];
      const shapes = ['tri', 'dia', 'cir', 'sq'];
      const cycle = (t / 1400) % 4;
      for (let i = 0; i < 4; i++) {
        const col = i % 2, row = i < 2 ? 0 : 1;
        const x = pad + col * (tw + gap);
        const y = pad + row * (th + gap);
        const active = Math.floor(cycle) === i;
        const phase = active ? 1 - (cycle % 1) : 0;
        const lift = active ? phase * 6 : 0;
        ctx.save();
        ctx.translate(0, -lift);
        // tile bg
        ctx.fillStyle = palette[i];
        ctx.globalAlpha = active ? 0.95 : 0.62;
        roundRect(ctx, x, y, tw, th, 8);
        ctx.fill();
        // glyph
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(6,6,8,0.85)';
        const gx = x + tw/2, gy = y + th/2;
        const r = Math.min(tw, th) * 0.22;
        if (shapes[i] === 'tri') {
          ctx.beginPath(); ctx.moveTo(gx, gy - r); ctx.lineTo(gx - r, gy + r*0.85); ctx.lineTo(gx + r, gy + r*0.85); ctx.closePath(); ctx.fill();
        } else if (shapes[i] === 'dia') {
          ctx.beginPath(); ctx.moveTo(gx, gy - r); ctx.lineTo(gx + r, gy); ctx.lineTo(gx, gy + r); ctx.lineTo(gx - r, gy); ctx.closePath(); ctx.fill();
        } else if (shapes[i] === 'cir') {
          ctx.beginPath(); ctx.arc(gx, gy, r*0.95, 0, Math.PI*2); ctx.fill();
        } else {
          ctx.fillRect(gx - r*0.85, gy - r*0.85, r*1.7, r*1.7);
        }
        ctx.restore();
      }
    },
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // Run a single shared RAF loop for ALL idle previews (cheap)
  const idlePainters = []; // { id, ctx, w, h }
  let idleRaf = 0;
  function startIdleLoop() {
    if (idleRaf) return;
    const loop = (t) => {
      idleRaf = requestAnimationFrame(loop);
      for (const p of idlePainters) {
        if (p.skip) continue;
        try { PreviewPainter[p.id](p.ctx, p.w, p.h, t); } catch (e) {}
      }
    };
    idleRaf = requestAnimationFrame(loop);
  }

  function attachIdlePreview(card, id) {
    if (!PreviewPainter[id]) return;
    const stage = card.querySelector('.pg-stage-mount');
    if (!stage) return;
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    canvas.style.opacity = '0.85';
    canvas.style.pointerEvents = 'none';
    canvas.dataset.preview = '1';
    card.querySelector('.pg-card-stage').insertBefore(canvas, stage);
    const ctx = canvas.getContext('2d');
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    const entry = { id, ctx, get w(){return canvas.width;}, get h(){return canvas.height;}, canvas, skip: false };
    idlePainters.push(entry);
    return entry;
  }

  /* ═══════════════════════════════════════════
     ARCADE MODE · split-screen with active game on left, rail on right
  ═══════════════════════════════════════════ */
  const Arcade = (() => {
    const root = document.getElementById('pg-arcade');
    const screen = document.getElementById('pg-arcade-screen');
    const nameEl = document.getElementById('arcade-name');
    const numEl = document.getElementById('arcade-num');
    const tagEl = document.getElementById('arcade-tag');
    const railList = document.getElementById('pg-rail-list');
    const railCount = document.getElementById('rail-count');
    const closeBtn = document.getElementById('arcade-close');
    const hudWrap = document.getElementById('arcade-hud');

    let cardsList = [];
    let activeId = null;
    let stashedHome = null; // { card, stageMount, hudClone }
    let switchHandler = null;
    let activateRef = null;
    let hudObserver = null;

    function init({ cards, switchTo, deactivate }) {
      cardsList = Array.from(cards);
      switchHandler = switchTo;
      activateRef = switchTo;
      buildRail();
      closeBtn.addEventListener('click', () => deactivate());
      // ESC to exit
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('is-arcade')) {
          deactivate();
        }
      });
    }

    function buildRail() {
      railList.innerHTML = '';
      cardsList.forEach(card => {
        const id = card.dataset.game;
        const name = card.querySelector('.pg-card-title').textContent.trim();
        const tag = (card.querySelector('.pg-pill')?.textContent || '').trim();
        const isLink = !!card.dataset.href;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'pg-rail-tile' + (isLink ? ' pg-rail-tile--link' : '');
        tile.dataset.gameId = id;
        tile.innerHTML = `
          <div class="pg-rail-tile-thumb">
            <canvas data-rail-thumb="${id}"></canvas>
            <span class="live"></span>
            ${isLink ? '<span class="link-badge" aria-hidden="true">↗</span>' : ''}
          </div>
          <div class="pg-rail-tile-meta">
            <span class="pg-rail-tile-name">${name}</span>
            <span class="pg-rail-tile-tag">${tag}</span>
          </div>
        `;
        tile.addEventListener('click', () => {
          if (isLink) {
            window.open(card.dataset.href, '_blank', 'noopener,noreferrer');
            return;
          }
          if (id !== activeId) switchHandler(id);
        });
        railList.appendChild(tile);
      });
      if (railCount) railCount.textContent = String(cardsList.length).padStart(2, '0');
      // attach idle previews to rail thumbs (independent of card thumbs)
      cardsList.forEach(card => {
        const id = card.dataset.game;
        const canvas = railList.querySelector(`canvas[data-rail-thumb="${id}"]`);
        if (!canvas || !PreviewPainter[id]) return;
        const ctx = canvas.getContext('2d');
        const fit = () => {
          const r = canvas.getBoundingClientRect();
          canvas.width = r.width; canvas.height = r.height;
        };
        fit();
        new ResizeObserver(fit).observe(canvas);
        idlePainters.push({
          id, ctx,
          get w(){return canvas.width;},
          get h(){return canvas.height;},
          canvas, skip: false,
        });
      });
    }

    function show(card, mod) {
      activeId = card.dataset.game;
      // header text
      const title = card.querySelector('.pg-card-title').textContent.trim();
      const num = card.querySelector('.pg-card-head .num')?.textContent.trim() || '';
      const pill = card.querySelector('.pg-pill')?.textContent.trim() || '';
      nameEl.textContent = title;
      numEl.textContent = num;
      tagEl.textContent = pill;

      // transplant the stage-mount (where the game's canvas lives) into the arcade screen
      const stageMount = card.querySelector('.pg-stage-mount');
      stashedHome = { card, stageMount, parent: stageMount.parentNode };
      // preserve the touch overlay
      const touchOverlay = screen.querySelector('.pg-touch');
      screen.innerHTML = '';
      screen.appendChild(stageMount);
      if (touchOverlay) screen.appendChild(touchOverlay);

      // mount mobile touch controls if applicable
      mountTouchControls(activeId, mod);

      // mirror HUD values
      mirrorHud(card);

      // mark rail
      railList.querySelectorAll('.pg-rail-tile').forEach(t => {
        t.classList.toggle('is-active', t.dataset.gameId === activeId);
      });

      // open shell
      document.body.classList.add('is-arcade');
      root.setAttribute('aria-hidden', 'false');

      // give layout a tick before resize event
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }

    function isCoarse() {
      return window.matchMedia('(hover: none) and (pointer: coarse)').matches
        || window.innerWidth < 720;
    }

    function mountTouchControls(id, mod) {
      const overlay = screen.querySelector('.pg-touch');
      if (!overlay) return;
      overlay.innerHTML = '';
      screen.classList.remove('has-touch');
      if (!isCoarse()) return;

      const arrow = (dir) => {
        const r = { up: 'M12 5l-7 7h4v7h6v-7h4z', down: 'M12 19l7-7h-4V5H9v7H5z',
          left: 'M5 12l7-7v4h7v6h-7v4z', right: 'M19 12l-7 7v-4H5V9h7V5z' }[dir];
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${r}"/></svg>`;
      };

      if (id === 'snake') {
        const pad = document.createElement('div');
        pad.className = 'pg-touch-pad';
        pad.innerHTML = `
          <button type="button" class="pg-touch-btn up"    aria-label="Up">${arrow('up')}</button>
          <button type="button" class="pg-touch-btn left"  aria-label="Left">${arrow('left')}</button>
          <button type="button" class="pg-touch-btn down"  aria-label="Down">${arrow('down')}</button>
          <button type="button" class="pg-touch-btn right" aria-label="Right">${arrow('right')}</button>
        `;
        const dirs = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
        pad.querySelectorAll('.pg-touch-btn').forEach(btn => {
          const cls = ['up','down','left','right'].find(c => btn.classList.contains(c));
          const handler = (e) => {
            e.preventDefault();
            if (mod && mod.setDir) mod.setDir(dirs[cls][0], dirs[cls][1]);
          };
          btn.addEventListener('touchstart', handler, { passive: false });
          btn.addEventListener('mousedown', handler);
        });
        overlay.appendChild(pad);
        screen.classList.add('has-touch');
      } else if (id === 'drift') {
        const pad = document.createElement('div');
        pad.className = 'pg-touch-pad lr';
        pad.innerHTML = `
          <button type="button" class="pg-touch-btn left" aria-label="Left">${arrow('left')}</button>
          <button type="button" class="pg-touch-btn right" aria-label="Right">${arrow('right')}</button>
        `;
        const setKey = (k, v) => { if (mod && mod.keys) mod.keys[k] = v; };
        ['left','right'].forEach(side => {
          const btn = pad.querySelector('.pg-touch-btn.' + side);
          const start = (e) => { e.preventDefault(); btn.classList.add('is-down'); setKey(side, true); };
          const end = (e) => { e.preventDefault(); btn.classList.remove('is-down'); setKey(side, false); };
          btn.addEventListener('touchstart', start, { passive: false });
          btn.addEventListener('touchend', end, { passive: false });
          btn.addEventListener('touchcancel', end, { passive: false });
          btn.addEventListener('mousedown', start);
          btn.addEventListener('mouseup', end);
          btn.addEventListener('mouseleave', end);
        });
        overlay.appendChild(pad);
        screen.classList.add('has-touch');
      }
    }

    function switchActive(card, mod) {
      // restore the previous game's stage-mount to its home card first
      if (stashedHome) {
        stashedHome.parent.appendChild(stashedHome.stageMount);
      }
      show(card, mod);
    }

    function mirrorHud(card) {
      if (hudObserver) hudObserver.disconnect();
      const cardHud = card.querySelector('.pg-hud');
      if (!cardHud) return;
      const sync = () => {
        cardHud.querySelectorAll('[data-hud]').forEach(el => {
          const key = el.dataset.hud;
          const target = hudWrap.querySelector(`[data-arcade-hud="${key}"]`);
          if (target) target.textContent = el.textContent;
        });
      };
      sync();
      hudObserver = new MutationObserver(sync);
      hudObserver.observe(cardHud, { childList: true, subtree: true, characterData: true });
    }

    function hide() {
      // restore the stage-mount to its home card
      if (stashedHome) {
        stashedHome.parent.appendChild(stashedHome.stageMount);
        stashedHome = null;
      }
      activeId = null;
      document.body.classList.remove('is-arcade');
      root.setAttribute('aria-hidden', 'true');
      if (hudObserver) { hudObserver.disconnect(); hudObserver = null; }
    }

    return { init, show, switchActive, hide };
  })();

  /* ═══════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════════ */
  function boot() {
    const cards = document.querySelectorAll('.pg-card[data-game]');
    const previewMap = new Map();

    cards.forEach(card => {
      const id = card.dataset.game;

      // attach idle preview FIRST so card is alive even before user clicks
      const preview = attachIdlePreview(card, id);
      if (preview) previewMap.set(card, preview);

      // ── LINK-OUT cards: no game module, just open data-href in new tab ──
      const href = card.dataset.href;
      if (href) {
        const stageEl = card.querySelector('.pg-card-stage');
        const open = (e) => {
          e && e.preventDefault && e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        };
        stageEl.addEventListener('click', open);
        const playBtn = card.querySelector('.pg-play');
        if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); open(e); });
        return; // skip game-module wiring
      }

      const stage = card.querySelector('.pg-stage-mount');
      const hud = card.querySelector('.pg-hud');
      const Cls = REGISTRY[id];
      if (!Cls || !stage) return;

      // lazy: don't construct the full game until user clicks play
      let mod = null;
      const ensureMod = () => {
        if (mod) return mod;
        mod = new Cls(stage, hud);
        Manager.register(id, mod, card, hud);
        return mod;
      };

      const stageEl = card.querySelector('.pg-card-stage');
      const hideIdle = () => { if (preview) { preview.skip = true; preview.canvas.style.display = 'none'; } };
      const showIdle = () => { if (preview) { preview.skip = false; preview.canvas.style.display = ''; } };

      const launch = () => {
        ensureMod();
        const wasActiveBefore = document.body.classList.contains('is-arcade');
        Manager.activate(id);
        if (wasActiveBefore) {
          Arcade.switchActive(card, mod);
        } else {
          Arcade.show(card, mod);
        }
      };

      stageEl.addEventListener('click', (e) => {
        if (card.classList.contains('is-active')) return;
        launch();
      });
      const playBtn = card.querySelector('.pg-play');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          launch();
        });
      }

      // observe class changes to swap idle-preview ↔ live game
      const mo = new MutationObserver(() => {
        if (card.classList.contains('is-active')) hideIdle();
        else showIdle();
        updateActiveCount();
      });
      mo.observe(card, { attributes: true, attributeFilter: ['class'] });
    });

    // wire arcade
    Arcade.init({
      cards,
      switchTo: (id) => {
        const target = Array.from(cards).find(c => c.dataset.game === id);
        if (target) target.querySelector('.pg-play').click();
      },
      deactivate: () => {
        // pause whatever is active and exit
        const a = Manager.active;
        if (a) { try { a.mod.pause && a.mod.pause(); } catch (e) {} }
        document.querySelectorAll('.pg-card.is-active').forEach(c => c.classList.remove('is-active'));
        Manager.updateStatus && Manager.updateStatus();
        Arcade.hide();
        updateActiveCount();
      },
    });

    startIdleLoop();
    Manager.updateStatus();
    updateActiveCount();

    // total count
    const totalEl = document.getElementById('count-total');
    if (totalEl) totalEl.textContent = String(cards.length).padStart(2, '0');

    // clock
    const clockEl = document.getElementById('pg-clock');
    if (clockEl) {
      const tick = () => {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2,'0');
        const mm = String(d.getMinutes()).padStart(2,'0');
        clockEl.textContent = `${hh}:${mm} PT`;
      };
      tick();
      setInterval(tick, 30000);
    }
  }

  function updateActiveCount() {
    const el = document.getElementById('count-active');
    if (!el) return;
    const n = document.querySelectorAll('.pg-card.is-active').length;
    el.textContent = String(n);
    const wrap = el.closest('.num');
    if (wrap) wrap.classList.toggle('live', n > 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
