import type { Router } from '../lib/router.js';
import { emitAck, getSocket } from '../lib/socket.js';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@shared/events.js';
import type {
  AnswerAck,
  GameOverPayload,
  JoinAck,
  LeaderboardPayload,
  PausedPayload,
  PerPlayerReveal,
  QuestionRevealPayload,
  QuestionStartPayload,
  ResumedPayload,
  SessionReplacedPayload,
  StartCountdownPayload,
  StateUpdatePayload,
} from '@shared/schemas.js';
import {
  NAME_MAX,
  NAME_MIN,
  QUESTION_DURATION_MS,
  THROW_AMMO_PER_QUESTION,
  THROW_KINDS,
  TILE_DEFS,
  type ThrowKind,
} from '@shared/constants.js';
import { shapeSvg } from '../components/shapes.js';
import { mountWordmark } from '../components/wordmark.js';
import { toast } from '../components/modal.js';
import { fireConfetti } from '../components/confetti.js';
import { CLUTCH_API_BASE } from '../lib/api.js';

interface PlayerUI {
  root: HTMLElement;
  sessionId: string;
  playerId: string;
  name: string;
  code: string;
  totalQuestions: number;
  currentIndex: number;
  state: StateUpdatePayload['state'];
  lockedOutForIndex: number | null;
  deadline: number | null;
  paused: boolean;
  pickedChoice: number | null;
  score: number;
  rafHandle: number | null;
  // Last leaderboard rank we showed for this player. Used to detect
  // "non-1st → 1st" transitions, which fire confetti.
  lastKnownRank: number | null;
  // Answer options for the current question. The server sends these on
  // question_start so the phone can label each tile; the question text is
  // still host-only.
  options: string[];
  // Throw mini-game state — only used after the player has locked an answer.
  // Ammo resets every question. The selected kind sticks across throws so a
  // player who likes the paper plane doesn't have to re-pick every time.
  throwAmmo: number;
  throwKind: ThrowKind;
  throwQuestionIndex: number | null;
}

export async function renderPlayer(
  app: HTMLElement,
  _router: Router,
  prefilledCode: string | null,
): Promise<void> {
  // QR-scan self-heal: iOS Camera's in-app browser occasionally paints the
  // first load without our CSS bundle applied. Only reload if we detect the
  // stylesheet actually failed to take — checking computed styles before
  // reloading means the 99% of phones with working CSS don't eat a double
  // round-trip (which on a flaky LAN looks like an infinite loading spinner).
  if (prefilledCode) scheduleQrSelfHealReload();

  // Always start /play from a clean slate — do not auto-rejoin from a prior
  // session. Users expect to be able to enter any code/name freely.
  clearCached();

  // Join form first. Name starts blank; code is only pre-filled when passed
  // explicitly (e.g. a QR scan hit /play/<CODE>).
  renderJoinForm(app, prefilledCode, '');
  // Hook join
  const form = document.getElementById('join-form') as HTMLFormElement;
  const errEl = document.getElementById('join-err') as HTMLElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('hidden');
    const submitBtn = document.getElementById('join-submit') as HTMLButtonElement | null;
    const codeRaw = (document.getElementById('code') as HTMLInputElement).value
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
    const name = (document.getElementById('name') as HTMLInputElement).value.trim();
    if (codeRaw.length !== 6) {
      showErr(errEl, 'Code must be 6 characters.');
      return;
    }
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      showErr(errEl, `Name must be ${NAME_MIN}–${NAME_MAX} characters.`);
      return;
    }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Joining…'; }
    const restoreBtn = (): void => {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Join game'; }
    };
    try {
      const s = getSocket();
      if (!s.connected) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Can’t reach the host. Check you’re on the same Wi-Fi as the big screen.')),
            8_000,
          );
          s.once('connect', () => { clearTimeout(timeout); resolve(); });
        });
      }
      const ack = (await emitAck(CLIENT_EVENTS.PlayerJoin, { code: codeRaw, name })) as JoinAck;
      if (!ack.ok) {
        showErr(errEl, ack.reason);
        restoreBtn();
        return;
      }
      writeCached({ code: codeRaw, name });
      // Happy path continues below.
      void handleJoinSuccess(app, ack, name);
    } catch (err) {
      showErr(errEl, (err as Error).message || 'Could not join. Try again.');
      restoreBtn();
    }
  });
}

async function handleJoinSuccess(
  app: HTMLElement,
  ack: Extract<JoinAck, { ok: true }>,
  name: string,
): Promise<void> {
  const ui: PlayerUI = {
    root: app,
    sessionId: ack.sessionId,
    playerId: ack.playerId,
    name,
    code: ack.sessionCode,
    totalQuestions: ack.totalQuestions,
    currentIndex: ack.currentQuestionIndex,
    state: ack.currentState,
    lockedOutForIndex: ack.lateForCurrent ? ack.currentQuestionIndex : null,
    deadline: null,
    paused: false,
    pickedChoice: null,
    score: 0,
    rafHandle: null,
    lastKnownRank: null,
    options: [],
    throwAmmo: 0,
    throwKind: 'tomato',
    throwQuestionIndex: null,
  };
  wirePlayer(ui);
  renderPlayerState(ui);
}

