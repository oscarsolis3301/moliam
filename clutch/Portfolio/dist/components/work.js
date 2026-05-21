// Work section — wraps all 4 demos in a tabbed UI with device-frame chrome.
// Demos are mounted lazily (only after Work has been visited) and paused when
// not the active tab or when Work is offscreen, so first-scroll-in is smooth.
function Work({
  accent,
  theme,
  active,
  visited
}) {
  const demos = [{
    id: 'tank',
    name: 'Tank Arena',
    kind: 'Canvas · Game',
    stack: ['HTML5 Canvas', 'Keyboard Input', 'Game Loop'],
    frame: 'window',
    Component: window.TankGame,
    desc: 'Top-down shooter with keyboard controls. Game-loop driven collision, particle bursts, and difficulty scaling.',
    cta: 'Launch arena'
  }, {
    id: 'maze',
    name: 'Maze Generator',
    kind: 'Algorithmic · Puzzle',
    stack: ['DFS Backtracking', 'BFS Solver', 'SVG'],
    frame: 'window',
    Component: window.MazeGame,
    desc: 'Procedurally generated mazes with optional BFS solve. Resize, regenerate, race the clock.',
    cta: 'Generate maze'
  }, {
    id: 'bottle',
    name: 'Water Bottle · 3D',
    kind: '3D · Three.js',
    stack: ['Three.js', 'WebGL', 'Physical Material'],
    frame: 'window',
    Component: window.BottleDemo,
    desc: 'Real-time rendered product shot. Drag to rotate, adjust fill, pause the spin.',
    cta: 'Render product'
  }, {
    id: 'pokedex',
    name: 'Pokédex',
    kind: 'Product · Data',
    stack: ['React', 'Canvas Sprites', 'Search'],
    frame: 'browser',
    Component: window.PokedexDemo,
    desc: 'Classic concept, reimagined. Live search, type-coded stats, animated entries.',
    cta: 'Boot pokédex'
  }];
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [mounted, setMounted] = React.useState(() => new Set());
  const demo = demos[activeIdx];

  // Warm up Three.js as soon as Work mounts, so the bottle demo is ready
  // by the time the user navigates to it.
  React.useEffect(() => {
    if (typeof window.__loadThree === 'function') window.__loadThree();
  }, []);

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
  const launch = i => {
    setActiveIdx(i);
    setMounted(prev => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };
  return /*#__PURE__*/React.createElement("section", {
    className: "snap section work",
    "data-screen-label": "03 Work"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-chrome"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, "03 / WORK"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "SELECTED PROJECTS")), /*#__PURE__*/React.createElement("div", {
    className: "work-layout"
  }, /*#__PURE__*/React.createElement("div", {
    className: "work-side"
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot sm",
    style: {
      background: accent
    }
  }), "INTERACTIVE"), /*#__PURE__*/React.createElement("h2", {
    className: "h-display"
  }, "Play with", /*#__PURE__*/React.createElement("br", null), "the work."), /*#__PURE__*/React.createElement("p", {
    className: "lede sm"
  }, "Every project below runs live in this page. No videos, no gifs \u2014 actual code doing actual things."), /*#__PURE__*/React.createElement("div", {
    className: "work-tabs"
  }, demos.map((d, i) => /*#__PURE__*/React.createElement("button", {
    key: d.id,
    className: `work-tab ${activeIdx === i ? 'on' : ''} ${mounted.has(i) ? 'mounted' : ''}`,
    onClick: () => setActiveIdx(i),
    onMouseEnter: e => e.currentTarget.setAttribute('data-hover', '1'),
    onMouseLeave: e => e.currentTarget.removeAttribute('data-hover')
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim tab-num"
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
    className: "tab-name"
  }, d.name), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, d.kind), /*#__PURE__*/React.createElement("span", {
    className: "tab-status mono tiny",
    "aria-hidden": true
  }, mounted.has(i) ? '● LIVE' : '○ READY'), /*#__PURE__*/React.createElement("span", {
    className: "tab-indicator",
    style: {
      background: accent
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "work-stage"
  }, /*#__PURE__*/React.createElement(DemoFrame, {
    frame: demo.frame,
    name: demo.name,
    accent: accent,
    live: mounted.has(activeIdx)
  }, demos.map((d, i) => {
    if (!mounted.has(i)) return null;
    const isActive = i === activeIdx;
    return /*#__PURE__*/React.createElement("div", {
      key: d.id,
      className: `demo-slot ${isActive ? 'on' : 'off'}`,
      "aria-hidden": !isActive
    }, /*#__PURE__*/React.createElement(d.Component, {
      accent: accent,
      theme: theme,
      paused: !active || !isActive
    }));
  }), !mounted.has(activeIdx) && /*#__PURE__*/React.createElement(ReadyState, {
    demo: demo,
    accent: accent,
    onLaunch: () => launch(activeIdx),
    visited: visited
  })), /*#__PURE__*/React.createElement("div", {
    className: "work-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "meta-stack"
  }, demo.stack.map(s => /*#__PURE__*/React.createElement("span", {
    key: s,
    className: "mono chip sm"
  }, s))), /*#__PURE__*/React.createElement("p", {
    className: "mono dim sm"
  }, demo.desc)))));
}

