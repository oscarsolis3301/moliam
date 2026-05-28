// Main app — layout, nav, cursor, konami, tweaks
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ff6b35",
  "theme": "dark",
  "motionLevel": "rich",
  "showCursor": true
}/*EDITMODE-END*/;

const SECTIONS = [
  { id: 'hero', label: 'Home', num: '01' },
  { id: 'about', label: 'About', num: '02' },
  { id: 'work', label: 'Work', num: '03' },
  { id: 'resume', label: 'Resume', num: '04' },
  { id: 'contact', label: 'Contact', num: '05' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [active, setActive] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [cursorPos, setCursorPos] = React.useState({ x: -100, y: -100 });
  const [cursorHover, setCursorHover] = React.useState(false);
  const [konami, setKonami] = React.useState(false);
  const appRef = React.useRef(null);

  // set body class for theme
  React.useEffect(() => {
    document.body.classList.toggle('light', t.theme === 'light');
    document.documentElement.classList.toggle('light', t.theme === 'light');
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--accent-glow', hexToGlow(t.accent));
  }, [t.theme, t.accent]);

  // scroll tracking
  React.useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight);
      setActive(Math.min(SECTIONS.length - 1, Math.max(0, idx)));
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? el.scrollTop / max : 0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // custom cursor
  React.useEffect(() => {
    if (!t.showCursor) return;
    const onMove = (e) => setCursorPos({ x: e.clientX, y: e.clientY });
    const onOver = (e) => {
      const target = e.target;
      const tag = target.tagName;
      const hit = target.closest('button, a, .work-tab, .link-chip, .pkd-item, .chip, .quote, input');
      setCursorHover(!!hit);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
    };
  }, [t.showCursor]);

  // konami
  React.useEffect(() => {
    const SEQ = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let buf = [];
    const onKey = (e) => {
      buf.push(e.key);
      if (buf.length > SEQ.length) buf = buf.slice(-SEQ.length);
      if (buf.length === SEQ.length && buf.every((k, i) => k.toLowerCase() === SEQ[i].toLowerCase())) {
        setKonami(true);
        setTimeout(() => setKonami(false), 3600);
        buf = [];
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navTo = (id) => {
    const el = document.querySelector(`[data-sec="${id}"]`);
    if (el && appRef.current) {
      appRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
    }
  };

  const toggleTheme = () => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark');

  return (
    <>
      {/* progress bar */}
      <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>

      {/* topbar */}
      <header className="topbar">
        <a href="/" className="back-pill" aria-label="Back to moliam.com">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M6.5 1.5L3 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>moliam</span>
        </a>
        <div className="actions">
          <span className="mono tiny dim">NOW · AUTOMATION ENGINEER</span>
          <button className="theme-toggle" onClick={toggleTheme}>
            <span className="sun-moon" />
            <span>{t.theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
          </button>
        </div>
      </header>

      {/* side rail */}
      <nav className="rail">
        {SECTIONS.map((s, i) => (
          <button key={s.id} className={active === i ? 'on' : ''} onClick={() => navTo(s.id)}>
            <span className="num">{s.num}</span>
            <span className="dash" />
            <span>{s.label.toUpperCase()}</span>
          </button>
        ))}
      </nav>

      {/* pages */}
      <main className="app" ref={appRef}>
        <div data-sec="hero"><Hero theme={t.theme} accent={t.accent} onNav={navTo} paused={active !== 0} /></div>
        <div data-sec="about"><About accent={t.accent} /></div>
        <div data-sec="work"><Work accent={t.accent} theme={t.theme} active={active === 2} visited={active >= 2} /></div>
        <div data-sec="resume"><Resume accent={t.accent} /></div>
        <div data-sec="contact"><Contact accent={t.accent} /></div>
      </main>

      {/* cursor */}
      {t.showCursor && (
        <>
          <div className={`cursor ${cursorHover ? 'hover' : ''}`}
               style={{ left: cursorPos.x, top: cursorPos.y }} />
          <div className="cursor-dot" style={{ left: cursorPos.x, top: cursorPos.y }} />
        </>
      )}

      {/* konami */}
      {konami && (
        <div className="konami">
          <div className="konami-card">
            <h3>You found it.</h3>
            <p>↑↑↓↓←→←→BA · KEEP TINKERING</p>
          </div>
        </div>
      )}

      {/* tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.theme}
          options={[{value: 'dark', label: 'Dark'}, {value: 'light', label: 'Light'}]}
          onChange={(v) => setTweak('theme', v)} />
        <TweakColor label="Accent" value={t.accent}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Experience" />
        <TweakRadio label="Motion" value={t.motionLevel}
          options={['subtle', 'moderate', 'rich']}
          onChange={(v) => setTweak('motionLevel', v)} />
        <TweakToggle label="Custom cursor" value={t.showCursor}
          onChange={(v) => setTweak('showCursor', v)} />
      </TweaksPanel>
    </>
  );
}

function hexToGlow(hex) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.25)`;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