function renderJoinForm(app: HTMLElement, prefilledCode: string | null, prefilledName: string): void {
  // If the code was pre-filled (i.e. they scanned a QR), autofocus the NAME
  // field so they land ready to type. Otherwise autofocus the code field.
  // The code field stays editable either way — users must always be able to
  // correct a wrong scan or type a different code on any device.
  const autofocusName = Boolean(prefilledCode);
  app.innerHTML = `
    <div class="min-h-full flex flex-col bg-clutch-paper relative">
      <div id="back-slot" class="absolute top-4 left-4 z-10"></div>
      <header class="pt-10 pb-2 text-center">
        <div id="wordmark" class="inline-block"></div>
      </header>
      <main class="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md w-full mx-auto">
        <form id="join-form" class="rounded-4xl bg-white border border-black/5 shadow-lg p-6 space-y-4">
          <div>
            <label for="code" class="text-sm font-medium text-clutch-mute">Game code</label>
            <input id="code" name="code" type="text" autocomplete="off" spellcheck="false" autocapitalize="characters"
              autocorrect="off" inputmode="text" enterkeyhint="next" maxlength="7" placeholder="ABCD-23"
              class="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-2xl font-mono uppercase tracking-widest text-center focus:border-clutch-ink focus:outline-none focus:placeholder-transparent"
              value="${escapeHtml(prefilledCode ?? '')}" />
          </div>
          <div>
            <label for="name" class="text-sm font-medium text-clutch-mute">Your name</label>
            <input id="name" name="name" type="text" autocomplete="nickname" autocorrect="off" spellcheck="false"
              enterkeyhint="go" maxlength="20" placeholder="Nickname"
              class="mt-1 w-full rounded-xl border border-black/10 px-4 py-3 text-lg focus:border-clutch-ink focus:outline-none"
              value="${escapeHtml(prefilledName)}" />
          </div>
          <button type="submit" id="join-submit" class="w-full rounded-2xl bg-clutch-ink text-white font-semibold px-4 py-4 text-lg hover:bg-black active:scale-[0.99] transition-transform disabled:opacity-60 disabled:cursor-not-allowed">
            Join game
          </button>
          <div id="join-err" class="hidden text-sm text-clutch-red text-center"></div>
        </form>
        <p class="text-center text-xs text-clutch-mute mt-6">Phones show answer tiles only.<br>Keep your eyes on the big screen.</p>
      </main>
    </div>
  `;
  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-5xl' });

  // Live-sanitize the code input so it always displays upper-case
  // alphanumerics, no matter how fast the user types or which mobile keyboard
  // they're using. This keeps the field fully editable (no readonly/disabled)
  // while still enforcing the 6-char code shape.
  const codeEl = document.getElementById('code') as HTMLInputElement | null;
  if (codeEl) {
    codeEl.addEventListener('input', () => {
      const cleaned = codeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (cleaned !== codeEl.value) codeEl.value = cleaned;
    });
  }

  // Focus the right field on mount. On mobile, avoid forcing focus if the
  // user hasn't interacted yet — iOS/Safari blocks programmatic focus without
  // a user gesture, so we only attempt it and let it silently no-op if denied.
  const target = document.getElementById(autofocusName ? 'name' : 'code') as HTMLInputElement | null;
  if (target) {
    // Use rAF so the focus call doesn't fight the browser's initial paint.
    requestAnimationFrame(() => { try { target.focus(); } catch { /* noop */ } });
  }

  // Async-render the "Back to chooser" link only for admins. The home view
  // bounces non-admins straight back to /play, so showing them a Back button
  // would land them on a page that immediately redirects — confusing UX.
  // Fire-and-forget; if the check fails or the user isn't admin, the slot
  // simply stays empty.
  void renderBackButtonIfAdmin();
}

async function renderBackButtonIfAdmin(): Promise<void> {
  let isAdmin = false;
  try {
    const r = await fetch(`${CLUTCH_API_BASE}/me`, { credentials: 'same-origin' });
    if (r.ok) {
      const j = (await r.json()) as { isAdmin?: boolean };
      isAdmin = !!j.isAdmin;
    }
  } catch { /* default false */ }
  if (!isAdmin) return;

  const slot = document.getElementById('back-slot');
  if (!slot) return;
  slot.innerHTML = `
    <a href="/" data-link
       class="inline-flex items-center gap-1.5 rounded-2xl bg-white/80 backdrop-blur-sm border border-black/5 shadow-sm hover:shadow-md hover:bg-white text-clutch-mute hover:text-clutch-ink transition-all px-3 py-2 text-sm font-medium"
       aria-label="Back to host or join chooser">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6"/>
      </svg>
      <span>Back</span>
    </a>
  `;
}

function showErr(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

function wirePlayer(ui: PlayerUI): void {
  const s = getSocket();
  // state_update syncs stored fields but is NOT the renderer. Dedicated events
  // below (question_start, question_reveal, leaderboard, game_over) paint.
  // We only react here when entering lobby (which has no dedicated event).
  s.on(SERVER_EVENTS.StateUpdate, (p: StateUpdatePayload) => {
    const prev = ui.state;
    ui.state = p.state;
    ui.currentIndex = p.currentQuestionIndex;
    ui.totalQuestions = p.totalQuestions;
    if (p.state === 'lobby' && prev !== 'lobby') renderPlayerState(ui);
  });
  s.on(SERVER_EVENTS.QuestionStart, (p: QuestionStartPayload) => {
    ui.state = 'question';
    ui.currentIndex = p.index;
    ui.deadline = p.deadline;
    ui.paused = false;
    ui.pickedChoice = null;
    ui.options = p.options ?? [];
    // Refresh the throw budget every question. We trust the server's count;
    // this local copy is just to render the chip immediately on submit.
    ui.throwAmmo = THROW_AMMO_PER_QUESTION;
    ui.throwQuestionIndex = p.index;
    renderPlayerState(ui);
  });
  s.on(SERVER_EVENTS.QuestionReveal, (p: QuestionRevealPayload) => {
    ui.state = 'reveal';
    const me = p.perPlayer.find((e) => e.name === ui.name);
    renderReveal(ui, p, me ?? null);
    if (me) ui.score = me.newScore;
  });
  s.on(SERVER_EVENTS.Leaderboard, (p: LeaderboardPayload) => {
    ui.state = 'leaderboard';
    renderPlayerLeaderboard(ui, p);
  });
  s.on(SERVER_EVENTS.Paused, (_p: PausedPayload) => {
    ui.paused = true;
    if (ui.state === 'question') renderPlayerState(ui);
  });
  s.on(SERVER_EVENTS.Resumed, (p: ResumedPayload) => {
    ui.paused = false;
    ui.deadline = p.newDeadline;
    if (ui.state === 'question') renderPlayerState(ui);
  });
  s.on(SERVER_EVENTS.GameOver, (p: GameOverPayload) => {
    ui.state = 'final';
    renderPlayerFinal(ui, p);
  });
  s.on(SERVER_EVENTS.StartCountdown, (p: StartCountdownPayload) => {
    showStartCountdown(p);
  });
  s.on(SERVER_EVENTS.SessionReplaced, (p: SessionReplacedPayload) => {
    // The host picked a fresh quiz and rotated the room. Reset our session
    // identifiers and bounce back to the lobby state — the engine has already
    // re-roomed our socket, so the next StateUpdate/RosterUpdate will paint
    // the new lobby.
    if (p.oldSessionId !== ui.sessionId) return;
    ui.sessionId = p.newSessionId;
    ui.code = p.newCode;
    ui.totalQuestions = p.totalQuestions;
    ui.currentIndex = 0;
    ui.state = 'lobby';
    ui.lockedOutForIndex = null;
    ui.deadline = null;
    ui.paused = false;
    ui.pickedChoice = null;
    ui.score = 0;
    ui.lastKnownRank = null;
    ui.options = [];
    renderPlayerState(ui);
  });
}

function renderPlayerState(ui: PlayerUI): void {
  if (ui.state === 'lobby') return renderWaiting(ui, 'You’re in. Waiting for host to start…');
  if (ui.state === 'question') return renderAnswerTiles(ui);
  if (ui.state === 'reveal') return renderWaiting(ui, 'Revealing results…');
  if (ui.state === 'leaderboard') return renderWaiting(ui, 'Next question coming…');
  if (ui.state === 'final' || ui.state === 'ended') return renderWaiting(ui, 'Game over.');
}

function renderAnswerTiles(ui: PlayerUI): void {
  if (ui.lockedOutForIndex === ui.currentIndex) {
    return renderWaiting(ui, 'Joining next round…');
  }
  if (ui.pickedChoice !== null) {
    return renderLockedIn(ui, ui.pickedChoice);
  }

  ui.root.innerHTML = `
    <div class="h-full flex flex-col bg-clutch-ink text-white">
      <div class="flex items-center justify-between px-4 pt-3 text-xs uppercase tracking-widest opacity-60">
        <span>Q ${ui.currentIndex + 1} / ${ui.totalQuestions}</span>
        <span id="p-timer">--</span>
      </div>
      <div class="grid grid-cols-2 grid-rows-2 gap-2 p-2 flex-1">
        ${TILE_DEFS.map((t, i) => {
          const label = escapeHtml(ui.options[i] ?? '');
          return `
            <button data-choice="${i}"
              class="tile tile-${t.color} rounded-4xl flex flex-col items-center justify-center gap-2 p-3 text-center">
              <div class="flex-shrink-0">${shapeSvg(t.shape, 64)}</div>
              <div class="flex-1 w-full flex items-center justify-center px-1 font-semibold leading-tight text-[clamp(0.95rem,4.5vw,1.5rem)] break-words overflow-hidden">
                ${label}
              </div>
            </button>
          `;
        }).join('')}
      </div>
      ${ui.paused ? `<div class="pause-backdrop absolute inset-0 flex items-center justify-center text-white text-2xl font-semibold">Paused</div>` : ''}
    </div>
  `;
  ui.root.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ix = Number(btn.dataset.choice);
      void submitAnswer(ui, ix);
    });
  });
  startPlayerTimer(ui);
}

