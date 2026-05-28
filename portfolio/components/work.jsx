// Work section — wraps all 4 demos in a tabbed UI with device-frame chrome.
// Demos are mounted lazily (only after Work has been visited) and paused when
// not the active tab or when Work is offscreen, so first-scroll-in is smooth.
function Work({ accent, theme, active, visited }) {
  const demos = [
    { id: 'tank', name: 'Tank Arena', kind: 'Canvas · Game', stack: ['HTML5 Canvas', 'Keyboard Input', 'Game Loop'], frame: 'window', Component: window.TankGame, desc: 'Top-down shooter with keyboard controls. Game-loop driven collision, particle bursts, and difficulty scaling.', cta: 'Launch arena' },
    { id: 'maze', name: 'Maze Generator', kind: 'Algorithmic · Puzzle', stack: ['DFS Backtracking', 'BFS Solver', 'SVG'], frame: 'window', Component: window.MazeGame, desc: 'Procedurally generated mazes with optional BFS solve. Resize, regenerate, race the clock.', cta: 'Generate maze' },
    { id: 'bottle', name: 'Water Bottle · 3D', kind: '3D · Three.js', stack: ['Three.js', 'WebGL', 'Physical Material'], frame: 'window', Component: window.BottleDemo, desc: 'Real-time rendered product shot. Drag to rotate, adjust fill, pause the spin.', cta: 'Render product' },
    { id: 'pokedex', name: 'Pokédex', kind: 'Product · Data', stack: ['React', 'Canvas Sprites', 'Search'], frame: 'browser', Component: window.PokedexDemo, desc: 'Classic concept, reimagined. Live search, type-coded stats, animated entries.', cta: 'Boot pokédex' },
  ];
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [mounted, setMounted] = React.useState(() => new Set());
  const demo = demos[activeIdx];

  // Auto-mount the active demo ~520ms after Work first becomes visible
  // (long enough for the scroll-snap to settle, so the heavy mount work
  // doesn't fight the scroll animation).
  React.useEffect(() => {
    if (!active) return;
    if (mounted.has(activeIdx)) return;
    const t = setTimeout(() => {
      setMounted(prev => {
        if (prev.has(activeIdx)) return prev;
        const next = new Set(prev);
        next.add(activeIdx);
        return next;
      });
    }, 520);
    return () => clearTimeout(t);
  }, [active, activeIdx, mounted]);

  const launch = (i) => {
    setActiveIdx(i);
    setMounted(prev => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  return (
    <section className="snap section work" data-screen-label="03 Work">
      <div className="section-chrome">
        <span className="mono tiny">03 / WORK</span>
        <span className="mono tiny dim">SELECTED PROJECTS</span>
      </div>
      <div className="work-layout">
        <div className="work-side">
          <p className="eyebrow mono">
            <span className="dot sm" style={{background: accent}} />
            INTERACTIVE
          </p>
          <h2 className="h-display">Play with<br/>the work.</h2>
          <p className="lede sm">
            Every project below runs live in this page. No videos, no gifs —
            actual code doing actual things.
          </p>
          <div className="work-tabs">
            {demos.map((d, i) => (
              <button key={d.id}
                className={`work-tab ${activeIdx === i ? 'on' : ''} ${mounted.has(i) ? 'mounted' : ''}`}
                onClick={() => setActiveIdx(i)}
                onMouseEnter={(e) => e.currentTarget.setAttribute('data-hover', '1')}
                onMouseLeave={(e) => e.currentTarget.removeAttribute('data-hover')}>
                <span className="mono tiny dim tab-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="tab-name">{d.name}</span>
                <span className="mono tiny dim">{d.kind}</span>
                <span className="tab-status mono tiny" aria-hidden>
                  {mounted.has(i) ? '● LIVE' : '○ READY'}
                </span>
                <span className="tab-indicator" style={{background: accent}} />
              </button>
            ))}
          </div>
        </div>
        <div className="work-stage">
          <DemoFrame frame={demo.frame} name={demo.name} accent={accent} live={mounted.has(activeIdx)}>
            {demos.map((d, i) => {
              if (!mounted.has(i)) return null;
              const isActive = i === activeIdx;
              return (
                <div key={d.id}
                  className={`demo-slot ${isActive ? 'on' : 'off'}`}
                  aria-hidden={!isActive}>
                  <d.Component accent={accent} theme={theme} paused={!active || !isActive} />
                </div>
              );
            })}
            {!mounted.has(activeIdx) && (
              <ReadyState
                demo={demo}
                accent={accent}
                onLaunch={() => launch(activeIdx)}
                visited={visited} />
            )}
          </DemoFrame>
          <div className="work-meta">
            <div className="meta-stack">
              {demo.stack.map(s => (<span key={s} className="mono chip sm">{s}</span>))}
            </div>
            <p className="mono dim sm">{demo.desc}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Pre-mount placeholder. Shows skeleton + launch CTA. Self-launches after
// Work has been visited, so by the time the user is looking at it the demo
// is already booting smoothly.
function ReadyState({ demo, accent, onLaunch, visited }) {
  const [booting, setBooting] = React.useState(false);
  const handleLaunch = () => {
    setBooting(true);
    // tiny delay so the boot animation is perceptible, then mount
    setTimeout(onLaunch, 220);
  };

  return (
    <div className={`demo-ready ${booting ? 'booting' : ''}`} onClick={handleLaunch}>
      <div className="ready-grid" aria-hidden />
      <div className="ready-scan" aria-hidden style={{background: `linear-gradient(180deg, transparent, ${accent}33, transparent)`}} />
      <div className="ready-inner">
        <div className="ready-meta mono tiny">
          <span className="dim">[ {demo.id.toUpperCase()} ]</span>
          <span style={{color: accent}}>● READY</span>
        </div>
        <div className="ready-title">{demo.name}</div>
        <div className="ready-sub mono">
          <span className="dim">stack:</span> {demo.stack.join(' / ')}
        </div>
        <button className="ready-cta" style={{borderColor: accent, color: accent}}>
          <span className="mono">▶ {demo.cta.toUpperCase()}</span>
        </button>
        <div className="ready-foot mono tiny dim">
          {visited ? 'click anywhere to launch' : 'scroll to enter'}
        </div>
      </div>
    </div>
  );
}

function DemoFrame({ frame, name, accent, children, live }) {
  if (frame === 'browser') {
    return (
      <div className="demo-frame browser">
        <div className="frame-bar">
          <div className="traffic"><i /><i /><i /></div>
          <div className="addr mono">osco.dev/projects/{name.toLowerCase().replace(/[^a-z]/g,'')}</div>
          <div className="frame-actions">
            <span className={`live-dot ${live ? '' : 'idle'}`} style={{background: live ? accent : 'currentColor'}} />
            <span className="mono tiny dim">{live ? 'LIVE' : 'READY'}</span>
          </div>
        </div>
        <div className="frame-body">{children}</div>
      </div>
    );
  }
  // terminal / window
  return (
    <div className="demo-frame terminal">
      <div className="frame-bar">
        <div className="traffic"><i /><i /><i /></div>
        <div className="addr mono">~/projects/{name.toLowerCase().replace(/[^a-z]/g,'')} — zsh</div>
        <div className="frame-actions">
          <span className={`live-dot ${live ? '' : 'idle'}`} style={{background: live ? accent : 'currentColor'}} />
          <span className="mono tiny dim">{live ? 'RUNNING' : 'READY'}</span>
        </div>
      </div>
      <div className="frame-body">{children}</div>
    </div>
  );
}

window.Work = Work;
