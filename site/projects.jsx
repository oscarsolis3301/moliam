// Moliam · Projects Hub — playable / live project gallery
const PROJECTS = [
  {
    id: 'tank',
    num: '/01',
    title: 'Cannonball Tank',
    desc: 'Physics-driven 2D tank duel. Aim with the mouse, account for wind and gravity, fire away.',
    tags: ['canvas', 'physics', 'game'],
    span: 'span-8 wide',
    status: 'live',
    badge: 'PLAYABLE',
    preview: 'tank',
  },
  {
    id: 'pokedex',
    num: '/02',
    title: 'Neural Pokédex',
    desc: 'All 649 Pokémon, fully searchable. Real artwork, base stats fetched on demand.',
    tags: ['react', 'api', 'data'],
    span: 'span-4',
    status: 'live',
    badge: 'LIVE DATA',
    preview: 'pokedex',
  },
  {
    id: 'maze',
    num: '/03',
    title: 'Maze Generator',
    desc: 'Watch a recursive backtracker carve a maze in real-time. Solve mode highlights the path.',
    tags: ['svg', 'algo'],
    span: 'span-4',
    status: 'live',
    badge: 'INTERACTIVE',
    preview: 'maze',
  },
  {
    id: 'bottle',
    num: '/04',
    title: '3D Liquid Bottle',
    desc: 'Three.js material study. Tilt the bottle, swap liquid color, watch surface tension.',
    tags: ['three.js', 'webgl', '3d'],
    span: 'span-8 wide',
    status: 'live',
    badge: 'WEBGL',
    preview: 'bottle',
  },
  {
    id: 'agent',
    num: '/05',
    title: 'Agent Orchestrator',
    desc: 'Multi-tenant agent runtime. Define tools, route across models, stream output.',
    tags: ['ai', 'infra', 'streaming'],
    span: 'span-6',
    status: 'live',
    badge: 'BETA',
    preview: 'agent',
  },
  {
    id: 'seo',
    num: '/06',
    title: 'SEO Crawler',
    desc: 'Lighthouse-style crawler with content scoring, schema check, and broken-link detection.',
    tags: ['python', 'crawler'],
    span: 'span-6',
    status: 'soon',
    badge: 'SOON',
    preview: 'seo',
  },
];

const TAGS = ['all', 'react', 'canvas', 'webgl', 'ai', 'physics', 'data', 'algo', 'svg', 'python'];