function renderLockedIn(ui: PlayerUI, choice: number): void {
  // After the answer is in, the phone becomes a throw arena: the bottom of
  // the screen is a swipe canvas, the top is a row of projectile pickers,
  // and a slim header keeps the timer + "your pick" chip in view. Swiping
  // upward inside the canvas flings whichever projectile is selected.
  //
  // Throw budget + cooldown live on the server; this view trusts the ack to
  // tell us when we're out of ammo or cooling down. The canvas always
  // renders so a player who's already empty still gets pleasant haptic-feel
  // feedback on swipe (no broadcast, but the local sprite still flies).
  const t = TILE_DEFS[choice]!;
  const pickedLabel = ui.options[choice] ?? '';

  ui.root.innerHTML = `
    <div class="player-throw-shell">
      <header class="player-throw-head">
        <div class="player-throw-head-left">
          <span class="player-throw-q">Q ${ui.currentIndex + 1}/${ui.totalQuestions}</span>
          <span class="player-throw-pick tile-${t.color}">${shapeSvg(t.shape, 22)}</span>
          ${pickedLabel
            ? `<span class="player-throw-pick-label">${escapeHtml(pickedLabel)}</span>`
            : ''}
        </div>
        <span id="p-timer" class="player-throw-timer">--</span>
      </header>

      <section class="player-throw-arena" id="throw-arena" aria-label="Swipe up to throw">
        <div class="player-throw-target" aria-hidden="true">
          <div class="player-throw-target-ring"></div>
          <div class="player-throw-target-label">Swipe up to throw</div>
        </div>
        <div class="player-throw-trail" id="throw-trail" aria-hidden="true"></div>
      </section>

      <section class="player-throw-rack" role="radiogroup" aria-label="Pick your projectile">
        ${throwKindCardsHtml(ui.throwKind)}
      </section>

      <footer class="player-throw-foot">
        <div class="player-throw-ammo" id="throw-ammo">
          <span class="player-throw-ammo-num" id="throw-ammo-num">${ui.throwAmmo}</span>
          <span class="player-throw-ammo-label">left</span>
        </div>
        <div class="player-throw-locked">Answer locked in</div>
      </footer>
    </div>
  `;
  wireThrowArena(ui);
  startPlayerTimer(ui);
}

function throwKindCardsHtml(active: ThrowKind): string {
  const kinds: { id: ThrowKind; label: string; emoji: string }[] = [
    { id: 'tomato',  label: 'Tomato',     emoji: '🍅' },
    { id: 'plane',   label: 'Paper Plane', emoji: '✈️' },
    { id: 'pie',     label: 'Cream Pie',   emoji: '🥧' },
    { id: 'sparkle', label: 'Sparkle',    emoji: '✨' },
  ];
  return kinds.map((k) => `
    <button type="button" data-throw-kind="${k.id}"
      class="player-throw-card${k.id === active ? ' is-active' : ''}"
      role="radio" aria-checked="${k.id === active}">
      <span class="player-throw-card-emoji" aria-hidden="true">${k.emoji}</span>
      <span class="player-throw-card-label">${k.label}</span>
    </button>
  `).join('');
}

