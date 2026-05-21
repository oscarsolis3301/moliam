// Full Pokédex — compact 3-pane layout (list · viewer · stats)
const POKEDEX_DATA = window.__POKEDEX_DATA || [];
const spriteUrl = n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${n}.png`;
const tinySpriteUrl = n => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${n}.png`;
const TYPE_COLORS = {
  normal: '#9fa19f',
  fire: '#e62829',
  water: '#2980ef',
  electric: '#fac000',
  grass: '#3fa129',
  ice: '#3dcef3',
  fighting: '#ff8000',
  poison: '#9141cb',
  ground: '#915121',
  flying: '#81b9ef',
  psychic: '#ef4179',
  bug: '#91a119',
  rock: '#afa981',
  ghost: '#704170',
  dragon: '#5060e1',
  dark: '#624d4e',
  steel: '#60a1b8',
  fairy: '#ef70ef'
};
function useStats(id) {
  const [stats, setStats] = React.useState(null);
  React.useEffect(() => {
    const key = 'pkmstats_' + id;
    const cached = sessionStorage.getItem(key);
    if (cached) {
      setStats(JSON.parse(cached));
      return;
    }
    setStats(null);
    let cancelled = false;
    fetch(`https://pokeapi.co/api/v2/pokemon/${id}`).then(r => r.json()).then(d => {
      if (cancelled) return;
      const s = {
        hp: d.stats[0].base_stat,
        atk: d.stats[1].base_stat,
        def: d.stats[2].base_stat,
        satk: d.stats[3].base_stat,
        sdef: d.stats[4].base_stat,
        spd: d.stats[5].base_stat,
        height: d.height,
        weight: d.weight
      };
      try {
        sessionStorage.setItem(key, JSON.stringify(s));
      } catch {}
      setStats(s);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);
  return stats;
}
function PokedexDemo({
  accent,
  theme
}) {
  const [q, setQ] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [selId, setSelId] = React.useState(25);
  const [artLoaded, setArtLoaded] = React.useState(false);
  const filtered = React.useMemo(() => {
    const qq = q.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(qq);
    return POKEDEX_DATA.filter(p => {
      if (typeFilter && !p.t.includes(typeFilter)) return false;
      if (!qq) return true;
      if (isNumeric) return String(p.i) === qq || String(p.i).startsWith(qq);
      return p.n.toLowerCase().includes(qq) || p.t.some(t => t.includes(qq));
    });
  }, [q, typeFilter]);
  const sel = POKEDEX_DATA.find(p => p.i === selId) || POKEDEX_DATA[0];
  const stats = useStats(selId);
  React.useEffect(() => {
    setArtLoaded(false);
  }, [selId]);

  // keyboard nav
  const rootRef = React.useRef(null);
  React.useEffect(() => {
    const onKey = e => {
      if (document.activeElement?.tagName === 'INPUT') return;
      const i = filtered.findIndex(p => p.i === selId);
      if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelId(filtered[Math.min(filtered.length - 1, i + 1)].i);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelId(filtered[Math.max(0, i - 1)].i);
      }
    };
    const el = rootRef.current;
    el?.addEventListener('keydown', onKey);
    return () => el?.removeEventListener('keydown', onKey);
  }, [filtered, selId]);

  // scroll selected into view
  const listRef = React.useRef(null);
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-id="${selId}"]`);
    if (el && listRef.current) {
      const lr = listRef.current.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      if (er.top < lr.top || er.bottom > lr.bottom) el.scrollIntoView({
        block: 'nearest'
      });
    }
  }, [selId]);
  const prev = () => {
    const i = filtered.findIndex(p => p.i === selId);
    if (i > 0) setSelId(filtered[i - 1].i);
  };
  const next = () => {
    const i = filtered.findIndex(p => p.i === selId);
    if (i >= 0 && i < filtered.length - 1) setSelId(filtered[i + 1].i);
  };
  const main = TYPE_COLORS[sel.t[0]] || '#999';
  const sec = TYPE_COLORS[sel.t[1]] || main;
  const allTypes = Object.keys(TYPE_COLORS);
  const STAT_ROWS = stats ? [['HP', stats.hp, 255], ['ATK', stats.atk, 190], ['DEF', stats.def, 230], ['SATK', stats.satk, 194], ['SDEF', stats.sdef, 230], ['SPD', stats.spd, 180]] : [];
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-body pokedex",
    ref: rootRef,
    tabIndex: 0
  }, /*#__PURE__*/React.createElement("div", {
    className: "pkd-col pkd-list-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pkd-search"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 12 12"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "5",
    r: "3.5",
    stroke: "currentColor",
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m7.5 7.5 3 3",
    stroke: "currentColor",
    strokeLinecap: "round"
  })), /*#__PURE__*/React.createElement("input", {
    placeholder: "search name or #",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, filtered.length)), /*#__PURE__*/React.createElement("div", {
    className: "pkd-types-filter"
  }, /*#__PURE__*/React.createElement("button", {
    className: `tf tf-all ${!typeFilter ? 'on' : ''}`,
    onClick: () => setTypeFilter('')
  }, "ALL"), allTypes.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: `tf ${typeFilter === t ? 'on' : ''}`,
    onClick: () => setTypeFilter(typeFilter === t ? '' : t),
    "data-tip": t
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      background: TYPE_COLORS[t]
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "pkd-list",
    ref: listRef
  }, filtered.map(p => /*#__PURE__*/React.createElement(PkdItem, {
    key: p.i,
    p: p,
    sel: sel.i === p.i,
    onClick: () => setSelId(p.i)
  })), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "pkd-empty mono tiny dim"
  }, "no matches"))), /*#__PURE__*/React.createElement("div", {
    className: "pkd-col pkd-view-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pkd-sprite",
    style: {
      background: `radial-gradient(circle at 50% 55%, ${main}33 0%, ${sec}11 55%, transparent 80%)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pkd-orbit-ring",
    style: {
      borderColor: main + '55'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "pkd-orbit-ring pkd-orbit-ring-2",
    style: {
      borderColor: accent + '44'
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "pkd-arrow left",
    onClick: prev,
    "aria-label": "prev"
  }, "\u2039"), /*#__PURE__*/React.createElement("button", {
    className: "pkd-arrow right",
    onClick: next,
    "aria-label": "next"
  }, "\u203A"), /*#__PURE__*/React.createElement("img", {
    key: sel.i,
    src: spriteUrl(sel.i),
    alt: sel.n,
    className: `pkd-img ${artLoaded ? 'in' : ''}`,
    onLoad: () => setArtLoaded(true),
    onError: e => {
      e.currentTarget.style.opacity = 0.3;
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "pkd-num mono"
  }, "#", String(sel.i).padStart(4, '0'))), /*#__PURE__*/React.createElement("div", {
    className: "pkd-name-row"
  }, /*#__PURE__*/React.createElement("h3", null, sel.n), /*#__PURE__*/React.createElement("div", {
    className: "pkd-types"
  }, sel.t.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "type-chip",
    style: {
      background: TYPE_COLORS[t]
    }
  }, t))))), /*#__PURE__*/React.createElement("div", {
    className: "pkd-col pkd-stats-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pkd-stats-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "// BASE STATS")), /*#__PURE__*/React.createElement("div", {
    className: "pkd-stats"
  }, stats ? STAT_ROWS.map(([k, v, max]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "stat-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, k), /*#__PURE__*/React.createElement("div", {
    className: "stat-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: `${v / max * 100}%`,
      background: accent
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "mono num tiny"
  }, String(v).padStart(3, ' ')))) : /*#__PURE__*/React.createElement("div", {
    className: "pkd-loading mono tiny dim"
  }, "fetching\u2026")), /*#__PURE__*/React.createElement("div", {
    className: "pkd-stats-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pkd-meta-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "HT"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, stats ? `${(stats.height / 10).toFixed(1)}m` : '—')), /*#__PURE__*/React.createElement("div", {
    className: "pkd-meta-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "WT"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, stats ? `${(stats.weight / 10).toFixed(1)}kg` : '—')), /*#__PURE__*/React.createElement("div", {
    className: "pkd-meta-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "GEN"), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny"
  }, ['', 'I', 'II', 'III', 'IV', 'V'][sel.g])))));
}
const PkdItem = React.memo(function PkdItem({
  p,
  sel,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    "data-id": p.i,
    className: `pkd-item ${sel ? 'sel' : ''}`,
    onClick: onClick
  }, /*#__PURE__*/React.createElement("img", {
    src: tinySpriteUrl(p.i),
    alt: "",
    className: "pkd-item-img",
    loading: "lazy"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim pkd-item-num"
  }, String(p.i).padStart(3, '0')), /*#__PURE__*/React.createElement("span", {
    className: "pkd-item-name"
  }, p.n), /*#__PURE__*/React.createElement("span", {
    className: "pkd-item-types"
  }, p.t.map(t => /*#__PURE__*/React.createElement("i", {
    key: t,
    style: {
      background: TYPE_COLORS[t]
    }
  }))));
});
window.PokedexDemo = PokedexDemo;