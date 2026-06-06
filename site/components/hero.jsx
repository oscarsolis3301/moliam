// Hero: premium neural-mesh particle field + giant typographic statement
function Hero({ theme, accent, onNav, paused }) {
  const canvasRef = React.useRef(null);
  const mouseRef = React.useRef({ x: -1000, y: -1000, active: false, vx: 0, vy: 0 });
  const pausedRef = React.useRef(paused);
  React.useEffect(() => { pausedRef.current = paused; }, [paused]);

  // typewriter
  const lines = React.useMemo(() => [
    'automation engineer',
    'python · django · flask',
    'ui/ux · ai · servicenow',
    'builder. tinkerer. shipper.',
  ], []);
  const [lineIdx, setLineIdx] = React.useState(0);
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => {
    const target = lines[lineIdx];
    let i = 0, holdTimeout;
    const tick = setInterval(() => {
      i++;
      setTyped(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(tick);
        holdTimeout = setTimeout(() => {
          setLineIdx((p) => (p + 1) % lines.length);
        }, 2200);
      }
    }, 55);
    return () => { clearInterval(tick); clearTimeout(holdTimeout); };
  }, [lineIdx, lines]);

  // premium neural mesh
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf, w, h, dpr;
    let nodes = [];
    let lastMove = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Layer nodes by depth for parallax feel
      const density = Math.floor((w * h) / 7000);
      const N = Math.min(220, density);
      nodes = Array.from({ length: N }, () => {
        const z = Math.random();  // depth 0..1
        return {
          // store base pos + phase for flow-field drift (stable, no jitter)
          bx: Math.random() * w,
          by: Math.random() * h,
          x: 0, y: 0,
          px: 0, py: 0, // offset from base
          vx: 0, vy: 0,
          r: 0.6 + z * 1.8,
          z,                           // 0 far → 1 near
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.006 + Math.random() * 0.008,
          seed: Math.random() * 1000,
        };
      });
      nodes.forEach(n => { n.x = n.bx; n.y = n.by; });
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      const m = mouseRef.current;
      m.vx = nx - m.x;
      m.vy = ny - m.y;
      m.x = nx; m.y = ny;
      // Only mark active when cursor is actually over the hero canvas bounds
      m.active = nx >= 0 && ny >= 0 && nx <= rect.width && ny <= rect.height;
      lastMove = performance.now();
    };
    const onLeave = () => { mouseRef.current.active = false; };
    const onTouch = (e) => {
      if (!e.touches || !e.touches.length) return;
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const nx = t.clientX - rect.left;
      const ny = t.clientY - rect.top;
      const m = mouseRef.current;
      m.vx = nx - m.x;
      m.vy = ny - m.y;
      m.x = nx; m.y = ny;
      m.active = nx >= 0 && ny >= 0 && nx <= rect.width && ny <= rect.height;
      lastMove = performance.now();
    };
    // Listen on window so overlays (hero-inner, vignette, buttons) don't block interaction
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onLeave);

    const fgRGB = theme === 'dark' ? [235, 228, 215] : [22, 24, 27];
    const accRGB = hexToRgb(accent);

    // Flow-field function — smooth curl-like drift
    const flow = (x, y, t) => {
      const s = 0.0018;
      const ang = Math.sin(x * s + t * 0.00018) * 1.7 + Math.cos(y * s * 1.3 - t * 0.00014) * 1.3;
      return { fx: Math.cos(ang), fy: Math.sin(ang) };
    };

    let t0 = performance.now();
    const render = () => {
      if (pausedRef.current) {
        raf = requestAnimationFrame(render);
        return;
      }
      const t = performance.now() - t0;
      ctx.clearRect(0, 0, w, h);

      const m = mouseRef.current;
      const mActive = m.active && performance.now() - lastMove < 2000;

      // Update nodes: base drift from flow field + mouse gravitational sway
      for (const n of nodes) {
        const { fx, fy } = flow(n.bx + n.px, n.by + n.py, t + n.seed * 17);
        // target velocity along flow
        const speed = 0.12 + n.z * 0.22;
        let tvx = fx * speed;
        let tvy = fy * speed;

        // Mouse sway — pulls nearer nodes toward cursor path
        if (mActive) {
          const dx = m.x - (n.bx + n.px);
          const dy = m.y - (n.by + n.py);
          const d2 = dx * dx + dy * dy;
          const reach = 260;
          if (d2 < reach * reach) {
            const d = Math.sqrt(d2) || 1;
            const pull = (1 - d / reach) * (0.4 + n.z * 0.6);
            tvx += (dx / d) * pull * 1.4 + m.vx * 0.02 * (1 - d / reach);
            tvy += (dy / d) * pull * 1.4 + m.vy * 0.02 * (1 - d / reach);
          }
        }

        // Smooth integrate velocity
        n.vx += (tvx - n.vx) * 0.06;
        n.vy += (tvy - n.vy) * 0.06;
        n.px += n.vx;
        n.py += n.vy;

        // gently return to base so they don't drift away
        n.px *= 0.995;
        n.py *= 0.995;

        n.x = n.bx + n.px;
        n.y = n.by + n.py;

        // wrap base position (for endless drift)
        if (n.x < -20) { n.bx += w + 40; n.px = 0; }
        if (n.x > w + 20) { n.bx -= w + 40; n.px = 0; }
        if (n.y < -20) { n.by += h + 40; n.py = 0; }
        if (n.y > h + 20) { n.by -= h + 40; n.py = 0; }

        n.pulse += n.pulseSpeed;
      }

      // Sort by depth for layered rendering (optional subtle effect)
      // Build k-nearest neighbor connections per node — denser, more "mesh" feel
      const MAX_NEIGHBORS = 3;
      const CONNECT_RADIUS = 150;
      ctx.lineWidth = 0.5;

      // For each node, find up to MAX_NEIGHBORS closest within radius and draw
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const near = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < CONNECT_RADIUS * CONNECT_RADIUS) {
            near.push({ j, d2 });
          }
        }
        near.sort((p, q) => p.d2 - q.d2);
        const pick = near.slice(0, MAX_NEIGHBORS);
        for (const { j, d2 } of pick) {
          if (j < i) continue; // draw each edge once
          const b = nodes[j];
          const d = Math.sqrt(d2);
          const alpha = (1 - d / CONNECT_RADIUS) * 0.28 * (0.5 + (a.z + b.z) * 0.25);
          // mouse proximity glow
          let nearMouse = 0;
          if (mActive) {
            const mx = (a.x + b.x) / 2 - m.x;
            const my = (a.y + b.y) / 2 - m.y;
            const md = Math.sqrt(mx * mx + my * my);
            nearMouse = Math.max(0, 1 - md / 280);
          }
          const r = Math.round(fgRGB[0] * (1 - nearMouse) + accRGB[0] * nearMouse);
          const g = Math.round(fgRGB[1] * (1 - nearMouse) + accRGB[1] * nearMouse);
          const bl = Math.round(fgRGB[2] * (1 - nearMouse) + accRGB[2] * nearMouse);
          ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha + nearMouse * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Draw nodes with pulse + mouse halo
      for (const n of nodes) {
        let nearMouse = 0;
        if (mActive) {
          const dx = n.x - m.x, dy = n.y - m.y;
          const md = Math.sqrt(dx * dx + dy * dy);
          nearMouse = Math.max(0, 1 - md / 220);
        }
        const pulseK = 0.85 + Math.sin(n.pulse) * 0.15;
        const r = Math.round(fgRGB[0] * (1 - nearMouse) + accRGB[0] * nearMouse);
        const g = Math.round(fgRGB[1] * (1 - nearMouse) + accRGB[1] * nearMouse);
        const bl = Math.round(fgRGB[2] * (1 - nearMouse) + accRGB[2] * nearMouse);
        const baseA = 0.35 + n.z * 0.4;
        ctx.fillStyle = `rgba(${r},${g},${bl},${baseA * pulseK + nearMouse * 0.4})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * pulseK + nearMouse * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // soft halo for near-mouse nodes
        if (nearMouse > 0.15) {
          const haloAlpha = nearMouse * 0.18;
          ctx.fillStyle = `rgba(${accRGB[0]},${accRGB[1]},${accRGB[2]},${haloAlpha})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 5 + nearMouse * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onLeave);
    };
  }, [theme, accent]);

  return (
    <section className="snap section hero" data-screen-label="01 Hero">
      <canvas ref={canvasRef} className="hero-canvas" />
      <div className="hero-vignette" />
      <div className="hero-inner">
        <div className="hero-meta">
          <span className="dot" style={{background: accent}} />
          <span className="mono">IRVINE, CA · AVAILABLE FOR WORK</span>
        </div>
        <h1 className="hero-name">
          <span className="hero-line">Oscar</span>
          <span className="hero-line italic">Solis.</span>
        </h1>
        <div className="hero-sub">
          <span className="mono dim">&gt;&nbsp;</span>
          <span className="mono">{typed}</span>
          <span className="caret" />
        </div>
        <div className="hero-cta">
          <button className="btn primary" onClick={() => onNav('work')}>
            <span>View work</span>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="btn ghost" onClick={() => onNav('contact')}>
            Get in touch
          </button>
        </div>
      </div>
      <div className="hero-scroll">
        <span className="mono tiny">SCROLL</span>
        <div className="scroll-line"><i /></div>
      </div>
      <div className="hero-corner bl"><span className="mono tiny">[ 01 / 05 ] · PORTFOLIO MMXXVI</span></div>
      <div className="hero-corner br"><span className="mono tiny">v1.0</span></div>
    </section>
  );
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

window.Hero = Hero;
window.hexToRgb = hexToRgb;