function ProjectsApp() {
  const [filter, setFilter] = React.useState('all');
  const [hoverId, setHoverId] = React.useState(null);

  const visible = filter === 'all' ? PROJECTS : PROJECTS.filter(p => p.tags.includes(filter));

  return (
    <>
      <div className="bg-grid" />
      <div className="bg-vignette" />
      <div className="bg-scan" />
      <ProjTopbar />
      <div className="proj-page">
        <div className="proj-head">
          <div>
            <div className="crumb">
              <a href="/">moliam</a> <span>/</span> <span style={{color:'var(--fg-2)'}}>projects</span>
            </div>
            <h1>The <span style={{color:'var(--accent)'}}>playground.</span></h1>
            <p style={{color:'var(--fg-2)', marginTop: 12, maxWidth: '60ch', fontSize: 13, lineHeight: 1.6}}>
              Every project we ship lives here · live, in-browser, no installs. Click any tile to launch.
            </p>
          </div>
          <div className="meta">
            <div><b>{visible.length}</b> projects</div>
            <div style={{marginTop: 4}}>last deploy · 02:14 UTC</div>
            <div style={{marginTop: 4}}>↑ 99.98% UPTIME</div>
          </div>
        </div>

        <div className="proj-filters">
          {TAGS.map(t => (
            <button key={t} className={`fchip ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="proj-grid">
          {visible.map(p => (
            <ProjectCard key={p.id} p={p} hover={hoverId === p.id}
              onEnter={() => setHoverId(p.id)} onLeave={() => setHoverId(null)} />
          ))}
        </div>
      </div>
    </>
  );
}

function ProjTopbar() {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <a href="/" className="brand">
          <span className="brand-mark">m</span>
          <span>moliam<span style={{color:'var(--accent)'}}>.</span>com</span>
        </a>
        <span style={{color:'var(--fg-4)'}}>/</span>
        <span style={{color:'var(--fg-2)', fontSize: 11}}>projects</span>
      </div>
      <div className="topbar-right">
        <span className="status-dot" />
        <span>OPERATIONAL</span>
        <span style={{color:'var(--fg-4)'}}>·</span>
        <a className="tb-link" href="/">← back to terminal</a>
      </div>
    </div>
  );
}

function ProjectCard({ p, hover, onEnter, onLeave }) {
  return (
    <div className={`proj-card ${p.span}`} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <span className={`status ${p.status === 'live' ? 'live' : ''}`}>
        <i /> {p.badge}
      </span>
      <button className="play-btn" aria-label="play">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 2v8l7-4-7-4z" fill="currentColor"/></svg>
      </button>
      <div className="preview">
        <Preview kind={p.preview} hover={hover} />
      </div>
      <div className="body">
        <div className="row1">
          <span className="ttl">{p.title}</span>
          <span className="num">{p.num}</span>
        </div>
        <div className="desc">{p.desc}</div>
        <div className="tagrow">
          {p.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      </div>
    </div>
  );
}

// -- Preview canvases --------------------------------------------------------
function Preview({ kind, hover }) {
  if (kind === 'tank') return <TankPreview hover={hover} />;
  if (kind === 'pokedex') return <PokedexPreview hover={hover} />;
  if (kind === 'maze') return <MazePreview hover={hover} />;
  if (kind === 'bottle') return <BottlePreview hover={hover} />;
  if (kind === 'agent') return <AgentPreview hover={hover} />;
  if (kind === 'seo') return <SEOPreview hover={hover} />;
  return null;
}

function TankPreview({ hover }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    let raf, t = 0;
    const resize = () => { c.width = c.clientWidth * 2; c.height = c.clientHeight * 2; ctx.scale(2, 2); };
    resize();
    const draw = () => {
      t += 1;
      const w = c.clientWidth, h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // ground
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, h - 20, w, 20);
      // tanks
      ctx.fillStyle = '#FF6B35';
      ctx.fillRect(20, h - 30, 26, 10);
      ctx.fillRect(28, h - 36, 10, 6);
      ctx.fillStyle = '#888';
      ctx.fillRect(w - 46, h - 30, 26, 10);
      ctx.fillRect(w - 38, h - 36, 10, 6);
      // arc
      ctx.strokeStyle = 'rgba(255,107,53,0.5)';
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = 30 + (w - 60) * (i / 40);
        const y = h - 30 - Math.sin((i / 40) * Math.PI) * (h - 60);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
      // ball
      const tt = ((t * (hover ? 1.6 : 0.8)) % 80) / 80;
      const bx = 30 + (w - 60) * tt;
      const by = h - 30 - Math.sin(tt * Math.PI) * (h - 60);
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [hover]);
  return <canvas ref={ref} style={{width:'100%', height:'100%'}} />;
}

function PokedexPreview({ hover }) {
  const ids = [25, 6, 9, 3, 150, 130, 94, 143];
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % ids.length), hover ? 700 : 1500);
    return () => clearInterval(id);
  }, [hover]);
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:'radial-gradient(circle at 50% 55%, rgba(255,107,53,0.08) 0%, transparent 70%)'}}>
      <img
        key={ids[idx]}
        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${ids[idx]}.png`}
        alt=""
        style={{maxHeight:'78%', maxWidth:'70%', filter:'drop-shadow(0 8px 20px rgba(0,0,0,0.5))', animation:'pkdFloat 3s ease-in-out infinite'}}
      />
      <span style={{position:'absolute', bottom:8, right:10, color:'var(--fg-4)', fontSize:10, letterSpacing:'.1em'}}>
        #{String(ids[idx]).padStart(4, '0')} · 649 ENTRIES
      </span>
    </div>
  );
}

function MazePreview({ hover }) {
  const W = 16, H = 10, CELL = 14;
  const [seed, setSeed] = React.useState(0);
  React.useEffect(() => {
    if (!hover) return;
    const id = setInterval(() => setSeed(s => s + 1), 1800);
    return () => clearInterval(id);
  }, [hover]);
  const cells = React.useMemo(() => {
    // simple deterministic pattern based on seed
    const r = (i) => Math.abs(Math.sin(i * 12.9898 + seed * 7.7) * 43758.5453) % 1;
    const arr = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      arr.push({ x, y, n: r(x * 31 + y) > 0.4, e: r(x * 17 + y * 5 + 100) > 0.4 });
    }
    return arr;
  }, [seed]);
  return (
    <svg viewBox={`0 0 ${W * CELL} ${H * CELL}`} preserveAspectRatio="xMidYMid meet" style={{background:'#050505'}}>
      {cells.map((c, i) => (
        <g key={i}>
          {c.n && <line x1={c.x*CELL} y1={c.y*CELL} x2={(c.x+1)*CELL} y2={c.y*CELL} stroke="#FF6B35" strokeWidth="1.2" opacity={0.6} />}
          {c.e && <line x1={(c.x+1)*CELL} y1={c.y*CELL} x2={(c.x+1)*CELL} y2={(c.y+1)*CELL} stroke="#FF6B35" strokeWidth="1.2" opacity={0.6} />}
        </g>
      ))}
      <circle cx={CELL/2} cy={CELL/2} r="3" fill="#fff" />
      <rect x={(W-1)*CELL+CELL/2-3} y={(H-1)*CELL+CELL/2-3} width="6" height="6" fill="#FF6B35" />
    </svg>
  );
}

function BottlePreview({ hover }) {
  return (
    <div style={{position:'relative', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'radial-gradient(circle at 50% 60%, rgba(255,107,53,0.1) 0%, transparent 70%)'}}>
      <svg width="80" height="160" viewBox="0 0 80 160" style={{filter:'drop-shadow(0 10px 24px rgba(0,0,0,0.6))', animation: hover ? 'bottleSpin 6s linear infinite' : 'bottleFloat 4s ease-in-out infinite'}}>
        <defs>
          <linearGradient id="liq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF6B35" stopOpacity=".95" />
            <stop offset="1" stopColor="#a83a14" stopOpacity=".95" />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0.2)" />
            <stop offset=".5" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.18)" />
          </linearGradient>
        </defs>
        <path d="M30 10 h20 v25 q0 5 5 10 q15 12 15 28 v60 q0 15 -15 18 h-30 q-15 -3 -15 -18 v-60 q0 -16 15 -28 q5 -5 5 -10 z" fill="url(#glass)" stroke="rgba(255,255,255,0.25)" strokeWidth=".8" />
        <path d="M22 84 q18 -6 36 0 v50 q0 13 -13 16 h-10 q-13 -3 -13 -16 z" fill="url(#liq)" />
        <ellipse cx="40" cy="84" rx="18" ry="3" fill="#FF6B35" opacity=".7" />
        <rect x="34" y="2" width="12" height="10" fill="#1a1a1a" rx="1" />
      </svg>
      <style>{`
        @keyframes bottleSpin { to { transform: rotateY(360deg); } }
        @keyframes bottleFloat { 0%,100% { transform: translateY(-4px) rotate(-3deg); } 50% { transform: translateY(4px) rotate(3deg); } }
        @keyframes pkdFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
}

function AgentPreview({ hover }) {
  const lines = [
    '> agent.run("summarize")',
    '  ↳ routing → claude-sonnet',
    '  ↳ tool: web.search ✓',
    '  ↳ tool: db.query ✓',
    '  ↳ streaming…',
    '  ✓ done · 1.2s · 412 tok',
  ];
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setN(x => (x + 1) % (lines.length + 2)), hover ? 350 : 700);
    return () => clearInterval(id);
  }, [hover]);
  return (
    <div style={{padding: 16, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.7, background:'#050505', height:'100%', overflow:'hidden'}}>
      {lines.slice(0, Math.min(n, lines.length)).map((l, i) => (
        <div key={i} style={{color: l.startsWith('>') ? '#FF6B35' : l.includes('✓') ? '#6cd28f' : 'var(--fg-2)'}}>{l}</div>
      ))}
      {n < lines.length && <div style={{color:'#FF6B35'}}>▌</div>}
    </div>
  );
}

function SEOPreview({ hover }) {
  return (
    <div style={{padding: 18, height:'100%', background:'#050505', display:'flex', flexDirection:'column', gap: 10, justifyContent:'center'}}>
      {[
        { l: 'PERFORMANCE', v: 94, c: '#6cd28f' },
        { l: 'ACCESSIBILITY', v: 88, c: '#FF6B35' },
        { l: 'SEO',           v: 76, c: '#FF6B35' },
        { l: 'BEST PRACTICES',v: 92, c: '#6cd28f' },
      ].map((m, i) => (
        <div key={i}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize: 9, letterSpacing: '.1em', color: 'var(--fg-3)', marginBottom: 4}}>
            <span>{m.l}</span><span style={{color: m.c}}>{m.v}</span>
          </div>
          <div style={{height: 3, background:'#1a1a1a', borderRadius: 2}}>
            <div style={{height:'100%', width: `${m.v}%`, background: m.c, borderRadius: 2, transition: 'width .8s'}} />
          </div>
        </div>
      ))}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ProjectsApp />);
