// Tank Game — WASD controls
// W/S rotate cannon, A/D move tank left/right. Space fires.
function TankGame({
  accent,
  theme,
  paused
}) {
  const canvasRef = React.useRef(null);
  const [running, setRunning] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const pausedRef = React.useRef(paused);
  React.useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const [hp, setHp] = React.useState(3);
  const stateRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 560,
      H = 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const state = {
      tank: {
        x: W / 2,
        y: H - 30,
        w: 36,
        h: 18,
        angle: -Math.PI / 2,
        speed: 0
      },
      bullets: [],
      enemies: [],
      particles: [],
      keys: {},
      lastSpawn: 0,
      lastShoot: 0,
      score: 0,
      hp: 3,
      over: false,
      t: 0
    };
    stateRef.current = state;
    const onKey = down => e => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', ' '].includes(e.key)) e.preventDefault();
      state.keys[e.key.toLowerCase()] = down;
    };
    const kd = onKey(true),
      ku = onKey(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const fg = theme === 'dark' ? '#ebe4d7' : '#16181b';
    const bg = theme === 'dark' ? '#0f0d0a' : '#fbfbfd';
    const grid = theme === 'dark' ? 'rgba(235,228,215,0.06)' : 'rgba(22,24,27,0.06)';
    let raf;
    const loop = () => {
      if (pausedRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      state.t++;
      // move tank
      if (state.keys['a']) state.tank.x -= 2.4;
      if (state.keys['d']) state.tank.x += 2.4;
      state.tank.x = Math.max(30, Math.min(W - 30, state.tank.x));
      // aim
      if (state.keys['w']) state.tank.angle -= 0.04;
      if (state.keys['s']) state.tank.angle += 0.04;
      state.tank.angle = Math.max(-Math.PI + 0.2, Math.min(-0.2, state.tank.angle));
      // shoot
      if (state.keys[' '] && state.t - state.lastShoot > 18 && !state.over) {
        state.lastShoot = state.t;
        const a = state.tank.angle;
        state.bullets.push({
          x: state.tank.x + Math.cos(a) * 22,
          y: state.tank.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 6.5,
          vy: Math.sin(a) * 6.5,
          life: 120
        });
      }
      // spawn enemies
      if (state.t - state.lastSpawn > Math.max(45, 110 - state.score * 3) && !state.over) {
        state.lastSpawn = state.t;
        state.enemies.push({
          x: Math.random() * (W - 60) + 30,
          y: -20,
          vy: 0.6 + Math.random() * 0.8 + state.score * 0.04,
          r: 10 + Math.random() * 6
        });
      }
      // update bullets
      state.bullets = state.bullets.filter(b => {
        b.x += b.vx;
        b.y += b.vy;
        b.life--;
        return b.life > 0 && b.x > 0 && b.x < W && b.y > 0;
      });
      // update enemies + collide
      state.enemies = state.enemies.filter(en => {
        en.y += en.vy;
        if (en.y > H + 20) return false;
        // hit tank?
        const dxT = en.x - state.tank.x,
          dyT = en.y - state.tank.y;
        if (Math.sqrt(dxT * dxT + dyT * dyT) < en.r + 18 && !state.over) {
          state.hp--;
          setHp(state.hp);
          burst(state, en.x, en.y, accent);
          if (state.hp <= 0) state.over = true;
          return false;
        }
        // hit by bullet?
        for (let i = 0; i < state.bullets.length; i++) {
          const b = state.bullets[i];
          const dx = b.x - en.x,
            dy = b.y - en.y;
          if (dx * dx + dy * dy < en.r * en.r) {
            state.bullets.splice(i, 1);
            state.score++;
            setScore(state.score);
            burst(state, en.x, en.y, accent);
            return false;
          }
        }
        return true;
      });
      // particles
      state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life--;
        return p.life > 0;
      });

      // draw
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // ground
      ctx.fillStyle = theme === 'dark' ? 'rgba(235,228,215,0.06)' : 'rgba(26,24,20,0.08)';
      ctx.fillRect(0, H - 12, W, 12);

      // enemies
      for (const en of state.enemies) {
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(en.x, en.y, en.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(en.x, en.y, en.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // bullets
      for (const b of state.bullets) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // particles
      for (const p of state.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.fillRect(p.x, p.y, 2, 2);
        ctx.globalAlpha = 1;
      }
      // tank
      const t = state.tank;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = fg;
      // treads
      ctx.fillRect(-t.w / 2, -t.h / 2 + 4, t.w, t.h);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = bg;
        ctx.fillRect(-t.w / 2 + 2 + i * 7, -t.h / 2 + 6, 4, t.h - 4);
      }
      // body
      ctx.fillStyle = fg;
      ctx.fillRect(-t.w / 2 + 4, -t.h / 2, t.w - 8, t.h - 2);
      // turret
      ctx.beginPath();
      ctx.arc(0, -t.h / 2 + 2, 7, 0, Math.PI * 2);
      ctx.fill();
      // cannon
      ctx.save();
      ctx.rotate(t.angle + Math.PI / 2);
      ctx.fillStyle = accent;
      ctx.fillRect(-2, -20, 4, 20);
      ctx.restore();
      ctx.restore();

      // hud overlays
      if (state.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = accent;
        ctx.font = '700 22px "Instrument Serif", serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 4);
        ctx.fillStyle = '#ebe4d7';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText('score ' + state.score + '  ·  press R to restart', W / 2, H / 2 + 16);
      }
      if (!running && !state.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ebe4d7';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK TO FOCUS · A/D MOVE · W/S AIM · SPACE FIRE', W / 2, H / 2);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    // restart
    const onRestart = e => {
      if (e.key === 'r' || e.key === 'R') {
        if (state.over) {
          state.over = false;
          state.score = 0;
          state.hp = 3;
          state.enemies = [];
          state.bullets = [];
          state.particles = [];
          setScore(0);
          setHp(3);
        }
      }
    };
    window.addEventListener('keydown', onRestart);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('keydown', onRestart);
    };
  }, [accent, theme, running]);
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-body tank",
    tabIndex: 0,
    onFocus: () => setRunning(true)
  }, /*#__PURE__*/React.createElement("div", {
    className: "demo-hud"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "SCORE"), /*#__PURE__*/React.createElement("span", {
    className: "mono num"
  }, String(score).padStart(3, '0'))), /*#__PURE__*/React.createElement("div", {
    className: "hud-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "HP"), /*#__PURE__*/React.createElement("span", {
    className: "hp"
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("i", {
    key: i,
    className: i < hp ? 'on' : 'off',
    style: {
      background: i < hp ? accent : undefined
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "hud-group right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "A/D \xB7 MOVE"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "W/S \xB7 AIM"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "SPACE \xB7 FIRE"))), /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    style: {
      width: 560,
      height: 320,
      maxWidth: '100%'
    },
    onClick: e => e.currentTarget.parentElement.focus()
  }));
}
function burst(state, x, y, color) {
  for (let i = 0; i < 14; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 22 + Math.random() * 10,
      color
    });
  }
}
window.TankGame = TankGame;