function wireThrowArena(ui: PlayerUI): void {
  const arena = document.getElementById('throw-arena');
  const trail = document.getElementById('throw-trail');
  const rack = document.querySelectorAll<HTMLButtonElement>('[data-throw-kind]');
  if (!arena || !trail) return;

  rack.forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.throwKind as ThrowKind | undefined;
      if (!kind) return;
      ui.throwKind = kind;
      rack.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
      // Quick haptic blip on supporting devices for tactile feedback.
      try { navigator.vibrate?.(8); } catch { /* noop */ }
    });
  });

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let lastX = 0;
  let lastY = 0;
  let cooldownUntil = 0;

  const setTrail = (x: number, y: number, scale: number, fade = 1): void => {
    const r = arena.getBoundingClientRect();
    const lx = x - r.left;
    const ly = y - r.top;
    trail.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -50%) scale(${scale})`;
    trail.style.opacity = String(fade);
  };

  const onDown = (e: PointerEvent): void => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    startT = performance.now();
    arena.classList.add('is-active');
    trail.classList.add('is-visible');
    // Use the currently-selected kind as the trail emoji, so the player
    // sees what they're about to fling.
    trail.textContent = trailEmoji(ui.throwKind);
    setTrail(startX, startY, 0.85, 1);
    try { arena.setPointerCapture(e.pointerId); } catch { /* noop */ }
    e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    lastX = e.clientX;
    lastY = e.clientY;
    setTrail(lastX, lastY, 1, 1);
  };
  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    arena.classList.remove('is-active');
    trail.classList.remove('is-visible');
    try { arena.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const dx = lastX - startX;
    const dy = lastY - startY;
    const dt = Math.max(40, performance.now() - startT);
    // Treat short twitches and "tap and let go" as accidental — only fling
    // if the swipe traveled some real distance and was mostly upward.
    const dist = Math.hypot(dx, dy);
    if (dist < 36 || dy > -10) return;
    const now = performance.now();
    if (now < cooldownUntil) return;

    fireThrow(ui, { dx, dy, dt, arena });
  };

  arena.addEventListener('pointerdown', onDown);
  arena.addEventListener('pointermove', onMove);
  arena.addEventListener('pointerup', onUp);
  arena.addEventListener('pointercancel', onUp);
  // The arena owns these gestures; suppress browser-level scroll/zoom so a
  // strong upward swipe doesn't accidentally pull-to-refresh.
  arena.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  function fireThrow(
    u: PlayerUI,
    args: { dx: number; dy: number; dt: number; arena: HTMLElement },
  ): void {
    cooldownUntil = performance.now() + 400; // local soft-lock to avoid double-fires
    if (u.throwAmmo <= 0) {
      flashOutOfAmmo();
      return;
    }
    const r = args.arena.getBoundingClientRect();
    // Splat target on the host: project the swipe direction onto the host
    // viewport. We bias toward the upper half of the host screen so throws
    // feel "thrown at" the question, not the floor.
    const speed = Math.min(2, Math.hypot(args.dx, args.dy) / Math.max(1, args.dt) * 12);
    // Cosmetic fly-up on the phone so the player sees something happen even
    // if the network's slow.
    spawnLocalFly(args.arena, args.dx, args.dy);

    // Convert swipe vector to a normalized landing point on the host. The
    // x lands roughly where the player's swipe ended (relative to phone),
    // y biases upward proportional to swipe strength. Clamp to safe band.
    const localX = (args.dx + r.width / 2) / r.width; // ~ 0..1 from start point
    const x = clamp01(0.15 + 0.7 * Math.max(0, Math.min(1, localX)));
    const y = clamp01(0.30 + (1 - Math.min(1, speed)) * 0.4 + Math.random() * 0.05);
    // Pick the entry side opposite to the swipe horizontal component so the
    // projectile flies in from a sensible edge. Strong vertical-only swipes
    // come up from the bottom for that "lobbed it from the audience" feel.
    const originSide: 'left' | 'right' | 'bottom' | 'top' =
      Math.abs(args.dx) > 60
        ? (args.dx > 0 ? 'right' : 'left')
        : 'bottom';
    const vx = Math.max(-2, Math.min(2, args.dx / 200));
    const vy = Math.max(-2, Math.min(2, args.dy / 200));

    u.throwAmmo = Math.max(0, u.throwAmmo - 1);
    updateAmmoChip(u.throwAmmo);
    try { navigator.vibrate?.(14); } catch { /* noop */ }

    void emitAck(CLIENT_EVENTS.PlayerThrow, {
      sessionId: u.sessionId,
      questionIndex: u.currentIndex,
      kind: u.throwKind,
      x, y, vx, vy,
      originSide,
    }).then((res) => {
      const ack = res as { accepted: boolean; ammoLeft?: number; reason?: string } | undefined;
      if (!ack) return;
      if (typeof ack.ammoLeft === 'number') {
        u.throwAmmo = ack.ammoLeft;
        updateAmmoChip(u.throwAmmo);
      }
      if (!ack.accepted && ack.reason && ack.reason !== 'Cooling down.') {
        // Out-of-ammo is the only message worth surfacing; cooldown is
        // expected. Suppress noisy server lifecycle messages so a
        // mid-question reveal doesn't pop a toast.
        if (ack.reason === 'Out of ammo.') flashOutOfAmmo();
      }
    });
  }

  function flashOutOfAmmo(): void {
    const ammo = document.getElementById('throw-ammo');
    if (!ammo) return;
    ammo.classList.remove('is-empty-flash');
    void ammo.offsetWidth;
    ammo.classList.add('is-empty-flash');
  }
}

function updateAmmoChip(n: number): void {
  const num = document.getElementById('throw-ammo-num');
  if (num) num.textContent = String(n);
  const ammo = document.getElementById('throw-ammo');
  if (!ammo) return;
  ammo.classList.toggle('is-empty', n <= 0);
}

function trailEmoji(kind: ThrowKind): string {
  switch (kind) {
    case 'tomato':  return '🍅';
    case 'plane':   return '✈️';
    case 'pie':     return '🥧';
    case 'sparkle': return '✨';
  }
}

function spawnLocalFly(arena: HTMLElement, dx: number, dy: number): void {
  // Cosmetic only: a small sprite that flies off the top of the arena to
  // give the swipe a satisfying release frame. The host renders the real
  // splat from the broadcast.
  const sprite = document.createElement('div');
  sprite.className = 'player-throw-fly';
  sprite.textContent = trailEmoji(arenaKind());
  sprite.style.setProperty('--fly-dx', `${dx * 1.4}px`);
  sprite.style.setProperty('--fly-dy', `${Math.min(-100, dy * 1.4)}px`);
  arena.appendChild(sprite);
  window.setTimeout(() => sprite.remove(), 700);
}

function arenaKind(): ThrowKind {
  const active = document.querySelector<HTMLButtonElement>(
    '[data-throw-kind].is-active',
  );
  return (active?.dataset.throwKind as ThrowKind) ?? 'tomato';
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function startPlayerTimer(ui: PlayerUI): void {
  if (ui.rafHandle) cancelAnimationFrame(ui.rafHandle);
  const el = document.getElementById('p-timer');
  if (!el || !ui.deadline) return;
  const tick = (): void => {
    if (!ui.deadline) return;
    const rem = Math.max(0, ui.deadline - Date.now());
    el.textContent = ui.paused ? '❚❚' : String(Math.ceil(rem / 1000));
    if (rem > 0) ui.rafHandle = requestAnimationFrame(tick);
  };
  ui.rafHandle = requestAnimationFrame(tick);
  void QUESTION_DURATION_MS;
}

async function submitAnswer(ui: PlayerUI, choice: number): Promise<void> {
  ui.pickedChoice = choice;
  renderLockedIn(ui, choice);
  const ack = (await emitAck(CLIENT_EVENTS.PlayerAnswer, {
    sessionId: ui.sessionId,
    questionIndex: ui.currentIndex,
    choiceIndex: choice,
  })) as AnswerAck;
  if (!ack.accepted) {
    // Re-open tiles so they can tap another option (within grace)
    ui.pickedChoice = null;
    renderAnswerTiles(ui);
    toast(ack.reason ?? 'Could not submit.', 'error');
  }
}

function renderReveal(
  ui: PlayerUI,
  p: QuestionRevealPayload,
  me: PerPlayerReveal | null,
): void {
  if (!me) {
    return renderWaiting(ui, 'Watching…');
  }

  const correct = me.correct;
  const bg = correct ? 'bg-clutch-green' : 'bg-clutch-red';
  const heading = correct ? 'Correct' : 'Incorrect';
  const iconSvg = correct ? checkmarkSvg() : crossSvg();

  // "Tied with X, Y" — any OTHER player at the same rank counts as tied. We
  // intentionally use rank equality (not score) so ties that arise from late
  // answers during a grace period still read correctly.
  const tiedNames = p.perPlayer
    .filter((e) => e.name !== me.name && e.rank === me.rank)
    .map((e) => e.name);
  const tiedLine = tiedNames.length > 0
    ? `<div class="mt-1 text-white/90">Tied with ${escapeHtml(formatNameList(tiedNames))}</div>`
    : '';

  // Show "The correct answer was: <text>" only when the player missed it.
  // When correct, the big "+points" number carries the moment instead.
  const answerBlock = correct
    ? `<div class="mt-6 text-4xl font-bold text-white drop-shadow-sm">+${me.delta}</div>
       <div class="mt-1 text-sm uppercase tracking-widest text-white/80">points</div>`
    : `<div class="mt-6 text-lg text-white/90">The correct answer was:</div>
       <div class="mt-1 text-2xl font-bold text-white break-words px-6">${escapeHtml(p.correctText || 'See the big screen')}</div>`;

  ui.root.innerHTML = `
    <div class="h-full flex flex-col ${bg} text-white">
      ${renderPlayerHeader(ui)}
      <section class="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div class="reveal-icon-wrap">
          ${iconSvg}
        </div>
        <h1 class="mt-6 text-5xl font-bold italic font-elegant tracking-tight">${heading}</h1>
        ${answerBlock}
        <div class="mt-8 text-lg">You're now in <span class="font-bold">${formatOrdinal(me.rank)}</span> place.</div>
        ${tiedLine}
      </section>
      ${renderPlayerFooter(ui, me.newScore)}
    </div>
  `;
}

function renderPlayerHeader(ui: PlayerUI): string {
  return `
    <header class="flex items-center justify-between px-5 py-3 bg-white/95 text-clutch-ink">
      <div class="font-mono font-semibold tracking-wider text-sm sm:text-base">PIN: ${escapeHtml(ui.code)}</div>
      <div class="font-bold text-sm sm:text-base">Q${ui.currentIndex + 1}</div>
    </header>
  `;
}

function renderPlayerFooter(ui: PlayerUI, score: number): string {
  return `
    <footer class="flex items-center justify-between px-5 py-3 bg-white/95 text-clutch-ink">
      <div class="font-semibold truncate pr-3">${escapeHtml(ui.name)}</div>
      <div class="rounded-lg bg-clutch-ink text-white font-mono font-bold px-5 py-1.5 min-w-[72px] text-center">${score}</div>
    </footer>
  `;
}

function checkmarkSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="128" height="128" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  `;
}
function crossSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="128" height="128" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  `;
}

function formatOrdinal(n: number): string {
  // Returns "1st", "2nd", "3rd", "4th", ..., "20th"-style strings using a
  // rank number. Handles the 11/12/13 exception.
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function formatNameList(names: string[]): string {
  if (names.length === 1) return `${names[0]}!`;
  if (names.length === 2) return `${names[0]} and ${names[1]}!`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}!`;
}

