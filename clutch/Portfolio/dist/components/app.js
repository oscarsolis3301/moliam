// Main app — layout, nav, cursor, konami, tweaks
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#ff6b35",
  "theme": "dark",
  "motionLevel": "rich",
  "showCursor": true
} /*EDITMODE-END*/;
const SECTIONS = [{
  id: 'hero',
  label: 'Home',
  num: '01'
}, {
  id: 'about',
  label: 'About',
  num: '02'
}, {
  id: 'work',
  label: 'Work',
  num: '03'
}, {
  id: 'resume',
  label: 'Resume',
  num: '04'
}, {
  id: 'contact',
  label: 'Contact',
  num: '05'
}];
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [active, setActive] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [cursorPos, setCursorPos] = React.useState({
    x: -100,
    y: -100
  });
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
    el.addEventListener('scroll', onScroll, {
      passive: true
    });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // custom cursor
  React.useEffect(() => {
    if (!t.showCursor) return;
    const onMove = e => setCursorPos({
      x: e.clientX,
      y: e.clientY
    });
    const onOver = e => {
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
    const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let buf = [];
    const onKey = e => {
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
  const navTo = id => {
    const el = document.querySelector(`[data-sec="${id}"]`);
    if (el && appRef.current) {
      appRef.current.scrollTo({
        top: el.offsetTop,
        behavior: 'smooth'
      });
    }
  };
  const toggleTheme = () => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark');
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "progress"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: `${progress * 100}%`
    }
  })), /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("a", {
    href: "index.html",
    className: "back-pill",
    "aria-label": "Back to moliam.com"
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "",
    width: "16",
    height: "16",
    style: { objectFit: "contain", display: "inline-block", verticalAlign: "middle" }
  }), /*#__PURE__*/React.createElement("span", null, "moliam")), /*#__PURE__*/React.createElement("div", {
    className: "actions"
  }, /*#__PURE__*/React.createElement("a", {
    href: "index.html",
    className: "playground-link",
    "aria-label": "Go to Playground"
  }, /*#__PURE__*/React.createElement("span", {
    className: "playground-link-mark",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span"), /*#__PURE__*/React.createElement("span")), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, "PLAYGROUND"), /*#__PURE__*/React.createElement("svg", {
    width: "10", height: "10", viewBox: "0 0 10 10", "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 5h6M5.5 2.5L8 5l-2.5 2.5",
    stroke: "currentColor", strokeWidth: "1.4", fill: "none",
    strokeLinecap: "round", strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle",
    onClick: toggleTheme
  }, /*#__PURE__*/React.createElement("span", {
    className: "sun-moon"
  }), /*#__PURE__*/React.createElement("span", null, t.theme === 'dark' ? 'DARK' : 'LIGHT')))), /*#__PURE__*/React.createElement("nav", {
    className: "rail"
  }, SECTIONS.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    className: active === i ? 'on' : '',
    onClick: () => navTo(s.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, s.num), /*#__PURE__*/React.createElement("span", {
    className: "dash"
  }), /*#__PURE__*/React.createElement("span", null, s.label.toUpperCase())))), /*#__PURE__*/React.createElement("main", {
    className: "app",
    ref: appRef
  }, /*#__PURE__*/React.createElement("div", {
    "data-sec": "hero"
  }, /*#__PURE__*/React.createElement(Hero, {
    theme: t.theme,
    accent: t.accent,
    onNav: navTo,
    paused: active !== 0
  })), /*#__PURE__*/React.createElement("div", {
    "data-sec": "about"
  }, /*#__PURE__*/React.createElement(About, {
    accent: t.accent
  })), /*#__PURE__*/React.createElement("div", {
    "data-sec": "work"
  }, /*#__PURE__*/React.createElement(Work, {
    accent: t.accent,
    theme: t.theme,
    active: active === 2,
    visited: active >= 2
  })), /*#__PURE__*/React.createElement("div", {
    "data-sec": "resume"
  }, /*#__PURE__*/React.createElement(Resume, {
    accent: t.accent
  })), /*#__PURE__*/React.createElement("div", {
    "data-sec": "contact"
  }, /*#__PURE__*/React.createElement(Contact, {
    accent: t.accent
  }))), t.showCursor && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: `cursor ${cursorHover ? 'hover' : ''}`,
    style: {
      left: cursorPos.x,
      top: cursorPos.y
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "cursor-dot",
    style: {
      left: cursorPos.x,
      top: cursorPos.y
    }
  })), konami && /*#__PURE__*/React.createElement("div", {
    className: "konami"
  }, /*#__PURE__*/React.createElement("div", {
    className: "konami-card"
  }, /*#__PURE__*/React.createElement("h3", null, "You found it."), /*#__PURE__*/React.createElement("p", null, "\u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192BA \xB7 KEEP TINKERING"))), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "Tweaks"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    label: "Theme"
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Mode",
    value: t.theme,
    options: [{
      value: 'dark',
      label: 'Dark'
    }, {
      value: 'light',
      label: 'Light'
    }],
    onChange: v => setTweak('theme', v)
  }), /*#__PURE__*/React.createElement(TweakColor, {
    label: "Accent",
    value: t.accent,
    onChange: v => setTweak('accent', v)
  }), /*#__PURE__*/React.createElement(TweakSection, {
    label: "Experience"
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Motion",
    value: t.motionLevel,
    options: ['subtle', 'moderate', 'rich'],
    onChange: v => setTweak('motionLevel', v)
  }), /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Custom cursor",
    value: t.showCursor,
    onChange: v => setTweak('showCursor', v)
  })));
}
function hexToGlow(hex) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.25)`;
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));