// Pre-mount placeholder. Shows skeleton + launch CTA. Self-launches after
// Work has been visited, so by the time the user is looking at it the demo
// is already booting smoothly.
function ReadyState({
  demo,
  accent,
  onLaunch,
  visited
}) {
  const [booting, setBooting] = React.useState(false);
  const handleLaunch = () => {
    setBooting(true);
    // tiny delay so the boot animation is perceptible, then mount
    setTimeout(onLaunch, 220);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `demo-ready ${booting ? 'booting' : ''}`,
    onClick: handleLaunch
  }, /*#__PURE__*/React.createElement("div", {
    className: "ready-grid",
    "aria-hidden": true
  }), /*#__PURE__*/React.createElement("div", {
    className: "ready-scan",
    "aria-hidden": true,
    style: {
      background: `linear-gradient(180deg, transparent, ${accent}33, transparent)`
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "ready-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ready-meta mono tiny"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "[ ", demo.id.toUpperCase(), " ]"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent
    }
  }, "\u25CF READY")), /*#__PURE__*/React.createElement("div", {
    className: "ready-title"
  }, demo.name), /*#__PURE__*/React.createElement("div", {
    className: "ready-sub mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "stack:"), " ", demo.stack.join(' / ')), /*#__PURE__*/React.createElement("button", {
    className: "ready-cta",
    style: {
      borderColor: accent,
      color: accent
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, "\u25B6 ", demo.cta.toUpperCase())), /*#__PURE__*/React.createElement("div", {
    className: "ready-foot mono tiny dim"
  }, visited ? 'click anywhere to launch' : 'scroll to enter')));
}
function DemoFrame({
  frame,
  name,
  accent,
  children,
  live
}) {
  if (frame === 'browser') {
    return /*#__PURE__*/React.createElement("div", {
      className: "demo-frame browser"
    }, /*#__PURE__*/React.createElement("div", {
      className: "frame-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "traffic"
    }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/React.createElement("div", {
      className: "addr mono"
    }, "osco.dev/projects/", name.toLowerCase().replace(/[^a-z]/g, '')), /*#__PURE__*/React.createElement("div", {
      className: "frame-actions"
    }, /*#__PURE__*/React.createElement("span", {
      className: `live-dot ${live ? '' : 'idle'}`,
      style: {
        background: live ? accent : 'currentColor'
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "mono tiny dim"
    }, live ? 'LIVE' : 'READY'))), /*#__PURE__*/React.createElement("div", {
      className: "frame-body"
    }, children));
  }
  // terminal / window
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-frame terminal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "frame-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "traffic"
  }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/React.createElement("div", {
    className: "addr mono"
  }, "~/projects/", name.toLowerCase().replace(/[^a-z]/g, ''), " \u2014 zsh"), /*#__PURE__*/React.createElement("div", {
    className: "frame-actions"
  }, /*#__PURE__*/React.createElement("span", {
    className: `live-dot ${live ? '' : 'idle'}`,
    style: {
      background: live ? accent : 'currentColor'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, live ? 'RUNNING' : 'READY'))), /*#__PURE__*/React.createElement("div", {
    className: "frame-body"
  }, children));
}
window.Work = Work;