function renderPlayerLeaderboard(ui: PlayerUI, p: LeaderboardPayload): void {
  const me = p.entries.find((e) => e.name === ui.name) ?? null;
  const myRank = me?.rank ?? null;
  const previousRank = ui.lastKnownRank;
  ui.lastKnownRank = myRank;

  // "Rose to #1" confetti: only fire when this player just took the lead, and
  // they weren't already there. The first leaderboard of the game has
  // previousRank=null, so the very first 1st-place still triggers — that's
  // the right moment for a celebration.
  const justTookFirst = myRank === 1 && previousRank !== 1;
  const heroTheme = me ? heroCardTheme(me.rank) : neutralHeroTheme();
  const isFirst = me?.rank === 1;

  const heroBlock = isFirst
    ? `
      <div class="relative">
        ${crownBigSvg()}
      </div>
      <div class="text-[0.72rem] uppercase tracking-[0.32em] opacity-80">After Q ${p.questionIndex + 1} / ${p.total}</div>
      <div class="mt-1 player-place-headline">1st Place!</div>
      <div class="mt-3 font-mono text-2xl font-extrabold tabular-nums">${me!.score} pts</div>
    `
    : `
      <div class="text-[0.72rem] uppercase tracking-[0.32em] opacity-80">After Q ${p.questionIndex + 1} / ${p.total}</div>
      <div class="mt-2 flex items-end gap-3">
        <div class="text-6xl font-extrabold leading-none tabular-nums">${me ? '#' + me.rank : '—'}</div>
        <div class="pb-1.5">${me ? heroBadgeIcon(me.rank) : ''}</div>
      </div>
      <div class="mt-1 text-base opacity-90">${me ? formatOrdinal(me.rank) + ' place' : 'Keep going'}</div>
      <div class="mt-1 font-mono text-2xl font-bold tabular-nums">${me ? me.score + ' pts' : ''}</div>
    `;

  ui.root.innerHTML = `
    <div class="h-full w-full flex flex-col bg-clutch-paper p-5 sm:p-6 overflow-x-hidden">
      <div class="hero-pop rounded-3xl ${heroTheme.bg} ${heroTheme.text} p-5 mb-5 shadow-md ${heroTheme.shadow} relative overflow-hidden">
        <div class="absolute -top-6 -right-6 opacity-10 pointer-events-none">${decorativeBurst()}</div>
        ${heroBlock}
      </div>

      <div class="flex-1 min-w-0 overflow-x-hidden overflow-y-auto space-y-2.5 pb-4">
        ${p.entries.map((e, idx) => playerLeaderboardRowHtml(e, idx, ui.name)).join('')}
      </div>
    </div>
  `;

  if (justTookFirst) {
    fireConfetti({ count: 110, duration: 2200 });
  }
}

