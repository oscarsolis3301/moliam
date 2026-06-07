/* ────────────────────────────────────────────────────────────
 * services.js — rotator · agent live · pricing toggle · reveal
 *                client-side PDF capabilities brief
 * Vanilla. No deps.
 * ──────────────────────────────────────────────────────────── */

(() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // 1) HERO TYPING ROTATOR — locked-width, no row jumps
  // ═══════════════════════════════════════════════════════════
  const PHRASES = [
    'proactive agents.',
    'a desktop companion.',
    'AI that follows you.',
    'always on, always local.',
    'capture · record · repair.',
  ];

  function startRotator() {
    const wrap = document.querySelector('.rotator-wrap[data-rotator]');
    const el = document.getElementById('hero-rotator');
    const ghost = wrap ? wrap.querySelector('.rotator-ghost') : null;
    if (!el || !ghost) return;

    // 1) lock width to the longest phrase by character count → ghost reserves slot
    const longest = PHRASES.reduce((a, b) => (b.length > a.length ? b : a), '');
    ghost.textContent = longest;

    // 2) typing loop
    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;
    const TYPE_MS = 62;
    const DELETE_MS = 30;
    const HOLD_MS = 1700;

    function tick() {
      const phrase = PHRASES[phraseIdx];
      if (!deleting) {
        charIdx++;
        el.textContent = phrase.slice(0, charIdx);
        if (charIdx === phrase.length) {
          deleting = true;
          setTimeout(tick, HOLD_MS);
          return;
        }
        setTimeout(tick, TYPE_MS);
      } else {
        charIdx--;
        el.textContent = phrase.slice(0, charIdx);
        if (charIdx === 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % PHRASES.length;
          setTimeout(tick, 260);
          return;
        }
        setTimeout(tick, DELETE_MS);
      }
    }
    el.textContent = '';
    setTimeout(tick, 500);
  }

  // ═══════════════════════════════════════════════════════════
  // 2) MOLIAM AGENT LIVE STREAM (Hermes runtime, OpenClaw tools)
  // ═══════════════════════════════════════════════════════════
  // Bridge: the vault graph (section 2b) registers a callback here so each
  // console run "creates files" → spawns a node cluster in the graph.
  let onAgentRun = null;

  const AGENT_RUNS = [
    {
      user: 'screenshot · area · annotate',
      steps: [
        { d: 600,  type: 'dim',  text: '  ↳ picker → 1840×986 region selected' },
        { d: 550,  type: 'dim',  text: '  ↳ capture · screen 1 · 248ms' },
        { d: 650,  type: 'dim',  text: '  ↳ annotator open · arrow · text · blur' },
        { d: 500,  type: 'ok',   text: '  ✓ saved · clipboard + lumi.inbox' },
      ]
    },
    {
      user: 'proactive: post-resume sweep',
      steps: [
        { d: 600,  type: 'dim',  text: '  ↳ resume detected · 03:14 local' },
        { d: 800,  type: 'dim',  text: '  ↳ memory pressure 78% · trim working sets' },
        { d: 700,  type: 'dim',  text: '  ↳ hygiene targets · 1.2 GB freed' },
        { d: 500,  type: 'ok',   text: '  ✓ done · 2 hangs prevented · plan: balanced' },
      ]
    },
    {
      user: 'record · screen + mic + cam',
      steps: [
        { d: 600,  type: 'dim',  text: '  ↳ floating bar shown · countdown 3s' },
        { d: 850,  type: 'dim',  text: '  ↳ recording · screen 0 · 60fps · h264' },
        { d: 700,  type: 'dim',  text: '  ↳ stop pill · 42.3s · 18 MB · webcam pip' },
        { d: 500,  type: 'ok',   text: '  ✓ opened in editor · trim · export ready' },
      ]
    },
    {
      user: 'drop · quarterly-deck.pptx',
      steps: [
        { d: 550,  type: 'dim',  text: '  ↳ drop-catcher · file received' },
        { d: 800,  type: 'dim',  text: '  ↳ markitdown · 24 slides → markdown' },
        { d: 700,  type: 'dim',  text: '  ↳ openclaw: file router · indexed' },
        { d: 500,  type: 'ok',   text: '  ✓ ready in chat · 1.6s · 12.4k tokens' },
      ]
    },
    {
      user: 'repair · audio.dll not loaded',
      steps: [
        { d: 600,  type: 'dim',  text: '  ↳ resolver · symptom match · 92%' },
        { d: 750,  type: 'dim',  text: '  ↳ runbook · powershell · audit + restart' },
        { d: 700,  type: 'dim',  text: '  ↳ self-learn · pattern stored' },
        { d: 500,  type: 'ok',   text: '  ✓ resolved · 3.1s · no reboot' },
      ]
    },
    {
      user: 'meeting detected · transcribe',
      steps: [
        { d: 550,  type: 'dim',  text: '  ↳ audio session · zoom.exe · capturing' },
        { d: 850,  type: 'dim',  text: '  ↳ streaming transcript · 2 speakers' },
        { d: 700,  type: 'dim',  text: '  ↳ action items extracted · 4 flagged' },
        { d: 500,  type: 'ok',   text: '  ✓ saved · summary + raw transcript' },
      ]
    },
  ];

  const REGIONS = ['local · m3 max', 'local · win11 · i7', 'tray · idle', 'on-prem · vpc-a'];

  function startAgent() {
    const stream = document.getElementById('agent-stream');
    const tasksEl = document.getElementById('ag-tasks');
    const latEl = document.getElementById('ag-lat');
    const statusEl = document.getElementById('ag-status');
    const regionEl = document.getElementById('ag-region');
    if (!stream) return;

    let runIdx = 0;
    let tasks = 1284;
    const MAX_LINES = 14;

    function addLine(html) {
      const node = document.createElement('div');
      node.className = 'agent-line';
      node.innerHTML = html;
      stream.appendChild(node);
      while (stream.children.length > MAX_LINES) {
        stream.removeChild(stream.firstChild);
      }
    }

    function addLineNoAnim(html) {
      const node = document.createElement('div');
      node.className = 'agent-line agent-line-static';
      node.innerHTML = html;
      stream.appendChild(node);
    }

    // Seed the stream so the panel is never empty / never has dead space.
    // These appear instantly (no fade-in) so the user lands on a "warm" runtime.
    function seed() {
      const seedLines = [
        ['prompt', `<span class="ag-prompt">$</span><span class="ag-user">moliam.agent</span> <span class="ag-arg">"screenshot · area · annotate"</span>`],
        ['dim',    '  ↳ picker → 1840×986 region selected'],
        ['dim',    '  ↳ capture · screen 1 · 248ms'],
        ['dim',    '  ↳ annotator open · arrow · text · blur'],
        ['ok',     '  ✓ saved · clipboard + lumi.inbox'],
        ['prompt', `<span class="ag-prompt">$</span><span class="ag-user">moliam.agent</span> <span class="ag-arg">"drop · quarterly-deck.pptx"</span>`],
        ['dim',    '  ↳ drop-catcher · file received'],
        ['dim',    '  ↳ markitdown · 24 slides → markdown'],
        ['ok',     '  ✓ ready in chat · 1.6s · 12.4k tokens'],
      ];
      for (const [t, txt] of seedLines) {
        if (t === 'prompt') addLineNoAnim(txt);
        else addLineNoAnim(`<span class="ag-${t === 'ok' ? 'ok' : 'dim'}">${escapeHtml(txt)}</span>`);
      }
    }
    seed();

    function setStatus(text) { if (statusEl) statusEl.textContent = text; }

    async function runOnce() {
      const run = AGENT_RUNS[runIdx % AGENT_RUNS.length];
      runIdx++;

      // region tick
      if (regionEl) regionEl.textContent = REGIONS[Math.floor(Math.random() * REGIONS.length)];

      setStatus('LIVE · streaming');
      addLine(`<span class="ag-prompt">$</span><span class="ag-user">moliam.agent</span> <span class="ag-arg">"${run.user}"</span>`);
      if (onAgentRun) onAgentRun(run.user); // grow the vault graph in sync
      await wait(350);

      for (const s of run.steps) {
        addLine(`<span class="ag-${s.type === 'ok' ? 'ok' : 'dim'}">${escapeHtml(s.text)}</span>`);
        // captures number tick — small organic jitter
        if (latEl && Math.random() < 0.45) {
          const cur = parseInt(latEl.textContent.replace(/[^0-9]/g, ''), 10) || 142;
          latEl.textContent = (cur + 1).toString();
        }
        await wait(s.d);
      }

      tasks += 1;
      if (tasksEl) tasksEl.textContent = tasks.toLocaleString();

      setStatus('IDLE · 2s');
      await wait(2000);
    }

    async function loop() {
      while (true) {
        try { await runOnce(); }
        catch (e) { await wait(2000); }
      }
    }

    loop();
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ═══════════════════════════════════════════════════════════
  // 2b) VAULT GRAPH — Obsidian-style node map, grows with the console
  // ═══════════════════════════════════════════════════════════
  // Persistent hubs every cluster links into (so it reads as one graph).
  const GRAPH_HUBS = [
    { key: 'vault',   name: 'Vault',        type: 'root',  meta: 'root · index' },
    { key: 'inbox',   name: 'lumi.inbox',   type: 'inbox', meta: 'inbox · 156 items' },
    { key: 'pattern', name: 'pattern.store', type: 'store', meta: 'learned · self-heal' },
  ];

  // One artifact cluster per console run (keyed by run.user). Each cluster is a
  // short chain of files; `hub`/`hubLink` wires one node into a persistent hub.
  const GRAPH_ARTIFACTS = {
    'screenshot · area · annotate': {
      hub: 'inbox', hubLink: 1,
      nodes: [
        { name: 'screen-1840×986.png', type: 'image',  meta: 'image · 2.1 MB' },
        { name: 'annotated.png',       type: 'image',  meta: 'image · 2.3 MB' },
        { name: 'clip.txt',            type: 'text',   meta: 'clipboard · 4 KB' },
      ],
    },
    'proactive: post-resume sweep': {
      hub: 'pattern', hubLink: 2,
      nodes: [
        { name: 'resume-0314.log',   type: 'log',    meta: 'log · 12 KB' },
        { name: 'hygiene-report.md', type: 'note',   meta: 'note · 8 KB' },
        { name: 'freed-1.2GB.json',  type: 'report', meta: 'report · 3 KB' },
      ],
    },
    'record · screen + mic + cam': {
      hub: 'inbox', hubLink: 2,
      nodes: [
        { name: 'screen-rec-42s.mp4', type: 'video', meta: 'video · 18 MB' },
        { name: 'webcam-pip.mp4',     type: 'video', meta: 'video · 6 MB' },
        { name: 'export.mp4',         type: 'video', meta: 'video · 22 MB' },
      ],
    },
    'drop · quarterly-deck.pptx': {
      hub: 'vault', hubLink: 1,
      nodes: [
        { name: 'quarterly-deck.pptx', type: 'file',  meta: 'file · 9.4 MB' },
        { name: 'quarterly-deck.md',   type: 'note',  meta: 'note · 48 KB' },
        { name: 'slides-index.json',   type: 'index', meta: 'index · 11 KB' },
      ],
    },
    'repair · audio.dll not loaded': {
      hub: 'pattern', hubLink: 1,
      nodes: [
        { name: 'symptom-match.log', type: 'log',    meta: 'log · 6 KB' },
        { name: 'audio-repair.ps1',  type: 'script', meta: 'script · 2 KB' },
        { name: 'audit-restart.log', type: 'log',    meta: 'log · 4 KB' },
      ],
    },
    'meeting detected · transcribe': {
      hub: 'vault', hubLink: 1,
      nodes: [
        { name: 'zoom-session.wav', type: 'audio', meta: 'audio · 34 MB' },
        { name: 'transcript.md',    type: 'note',  meta: 'note · 22 KB' },
        { name: 'action-items.md',  type: 'note',  meta: 'note · 5 KB' },
      ],
    },
  };

  function startGraph() {
    const canvas = document.getElementById('lumi-graph');
    if (!canvas) return;
    const body = canvas.parentElement;
    const tip = document.getElementById('graph-tip');
    const countEl = document.getElementById('graph-count');
    const emptyEl = document.getElementById('graph-empty');
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const MAX_ARTIFACTS = 21;       // breathe: fade oldest beyond this (hubs excluded)
    let nodes = [];
    let edges = [];
    let hubMap = {};
    let uid = 0;
    let born = 0;
    let w = 0, h = 0, cx = 0, cy = 0;
    let hover = null;
    const timers = [];

    const rand = (a, b) => a + Math.random() * (b - a);

    function radiusFor(type) {
      if (type === 'root') return 9;
      if (type === 'inbox' || type === 'store') return 7.5;
      if (type === 'video' || type === 'audio' || type === 'image') return 5.5;
      return 4.6;
    }

    function makeNode(spec, isHub) {
      const r = radiusFor(spec.type);
      return {
        id: ++uid, key: spec.key || null,
        name: spec.name, type: spec.type, meta: spec.meta,
        hub: !!isHub, born: born++,
        x: cx + rand(-30, 30), y: cy + rand(-30, 30),
        vx: 0, vy: 0,
        r, rNow: reduce ? r : 0.1,
        alpha: reduce ? 1 : 0, dying: false,
      };
    }

    function link(a, b) { if (a && b && a !== b) edges.push({ a, b }); }

    function neighbors(node) {
      const set = new Set();
      for (const e of edges) {
        if (e.a === node) set.add(e.b);
        else if (e.b === node) set.add(e.a);
      }
      return set;
    }

    function updateCount() {
      const n = nodes.filter(x => !x.hub && !x.dying).length;
      if (countEl) countEl.textContent = n + (n === 1 ? ' note' : ' notes');
    }

    function hideEmpty() {
      if (emptyEl && !emptyEl.classList.contains('is-hidden')) emptyEl.classList.add('is-hidden');
    }

    function enforceCap() {
      const live = nodes.filter(x => !x.hub && !x.dying);
      let over = live.length - MAX_ARTIFACTS;
      if (over <= 0) return;
      live.sort((a, b) => a.born - b.born);
      for (let i = 0; i < over; i++) live[i].dying = true;
      if (reduce) prune();
    }

    function prune() {
      const gone = new Set(nodes.filter(n => n.dying && n.alpha <= 0.02));
      if (!gone.size) return;
      nodes = nodes.filter(n => !gone.has(n));
      edges = edges.filter(e => !gone.has(e.a) && !gone.has(e.b));
    }

    // Spawn a run's cluster, staggered so dots appear as the console prints steps.
    function spawnFor(user) {
      const spec = GRAPH_ARTIFACTS[user];
      if (!spec) return;
      hideEmpty();
      const cluster = { prev: null };
      spec.nodes.forEach((nspec, i) => {
        const t = setTimeout(() => {
          const node = makeNode(nspec, false);
          const anchor = (spec.hub && hubMap[spec.hub]) || { x: cx, y: cy };
          node.x = anchor.x + rand(-46, 46);
          node.y = anchor.y + rand(-46, 46);
          nodes.push(node);
          if (cluster.prev) link(node, cluster.prev);
          if (i === spec.hubLink && spec.hub) link(node, hubMap[spec.hub]);
          cluster.prev = node;
          updateCount();
          enforceCap();
          if (reduce) { settle(); render(); }
        }, i * 520);
        timers.push(t);
      });
    }

    // ── physics ──────────────────────────────────────────────
    function step() {
      const n = nodes.length;
      const REP = 1400, SPRING = 0.018, REST = 64, CENTER = 0.012, DAMP = 0.86;
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy || 0.01;
          const f = REP / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      for (const e of edges) {
        let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - REST) * SPRING;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
      }
      const pad = 16;
      for (const a of nodes) {
        a.vx += (cx - a.x) * CENTER;
        a.vy += (cy - a.y) * CENTER;
        a.vx *= DAMP; a.vy *= DAMP;
        a.x += a.vx; a.y += a.vy;
        a.x = Math.max(pad + a.r, Math.min(w - pad - a.r, a.x));
        a.y = Math.max(pad + a.r, Math.min(h - pad - a.r, a.y));
      }
    }

    function settle() { for (let k = 0; k < 160; k++) step(); }

    function animateBirth() {
      for (const node of nodes) {
        if (node.dying) {
          node.alpha += (0 - node.alpha) * 0.12;
          node.rNow += (0 - node.rNow) * 0.12;
        } else {
          node.alpha += (1 - node.alpha) * 0.10;
          node.rNow += (node.r - node.rNow) * 0.12;
        }
      }
      prune();
    }

    // ── render ───────────────────────────────────────────────
    function render() {
      ctx.clearRect(0, 0, w, h);
      const hoverSet = hover ? neighbors(hover) : null;

      // edges
      for (const e of edges) {
        const incident = hover && (e.a === hover || e.b === hover);
        const a = Math.min(e.a.alpha, e.b.alpha);
        ctx.beginPath();
        ctx.moveTo(e.a.x, e.a.y);
        ctx.lineTo(e.b.x, e.b.y);
        ctx.lineWidth = incident ? 1.4 : 1;
        ctx.strokeStyle = incident
          ? `rgba(196,181,253,${0.55 * a})`
          : `rgba(167,139,250,${0.13 * a})`;
        ctx.stroke();
      }

      // nodes
      for (const node of nodes) {
        const isHover = node === hover;
        const isNeigh = hoverSet && hoverSet.has(node);
        const dim = hover && !isHover && !isNeigh ? 0.4 : 1;
        const r = node.rNow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.shadowBlur = isHover ? 16 : (node.hub ? 10 : 6);
        ctx.shadowColor = `rgba(167,139,250,${0.5 * node.alpha})`;
        const fill = node.hub ? '196,181,253' : '167,139,250';
        ctx.fillStyle = `rgba(${fill},${(isHover ? 1 : 0.9) * node.alpha * dim})`;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isHover) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 3.5, 0, Math.PI * 2);
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = `rgba(196,181,253,${0.6 * node.alpha})`;
          ctx.stroke();
        }
      }

      // labels — only hovered node + neighbors (Obsidian feel)
      if (hover) {
        ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelSet = new Set(hoverSet);
        labelSet.add(hover);
        for (const node of labelSet) {
          if (node.alpha < 0.5) continue;
          ctx.fillStyle = node === hover
            ? `rgba(245,245,245,${node.alpha})`
            : `rgba(168,168,179,${0.85 * node.alpha})`;
          ctx.fillText(node.name, node.x, node.y + node.rNow + 5);
        }
      }
    }

    // ── loop ─────────────────────────────────────────────────
    function frame() {
      step();
      animateBirth();
      render();
      raf = requestAnimationFrame(frame);
    }
    let raf = null;

    // ── hover hit-testing ────────────────────────────────────
    function hitTest(mx, my) {
      let best = null, bestD = Infinity;
      for (const node of nodes) {
        if (node.alpha < 0.4) continue;
        const dx = node.x - mx, dy = node.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < node.r + 6 && d < bestD) { bestD = d; best = node; }
      }
      return best;
    }

    function showTip(node) {
      if (!tip) return;
      tip.hidden = false;
      tip.style.left = node.x + 'px';
      tip.style.top = node.y + 'px';
      tip.innerHTML = `<span class="tip-name">${escapeHtml(node.name)}</span><br><span class="tip-meta">${escapeHtml(node.meta)}</span>`;
    }
    function hideTip() { if (tip) tip.hidden = true; }

    canvas.addEventListener('pointermove', (ev) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit !== hover) {
        hover = hit;
        if (hover) showTip(hover); else hideTip();
        if (reduce) render();
      } else if (hover) {
        showTip(hover); // keep tip pinned to live position
      }
      canvas.style.cursor = hit ? 'pointer' : 'grab';
    });
    canvas.addEventListener('pointerleave', () => {
      hover = null; hideTip();
      if (reduce) render();
    });

    // ── sizing ───────────────────────────────────────────────
    function resize() {
      const rect = body.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      cx = w / 2; cy = h / 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) { settle(); render(); }
    }

    // ── init ─────────────────────────────────────────────────
    resize();
    if ('ResizeObserver' in window) {
      new ResizeObserver(resize).observe(body);
    } else {
      window.addEventListener('resize', resize);
    }

    // hubs first, wired together as the spine of the vault
    GRAPH_HUBS.forEach(h => { const n = makeNode(h, true); hubMap[h.key] = n; nodes.push(n); });
    link(hubMap.vault, hubMap.inbox);
    link(hubMap.vault, hubMap.pattern);

    // register the console bridge so each run grows the graph
    onAgentRun = spawnFor;

    // seed warm: drop the first two clusters so the graph isn't empty on load
    spawnFor('screenshot · area · annotate');
    spawnFor('drop · quarterly-deck.pptx');

    if (reduce) { settle(); render(); }
    else { raf = requestAnimationFrame(frame); }
  }

  // ═══════════════════════════════════════════════════════════
  // 3) PRICING — billing toggle (monthly/annual)
  // ═══════════════════════════════════════════════════════════
  function startPricing() {
    const toggle = document.querySelector('.pricing-toggle');
    if (!toggle) return;
    const btns = toggle.querySelectorAll('.pt-btn');
    const nums = document.querySelectorAll('.tp-num[data-monthly]');
    const metas = document.querySelectorAll('.tier-meta[data-billed-monthly]');

    function apply(mode) {
      toggle.setAttribute('data-bill', mode);
      btns.forEach(b => {
        const on = b.dataset.bill === mode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      nums.forEach(n => {
        const target = mode === 'annual' ? n.dataset.annual : n.dataset.monthly;
        if (!target) return;
        // micro count-tween for polish
        const from = parseInt(n.textContent.replace(/[^0-9]/g, ''), 10) || 0;
        const to = parseInt(target, 10) || 0;
        animateNum(n, from, to, 340);
      });
      metas.forEach(m => {
        const txt = mode === 'annual' ? m.dataset.billedAnnual : m.dataset.billedMonthly;
        if (txt) m.textContent = txt;
      });
    }

    btns.forEach(b => b.addEventListener('click', () => apply(b.dataset.bill)));
  }

  function animateNum(el, from, to, ms) {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ═══════════════════════════════════════════════════════════
  // 4) REVEAL ON SCROLL
  // ═══════════════════════════════════════════════════════════
  function startReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(e => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(e => io.observe(e));
  }

  // ═══════════════════════════════════════════════════════════
  // 4b) BRAND DOCK — logo top-left ↔ diamond follow-badge
  // ═══════════════════════════════════════════════════════════
  function startBrandDock() {
    const dock = document.getElementById('brand-dock');
    if (!dock) return;

    // Hysteresis avoids flicker when the user lingers right at the threshold.
    const DOCK_AT = 120, UNDOCK_AT = 60;
    let docked = false;
    let ticking = false;

    function update() {
      ticking = false;
      const y = window.scrollY || window.pageYOffset || 0;
      if (!docked && y > DOCK_AT) {
        docked = true;
        dock.classList.add('is-docked');
      } else if (docked && y < UNDOCK_AT) {
        docked = false;
        dock.classList.remove('is-docked');
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update(); // honor initial scroll position (e.g. reload mid-page)

    // Clicking the mark jumps to the very top, then hard-reloads the homepage.
    dock.addEventListener('click', (e) => {
      e.preventDefault();
      try { history.scrollRestoration = 'manual'; } catch (_) {}
      window.scrollTo(0, 0);
      window.location.reload();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 5) FAQ — single-open behavior
  // ═══════════════════════════════════════════════════════════
  function startFaq() {
    const rows = document.querySelectorAll('.faq-row');
    rows.forEach(r => {
      r.addEventListener('toggle', () => {
        if (r.open) {
          rows.forEach(other => { if (other !== r) other.removeAttribute('open'); });
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 6) DOWNLOAD — vanilla PDF capabilities brief
  // ═══════════════════════════════════════════════════════════

  // ──────── PDF builder (tiny, dependency-free) ────────
  // Helvetica avg char width factors (good enough for layout)
  const W_FACTOR = { normal: 0.51, bold: 0.555, italic: 0.51 };

  function widthOf(str, size, style) {
    const f = W_FACTOR[style] || W_FACTOR.normal;
    return str.length * size * f;
  }

  // sanitize → WinAnsi-safe
  function sanitize(s) {
    return String(s)
      .replace(/—|–/g, '-')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\u00B7/g, '\u00B7')      // keep middot (winansi 0xB7)
      .replace(/\u2192/g, '->')          // arrow
      .replace(/\u2713|\u2714/g, 'v')    // check
      .replace(/\u2022/g, '\u00B7')      // bullet -> middot
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ''); // strip rest
  }

  function escapePdfText(s) {
    return sanitize(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  // Encode a Latin-1-safe string as raw bytes
  function latin1Bytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
    return out;
  }

  function wrapText(str, size, max, style) {
    const words = sanitize(str).split(/(\s+)/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur + w;
      if (widthOf(test, size, style) > max && cur.trim()) {
        lines.push(cur.trimEnd());
        cur = w.trimStart();
      } else {
        cur = test;
      }
    }
    if (cur.trim()) lines.push(cur.trimEnd());
    return lines.length ? lines : [''];
  }

  // ─────────────────────────────────────────────────────────────
  //  Branded PDF builder — editorial cover + capabilities + extensibility + pricing
  //  Visual system: deep purple accent, paper, ink, hairlines. No fake gradient
  //  bands — every fill is a single solid color.
  // ─────────────────────────────────────────────────────────────
  function buildPdf() {
    // ═════════════════════════════════════════════════════════
    //  Lumi · Capabilities & Pricing — DARK editorial brief
    //  US Letter (612 × 792). Six pages.
    //    01  Cover                            (full-bleed dark + orb glyph)
    //    02  Inside this brief                (TOC + At a glance)
    //    03  What Lumi does                   (capabilities 01–03)
    //    04  What Lumi does · cont.           (capabilities 04–06)
    //    05  Extensibility                    (Hermes / OpenClaw + extras)
    //    06  Enterprise                       (single engagement + contact)
    //
    //  Visual system: graph-paper grid bg, big italic display type,
    //  purple primary accent (#a78bfa) + orange tick accent (#ff6b35),
    //  card panels with hairline borders. No stripes.
    // ═════════════════════════════════════════════════════════

    const W = 612, H = 792;
    const M = 50;
    const CW = W - M * 2;

    // ── DARK palette — matches moliam-styles ──
    const C = {
      bg:       [0.039, 0.039, 0.047], // #0a0a0c
      bg1:      [0.058, 0.058, 0.070], // #0f0f12
      bg2:      [0.078, 0.078, 0.094], // #141418
      bg3:      [0.102, 0.102, 0.125], // #1a1a20
      line:     [0.133, 0.133, 0.165], // #22222a
      line2:    [0.165, 0.165, 0.204], // #2a2a34
      grid:     [0.085, 0.085, 0.108], // graph paper line
      gridDim:  [0.062, 0.062, 0.082], // graph paper micro
      fg:       [0.96, 0.96, 0.96],
      fg2:      [0.78, 0.78, 0.82],
      fg3:      [0.55, 0.55, 0.60],
      fg4:      [0.36, 0.36, 0.41],
      purple:   [0.655, 0.545, 0.98],  // #a78bfa
      purpleLt: [0.77,  0.71,  0.99],  // #c4b5fd
      purpleDp: [0.486, 0.361, 0.961], // #7c5cf5
      purpleVD: [0.21,  0.16,  0.36],
      purpleBg: [0.10,  0.08,  0.18],
      orange:   [1.000, 0.420, 0.208], // #ff6b35
      orangeLt: [1.000, 0.580, 0.360],
      green:    [0.420, 0.820, 0.560],
      white:    [1, 1, 1],
    };

    const pages = [];
    let stream = '';

    // ── tiny ops ──
    const fmt = (n) => Math.round(n * 1000) / 1000;
    function setFill(c)   { stream += `${fmt(c[0])} ${fmt(c[1])} ${fmt(c[2])} rg\n`; }
    function setStroke(c) { stream += `${fmt(c[0])} ${fmt(c[1])} ${fmt(c[2])} RG\n`; }
    function rect(x, yy, w, h, color) {
      stream += `q\n`; setFill(color);
      stream += `${fmt(x)} ${fmt(yy)} ${fmt(w)} ${fmt(h)} re f\nQ\n`;
    }
    function strokeRect(x, yy, w, h, color, lw) {
      lw = lw == null ? 0.5 : lw;
      stream += `q\n`; setStroke(color);
      stream += `${fmt(lw)} w\n${fmt(x)} ${fmt(yy)} ${fmt(w)} ${fmt(h)} re S\nQ\n`;
    }
    function line(x1, y1, x2, y2, color, lw) {
      lw = lw == null ? 0.5 : lw;
      stream += `q\n`; setStroke(color);
      stream += `${fmt(lw)} w\n${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S\nQ\n`;
    }
    function circle(cx, cy, r, fillC, strokeC, lw) {
      const k = r * 0.5523;
      stream += `q\n`;
      if (fillC) setFill(fillC);
      if (strokeC) { setStroke(strokeC); stream += `${fmt(lw == null ? 0.6 : lw)} w\n`; }
      stream += `${fmt(cx + r)} ${fmt(cy)} m\n`;
      stream += `${fmt(cx + r)} ${fmt(cy + k)} ${fmt(cx + k)} ${fmt(cy + r)} ${fmt(cx)} ${fmt(cy + r)} c\n`;
      stream += `${fmt(cx - k)} ${fmt(cy + r)} ${fmt(cx - r)} ${fmt(cy + k)} ${fmt(cx - r)} ${fmt(cy)} c\n`;
      stream += `${fmt(cx - r)} ${fmt(cy - k)} ${fmt(cx - k)} ${fmt(cy - r)} ${fmt(cx)} ${fmt(cy - r)} c\n`;
      stream += `${fmt(cx + k)} ${fmt(cy - r)} ${fmt(cx + r)} ${fmt(cy - k)} ${fmt(cx + r)} ${fmt(cy)} c\n`;
      if (fillC && strokeC) stream += `B\n`;
      else if (fillC) stream += `f\n`;
      else stream += `S\n`;
      stream += `Q\n`;
    }
    function drawText(x, yy, str, opts) {
      opts = opts || {};
      const size = opts.size || 10;
      const fontTag = opts.bold ? '/F2' : (opts.italic ? '/F3' : '/F1');
      const color = opts.color || C.fg2;
      const cs = opts.charSpace || 0;
      stream += `BT\n${fontTag} ${fmt(size)} Tf\n`;
      stream += `${fmt(cs)} Tc\n`;
      stream += `${fmt(color[0])} ${fmt(color[1])} ${fmt(color[2])} rg\n`;
      stream += `${fmt(x)} ${fmt(yy)} Td\n(${escapePdfText(str)}) Tj\nET\n`;
    }
    function textWidth(str, opts) {
      opts = opts || {};
      const size = opts.size || 10;
      const style = opts.bold ? 'bold' : (opts.italic ? 'italic' : 'normal');
      const cs = opts.charSpace || 0;
      const s = sanitize(str);
      return widthOf(s, size, style) + cs * Math.max(0, s.length - 1);
    }
    function drawTextRight(rx, yy, str, opts) { drawText(rx - textWidth(str, opts), yy, str, opts); }
    function drawTextCenter(cx, yy, str, opts) { drawText(cx - textWidth(str, opts) / 2, yy, str, opts); }

    // ── orb glyph (the Lumi smiley) ──
    function drawOrb(cx, cy, r) {
      // soft halo — concentric darker→lighter rings approximating glow
      circle(cx, cy, r * 2.10, [0.046, 0.040, 0.063]);
      circle(cx, cy, r * 1.80, [0.063, 0.052, 0.090]);
      circle(cx, cy, r * 1.55, [0.090, 0.072, 0.135]);
      circle(cx, cy, r * 1.35, [0.125, 0.098, 0.195]);
      circle(cx, cy, r * 1.18, [0.170, 0.130, 0.270]);
      circle(cx, cy, r * 1.06, [0.220, 0.170, 0.350]);
      // hairline orbit rings
      circle(cx, cy, r * 1.32, null, [0.20, 0.16, 0.38], 0.5);
      circle(cx, cy, r * 1.65, null, [0.13, 0.11, 0.22], 0.4);
      // orb body — purple sphere w/ upper-left highlight stack
      circle(cx, cy, r,                        C.purpleDp);
      circle(cx - r * 0.10, cy + r * 0.14, r * 0.90, C.purple);
      circle(cx - r * 0.22, cy + r * 0.28, r * 0.55, C.purpleLt);
      circle(cx - r * 0.30, cy + r * 0.38, r * 0.18, C.white);
      // eyes
      circle(cx - r * 0.28, cy + r * 0.08, r * 0.075, C.white);
      circle(cx + r * 0.32, cy + r * 0.08, r * 0.075, C.white);
      // smile — cubic bezier
      const ex = r * 0.34, ey = r * 0.20, sy = cy - r * 0.22;
      stream += `q\n`;
      setStroke(C.white);
      stream += `${fmt(r * 0.10)} w\n1 J\n`;
      stream += `${fmt(cx - ex)} ${fmt(sy)} m\n`;
      stream += `${fmt(cx - ex * 0.4)} ${fmt(sy - ey * 1.20)} ${fmt(cx + ex * 0.4)} ${fmt(sy - ey * 1.20)} ${fmt(cx + ex)} ${fmt(sy)} c\n`;
      stream += `S\nQ\n`;
    }

    // ── graph-paper page background ──
    function drawBg(opts) {
      opts = opts || {};
      // full-bleed dark
      rect(0, 0, W, H, C.bg);
      // graph paper grid — major 28pt, very subtle
      const step = 28;
      const x0 = M, x1 = W - M;
      const y0 = 60, y1 = H - 60;
      for (let x = x0; x <= x1 + 0.5; x += step) {
        line(x, y0, x, y1, C.grid, 0.25);
      }
      for (let y = y0; y <= y1 + 0.5; y += step) {
        line(x0, y, x1, y, C.grid, 0.25);
      }
      // accent crosses at every 4th intersection — tiny + dots
      const big = step * 4;
      for (let x = x0; x <= x1 + 0.5; x += big) {
        for (let y = y0; y <= y1 + 0.5; y += big) {
          circle(x, y, 0.9, C.purpleVD);
        }
      }
    }

    // ── real Moliam logo glyph — vectorized from moliam [Purple].svg ──
    // (x, y) = bottom-left of the logo box; `size` = box height in pt.
    const MOLIAM_PATH = "M428.63 479.48 c-3.98 -1.47 -21.36 -12.80 -47.22 -30.88 -43.07 -30.18 -48.09 -34.94 -51.46 -49.12 -1.12 -4.76 -1.30 -17.56 -1.30 -89.43 0 -92.19 -0.09 -89.86 5.28 -99.98 5.10 -9.51 9.60 -12.89 41.34 -31.05 16 -9.17 46.01 -26.55 66.68 -38.49 57.69 -33.47 55.44 -32.43 72.22 -32.43 16.95 0 13.41 -1.64 79.91 36.67 24.48 14.10 53.79 31.05 65.21 37.54 23.96 13.66 30.79 19.20 35.11 28.11 5.45 11.16 5.28 7.52 5.28 99.37 0 86.92 -0.09 89.08 -3.63 96.26 -4.24 8.39 -7.09 10.81 -40.30 34.51 -14.27 10.12 -17.04 11.85 -19.46 11.59 l-2.77 -0.26 -0.43 -116.32 c-0.43 -115.37 -0.43 -116.32 -2.25 -119.35 -2.08 -3.63 -6.66 -6.92 -9.60 -6.92 -3.89 0 -7.61 2.85 -21.88 16.78 -39.78 38.83 -72.22 69.45 -75.42 71.26 -4.67 2.51 -14.18 2.68 -19.29 0.26 -2.25 -1.04 -19.11 -16.69 -47.31 -44.02 -24.13 -23.26 -45.23 -42.98 -46.88 -43.76 -2.68 -1.30 -3.37 -1.30 -5.88 -0.26 -4.41 1.82 -8.22 6.75 -9.34 12.02 -0.69 3.29 -0.86 25.43 -0.69 79.83 0.26 73.95 0.26 75.33 1.99 78.27 1.04 1.64 3.20 3.81 4.93 4.76 3.20 1.73 3.20 1.73 5.54 -0.09 1.30 -0.95 3.20 -2.85 4.15 -4.15 1.82 -2.34 1.82 -3.29 2.08 -69.02 0.17 -46.88 0.52 -67.03 1.12 -67.89 0.61 -0.61 2.77 -1.12 5.28 -1.12 l4.32 0 20.41 19.72 c62.10 59.94 61.15 59.07 68.15 60.37 7.09 1.30 11.59 -2.59 83.03 -71.61 8.65 -8.39 8.74 -8.48 12.97 -8.48 2.42 0 4.76 0.43 5.36 1.04 0.78 0.78 1.04 22.66 1.04 93.23 0 85.97 -0.09 92.28 -1.56 95.14 -2.42 4.93 -5.79 6.05 -18.51 6.05 -12.63 0 -16.86 -1.12 -19.98 -5.54 -1.90 -2.68 -1.90 -2.68 -2.34 -50.77 l-0.43 -48.09 -20.32 19.37 c-11.16 10.64 -22.05 20.41 -24.22 21.71 -3.37 1.99 -4.93 2.34 -12.71 2.59 -13.15 0.52 -13.84 0.17 -38.31 -23.35 l-20.32 -19.55 -0.43 68.50 c-0.35 49.73 -0.69 68.84 -1.47 70.14 -1.56 2.68 -5.62 6.31 -8.30 7.26 -3.46 1.30 -13.32 1.04 -17.38 -0.43z";
    function drawLogo(x, y, size, color) {
      // viewBox of the source SVG: "320.56 98.46 387.29 390.74"
      const vbMinX = 320.56, vbMinY = 98.46, vbW = 387.29, vbH = 390.74;
      const s = size / Math.max(vbW, vbH);
      const TX = (px) => fmt(x + (px - vbMinX) * s);
      const TY = (py) => fmt(y + (vbH - (py - vbMinY)) * s); // flip Y: SVG y-down → PDF y-up

      const tokens = MOLIAM_PATH.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
      let i = 0;
      const num = () => parseFloat(tokens[i++]);
      let cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;

      stream += `q\n`;
      setFill(color);
      while (i < tokens.length) {
        if (/[A-Za-z]/.test(tokens[i])) { cmd = tokens[i]; i++; }
        switch (cmd) {
          case 'M': cx = num(); cy = num(); sx = cx; sy = cy; stream += `${TX(cx)} ${TY(cy)} m\n`; cmd = 'L'; break;
          case 'm': cx += num(); cy += num(); sx = cx; sy = cy; stream += `${TX(cx)} ${TY(cy)} m\n`; cmd = 'l'; break;
          case 'L': cx = num(); cy = num(); stream += `${TX(cx)} ${TY(cy)} l\n`; break;
          case 'l': cx += num(); cy += num(); stream += `${TX(cx)} ${TY(cy)} l\n`; break;
          case 'H': cx = num(); stream += `${TX(cx)} ${TY(cy)} l\n`; break;
          case 'h': cx += num(); stream += `${TX(cx)} ${TY(cy)} l\n`; break;
          case 'V': cy = num(); stream += `${TX(cx)} ${TY(cy)} l\n`; break;
          case 'v': cy += num(); stream += `${TX(cx)} ${TY(cy)} l\n`; break;
          case 'C': {
            const x1 = num(), y1 = num(), x2 = num(), y2 = num(), ex = num(), ey = num();
            stream += `${TX(x1)} ${TY(y1)} ${TX(x2)} ${TY(y2)} ${TX(ex)} ${TY(ey)} c\n`;
            cx = ex; cy = ey; break;
          }
          case 'c': {
            const x1 = cx + num(), y1 = cy + num(), x2 = cx + num(), y2 = cy + num(), ex = cx + num(), ey = cy + num();
            stream += `${TX(x1)} ${TY(y1)} ${TX(x2)} ${TY(y2)} ${TX(ex)} ${TY(ey)} c\n`;
            cx = ex; cy = ey; break;
          }
          case 'Z': case 'z': stream += `h\n`; cx = sx; cy = sy; break;
          default: i++; break; // skip anything unexpected safely
        }
      }
      stream += `f\nQ\n`;
    }

    function drawHeader(label) {
      // brand strip
      drawLogo(M, H - 40, 11, C.purple);
      drawText(M + 16, H - 36, 'MOLIAM', { size: 8.5, bold: true, color: C.fg, charSpace: 2.2 });
      const mw = textWidth('MOLIAM', { size: 8.5, bold: true, charSpace: 2.2 });
      drawText(M + 16 + mw + 10, H - 36, '/  Lumi capabilities', { size: 8.5, italic: true, color: C.fg3 });
      drawTextRight(W - M, H - 36, label, { size: 8.5, bold: true, color: C.purple, charSpace: 1.8 });
      line(M, H - 50, W - M, H - 50, C.line2, 0.5);
    }

    function drawFooter(idx, total) {
      line(M, 52, W - M, 52, C.line2, 0.4);
      drawLogo(M, 30, 9, C.purple);
      drawText(M + 13, 34, 'moliam.com', { size: 8, italic: true, color: C.fg2 });
      drawText(M + 69, 34, '/  Irvine, California  /  hello@moliam.com', { size: 8, color: C.fg3 });
      const pn = String(idx).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      drawTextRight(W - M, 34, pn, { size: 8.5, bold: true, color: C.purple });
    }

    // ═════════════════════════════════════════════════════════
    //  PAGE 1 — COVER
    // ═════════════════════════════════════════════════════════
    drawBg();

    // top brand row
    drawLogo(M, H - 41, 12, C.purple);
    drawText(M + 18, H - 36, 'MOLIAM', { size: 9, bold: true, color: C.fg, charSpace: 2.4 });
    const mw0 = textWidth('MOLIAM', { size: 9, bold: true, charSpace: 2.4 });
    drawText(M + 18 + mw0 + 10, H - 36, '/  Lumi capabilities + pricing', { size: 9, italic: true, color: C.fg3 });
    drawTextRight(W - M, H - 36, 'EST. MMXXVI', { size: 9, color: C.fg2, charSpace: 1.8 });
    line(M, H - 52, W - M, H - 52, C.line2, 0.5);

    // hero orb — anchors the upper-right
    drawOrb(W - M - 76, H - 200, 64);

    // eyebrow
    drawText(M, H - 108, '/  A CAPABILITIES BRIEF', { size: 9, bold: true, color: C.purple, charSpace: 2.4 });
    const ebW = textWidth('/  A CAPABILITIES BRIEF', { size: 9, bold: true, charSpace: 2.4 });
    drawText(M + ebW + 14, H - 108, 'MMXXVI  ·  v1.0', { size: 9, italic: true, color: C.fg3 });
    rect(M, H - 120, 32, 1.5, C.orange);

    // display title — left aligned, massive
    drawText(M, H - 320, 'Lumi.', { size: 132, bold: true, color: C.fg });

    // italic subtitle — two lines, purple
    drawText(M, H - 360, 'Your personal', { size: 28, italic: true, color: C.purple });
    drawText(M, H - 394, 'AI assistant.', { size: 28, italic: true, color: C.purple });

    // description block
    const coverDesc = [
      'A signed-in assistant in your system tray that chats, captures,',
      'records, and repairs - entirely on your machine. Watches',
      'your habits. Quietly proactive. Loud when it matters.',
    ];
    for (let i = 0; i < coverDesc.length; i++) {
      drawText(M, H - 436 - i * 16, coverDesc[i], { size: 11, color: C.fg2 });
    }

    // ── stats strip ──
    const sStripTop = 224;
    line(M, sStripTop + 32, W - M, sStripTop + 32, C.line2, 0.5);
    const STATS = [
      ['12+',    'live products'],
      ['<2wk',   'avg ship time'],
      ['99.98%', 'runtime uptime'],
      ['24h',    'reply window'],
    ];
    const colS = CW / STATS.length;
    for (let i = 0; i < STATS.length; i++) {
      const cx = M + colS * i + colS / 2;
      drawTextCenter(cx, sStripTop + 8, STATS[i][0], { size: 24, italic: true, color: C.fg });
      drawTextCenter(cx, sStripTop - 12, STATS[i][1].toUpperCase(), { size: 7.5, color: C.fg3, charSpace: 1.8 });
      // tiny divider between stats (vertical hairlines)
      if (i > 0) line(M + colS * i, sStripTop - 18, M + colS * i, sStripTop + 30, C.line, 0.3);
    }
    line(M, sStripTop - 26, W - M, sStripTop - 26, C.line2, 0.5);

    // bottom tag — centered tracked label + nav row
    drawTextCenter(W / 2, sStripTop - 56, 'TRAY-NATIVE   /   LOCAL-FIRST   /   ALWAYS ON',
      { size: 8, color: C.purple, charSpace: 2.6 });

    // table-of-contents pre-card under the stats
    const tocBoxY = 110;
    drawText(M, tocBoxY, 'INSIDE THIS BRIEF', { size: 8, bold: true, color: C.purple, charSpace: 2.2 });
    rect(M, tocBoxY - 10, 28, 1.4, C.purple);
    const TOCMini = [
      ['01', 'What Lumi does · six capabilities',           'p. 03'],
      ['02', 'Extensibility · Hermes / OpenClaw / Skills',  'p. 05'],
      ['03', 'Enterprise · one engagement',                 'p. 06'],
    ];
    for (let i = 0; i < TOCMini.length; i++) {
      const yy = tocBoxY - 28 - i * 14;
      drawText(M,        yy, TOCMini[i][0], { size: 9, italic: true, color: C.purpleLt });
      drawText(M + 22,   yy, TOCMini[i][1], { size: 9, color: C.fg2 });
      drawTextRight(W - M, yy, TOCMini[i][2], { size: 8.5, color: C.purple, charSpace: 0.6 });
    }

    // footer for cover
    line(M, 52, W - M, 52, C.line2, 0.4);
    drawText(M, 34, 'moliam.com', { size: 8, italic: true, color: C.fg2 });
    drawText(M + 56, 34, '/  Irvine, California  /  hello@moliam.com', { size: 8, color: C.fg3 });
    drawTextRight(W - M, 34, '01 / 06', { size: 8.5, bold: true, color: C.purple });

    pages.push(stream); stream = '';

    // ═════════════════════════════════════════════════════════
    //  PAGE 2 — INSIDE THIS BRIEF (TOC + AT A GLANCE)
    // ═════════════════════════════════════════════════════════
    drawBg();
    drawHeader('/  INSIDE THIS BRIEF');

    drawText(M, H - 100, 'Inside', { size: 36, bold: true, color: C.fg });
    const insW = textWidth('Inside', { size: 36, bold: true });
    drawText(M + insW + 12, H - 100, 'this brief.', { size: 36, italic: true, color: C.purple });
    drawText(M, H - 130, 'Everything Lumi ships, organized for you.', { size: 11.5, italic: true, color: C.fg3 });
    rect(M, H - 144, 32, 1.5, C.orange);

    // ── TOC rows ──
    const TOC = [
      ['01', 'What Lumi does',     'Six capabilities, one assistant',  '03'],
      ['02', 'Extensibility',      'Hermes / OpenClaw / Skills',   '05'],
      ['03', 'Lumi Enterprise', 'One engagement, scoped to you',   '06'],
    ];
    let ty = H - 198;
    line(M, ty + 30, W - M, ty + 30, C.line2, 0.5);
    for (let i = 0; i < TOC.length; i++) {
      const row = TOC[i];
      drawText(M,           ty + 4, row[0], { size: 14, italic: true, color: C.purpleLt });
      drawText(M + 48,      ty + 4, row[1], { size: 18, bold: true, color: C.fg });
      const ttw = textWidth(row[1], { size: 18, bold: true });
      drawText(M + 48 + ttw + 18, ty + 6, row[2], { size: 10, italic: true, color: C.fg3 });
      drawText(W - M - 64,  ty + 7, 'PAGE', { size: 7.5, color: C.fg3, charSpace: 1.8 });
      drawTextRight(W - M,  ty + 4, row[3], { size: 14, bold: true, color: C.purple });
      line(M, ty - 24, W - M, ty - 24, C.line2, 0.5);
      ty -= 54;
    }

    // ── AT A GLANCE — 4 panels ──
    const gY = ty - 36;
    drawText(M, gY, 'AT A GLANCE', { size: 9, bold: true, color: C.purple, charSpace: 2.2 });
    rect(M, gY - 10, 28, 1.4, C.purple);

    const GLANCE = [
      ['One assistant',    'Lives in your system tray. Comes to the front on demand. Signed in via a single browser handoff.'],
      ['Two runtimes',     'Hermes ships a bundled Python interpreter. OpenClaw is the local agentic gateway.'],
      ['Six capabilities', 'Tray assistant, AI chat, capture + recording, files + drop, proactive watcher, repair toolkit.'],
      ['Enterprise',       'One engagement — every capability, scoped to your organization. Custom pricing, volume licensing, dedicated support.'],
    ];
    const glColW = (CW - 18) / 2;
    const glRowH = 76;
    const glTop = gY - 36;
    for (let i = 0; i < GLANCE.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = M + col * (glColW + 18);
      const y = glTop - row * (glRowH + 12);
      rect(x, y - glRowH, glColW, glRowH, C.bg1);
      strokeRect(x, y - glRowH, glColW, glRowH, C.line, 0.5);
      rect(x, y - glRowH, 2.5, glRowH, C.purple);
      drawText(x + 16, y - 22, GLANCE[i][0], { size: 13, bold: true, color: C.fg });
      const dl = wrapText(GLANCE[i][1], 9.5, glColW - 28, 'normal').slice(0, 3);
      for (let li = 0; li < dl.length; li++) {
        drawText(x + 16, y - 38 - li * 12, dl[li], { size: 9.5, color: C.fg2 });
      }
    }

    // ── quote callout (dark panel + orange accent) ──
    const qTop = glTop - 2 * (glRowH + 12) - 16;
    const qH = 64;
    rect(M, qTop - qH, CW, qH, C.bg2);
    strokeRect(M, qTop - qH, CW, qH, C.line2, 0.5);
    rect(M, qTop - qH, 3, qH, C.orange);
    drawText(M + 22, qTop - 26, 'You set the rules.', { size: 18, italic: true, color: C.fg });
    const qw1 = textWidth('You set the rules.', { size: 18, italic: true });
    drawText(M + 22 + qw1 + 10, qTop - 26, 'Lumi runs the loop.', { size: 18, italic: true, color: C.purple });
    drawText(M + 22, qTop - 48,
      'BACKGROUND WATCHER   /   POST-RESUME SWEEPS   /   SELF-LEARNING RUNBOOKS',
      { size: 7.5, color: C.fg3, charSpace: 1.8 });

    drawFooter(2, 6);
    pages.push(stream); stream = '';

    // ═════════════════════════════════════════════════════════
    //  Shared: capability card renderer
    // ═════════════════════════════════════════════════════════
    function drawCapCard(cap, yTop) {
      const n = cap[0], name = cap[1], desc = cap[2], tags = cap[3], featured = !!cap[4];
      const cH = 138;
      const cardY = yTop - cH;

      // base
      rect(M, cardY, CW, cH, featured ? C.bg2 : C.bg1);
      strokeRect(M, cardY, CW, cH, featured ? C.purple : C.line, featured ? 0.9 : 0.5);
      // left accent
      rect(M, cardY, 3, cH, featured ? C.orange : C.purpleVD);

      // big italic number (left column)
      drawText(M + 20, cardY + cH - 50, n, {
        size: 44, italic: true, color: featured ? C.purple : C.purpleDp
      });
      // tiny "0X" prefix kicker under the number
      drawText(M + 20, cardY + 18, featured ? 'FLAGSHIP' : 'CORE', {
        size: 7, bold: true, color: featured ? C.orange : C.fg3, charSpace: 1.8
      });

      // title
      drawText(M + 100, cardY + cH - 30, name, { size: 17, bold: true, color: C.fg });

      // description (cap 3 lines)
      const dlines = wrapText(desc, 10.5, CW - 120, 'normal').slice(0, 3);
      for (let li = 0; li < dlines.length; li++) {
        drawText(M + 100, cardY + cH - 52 - li * 14, dlines[li], { size: 10.5, color: C.fg2 });
      }

      // tag chips along bottom
      let tx = M + 100;
      for (let ti = 0; ti < tags.length; ti++) {
        const tg = (tags[ti] || '').toUpperCase();
        const tw = textWidth(tg, { size: 7.5, bold: featured, charSpace: 1.6 });
        circle(tx + 3, cardY + 22, 1.6, featured ? C.purple : C.purpleDp);
        drawText(tx + 12, cardY + 19, tg, {
          size: 7.5, bold: featured, color: featured ? C.purple : C.fg2, charSpace: 1.6
        });
        tx += 12 + tw + 22;
      }

      // featured-only: "FLAGSHIP" pill in upper right
      if (featured) {
        const pillTxt = 'FLAGSHIP';
        const pw = textWidth(pillTxt, { size: 7, bold: true, charSpace: 1.6 }) + 16;
        const px = M + CW - pw - 16;
        const py = cardY + cH - 26;
        rect(px, py, pw, 14, C.orange);
        drawText(px + 8, py + 4, pillTxt, { size: 7, bold: true, color: C.bg, charSpace: 1.6 });
      }
    }

    // ═════════════════════════════════════════════════════════
    //  PAGE 3 — WHAT LUMI DOES  (01–03)
    // ═════════════════════════════════════════════════════════
    drawBg();
    drawHeader('/  01   WHAT LUMI DOES');

    drawText(M, H - 100, 'Six things.', { size: 36, bold: true, color: C.fg });
    const stW = textWidth('Six things.', { size: 36, bold: true });
    drawText(M + stW + 14, H - 100, 'One assistant.', { size: 36, italic: true, color: C.purple });
    drawText(M, H - 130, 'All on your machine. One signed-in assistant.', { size: 11.5, italic: true, color: C.fg3 });
    rect(M, H - 144, 32, 1.5, C.orange);

    const CAPS_1 = [
      ['01', 'Always-on assistant',
        'Lumi lives in your system tray and comes to the front when called. One global shortcut brings it back; browser handoff for sign-in - no passwords to retype.',
        ['Tray + shortcut', 'Auto-start on login']],
      ['02', 'Chat & AI Brain',
        'A control window with chat, settings, and a brain view. Multi-provider streaming, local Claude Code CLI, and OAuth Claude sessions. Chats and skills persist.',
        ['Multi-provider', 'Claude Code CLI', 'Persistent memory']],
      ['03', 'Screen Capture & Recording',
        'One-click screenshots with annotation editor. Area, window, and full-screen pickers. Screen + audio recorder with floating bar, webcam pip, and a full video editor.',
        ['Annotate', 'Webcam pip', 'Video editor'], true],
    ];
    let cy3 = H - 174;
    for (let i = 0; i < CAPS_1.length; i++) {
      drawCapCard(CAPS_1[i], cy3);
      cy3 -= 154;
    }

    drawFooter(3, 6);
    pages.push(stream); stream = '';

    // ═════════════════════════════════════════════════════════
    //  PAGE 4 — WHAT LUMI DOES · cont. (04–06)
    // ═════════════════════════════════════════════════════════
    drawBg();
    drawHeader('/  01   WHAT LUMI DOES   /   cont.');

    drawText(M, H - 100, 'Three more.', { size: 36, bold: true, color: C.fg });
    drawText(M, H - 132, 'Files, foresight, and a repair shop.', { size: 22, italic: true, color: C.purple });
    rect(M, H - 146, 32, 1.5, C.orange);

    const CAPS_2 = [
      ['04', 'Documents & Files',
        'Drop-catcher accepts files anywhere on screen. Markitdown converts Office and PDFs into clean markdown. OpenClaw routes and searches files locally.',
        ['Drop-catcher', 'Markitdown', 'Local search']],
      ['05', 'Proactive PC Helper',
        'Watches for app hangs, memory pressure, disk problems, and boot/resume issues. Trims working sets, manages power plans, catches unsaved data before crashes.',
        ['Background watcher', 'Post-resume sweeps', 'Hygiene targets']],
      ['06', 'SysOps Repair Toolkit',
        'A loopback service searches files, runs diagnostics, and executes repair runbooks. PowerShell-driven app resolver. Self-learning - remembers which fixes worked.',
        ['PowerShell runbooks', 'Self-learning', 'Loopback service']],
    ];
    let cy4 = H - 180;
    for (let i = 0; i < CAPS_2.length; i++) {
      drawCapCard(CAPS_2[i], cy4);
      cy4 -= 154;
    }

    drawFooter(4, 6);
    pages.push(stream); stream = '';

    // ═════════════════════════════════════════════════════════
    //  PAGE 5 — EXTENSIBILITY
    // ═════════════════════════════════════════════════════════
    drawBg();
    drawHeader('/  02   EXTENSIBILITY');

    drawText(M, H - 100, 'Two runtimes.', { size: 36, bold: true, color: C.fg });
    drawText(M, H - 132, 'Open to your tools.', { size: 22, italic: true, color: C.purple });
    rect(M, H - 146, 32, 1.5, C.orange);

    // runtime cards
    const RcolW = (CW - 16) / 2;
    const RY = H - 184;
    const RH = 220;

    function drawRuntime(x, glyph, title, sub, desc, items) {
      rect(x, RY - RH, RcolW, RH, C.bg1);
      strokeRect(x, RY - RH, RcolW, RH, C.line2, 0.6);
      // accent top strip
      rect(x, RY - 3, RcolW, 3, C.purple);

      // glyph badge — ringed circle
      circle(x + 28, RY - 38, 14, C.purpleBg);
      circle(x + 28, RY - 38, 14, null, C.purple, 0.8);
      drawTextCenter(x + 28, RY - 43, glyph, { size: 14, bold: true, color: C.purpleLt });

      drawText(x + 56, RY - 32, title, { size: 18, bold: true, color: C.fg });
      drawText(x + 56, RY - 48, sub, { size: 7.5, bold: true, color: C.purple, charSpace: 1.6 });

      const dl = wrapText(desc, 10, RcolW - 36, 'normal');
      for (let i = 0; i < dl.length; i++) {
        drawText(x + 18, RY - 80 - i * 14, dl[i], { size: 10, color: C.fg2 });
      }

      const sepY = RY - 80 - dl.length * 14 - 12;
      line(x + 18, sepY, x + RcolW - 18, sepY, C.line2, 0.4);

      for (let i = 0; i < items.length; i++) {
        const iy = sepY - 18 - i * 17;
        circle(x + 22, iy + 3, 1.6, C.purple);
        drawText(x + 30, iy, items[i], { size: 9.5, color: C.fg });
      }
    }

    drawRuntime(M, 'H', 'Hermes',
      'PYTHON RUNTIME  /  IN-PROCESS',
      'A Python interpreter ships inside Lumi. Drop in custom adapters and HTTP plugins - Hermes loads them at launch.',
      ['Bundled interpreter, zero setup', 'HTTP plugins, hot-reload', 'Best for integrations & scripts']);
    drawRuntime(M + RcolW + 16, 'O', 'OpenClaw',
      'LOCAL GATEWAY  /  ACTS ON PC',
      'A local gateway gives Lumi safe, structured tools to act on your machine - file search, routing, shell, and apps.',
      ['File router and search', 'Shell + app actions, scoped', 'Skills store layers on top']);

    // ── ALSO IN THE BOX ──
    const exHead = RY - RH - 40;
    drawText(M, exHead, '+  ALSO IN THE BOX', { size: 9, bold: true, color: C.purple, charSpace: 2.2 });
    rect(M, exHead - 10, 28, 1.4, C.purple);
    drawTextRight(W - M, exHead, 'Everything else shipping with Lumi today.', { size: 9, italic: true, color: C.fg3 });

    const EXTRAS = [
      ['Meeting transcription',       'auto-detects calls, captures audio sessions'],
      ['Lock & blocker overlays',     'session lock + focus blocker for deep work'],
      ['Phone gate & support-talk',   'SMS/voice features inside the control window'],
      ['Auto-updater + crash report', 'rollback baked in, postmortems shipped home'],
      ['Heartbeat & device card',     'per-device status, opt-out telemetry'],
      ['Shell-fragment quarantine',   'auto-sweeps junk from stray paste accidents'],
    ];
    const exTop = exHead - 38;
    const exColW = (CW - 28) / 2;
    const exRowH = 36;
    for (let i = 0; i < EXTRAS.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const ex = M + col * (exColW + 28);
      const ey = exTop - row * exRowH;
      drawText(ex,        ey, '+', { size: 11, bold: true, color: C.orange });
      drawText(ex + 14,   ey, EXTRAS[i][0], { size: 10.5, bold: true, color: C.fg });
      drawText(ex + 14,   ey - 14, EXTRAS[i][1], { size: 9, italic: true, color: C.fg2 });
      line(ex, ey - 22, ex + exColW, ey - 22, C.line, 0.3);
    }

    drawFooter(5, 6);
    pages.push(stream); stream = '';

    // ═════════════════════════════════════════════════════════
    //  PAGE 6 — ENTERPRISE + CONTACT
    // ═════════════════════════════════════════════════════════
    drawBg();
    drawHeader('/  03   ENTERPRISE');

    drawText(M, H - 100, 'One assistant.', { size: 36, bold: true, color: C.fg });
    const ooW = textWidth('One assistant.', { size: 36, bold: true });
    drawText(M + ooW + 14, H - 100, 'Built for your org.', { size: 36, italic: true, color: C.purple });
    drawText(M, H - 130, 'One engagement. Every capability. Scoped to your organization.', { size: 11.5, italic: true, color: C.fg3 });
    rect(M, H - 144, 32, 1.5, C.orange);

    // ── single Enterprise panel (full width) ──
    const panelTop = H - 168;
    const panelBot = 168;
    const panelH = panelTop - panelBot;
    rect(M, panelBot, CW, panelH, C.bg2);
    strokeRect(M, panelBot, CW, panelH, C.purple, 1.0);
    rect(M, panelTop - 4, CW, 4, C.purple);          // top accent strip
    const topY = panelTop;

    // left / right zones
    const leftW = CW * 0.40;
    const lx = M + 24;
    const dividerX = M + leftW;

    // flag pill
    const eFlag = 'ENTERPRISE';
    const efw = textWidth(eFlag, { size: 7, bold: true, charSpace: 1.6 }) + 16;
    rect(lx, topY - 40, efw, 15, C.orange);
    drawText(lx + 8, topY - 36, eFlag, { size: 7, bold: true, color: C.bg, charSpace: 1.6 });

    // name — "Lumi <italic Enterprise>"
    const eNameY = topY - 72;
    drawText(lx, eNameY, 'Lumi', { size: 16, color: C.fg3 });
    const elw = widthOf('Lumi', 16, 'normal');
    drawText(lx + elw + 6, eNameY, 'Enterprise', { size: 19, italic: true, color: C.purple });

    // tag
    const eTag = 'One agreement. Every capability. Tailored to your organization.';
    const eTagLines = wrapText(eTag, 9.5, leftW - 44, 'italic').slice(0, 3);
    for (let li = 0; li < eTagLines.length; li++) {
      drawText(lx, eNameY - 22 - li * 12, eTagLines[li], { size: 9.5, italic: true, color: C.fg2 });
    }

    // pricing label + ambiguous "Custom" (no dollar amount)
    const ePriceY = eNameY - 122;
    drawText(lx, ePriceY + 50, 'PRICING', { size: 8, bold: true, color: C.purple, charSpace: 2.2 });
    drawText(lx, ePriceY, 'Custom', { size: 40, italic: true, color: C.purpleLt });
    drawText(lx, ePriceY - 16, 'Scoped to seats, security & support', { size: 8, color: C.fg3, charSpace: 0.4 });

    // note
    const eNote = 'Volume licensing, SSO & RBAC, audit trails, dedicated onboarding, and priority support — packaged into one agreement and quoted to your deployment.';
    const eNoteLines = wrapText(eNote, 8.5, leftW - 44, 'normal').slice(0, 5);
    let enY = ePriceY - 44;
    for (let li = 0; li < eNoteLines.length; li++) {
      drawText(lx, enY, eNoteLines[li], { size: 8.5, color: C.fg3 });
      enY -= 11;
    }

    // vertical divider between zones
    line(dividerX, panelBot + 22, dividerX, topY - 22, C.line2, 0.5);

    // right zone — "everything included", two feature columns
    const rx = dividerX + 24;
    const rZoneW = (M + CW) - rx - 16;
    drawText(rx, topY - 36, 'EVERYTHING INCLUDED', { size: 8, bold: true, color: C.purple, charSpace: 2.2 });
    line(rx, topY - 46, M + CW - 16, topY - 46, C.line, 0.4);

    const FEAT_COLS = [
      {
        head: 'PLATFORM',
        feats: [
          'Tray-native assistant',
          'Multi-provider AI chat',
          'Screenshots + annotation',
          'Screen recording + video editor',
          'Drop-catcher + Markitdown',
          'Meeting transcription',
        ],
      },
      {
        head: 'OPERATIONS & CONTROL',
        feats: [
          'Proactive PC helper',
          'SysOps repair toolkit',
          'Hermes + OpenClaw + Skills',
          'SSO handoff + RBAC',
          'Activity log + audit trail',
          'Private Skills registry',
          'Per-device cards + heartbeat',
          'Lock & blocker overlays',
        ],
      },
    ];
    const fColGap = 22;
    const fColW = (rZoneW - fColGap) / 2;
    for (let ci = 0; ci < FEAT_COLS.length; ci++) {
      const col = FEAT_COLS[ci];
      const cx = rx + ci * (fColW + fColGap);
      drawText(cx, topY - 70, col.head, { size: 7.5, bold: true, color: C.purpleLt, charSpace: 1.4 });
      let fy = topY - 90;
      for (let fi = 0; fi < col.feats.length; fi++) {
        const flines = wrapText(col.feats[fi], 8.5, fColW - 12, 'normal');
        for (let k = 0; k < flines.length; k++) {
          if (k === 0) drawText(cx, fy, '+', { size: 9, bold: true, color: C.purple });
          drawText(cx + 11, fy, flines[k], { size: 8.5, color: C.fg2 });
          fy -= 11.5;
        }
        fy -= 3;
      }
    }

    // ── contact strip ──
    const contactY = 88;
    const contactH = 60;
    rect(M, contactY, CW, contactH, C.bg2);
    strokeRect(M, contactY, CW, contactH, C.line2, 0.5);
    rect(M, contactY, 3, contactH, C.orange);
    drawText(M + 22, contactY + contactH - 24, 'Talk to us.', { size: 17, bold: true, color: C.fg });
    drawText(M + 22, contactY + 14,
      'hello@moliam.com   /   Irvine, California   /   UTC-8   /   Booking Q3 2026',
      { size: 9, italic: true, color: C.purpleLt });
    drawTextRight(W - M - 16, contactY + contactH - 24, 'Priority support', { size: 9, color: C.purpleLt });
    drawTextRight(W - M - 16, contactY + 14, 'Dedicated onboarding', { size: 9, color: C.purpleLt });

    drawFooter(6, 6);

    pages.push(stream);

    return assemble(pages, W, H);
  }

  function assemble(pageStreams, W, H) {
    // Object IDs:
    // 1 = Catalog
    // 2 = Pages
    // For each page i (0-based): page obj id = 3 + 2i, content stream id = 4 + 2i
    // After pages: F1 = next, F2 = next+1, F3 = next+2
    const n = pageStreams.length;
    const F1_ID = 3 + 2 * n;
    const F2_ID = F1_ID + 1;
    const F3_ID = F1_ID + 2;

    const objs = [];

    objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;

    const kids = [];
    for (let i = 0; i < n; i++) kids.push(`${3 + 2 * i} 0 R`);
    objs[2] = `<< /Type /Pages /Count ${n} /Kids [${kids.join(' ')}] >>`;

    for (let i = 0; i < n; i++) {
      const pageId = 3 + 2 * i;
      const contId = 4 + 2 * i;
      objs[pageId] =
        `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [0 0 ${W} ${H}] ` +
        `/Resources << /Font << /F1 ${F1_ID} 0 R /F2 ${F2_ID} 0 R /F3 ${F3_ID} 0 R >> >> ` +
        `/Contents ${contId} 0 R >>`;
      const sBytes = latin1Bytes(pageStreams[i]).length;
      objs[contId] = `<< /Length ${sBytes} >>\nstream\n${pageStreams[i]}\nendstream`;
    }

    objs[F1_ID] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
    objs[F2_ID] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;
    objs[F3_ID] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`;

    // Build the byte stream
    const headerStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const chunks = [];
    chunks.push(latin1Bytes(headerStr));
    let offset = chunks[0].length;
    const xref = new Array(objs.length).fill(0);

    for (let id = 1; id < objs.length; id++) {
      if (!objs[id]) continue;
      xref[id] = offset;
      const body = `${id} 0 obj\n${objs[id]}\nendobj\n`;
      const buf = latin1Bytes(body);
      chunks.push(buf);
      offset += buf.length;
    }

    const xrefStart = offset;
    let xrefStr = `xref\n0 ${objs.length}\n`;
    xrefStr += `0000000000 65535 f \n`;
    for (let id = 1; id < objs.length; id++) {
      if (xref[id]) {
        xrefStr += `${String(xref[id]).padStart(10, '0')} 00000 n \n`;
      } else {
        // null entries get a free placeholder
        xrefStr += `0000000000 65535 f \n`;
      }
    }
    xrefStr += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    chunks.push(latin1Bytes(xrefStr));

    // concat
    let total = 0;
    for (const c of chunks) total += c.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  }

  function downloadBrief() {
    const bytes = buildPdf();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `lumi-capabilities-${stamp}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 250);
  }

  function startDownload() {
    // ── PDF capabilities brief buttons (capability section + final CTA + pricing foot)
    const pdfButtons = [
      document.getElementById('dl-brief'),
      document.getElementById('dl-brief-2'),
      document.getElementById('dl-brief-3'),
    ].filter(Boolean);

    const primary = document.getElementById('dl-brief');
    const label = document.getElementById('dl-label');
    const defaultLabel = label ? label.textContent : 'Capabilities brief · PDF';

    function setState(state, text) {
      if (primary) primary.setAttribute('data-dl-state', state);
      if (label && text != null) label.textContent = text;
    }

    function triggerPdf() {
      setState('working', 'Generating…');
      setTimeout(() => {
        try {
          downloadBrief();
          setState('done', 'Downloaded ✓');
          setTimeout(() => setState('idle', defaultLabel), 2400);
        } catch (e) {
          console.error('[dl] failed', e);
          setState('idle', 'Download failed — retry');
        }
      }, 280);
    }
    pdfButtons.forEach(b => b.addEventListener('click', triggerPdf));

    // ── Download Now button (hero) — wires to data-download-href, falls back to '#'
    const dlBtn = document.getElementById('dl-now');
    if (dlBtn) {
      let busy = false;
      dlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (busy) return;
        busy = true;

        const href = dlBtn.getAttribute('data-download-href') || '#';
        const name = dlBtn.getAttribute('data-download-name') || '';

        dlBtn.classList.add('is-loading');

        // 2s pseudo-prep, then trigger the actual download if href is set
        setTimeout(() => {
          if (href && href !== '#') {
            const a = document.createElement('a');
            a.href = href;
            if (name) a.download = name;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 200);
          }
          dlBtn.classList.remove('is-loading');
          dlBtn.classList.add('is-success');
        }, 1600);

        setTimeout(() => {
          dlBtn.classList.remove('is-success');
          busy = false;
        }, 3800);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // boot
  // ═══════════════════════════════════════════════════════════
  function boot() {
    startRotator();
    startAgent();
    startGraph();
    startPricing();
    startReveal();
    startFaq();
    startDownload();
    startBrandDock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