function playerLeaderboardRowHtml(
  e: { rank: number; name: string; score: number },
  idx: number,
  myName: string,
): string {
  const isMe = e.name === myName;
  const t = playerRowTheme(e.rank, isMe);
  // Stagger the entrance more dramatically and let later rows cascade further
  // — feels like "the leaderboard is settling into place" rather than just
  // popping in. Use a custom animation for a subtle scale-from-side as well.
  const delayMs = Math.min(idx, 8) * 70;
  return `
    <div class="${t.container} player-board-row flex items-center gap-3 rounded-2xl px-3.5 py-3 min-w-0"
         style="animation-delay: ${delayMs}ms">
      <div class="flex-shrink-0 w-12 h-12 rounded-2xl flex flex-col items-center justify-center ${t.medalBg} ${t.medalText} relative">
        <div class="text-[0.55rem] font-bold tracking-[0.15em] uppercase opacity-80 -mb-0.5">#${e.rank}</div>
        <div class="text-base font-extrabold leading-none">${rankBadgeContentMobile(e.rank)}</div>
      </div>
      <div class="flex-1 min-w-0 flex items-center gap-2">
        <span class="font-semibold truncate min-w-0 ${t.nameText}">${escapeHtml(e.name)}</span>
        ${isMe ? `<span class="flex-shrink-0 text-[0.6rem] uppercase tracking-[0.18em] font-bold rounded-full px-2 py-0.5 ${t.youBadge}">You</span>` : ''}
      </div>
      <div class="flex-shrink-0 font-mono font-extrabold tabular-nums ${t.scoreText}">${e.score}</div>
    </div>
  `;
}

interface HeroTheme { bg: string; text: string; shadow: string }
function heroCardTheme(rank: number): HeroTheme {
  switch (rank) {
    case 1: return {
      bg: 'bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 border border-amber-300/60',
      text: 'text-clutch-ink',
      shadow: 'shadow-amber-500/30',
    };
    case 2: return {
      bg: 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400 border border-slate-200/60',
      text: 'text-clutch-ink',
      shadow: 'shadow-slate-400/30',
    };
    case 3: return {
      bg: 'bg-gradient-to-br from-orange-300 via-amber-600 to-amber-800 border border-amber-600/40',
      text: 'text-white',
      shadow: 'shadow-amber-700/30',
    };
    default: return neutralHeroTheme();
  }
}
function neutralHeroTheme(): HeroTheme {
  return {
    bg: 'bg-gradient-to-br from-clutch-ink to-black border border-black/10',
    text: 'text-white',
    shadow: 'shadow-black/20',
  };
}

interface PlayerRowTheme {
  container: string;
  medalBg: string;
  medalText: string;
  nameText: string;
  scoreText: string;
  youBadge: string;
}
function playerRowTheme(rank: number, isMe: boolean): PlayerRowTheme {
  const meRing = isMe ? ' ring-2 ring-clutch-ink ring-offset-2 ring-offset-clutch-paper' : '';
  switch (rank) {
    case 1: return {
      container: `bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 border border-amber-300/60 shadow-md shadow-amber-500/20${meRing}`,
      medalBg: 'bg-white/85',
      medalText: 'text-amber-700',
      nameText: 'text-clutch-ink',
      scoreText: 'text-clutch-ink',
      youBadge: 'bg-clutch-ink/85 text-amber-200',
    };
    case 2: return {
      container: `bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400 border border-slate-200/60 shadow-md shadow-slate-400/20${meRing}`,
      medalBg: 'bg-white/85',
      medalText: 'text-slate-600',
      nameText: 'text-clutch-ink',
      scoreText: 'text-clutch-ink',
      youBadge: 'bg-clutch-ink/85 text-slate-100',
    };
    case 3: return {
      container: `bg-gradient-to-br from-orange-300 via-amber-600 to-amber-800 border border-amber-600/40 shadow-md shadow-amber-700/20${meRing}`,
      medalBg: 'bg-white/85',
      medalText: 'text-amber-800',
      nameText: 'text-white',
      scoreText: 'text-white',
      youBadge: 'bg-white/90 text-amber-800',
    };
    default: return {
      container: `bg-white border border-black/5 shadow-sm${meRing}`,
      medalBg: 'bg-clutch-paper',
      medalText: 'text-clutch-mute',
      nameText: 'text-clutch-ink',
      scoreText: 'text-clutch-ink',
      youBadge: 'bg-clutch-ink text-white',
    };
  }
}

function rankBadgeContentMobile(rank: number): string {
  if (rank === 1) return crownSvgSmall();
  if (rank === 2 || rank === 3) return medalSvgSmall();
  // 4th+ — the #N label above is enough; show a small dot to keep the badge
  // visually balanced.
  return `<span class="opacity-50">·</span>`;
}

function heroBadgeIcon(rank: number): string {
  if (rank === 1) return `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/85 text-amber-700">${crownSvgSmall()}</span>`;
  if (rank === 2) return `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/85 text-slate-600">${medalSvgSmall()}</span>`;
  if (rank === 3) return `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/85 text-amber-800">${medalSvgSmall()}</span>`;
  return '';
}

function crownSvgSmall(): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 8l4 4 5-7 5 7 4-4-1.5 11h-15z"/></svg>`;
}
function crownBigSvg(): string {
  return `
    <div class="absolute -top-3 right-0 crown-bob">
      <svg viewBox="0 0 24 24" width="58" height="58" fill="currentColor" aria-hidden="true">
        <path d="M3 8l4 4 5-7 5 7 4-4-1.5 11h-15z"/>
      </svg>
    </div>
  `;
}
function medalSvgSmall(): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3l4 8 4-8"/><circle cx="12" cy="16" r="5" fill="currentColor" stroke="none"/></svg>`;
}
function decorativeBurst(): string {
  return `<svg viewBox="0 0 100 100" width="120" height="120" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <circle cx="50" cy="50" r="40"/>
    <circle cx="50" cy="50" r="30"/>
    <circle cx="50" cy="50" r="20"/>
  </svg>`;
}

function renderPlayerFinal(ui: PlayerUI, p: GameOverPayload): void {
  const me = p.final.find((e) => e.name === ui.name) ?? null;
  const t = me ? heroCardTheme(me.rank) : neutralHeroTheme();
  const isFirst = me?.rank === 1;
  const headline = isFirst
    ? '1st Place!'
    : me ? `${formatOrdinal(me.rank)} place` : 'Thanks for playing';

  // Front face = celebration. Back face = stats / streak / share.
  // Card is grab-rotatable: drag to spin, release to settle. Tap to flip.
  const corrects = me ? '—' : '—'; // payload doesn't carry per-player correct count yet
  void corrects;
  const front = `
    <div class="player-final-face player-final-front ${t.bg} ${t.text} ${t.shadow}">
      <div class="absolute -top-8 -right-8 opacity-15">${decorativeBurst()}</div>
      <div class="text-[0.65rem] uppercase tracking-[0.34em] opacity-80">Final</div>
      ${isFirst ? `<div class="player-final-crown">${crownStaticSvg()}</div>` : ''}
      <div class="player-final-rank">
        ${isFirst ? '' : `<span class="player-final-hash">#${me?.rank ?? '—'}</span>`}
      </div>
      <div class="player-final-headline ${isFirst ? 'player-final-headline-big' : ''}">${escapeHtml(headline)}</div>
      <div class="player-final-name">${escapeHtml(ui.name)}</div>
      <div class="player-final-score">${me ? me.score : 0}<span class="player-final-score-pts">pts</span></div>
      <div class="player-final-flip-hint">Tap card to flip · drag to rotate</div>
    </div>
  `;

  const top3 = p.final.slice(0, 3);
  const back = `
    <div class="player-final-face player-final-back">
      <div class="text-[0.65rem] uppercase tracking-[0.32em] opacity-70 mb-3">Top of the room</div>
      <div class="player-final-top3">
        ${top3.map((e) => `
          <div class="player-final-top3-row ${e.name === ui.name ? 'is-me' : ''}">
            <div class="player-final-top3-rank rank-${e.rank}">${e.rank}</div>
            <div class="player-final-top3-name">${escapeHtml(e.name)}</div>
            <div class="player-final-top3-score">${e.score}</div>
          </div>
        `).join('')}
      </div>
      ${me && me.rank > 3 ? `
        <div class="player-final-you-row">
          <div class="player-final-top3-rank rank-x">#${me.rank}</div>
          <div class="player-final-top3-name">${escapeHtml(ui.name)}</div>
          <div class="player-final-top3-score">${me.score}</div>
        </div>
      ` : ''}
      <div class="player-final-flip-hint">Tap to flip back</div>
    </div>
  `;

  ui.root.innerHTML = `
    <div class="player-final-shell">
      <div class="player-final-stage" id="final-stage">
        <div class="player-final-card" id="final-card">
          ${front}
          ${back}
        </div>
      </div>
      <div class="player-final-controls">
        <button id="final-rotate" class="player-final-cta-secondary">Spin</button>
        <a href="/" data-link class="player-final-cta">Done</a>
      </div>
    </div>
  `;

  wireFinalCardRotation(ui.root);

  // Celebrate first place with a fresh confetti burst when the final card mounts.
  if (isFirst) {
    fireConfetti({ count: 140, duration: 2400, originY: 0.4 });
    window.setTimeout(() => fireConfetti({ count: 60, duration: 1600, originX: 0.2, originY: 0.5 }), 400);
    window.setTimeout(() => fireConfetti({ count: 60, duration: 1600, originX: 0.8, originY: 0.5 }), 700);
  }
}

/**
 * Make the final card grab-rotatable. Drag horizontally to spin around Y;
 * vertical drag tilts on X. Releasing snaps back to the nearest face. Tapping
 * (no drag) flips to the opposite face.
 *
 * Pointer events normalize mouse + touch + pen, so we don't need to wire
 * touchstart/move/end separately. The :focus / hover handlers also kick a
 * subtle idle wobble so the card never reads as static.
 */
function wireFinalCardRotation(root: HTMLElement): void {
  const stage = root.querySelector<HTMLElement>('#final-stage');
  const card = root.querySelector<HTMLElement>('#final-card');
  const spinBtn = root.querySelector<HTMLButtonElement>('#final-rotate');
  if (!stage || !card) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseY = 0; // snapped angle around Y at drag start
  let baseX = 0; // snapped angle around X at drag start
  let curY = 0;
  let curX = 0;
  let pointerId: number | null = null;
  let movedDistance = 0;

  const apply = (rx: number, ry: number): void => {
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  };

  const snapToNearestFace = (): void => {
    // Nearest 180-multiple for Y so we settle on a face. Keep X gentle.
    const snappedY = Math.round(curY / 180) * 180;
    const snappedX = 0;
    curY = snappedY;
    curX = snappedX;
    card.classList.add('is-snapping');
    apply(snappedX, snappedY);
    window.setTimeout(() => card.classList.remove('is-snapping'), 500);
  };

  const onDown = (e: PointerEvent): void => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    dragging = true;
    movedDistance = 0;
    startX = e.clientX;
    startY = e.clientY;
    baseY = curY;
    baseX = curX;
    card.classList.add('is-grabbing');
    card.classList.remove('is-snapping');
    try { stage.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    movedDistance = Math.max(movedDistance, Math.abs(dx) + Math.abs(dy));
    // Y-rotation tracks horizontal drag; X-rotation tracks vertical (clamped).
    curY = baseY + dx * 0.6;
    curX = Math.max(-30, Math.min(30, baseX - dy * 0.4));
    apply(curX, curY);
  };
  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    dragging = false;
    card.classList.remove('is-grabbing');
    try { stage.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    // Treat low-motion drags as taps → flip the card.
    if (movedDistance < 6) {
      curY = curY + 180;
      curX = 0;
      card.classList.add('is-snapping');
      apply(curX, curY);
      window.setTimeout(() => card.classList.remove('is-snapping'), 600);
      return;
    }
    snapToNearestFace();
  };

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);

  if (spinBtn) {
    // Track recent presses so spam-clicking the spin button rewards the
    // player with hidden confetti bursts. The threshold/window are tuned so
    // a normal user (one click) sees nothing surprising, but someone really
    // mashing the button gets a celebratory payoff after ~3 quick taps.
    const recentClicks: number[] = [];
    const SPAM_WINDOW_MS = 1600;
    const SPAM_THRESHOLD = 3;
    let escalation = 0;

    spinBtn.addEventListener('click', () => {
      // 180deg flips to the OTHER face. Previously this was 360, which
      // visibly spun a full turn but landed on the same face as before —
      // exactly what we don't want from a "Spin" button.
      curY += 180;
      curX = 0;
      card.classList.add('is-snapping');
      apply(curX, curY);
      window.setTimeout(() => card.classList.remove('is-snapping'), 700);

      // Hidden easter egg: rapid-fire clicks fire confetti, escalating in
      // intensity each consecutive burst. Resets when the player slows down.
      const now = Date.now();
      recentClicks.push(now);
      while (recentClicks.length > 0 && recentClicks[0]! < now - SPAM_WINDOW_MS) {
        recentClicks.shift();
      }
      if (recentClicks.length >= SPAM_THRESHOLD) {
        escalation = Math.min(escalation + 1, 4);
        const count = 60 + escalation * 30;
        const spread = 0.8 + escalation * 0.1;
        fireConfetti({ count, duration: 1600 + escalation * 200, spread, originY: 0.45 });
        recentClicks.length = 0;
      } else if (recentClicks.length === 0) {
        escalation = 0;
      }
    });
  }
}

function crownStaticSvg(): string {
  return `<svg viewBox="0 0 24 24" width="62" height="62" fill="currentColor" aria-hidden="true"><path d="M3 8l4 4 5-7 5 7 4-4-1.5 11h-15z"/></svg>`;
}

// Full-screen "3, 2, 1, GO!" overlay rendered when the host hits Start.
// Drives off the server-supplied deadline so every phone counts to the same
// second regardless of clock drift; cleans itself up either when the deadline
// passes or when QuestionStart kicks in (whichever is sooner).
function showStartCountdown(p: { deadline: number; durationMs: number }): void {
  // De-dupe: a flaky reconnect could replay the event. Replace any existing
  // overlay rather than stacking them.
  document.querySelectorAll('.player-start-countdown-layer').forEach((el) => el.remove());

  const layer = document.createElement('div');
  layer.className = 'player-start-countdown-layer';
  layer.innerHTML = `
    <div class="player-start-countdown-card">
      <div class="player-start-countdown-eyebrow">Get ready</div>
      <div class="player-start-countdown-num" data-role="num">3</div>
      <div class="player-start-countdown-dots">
        <span class="player-start-countdown-dot" data-i="0"></span>
        <span class="player-start-countdown-dot" data-i="1"></span>
        <span class="player-start-countdown-dot" data-i="2"></span>
      </div>
    </div>
  `;
  document.body.appendChild(layer);
  void layer.offsetWidth;
  layer.classList.add('is-open');

  const numEl = layer.querySelector<HTMLElement>('[data-role="num"]')!;
  const dots = Array.from(layer.querySelectorAll<HTMLElement>('.player-start-countdown-dot'));

  let lastShown: string | null = null;
  const cleanup = (): void => {
    layer.classList.add('is-leaving');
    window.setTimeout(() => layer.remove(), 220);
  };

  const tick = (): void => {
    const remaining = p.deadline - Date.now();
    if (remaining <= 0) {
      // GO! flash, then bow out so the question screen can paint over.
      if (lastShown !== 'GO') {
        lastShown = 'GO';
        numEl.textContent = 'GO!';
        numEl.classList.add('is-go');
        dots.forEach((d) => d.classList.add('is-lit'));
        // Overlay self-clears shortly after; QuestionStart will also remove
        // any straggler when it paints the answer tiles.
        window.setTimeout(cleanup, 350);
      }
      return;
    }
    // Render whole-second buckets (3, 2, 1). Use ceil so 2999ms still reads
    // as "3" and the last frame before zero shows "1".
    const n = Math.max(1, Math.min(Math.ceil(remaining / 1000), Math.ceil(p.durationMs / 1000) - 1));
    const label = String(n);
    if (lastShown !== label) {
      lastShown = label;
      numEl.textContent = label;
      // Restart the pop animation by toggling the class.
      numEl.classList.remove('is-pop');
      void numEl.offsetWidth;
      numEl.classList.add('is-pop');
      // Light the corresponding dot (3→idx0, 2→idx1, 1→idx2).
      const litCount = Math.max(0, Math.ceil(p.durationMs / 1000) - 1 - n + 1);
      dots.forEach((d, i) => d.classList.toggle('is-lit', i < litCount));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Hard ceiling: in case `requestAnimationFrame` is stalled (tab background)
  // and QuestionStart never fires, force-cleanup after 1.5x the duration.
  window.setTimeout(() => {
    if (document.body.contains(layer)) cleanup();
  }, Math.max(1500, p.durationMs * 1.5));
}

function renderWaiting(ui: PlayerUI, msg: string): void {
  ui.root.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center bg-clutch-paper p-8 text-center">
      <div id="wordmark" class="mb-8"></div>
      <div class="text-xl text-clutch-mute">${escapeHtml(msg)}</div>
      <div class="text-xs text-clutch-mute mt-10">You are ${escapeHtml(ui.name)} · ${formatCode(ui.code)}</div>
    </div>
  `;
  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-5xl' });
}

function writeCached(v: { code: string; name: string }): void {
  try { sessionStorage.setItem('clutch:player', JSON.stringify(v)); } catch { /* noop */ }
}
function clearCached(): void {
  try { sessionStorage.removeItem('clutch:player'); } catch { /* noop */ }
}

// Conditionally self-heal after a QR-scan landing: only reload if the CSS
// bundle visibly didn't apply. We detect this by checking a Tailwind class
// we know the page uses — `bg-clutch-paper` on <body>. If computed styles
// show the default white background, the stylesheet never took and a hard
// reload recovers. Otherwise we no-op, so the common case pays zero latency.
function scheduleQrSelfHealReload(): void {
  const flagKey = `clutch:qr-heal:${window.location.pathname}`;
  try {
    if (sessionStorage.getItem(flagKey) === '1') return;
  } catch {
    return;
  }

  const check = (): void => {
    // clutch-paper is #FAFAF7. If the body shows that, CSS applied — done.
    // If it shows white (or an unset default), the stylesheet failed and a
    // reload is warranted.
    const bg = getComputedStyle(document.body).backgroundColor;
    const cssApplied = /250,\s*250,\s*247/.test(bg) || /rgb\(250,\s*250,\s*247\)/.test(bg);
    if (cssApplied) return;

    try { sessionStorage.setItem(flagKey, '1'); } catch { return; }
    window.location.reload();
  };

  if (document.readyState === 'complete') {
    requestAnimationFrame(() => requestAnimationFrame(check));
  } else {
    window.addEventListener('load', () => {
      requestAnimationFrame(() => requestAnimationFrame(check));
    }, { once: true });
  }
}

function formatCode(code: string): string {
  if (code.length <= 4) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}
