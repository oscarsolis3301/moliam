import type { Router } from '../lib/router.js';
import { emitAck, getSocket } from '../lib/socket.js';
import { CLUTCH_API_BASE, listQuizzes } from '../lib/api.js';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@shared/events.js';
import type {
  AnsweredCountPayload,
  CreateSessionAck,
  GameOverPayload,
  LeaderboardEntry,
  LeaderboardPayload,
  PausedPayload,
  ProjectileThrownPayload,
  PublicPlayer,
  QuestionRevealPayload,
  QuestionStartHostPayload,
  QuizSummary,
  ResumedPayload,
  RosterUpdatePayload,
  SimpleErrAck,
  StateUpdatePayload,
} from '@shared/schemas.js';
import { QUESTION_DURATION_MS, TILE_DEFS } from '@shared/constants.js';
import { shapeSvg } from '../components/shapes.js';
import { mountWordmark } from '../components/wordmark.js';
import type { VoxelLobbyHandle } from '../components/voxelLobby.js';
import { confirmModal, toast } from '../components/modal.js';
import { fireConfetti } from '../components/confetti.js';
import { getAudio } from '../lib/audio.js';

// A small "← Home" pill that matches the host-screen control row (Skip/Pause/End).
// Mid-game we confirm before leaving, since walking away does NOT end the
// session — the server keeps running the game until the host clicks End.
//
// In-game we no longer surface a separate Home button: the Clutch wordmark
// becomes the entry point. The pill only renders on the lobby (pre-game) and
// the dead-session screens — i.e. when leaving costs nothing or the game is
// already over.
function homeButtonHtml(opts: { variant?: 'header' | 'inline' } = {}): string {
  const variant = opts.variant ?? 'header';
  const cls =
    variant === 'header'
      ? 'rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5 text-clutch-mute hover:text-clutch-ink transition-colors flex items-center gap-1.5'
      : 'rounded-2xl border border-black/10 px-5 py-3 text-clutch-mute hover:bg-black/5 hover:text-clutch-ink transition-colors flex items-center gap-1.5';
  return `
    <button id="home-btn" type="button" class="${cls}" aria-label="Back to home">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 11.5L12 4l9 7.5"/>
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>
      </svg>
      <span>Home</span>
    </button>
  `;
}

function wireHomeButton(router: Router, midGame: boolean): void {
  const btn = document.getElementById('home-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (midGame) {
      const ok = await confirmModal({
        title: 'Leave the game?',
        message: 'The session will keep running on this device. Players will stay connected. You can come back from the home screen.',
        confirmText: 'Leave',
        cancelText: 'Stay',
      });
      if (!ok) return;
    }
    router.navigate('/');
  });
}

// ----- In-game header: clickable wordmark that opens a top-10 intermission. -----
//
// During the game we hide the Home button and instead make the Clutch
// wordmark double as the "peek standings" affordance. Tapping it animates a
// sheet down from the top with the current top 10 — useful for the host to
// quickly remind the room where everyone is without leaving the question
// screen. Pressing again (or tapping outside) closes it.
function gameHeaderHtml(opts: { rightSlotHtml?: string } = {}): string {
  const right = opts.rightSlotHtml ?? '';
  return `
    <div class="flex items-center gap-3 cursor-pointer select-none" role="button" tabindex="0"
         id="wordmark-trigger" aria-label="Show standings">
      <div id="wordmark"></div>
      <span class="hidden sm:inline-flex items-center gap-1 text-xs text-clutch-mute uppercase tracking-[0.2em]">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        Standings
      </span>
    </div>
    ${right}
  `;
}

function wireGameHeader(ui: HostUI): void {
  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-3xl' });
  const trigger = document.getElementById('wordmark-trigger');
  if (!trigger) return;
  const open = (): void => openIntermission(ui);
  trigger.addEventListener('click', open);
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
}

let intermissionOpen = false;
function openIntermission(ui: HostUI): void {
  if (intermissionOpen) return;
  intermissionOpen = true;
  const top10 = [...ui.roster]
    .map((p, i) => ({ name: p.name, score: p.score, rank: i + 1 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: i + 1 }))
    .slice(0, 10);

  const layer = document.createElement('div');
  layer.className = 'host-intermission-layer';
  layer.innerHTML = `
    <div class="host-intermission-backdrop"></div>
    <div class="host-intermission-sheet" role="dialog" aria-label="Current standings">
      <div class="host-intermission-head">
        <div>
          <div class="text-xs uppercase tracking-[0.22em] text-clutch-mute">Live standings</div>
          <div class="text-2xl font-semibold tracking-tight">Top ${top10.length || 10}</div>
        </div>
        <button type="button" class="host-intermission-close" aria-label="Close standings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
        </button>
      </div>
      <div class="host-intermission-list">
        ${top10.length === 0
          ? '<div class="text-clutch-mute py-12 text-center">No players yet.</div>'
          : top10.map((e, i) => intermissionRowHtml(e, i)).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(layer);
  // Reflow before adding the open class so the CSS transition runs.
  void layer.offsetWidth;
  layer.classList.add('is-open');

  const close = (): void => {
    if (!intermissionOpen) return;
    intermissionOpen = false;
    layer.classList.remove('is-open');
    layer.classList.add('is-closing');
    document.removeEventListener('keydown', onKey);
    window.setTimeout(() => layer.remove(), 240);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  layer.querySelector('.host-intermission-close')!.addEventListener('click', close);
  layer.querySelector('.host-intermission-backdrop')!.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

function intermissionRowHtml(
  e: { rank: number; name: string; score: number },
  idx: number,
): string {
  const t = rankTheme(e.rank);
  return `
    <div class="host-intermission-row ${t.bg} ${t.text}" style="animation-delay:${Math.min(idx, 9) * 40}ms">
      <div class="host-intermission-rank ${t.medalBg} ${t.medalText}">
        <div class="host-intermission-rank-num">#${e.rank}</div>
        ${e.rank <= 3 ? `<div class="host-intermission-rank-icon">${rankBadgeContent(e.rank)}</div>` : ''}
      </div>
      <div class="host-intermission-name">${escapeHtml(e.name)}</div>
      <div class="host-intermission-score">${e.score}</div>
    </div>
  `;
}

// ----- In-game control rail (top right) -----
//
// Renders the action cluster shown at the top right of the leaderboard / final
// screens. We keep them tight so the player names dominate visually.
function controlRailHtml(opts: {
  showNext?: { label: string };
  showRotate?: boolean;
  showHome?: boolean;
  showResults?: boolean;
  // When defined, renders an "Auto · 30s" toggle pill before the Next button.
  // The boolean reflects the current pref (on = countdown active).
  showAutoAdvance?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.showResults) {
    parts.push(`
      <button data-rail="results" class="host-rail-btn host-rail-btn-ghost" title="View full results">
        ${railIconResults()}<span>Results</span>
      </button>
    `);
  }
  if (opts.showRotate) {
    parts.push(`
      <button data-rail="rotate" class="host-rail-btn host-rail-btn-ghost" title="Start a new session with the same players">
        ${railIconRotate()}<span>New game</span>
      </button>
    `);
  }
  if (opts.showHome) {
    parts.push(`
      <button data-rail="home" class="host-rail-btn host-rail-btn-ghost" title="Back to home">
        ${railIconHome()}<span class="hidden md:inline">Home</span>
      </button>
    `);
  }
  if (typeof opts.showAutoAdvance === 'boolean') {
    const on = opts.showAutoAdvance;
    parts.push(`
      <button data-rail="auto-advance" class="host-rail-btn host-rail-toggle ${on ? 'is-on' : ''}"
        type="button"
        aria-pressed="${on}"
        title="Auto-play next question after 30 seconds">
        <span class="host-rail-toggle-track"><span class="host-rail-toggle-thumb"></span></span>
        <span class="host-rail-toggle-label">Auto · 30s</span>
      </button>
    `);
  }
  if (opts.showNext) {
    parts.push(`
      <span data-rail="auto-num" class="host-rail-auto-num" aria-live="polite" hidden></span>
      <button data-rail="next" class="host-rail-btn host-rail-next" type="button">
        <span class="host-rail-next-fill" aria-hidden="true"></span>
        <span class="host-rail-next-label">${escapeHtml(opts.showNext.label)}</span>
        <span class="host-rail-next-arrow" aria-hidden="true">→</span>
      </button>
    `);
  }
  return `<div class="host-rail">${parts.join('')}</div>`;
}

function wireControlRail(ui: HostUI, opts: { onRotate?: () => void; onResults?: () => void } = {}): void {
  document.querySelector<HTMLButtonElement>('[data-rail="home"]')?.addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'Back to home?',
      message: 'Players will stay on this game until you start a new one.',
      confirmText: 'Go home',
      cancelText: 'Stay',
    });
    if (ok) ui.router.navigate('/');
  });
  document.querySelector<HTMLButtonElement>('[data-rail="next"]')?.addEventListener('click', () => {
    cancelAutoAdvance(ui);
    void hostAct(ui, CLIENT_EVENTS.HostNext);
  });
  document.querySelector<HTMLButtonElement>('[data-rail="rotate"]')?.addEventListener('click', () => {
    if (opts.onRotate) opts.onRotate();
  });
  document.querySelector<HTMLButtonElement>('[data-rail="results"]')?.addEventListener('click', () => {
    if (opts.onResults) opts.onResults();
  });
  document.querySelector<HTMLButtonElement>('[data-rail="auto-advance"]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    ui.autoAdvance = !ui.autoAdvance;
    saveAutoAdvancePref(ui.autoAdvance);
    btn.classList.toggle('is-on', ui.autoAdvance);
    btn.setAttribute('aria-pressed', String(ui.autoAdvance));
    if (ui.autoAdvance) {
      startAutoAdvance(ui);
    } else {
      cancelAutoAdvance(ui);
    }
  });
}

function cancelAutoAdvance(ui: HostUI): void {
  if (ui.autoAdvanceTimer != null) {
    window.clearInterval(ui.autoAdvanceTimer);
    ui.autoAdvanceTimer = null;
  }
  const next = document.querySelector<HTMLButtonElement>('[data-rail="next"]');
  if (next) {
    next.classList.remove('is-counting');
    next.removeAttribute('data-state');
    next.style.removeProperty('--auto-progress');
  }
  const num = document.querySelector<HTMLElement>('[data-rail="auto-num"]');
  if (num) {
    num.hidden = true;
    num.textContent = '';
    num.removeAttribute('data-state');
  }
}

function startAutoAdvance(ui: HostUI): void {
  cancelAutoAdvance(ui);
  const next = document.querySelector<HTMLButtonElement>('[data-rail="next"]');
  const num = document.querySelector<HTMLElement>('[data-rail="auto-num"]');
  if (!next) return;
  const startedAt = Date.now();
  const totalMs = AUTO_ADVANCE_SECONDS * 1000;
  next.classList.add('is-counting');
  next.style.setProperty('--auto-progress', '0');
  next.dataset.state = 'ok';
  if (num) {
    num.hidden = false;
    num.textContent = String(AUTO_ADVANCE_SECONDS);
    num.dataset.state = 'ok';
  }

  // Re-renders mid-question would invalidate the DOM node; we always check
  // that the node we started on is still in the document before updating.
  ui.autoAdvanceTimer = window.setInterval(() => {
    if (!document.body.contains(next)) {
      cancelAutoAdvance(ui);
      return;
    }
    const elapsed = Date.now() - startedAt;
    const pct = Math.min(1, elapsed / totalMs);
    const remaining = Math.max(0, totalMs - elapsed);
    const secondsLeft = Math.ceil(remaining / 1000);
    next.style.setProperty('--auto-progress', String(pct));
    // Tier the visual urgency to the remaining time so the button reads as
    // "running out" without yelling about it from the start.
    const state = secondsLeft <= 5 ? 'danger' : secondsLeft <= 12 ? 'warn' : 'ok';
    if (next.dataset.state !== state) next.dataset.state = state;
    if (num) {
      num.textContent = String(secondsLeft);
      if (num.dataset.state !== state) num.dataset.state = state;
    }
    if (elapsed >= totalMs) {
      cancelAutoAdvance(ui);
      void hostAct(ui, CLIENT_EVENTS.HostNext);
    }
  }, 100) as unknown as number;
}

function railIconHome(): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`;
}
function railIconRotate(): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`;
}
function railIconResults(): string {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V8"/><path d="M9 19v-6"/><path d="M14 19v-9"/><path d="M19 19V5"/><path d="M3 19h18"/></svg>`;
}

interface HostUI {
  root: HTMLElement;
  router: Router;
  sessionId: string;
  code: string;
  publicHostUrl: string;
  totalQuestions: number;
  currentIndex: number;
  state: StateUpdatePayload['state'];
  roster: PublicPlayer[];
  lastQuestion: QuestionStartHostPayload | null;
  deadline: number | null;
  voxelHandle: VoxelLobbyHandle | null;
  paused: boolean;
  answered: AnsweredCountPayload;
  rafHandle: number | null;
  qrDataUrl: string | null;
  // Mid-game auto-advance: after the per-question leaderboard appears, start
  // a 30s countdown that automatically clicks "Next question". Toggle is
  // persisted to localStorage so the host's preference survives reloads.
  autoAdvance: boolean;
  autoAdvanceTimer: number | null;
}

const AUTO_ADVANCE_KEY = 'clutch:host:autoAdvance';
const AUTO_ADVANCE_SECONDS = 30;
function loadAutoAdvancePref(): boolean {
  try {
    const raw = window.localStorage.getItem(AUTO_ADVANCE_KEY);
    return raw == null ? true : raw === '1';
  } catch { return true; }
}
function saveAutoAdvancePref(on: boolean): void {
  try { window.localStorage.setItem(AUTO_ADVANCE_KEY, on ? '1' : '0'); } catch { /* noop */ }
}

export async function renderHostConsole(
  app: HTMLElement,
  router: Router,
  sessionId: string,
): Promise<void> {
  app.innerHTML = `<div class="h-full flex items-center justify-center text-clutch-mute">Connecting…</div>`;

  const s = getSocket();
  if (!s.connected) await new Promise<void>((r) => s.once('connect', () => r()));

  const joinAck = await emitAck<{
    ok: boolean;
    reason?: string;
    publicHostUrl?: string;
    state?: StateUpdatePayload['state'];
  }>(
    CLIENT_EVENTS.HostJoinRoom,
    { sessionId },
  );
  if (!joinAck.ok) {
    renderSessionGone(app, joinAck.reason);
    return;
  }
  // The server echoes the authoritative session state. If the host tab is
  // stale (session already ended, or the browser restored a tab from a prior
  // completed game), route to the correct view instead of rendering a fresh
  // lobby whose Start button will be silently refused.
  if (joinAck.state === 'ended' || joinAck.state === 'final') {
    renderSessionFinished(app, sessionId);
    return;
  }

  const code = sessionStorage.getItem(`clutch:host:${sessionId}:code`) ?? (await lookupCode(sessionId));
  const publicHostUrl =
    joinAck.publicHostUrl
    ?? sessionStorage.getItem(`clutch:host:${sessionId}:publicHostUrl`)
    ?? window.location.origin;
  sessionStorage.setItem(`clutch:host:${sessionId}:publicHostUrl`, publicHostUrl);

  const ui: HostUI = {
    root: app,
    router,
    sessionId,
    code: code ?? '??????',
    publicHostUrl,
    totalQuestions: 0,
    currentIndex: 0,
    state: 'lobby',
    roster: [],
    lastQuestion: null,
    deadline: null,
    paused: false,
    answered: { count: 0, total: 0 },
    rafHandle: null,
    qrDataUrl: null,
    voxelHandle: null,
    autoAdvance: loadAutoAdvancePref(),
    autoAdvanceTimer: null,
  };

  if (code) sessionStorage.setItem(`clutch:host:${sessionId}:code`, code);

  // Pre-render QR using the LAN-reachable URL
  ui.qrDataUrl = await buildQr(joinUrlFor(ui, ui.code));
  renderHost(ui);

  // If the socket reconnects (server restart, network blip, laptop wake), the
  // engine has no record of this host being in the session room. Re-run
  // HostJoinRoom so the engine re-registers us. If the session is gone from
  // the engine (e.g. server was restarted), show the dead-session screen so
  // the host can start a fresh game instead of clicking Start into a void.
  s.on('connect', () => {
    void emitAck<{ ok: boolean; reason?: string; state?: StateUpdatePayload['state'] }>(
      CLIENT_EVENTS.HostJoinRoom,
      { sessionId },
    ).then((ack) => {
      if (!ack.ok) { renderSessionGone(app, ack.reason); return; }
      if (ack.state === 'ended' || ack.state === 'final') renderSessionFinished(app, sessionId);
    });
  });

  const off: Array<() => void> = [];
  const on = <T = unknown>(evt: string, fn: (p: T) => void): void => {
    const handler = (p: T): void => fn(p);
    s.on(evt, handler as (p: unknown) => void);
    off.push(() => s.off(evt, handler as (p: unknown) => void));
  };

  // State-update is an informational signal — it syncs stored state fields but
  // does NOT re-paint. The dedicated events below (question_start_host,
  // question_reveal, leaderboard, game_over) are authoritative for rendering.
  // Exception: lobby is rendered here because there is no dedicated "entered
  // lobby" event (the initial lobby render happens on first roster_update).
  on<StateUpdatePayload>(SERVER_EVENTS.StateUpdate, (p) => {
    const prev = ui.state;
    ui.state = p.state;
    ui.currentIndex = p.currentQuestionIndex;
    ui.totalQuestions = p.totalQuestions;
    if (p.state === 'lobby' && prev !== 'lobby') renderLobby(ui);
  });
  on<RosterUpdatePayload>(SERVER_EVENTS.RosterUpdate, (p) => {
    ui.roster = p.players;
    // In the lobby, patch the roster in-place to avoid tearing down the voxel
    // scene on every join. In other states, a roster update shouldn't repaint.
    if (ui.state === 'lobby') updateLobbyRoster(ui);
  });
  on<QuestionStartHostPayload>(SERVER_EVENTS.QuestionStartHost, (p) => {
    ui.state = 'question';
    ui.lastQuestion = p;
    ui.currentIndex = p.index;
    ui.deadline = p.deadline;
    ui.paused = false;
    ui.answered = { count: 0, total: ui.roster.length };
    cancelAutoAdvance(ui);
    // Leaving the lobby — release the voxel scene and silence the lobby pad.
    ui.voxelHandle?.dispose();
    ui.voxelHandle = null;
    getAudio().stopLobbyMusic();
    // Cute in-game loop only plays while a question is on the screen — paint
    // first, then start the music so the audio context resumes against a
    // user-visible state change.
    getAudio().startGameMusic();
    renderQuestion(ui);
  });
  on<ProjectileThrownPayload>(SERVER_EVENTS.ProjectileThrown, (p) => {
    if (ui.state !== 'question') return;
    spawnProjectile(p);
  });
  on<AnsweredCountPayload>(SERVER_EVENTS.AnsweredCount, (p) => {
    const isNewSubmission = p.lastAnsweredName != null && p.count > ui.answered.count;
    ui.answered = p;
    // Surface a transient toast on the host so they can feel the room
    // responding in real time. Skip on a roster of one since the host is
    // also the only player and the toast would be noise.
    if (p.lastAnsweredName && (p.total ?? 0) > 1) {
      toast(`${p.lastAnsweredName} answered`, 'info');
    }
    // Cute "pop" cue on each new submission — pairs with the toast so the
    // host can feel the room respond without staring at the screen.
    if (isNewSubmission) getAudio().answerSubmitted();
    updateAnsweredBar(ui);
  });
  on<QuestionRevealPayload>(SERVER_EVENTS.QuestionReveal, (p) => {
    ui.state = 'reveal';
    // Music + rush mode are only for the active question. Cut both as soon
    // as we transition out so the reveal screen sits in clean silence.
    getAudio().setGameMusicRush(0);
    getAudio().stopGameMusic();
    clearProjectiles();
    renderReveal(ui, p);
  });
  on<LeaderboardPayload>(SERVER_EVENTS.Leaderboard, (p) => {
    ui.state = 'leaderboard';
    renderLeaderboard(ui, p);
  });
  on<PausedPayload>(SERVER_EVENTS.Paused, () => {
    ui.paused = true;
    if (ui.state === 'question') renderQuestion(ui);
  });
  on<ResumedPayload>(SERVER_EVENTS.Resumed, (p) => {
    ui.paused = false;
    ui.deadline = p.newDeadline;
    if (ui.state === 'question') renderQuestion(ui);
  });
  on<GameOverPayload>(SERVER_EVENTS.GameOver, (p) => {
    ui.state = 'final';
    getAudio().setGameMusicRush(0);
    getAudio().stopGameMusic();
    clearProjectiles();
    renderPodium(ui, p);
  });

  window.addEventListener('beforeunload', () => {
    for (const fn of off) fn();
    if (ui.rafHandle) cancelAnimationFrame(ui.rafHandle);
    ui.voxelHandle?.dispose();
    ui.voxelHandle = null;
    getAudio().stopLobbyMusic();
    getAudio().stopGameMusic();
    clearProjectiles();
  });
}

async function lookupCode(sessionId: string): Promise<string | null> {
  try {
    const res = await fetch(`${CLUTCH_API_BASE}/sessions/by-id/${sessionId}`);
    const json = await res.json();
    if (json?.ok && typeof json.code === 'string') return json.code;
    return null;
  } catch { return null; }
}

function joinUrlFor(ui: HostUI, code: string): string {
  return `${ui.publicHostUrl}/play/${code}`;
}

async function buildQr(text: string): Promise<string> {
  const QR = await import('qrcode');
  // margin: 4 is the QR spec's required quiet-zone width. Phone scanners will
  // refuse to lock onto a QR with a tighter margin, especially under glare or
  // at an angle — the #1 cause of "nothing happens when I scan this".
  return QR.toDataURL(text, {
    margin: 4,
    width: 560,
    errorCorrectionLevel: 'M',
    color: { dark: '#0F0F14', light: '#FAFAF7' },
  });
}

function renderHost(ui: HostUI): void {
  switch (ui.state) {
    case 'lobby':
      return renderLobby(ui);
    case 'question':
      return renderQuestion(ui);
    case 'reveal':
    case 'leaderboard':
      // These are rendered by their own event handlers; on a refresh mid-state
      // we fall back to a minimal waiting view.
      return renderWaiting(ui, ui.state === 'reveal' ? 'Showing reveal…' : 'Showing leaderboard…');
    case 'final':
    case 'ended':
      return renderWaiting(ui, 'Game over.');
  }
}

function renderLobby(ui: HostUI): void {
  const joinHref = joinUrlFor(ui, ui.code);
  const audio = getAudio();

  ui.root.innerHTML = `
    <div class="host-lobby-shell">
      <div class="host-lobby-bg-orb host-lobby-bg-orb-1" aria-hidden="true"></div>
      <div class="host-lobby-bg-orb host-lobby-bg-orb-2" aria-hidden="true"></div>

      <header class="host-lobby-header">
        <div class="host-lobby-header-left">
          ${homeButtonHtml()}
          <div class="host-lobby-quiz">
            <span class="host-lobby-headline">Now hosting</span>
            <span class="host-lobby-quiz-name" data-role="quiz-name">Loading quiz…</span>
          </div>
        </div>
        <div class="host-lobby-actions">
          <div id="wordmark" class="hidden md:block mr-1"></div>
          <button id="audio-toggle" type="button" class="host-lobby-icon-btn"
            aria-pressed="${audio.isMuted() ? 'false' : 'true'}"
            data-on="${audio.isMuted() ? 'false' : 'true'}"
            title="${audio.isMuted() ? 'Unmute lobby music & sound effects' : 'Mute lobby music & sound effects'}">
            ${audioIconSvg(audio.isMuted())}
          </button>
          <button id="fullscreen-toggle" type="button" class="host-lobby-icon-btn"
            title="Toggle fullscreen for big-screen mode">
            ${fullscreenIconSvg()}
          </button>
        </div>
      </header>

      <main class="host-lobby-main">
        <section class="host-lobby-hero">
          <div class="host-lobby-card host-lobby-card-code" aria-label="Game code">
            <div class="host-lobby-code-group">
              <div class="host-lobby-eyebrow">Game code</div>
              <div class="host-lobby-code" data-role="code">${escapeHtml(formatCode(ui.code))}</div>
              <div class="host-lobby-code-hint">Type it in. No dashes, no spaces.</div>
            </div>

            <div class="host-lobby-url-row">
              <span class="host-lobby-url-prefix">clutch ↗</span>
              <span class="host-lobby-url-text" data-role="join-url">${escapeHtml(joinHref)}</span>
              <button id="copy-link" type="button" class="host-lobby-url-copy" title="Copy join link">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2"/>
                  <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
                </svg>
                <span data-role="copy-label">Copy</span>
              </button>
            </div>
          </div>

          <div class="host-lobby-card host-lobby-card-qr" aria-label="Scan to join">
            <div class="host-lobby-qr-group">
              <div class="host-lobby-eyebrow">Scan to join</div>
              <div class="host-lobby-qr-frame">
                <div id="qr-mount"></div>
              </div>
              <div class="host-lobby-qr-hint">Point your camera. Tap the link that appears.</div>
            </div>
          </div>
        </section>

        <section class="host-lobby-card host-lobby-roster-card" aria-label="Players in the room">
          <header class="host-lobby-roster-head">
            <div class="host-lobby-roster-head-left">
              <span class="host-lobby-roster-pulse" aria-hidden="true"></span>
              <h2 class="host-lobby-roster-title">Players</h2>
              <span class="host-lobby-roster-counter" data-role="roster-counter">${formatRosterCounter(ui.roster.length)}</span>
            </div>
            <div class="host-lobby-roster-hint" data-role="roster-hint">${rosterHint(ui.roster.length)}</div>
          </header>
          <div id="roster" class="host-lobby-roster-list"></div>
        </section>
      </main>

      <footer class="host-lobby-foot">
        <a href="/" data-link class="host-lobby-cancel">Cancel</a>
        <button id="start-btn" class="host-lobby-start" ${ui.roster.length === 0 ? 'disabled' : ''}>
          <span class="host-lobby-start-label" data-role="start-label">${startButtonLabel(ui.roster.length)}</span>
          <span class="host-lobby-start-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
          </span>
        </button>
      </footer>
    </div>
  `;

  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-2xl' });
  // In the lobby, no game is running yet — leaving is harmless (no players are
  // playing). Skip the confirm prompt to avoid a useless extra click.
  wireHomeButton(ui.router, false);

  const rosterEl = document.getElementById('roster')!;
  if (ui.roster.length === 0) renderEmptyRoster(rosterEl);

  // Quiz name fetch — replaces the placeholder.
  const quizNameEl = document.querySelector<HTMLElement>('[data-role="quiz-name"]');
  if (quizNameEl) {
    void fetch(`${CLUTCH_API_BASE}/sessions/by-id/${ui.sessionId}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; quizId?: string }) => {
        if (j?.ok && j.quizId) return fetch(`${CLUTCH_API_BASE}/quizzes/${j.quizId}`).then((r) => r.json());
        return null;
      })
      .then((j: null | { ok: boolean; quiz?: { name: string } }) => {
        if (j?.ok && j.quiz) quizNameEl.textContent = j.quiz.name;
        else if (quizNameEl) quizNameEl.textContent = 'Clutch quiz';
      })
      .catch(() => { quizNameEl.textContent = 'Clutch quiz'; });
  }

  // Copy link — preserve label, swap text on success/failure.
  const copyBtn = document.getElementById('copy-link') as HTMLButtonElement | null;
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(joinHref);
      const label = copyBtn.querySelector<HTMLElement>('[data-role="copy-label"]');
      if (!label) return;
      copyBtn.classList.add(ok ? 'is-success' : 'is-success');
      label.textContent = ok ? 'Copied' : 'Failed';
      audio.playerJoined(); // doubles as a "click confirm" — soft + welcoming.
      window.setTimeout(() => {
        copyBtn.classList.remove('is-success');
        label.textContent = 'Copy';
      }, 1500);
    });
  }

  // Tap the giant code itself to copy the bare code string. Hosts often want
  // to drop the code into a DM/chat — saves a select+Cmd-C. We copy the bare
  // code (not the URL) because the URL has its own dedicated Copy button next
  // to it; this gives the host both options without ambiguity.
  const codeEl = document.querySelector<HTMLElement>('[data-role="code"]');
  if (codeEl) {
    codeEl.setAttribute('role', 'button');
    codeEl.setAttribute('tabindex', '0');
    codeEl.setAttribute('title', 'Click to copy code');
    codeEl.setAttribute('aria-label', `Game code ${ui.code}. Click to copy.`);
    const flashCopied = async () => {
      const ok = await copyToClipboard(ui.code);
      if (!ok) return;
      codeEl.classList.add('is-copied');
      audio.playerJoined();
      window.setTimeout(() => codeEl.classList.remove('is-copied'), 900);
    };
    codeEl.addEventListener('click', () => { void flashCopied(); });
    codeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void flashCopied(); }
    });
  }

  // Audio toggle. Pressing it counts as the user gesture browsers require to
  // resume the AudioContext, so we attempt to start the lobby music here.
  const audioBtn = document.getElementById('audio-toggle') as HTMLButtonElement | null;
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      const wasMuted = audio.isMuted();
      audio.setMuted(!wasMuted);
      audioBtn.setAttribute('aria-pressed', String(wasMuted));
      audioBtn.dataset.on = String(wasMuted);
      audioBtn.title = wasMuted
        ? 'Mute lobby music & sound effects'
        : 'Unmute lobby music & sound effects';
      audioBtn.innerHTML = audioIconSvg(!wasMuted);
      if (wasMuted) audio.startLobbyMusic();
    });
  }

  // Fullscreen toggle for projector / big-screen use.
  const fsBtn = document.getElementById('fullscreen-toggle') as HTMLButtonElement | null;
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      try {
        if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
        else void document.exitFullscreen();
      } catch { /* unsupported, no-op */ }
    });
  }

  // Mount a clean, big QR. Three.js voxel scene is great but the QR was small
  // for an audience and the 3D toggle was a distraction during a live show.
  // Use the pre-built data URL the host already has in `ui.qrDataUrl`.
  const qrMount = document.getElementById('qr-mount');
  if (qrMount) {
    ui.voxelHandle?.dispose();
    ui.voxelHandle = null;
    qrMount.innerHTML = '';
    qrMount.style.width = '100%';
    qrMount.style.height = '100%';
    qrMount.style.display = 'flex';
    const img = document.createElement('img');
    img.src = ui.qrDataUrl ?? '';
    img.alt = 'Scan to join';
    qrMount.appendChild(img);
  }

  // Hydrate the roster.
  ui.roster.forEach((p) => {
    rosterEl.appendChild(buildLobbyChip(p.name));
  });

  const start = document.getElementById('start-btn') as HTMLButtonElement | null;
  if (start) {
    start.addEventListener('click', () => {
      // Pre-game countdown: short, dramatic, audible. Browsers require a user
      // gesture before audio can play; the click here qualifies, so we start
      // the lobby music too if it wasn't already playing (so future joins
      // chime in even without manually unmuting).
      audio.stopLobbyMusic();
      // Tell the server to broadcast the same countdown to every player so
      // phones light up in sync with the host's overlay. Fire-and-forget —
      // if the broadcast fails, the host's local countdown still runs and
      // players will catch up at QuestionStart.
      void emitAck(CLIENT_EVENTS.HostStartCountdown, { sessionId: ui.sessionId });
      void runStartCountdown(ui).then(() => {
        void hostAct(ui, CLIENT_EVENTS.HostStartGame);
      });
    });
  }

  // Kick off ambient lobby music. If the user hasn't yet interacted with the
  // page, the AudioContext will stay suspended; the first click on the audio
  // toggle / start button will resume it.
  audio.startLobbyMusic();
}

function buildLobbyChip(name: string): HTMLElement {
  const chip = document.createElement('div');
  chip.dataset.name = name;
  chip.className = 'host-lobby-roster-chip animate-pop-in';
  // Avatar uses the player's initial(s) on a hashed pastel background — gives
  // every chip a visual anchor so they read instantly across a packed grid.
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const tone = initialTone(name);
  chip.innerHTML = `
    <span class="host-lobby-roster-avatar" style="background:${tone.bg};color:${tone.fg}">${escapeHtml(initial)}</span>
    <span class="host-lobby-roster-chip-name">${escapeHtml(name)}</span>
  `;
  return chip;
}

// Stable colored avatar derived from the player name. Same name → same color
// across renders, so chips don't shimmer when the roster patches in place.
function initialTone(name: string): { bg: string; fg: string } {
  const palette: Array<{ bg: string; fg: string }> = [
    { bg: '#FCE7F3', fg: '#9D174D' },
    { bg: '#DBEAFE', fg: '#1E40AF' },
    { bg: '#DCFCE7', fg: '#166534' },
    { bg: '#FEF3C7', fg: '#92400E' },
    { bg: '#EDE9FE', fg: '#5B21B6' },
    { bg: '#CFFAFE', fg: '#155E75' },
    { bg: '#FFE4E6', fg: '#9F1239' },
    { bg: '#E0E7FF', fg: '#3730A3' },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length]!;
}

function formatRosterCounter(n: number): string {
  return `${n} ${n === 1 ? 'player' : 'players'}`;
}

function rosterHint(n: number): string {
  if (n === 0) return 'Waiting for the first player to join…';
  if (n === 1) return 'First one in! Share the code with the room.';
  if (n < 5) return 'Warming up — keep them coming.';
  if (n < 10) return 'Looking good. Start when you\'re ready.';
  return 'Packed house. Hit start whenever you like.';
}

function startButtonLabel(n: number): string {
  if (n === 0) return 'Waiting for players';
  if (n === 1) return 'Start game · 1 player';
  return `Start game · ${n} players`;
}

function audioIconSvg(muted: boolean): string {
  if (muted) {
    return `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M11 5L6 9H3v6h3l5 4V5z"/>
        <path d="M22 9l-5 5"/>
        <path d="M17 9l5 5"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4V5z"/>
      <path d="M16 8a5 5 0 0 1 0 8"/>
      <path d="M19 5a9 9 0 0 1 0 14"/>
    </svg>
  `;
}

function fullscreenIconSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 9V4h5"/>
      <path d="M20 9V4h-5"/>
      <path d="M4 15v5h5"/>
      <path d="M20 15v5h-5"/>
    </svg>
  `;
}

// Pre-game "3, 2, 1, GO!" overlay — dramatic, short, audible. Resolves after
// the final beat so the caller can fire HostStartGame on the same beat the
// players see the first question.
function runStartCountdown(ui: HostUI): Promise<void> {
  const audio = getAudio();
  return new Promise<void>((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'host-lobby-countdown-layer';
    layer.innerHTML = `
      <div class="host-lobby-countdown-num" data-role="num">3</div>
      <div class="host-lobby-countdown-label">Get ready…</div>
    `;
    document.body.appendChild(layer);
    const numEl = layer.querySelector<HTMLElement>('[data-role="num"]')!;
    const labelEl = layer.querySelector<HTMLElement>('.host-lobby-countdown-label')!;

    const seq: Array<{ text: string; final?: boolean; label?: string }> = [
      { text: '3' },
      { text: '2' },
      { text: '1' },
      { text: 'GO!', final: true, label: 'Question 1' },
    ];

    let i = 0;
    const step = (): void => {
      if (i >= seq.length) {
        layer.remove();
        resolve();
        return;
      }
      const s = seq[i++]!;
      numEl.textContent = s.text;
      // Restart the pop animation by toggling a class.
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = '';
      if (s.label) labelEl.textContent = s.label;
      audio.countdownBeep(s.final === true);
      // Don't gate completion on the host UI — but if the host bailed by
      // closing the tab while counting down, abort the timer.
      if (!ui.root.isConnected) {
        layer.remove();
        resolve();
        return;
      }
      window.setTimeout(step, 800);
    };
    step();
  });
}

/**
 * Send a host action and, if the server reports the session no longer exists
 * (typical after a server restart), swap the host view for a dead-session
 * screen with a "New session" link. Returns true if the action was accepted.
 */
async function hostAct(ui: HostUI, event: string): Promise<boolean> {
  const ack = await emitAck<{ ok: boolean; reason?: string }>(event, { sessionId: ui.sessionId });
  if (!ack.ok) {
    if (isSessionGone(ack.reason)) {
      renderSessionGone(ui.root, ack.reason);
      return false;
    }
    if (isSessionFinished(ack.reason)) {
      renderSessionFinished(ui.root, ui.sessionId);
      return false;
    }
    // Non-fatal errors get a transient banner rather than a full replace.
    toast(ack.reason ?? 'Action failed.', 'error');
  }
  return ack.ok;
}

function isSessionGone(reason: string | undefined): boolean {
  if (!reason) return false;
  return /session not found/i.test(reason);
}

// Engine rejects lifecycle actions (startGame, nextQuestion, …) with a message
// like: Session is in state "final", not lobby. Treat any "final" or "ended"
// state as a terminal signal so the host stops trying to drive a dead game.
function isSessionFinished(reason: string | undefined): boolean {
  if (!reason) return false;
  return /state\s+"(final|ended)"/i.test(reason);
}

function renderSessionGone(app: HTMLElement, reason: string | undefined): void {
  app.innerHTML = `
    <div class="h-full flex items-center justify-center p-8 text-center">
      <div class="max-w-md">
        <div class="text-3xl font-semibold mb-3">This session has ended</div>
        <div class="text-clutch-mute mb-6">${escapeHtml(reason ?? 'The server no longer has a record of this game.')}</div>
        <a href="/" data-link class="inline-block rounded-2xl bg-clutch-ink text-white px-6 py-3 font-semibold">Start a new session</a>
      </div>
    </div>`;
}

// Shown when the session exists but has already run to completion. Happens
// when a host re-opens /host/<id> for a finished game (browser tab restore,
// history back, stale bookmark). Avoids stranding them on a lobby whose
// Start button the engine will refuse.
function renderSessionFinished(app: HTMLElement, sessionId: string): void {
  app.innerHTML = `
    <div class="h-full flex items-center justify-center p-8 text-center">
      <div class="max-w-md">
        <div class="text-3xl font-semibold mb-3">This game is already over</div>
        <div class="text-clutch-mute mb-6">You can review the results or start a brand-new session.</div>
        <div class="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <a href="/results/${encodeURIComponent(sessionId)}" data-link class="inline-block rounded-2xl bg-clutch-ink text-white px-6 py-3 font-semibold">See results</a>
          <a href="/" data-link class="inline-block rounded-2xl border border-black/10 text-clutch-ink px-6 py-3 font-semibold hover:bg-black/5">Start a new session</a>
        </div>
      </div>
    </div>`;
}

/** In-place roster update for the lobby — avoids tearing down the voxel scene. */
function updateLobbyRoster(ui: HostUI): void {
  const roster = document.getElementById('roster');
  const counter = document.querySelector('[data-role="roster-counter"]') as HTMLElement | null;
  const hint = document.querySelector('[data-role="roster-hint"]') as HTMLElement | null;
  const startLabel = document.querySelector('[data-role="start-label"]') as HTMLElement | null;
  const start = document.getElementById('start-btn') as HTMLButtonElement | null;
  if (!roster) {
    // Lobby DOM isn't here — fall back to a full render.
    renderLobby(ui);
    return;
  }
  if (counter) counter.textContent = formatRosterCounter(ui.roster.length);
  if (hint) hint.textContent = rosterHint(ui.roster.length);
  if (startLabel) startLabel.textContent = startButtonLabel(ui.roster.length);
  if (start) start.disabled = ui.roster.length === 0;

  // Clear the empty-state if present.
  const empty = roster.querySelector('[data-role="empty"]');
  if (empty && ui.roster.length > 0) empty.remove();

  // Diff chips: only add/remove the ones that changed, so the pop-in animation
  // only plays for new arrivals.
  const present = new Set<string>();
  roster.querySelectorAll<HTMLElement>('[data-name]').forEach((el) => {
    present.add(el.dataset.name!);
  });
  const want = new Set(ui.roster.map((p) => p.name));

  // Remove chips for players that left (rare in current model, but future-proof).
  roster.querySelectorAll<HTMLElement>('[data-name]').forEach((el) => {
    if (!want.has(el.dataset.name!)) el.remove();
  });
  // Add chips for new players. Each new arrival also chimes the join sound,
  // so the host knows someone's in without staring at the screen.
  let added = 0;
  for (const p of ui.roster) {
    if (present.has(p.name)) continue;
    roster.appendChild(buildLobbyChip(p.name));
    added++;
  }
  if (added > 0) getAudio().playerJoined();

  // Re-add empty state if everyone left.
  if (ui.roster.length === 0 && !roster.querySelector('[data-role="empty"]')) {
    renderEmptyRoster(roster);
  }
}

function renderEmptyRoster(el: HTMLElement): void {
  const empty = document.createElement('div');
  empty.dataset.role = 'empty';
  empty.className = 'host-lobby-roster-empty';
  empty.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.5rem;opacity:0.6" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5"/>
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6"/>
    </svg>
    <span>No players yet — chips will pop in here as people join.</span>
  `;
  el.appendChild(empty);
}

function renderQuestion(ui: HostUI): void {
  const q = ui.lastQuestion;
  if (!q) { renderWaiting(ui, 'Loading question…'); return; }

  ui.root.innerHTML = `
    <div class="h-full flex flex-col bg-clutch-paper relative">
      <header class="flex items-center justify-between px-10 pt-6">
        ${gameHeaderHtml({
          rightSlotHtml: `
            <div class="ml-3 font-mono text-sm text-clutch-mute hidden md:inline">Question ${q.index + 1} / ${q.total}</div>
          `,
        })}
        <div class="flex items-center gap-3">
          <span class="font-mono text-sm text-clutch-mute md:hidden">Q ${q.index + 1} / ${q.total}</span>
          <button id="skip" class="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5">Skip</button>
          <button id="pause" class="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5">Pause</button>
          <button id="end" class="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5 text-clutch-red">End</button>
        </div>
      </header>

      <div class="px-10 mt-6 flex items-start gap-6">
        <div class="flex-1 text-5xl md:text-6xl font-semibold leading-tight">${escapeHtml(q.text)}</div>
        <div id="timer-wrap" class="host-qtimer flex-shrink-0" data-state="ok">
          <svg viewBox="0 0 100 100" class="host-qtimer-ring">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(15,15,20,0.08)" stroke-width="6"></circle>
            <circle id="timer-circle" cx="50" cy="50" r="44" fill="none" stroke="#0F0F14" stroke-width="6"
              stroke-dasharray="${(2 * Math.PI * 44).toFixed(2)}" stroke-dashoffset="0" stroke-linecap="round"></circle>
          </svg>
          <div id="timer-text" class="host-qtimer-num" aria-live="off">--</div>
        </div>
      </div>

      <div class="px-10 mt-3">
        <div class="h-2 rounded-full bg-black/5 overflow-hidden">
          <div id="answered-bar" class="h-full bg-clutch-ink transition-all" style="width:0%"></div>
        </div>
        <div class="mt-1 flex items-center justify-between gap-3 text-xs text-clutch-mute">
          <span id="answered-text">0 / ${ui.roster.length} answered</span>
          <span id="answered-pending" class="truncate text-right opacity-90"></span>
        </div>
      </div>

      <div class="flex-1 grid grid-cols-2 gap-6 px-10 py-8">
        ${q.options.map((opt, i) => {
          const t = TILE_DEFS[i]!;
          return `
            <div class="tile tile-${t.color} rounded-4xl p-8 flex items-center gap-6 text-3xl md:text-4xl font-semibold">
              <div class="flex-shrink-0">${shapeSvg(t.shape, 80)}</div>
              <div class="flex-1">${escapeHtml(opt)}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div id="projectile-layer" class="projectile-layer" aria-hidden="true"></div>

      ${ui.paused ? pauseOverlay(ui) : ''}
    </div>
  `;

  document.getElementById('skip')!.addEventListener('click', () => {
    void hostAct(ui, CLIENT_EVENTS.HostSkip);
  });
  document.getElementById('pause')!.addEventListener('click', () => {
    const evt = ui.paused ? CLIENT_EVENTS.HostResume : CLIENT_EVENTS.HostPause;
    void hostAct(ui, evt);
  });
  document.getElementById('end')!.addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'End game now?',
      message: 'All players will see the final results. This cannot be undone.',
      confirmText: 'End game',
      cancelText: 'Keep playing',
      destructive: true,
    });
    if (ok) void hostAct(ui, CLIENT_EVENTS.HostEnd);
  });
  wireGameHeader(ui);

  startTimerLoop(ui);
  updateAnsweredBar(ui);
}

function updateAnsweredBar(ui: HostUI): void {
  const bar = document.getElementById('answered-bar');
  const txt = document.getElementById('answered-text');
  const pending = document.getElementById('answered-pending');
  if (!bar || !txt) return;
  const total = ui.answered.total || ui.roster.length || 1;
  const pct = Math.round((ui.answered.count / Math.max(1, total)) * 100);
  bar.style.width = `${pct}%`;
  txt.textContent = `${ui.answered.count} / ${total} answered`;
  if (pending) {
    const names = ui.answered.pendingNames ?? [];
    if (names.length === 0) {
      pending.textContent = '';
    } else if (names.length <= 3) {
      pending.textContent = `Waiting on ${names.join(', ')}`;
    } else {
      pending.textContent = `Waiting on ${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
    }
  }
}

function startTimerLoop(ui: HostUI): void {
  if (ui.rafHandle) cancelAnimationFrame(ui.rafHandle);
  const circ = document.getElementById('timer-circle') as SVGCircleElement | null;
  const text = document.getElementById('timer-text') as HTMLElement | null;
  const wrap = document.getElementById('timer-wrap') as HTMLElement | null;
  if (!circ || !text) return;
  const circumference = 2 * Math.PI * 44;
  const audio = getAudio();
  // Track which "second" we last ticked so we play the countdown beep exactly
  // once per second in the final 3s of the question (and the time-up tone).
  let lastTickedSecond: number | null = null;
  const tick = (): void => {
    if (!ui.deadline) {
      ui.rafHandle = requestAnimationFrame(tick);
      return;
    }
    const now = Date.now();
    const remaining = ui.paused ? ui.deadline - now : Math.max(0, ui.deadline - now);
    const clamped = Math.max(0, remaining);
    const secondsLeft = Math.ceil(clamped / 1000);
    text.textContent = ui.paused ? '❚❚' : String(secondsLeft);
    const frac = Math.min(1, Math.max(0, clamped / QUESTION_DURATION_MS));
    circ.setAttribute('stroke-dashoffset', String(circumference * (1 - frac)));
    if (wrap) {
      const state = secondsLeft <= 3 ? 'danger' : secondsLeft <= 7 ? 'warn' : 'ok';
      if (wrap.dataset.state !== state) wrap.dataset.state = state;
    }

    // Rush ramp: in the final 6 seconds, smoothly push the in-game music
    // toward "panic" mode. The audio lib reads this every step, so a tween
    // here gives a continuous accelerando rather than a hard switch.
    if (!ui.paused) {
      const RUSH_WINDOW_MS = 6000;
      const rush = clamped < RUSH_WINDOW_MS
        ? Math.min(1, (RUSH_WINDOW_MS - clamped) / RUSH_WINDOW_MS)
        : 0;
      audio.setGameMusicRush(rush);
    }

    // Audio cues: tick on the last 3s, big tone on time-up. We compare against
    // `lastTickedSecond` rather than triggering on a strict equality check so
    // the cue still fires if we miss a frame.
    if (!ui.paused && lastTickedSecond !== secondsLeft) {
      if (secondsLeft > 0 && secondsLeft <= 3) {
        audio.countdownTick(secondsLeft);
      } else if (secondsLeft === 0 && (lastTickedSecond ?? 999) > 0) {
        audio.timeUp();
      }
      lastTickedSecond = secondsLeft;
    }

    if (clamped > 0 && !ui.paused) {
      ui.rafHandle = requestAnimationFrame(tick);
    } else if (ui.paused) {
      ui.rafHandle = requestAnimationFrame(tick);
    }
  };
  ui.rafHandle = requestAnimationFrame(tick);
}

function pauseOverlay(ui: HostUI): string {
  return `
    <div class="pause-backdrop absolute inset-0 z-20 flex items-center justify-center text-white">
      <div class="text-center">
        <div class="text-2xl uppercase tracking-[0.3em] opacity-70 mb-6">Paused — latecomers welcome</div>
        <img src="${ui.qrDataUrl ?? ''}" alt="Join QR" class="mx-auto rounded-3xl shadow-2xl" />
        <div class="mt-8 font-mono font-bold text-7xl tracking-wider">${formatCode(ui.code)}</div>
        <div class="mt-3 text-sm opacity-60">${escapeHtml(joinUrlFor(ui, ui.code))}</div>
      </div>
    </div>
  `;
}

// ----- Projectile mini-game (host renders incoming throws) ------------------
//
// Each accepted player throw arrives as a `ProjectileThrown` payload with a
// normalized splat target (`x`, `y` ∈ [0,1]) and an entry side. We spawn an
// element off-screen, glide it on a curved path to the splat, then draw a
// kind-specific splat that lingers ~1.4s before fading out. The whole layer
// is `pointer-events: none` so it never steals clicks from the host UI.
//
// The list of recently-rendered throwIds is capped so a flaky reconnection
// can't replay an old burst onto the screen days later.

const RECENT_THROW_IDS: string[] = [];
const RECENT_THROW_LIMIT = 200;

function spawnProjectile(p: ProjectileThrownPayload): void {
  const layer = document.getElementById('projectile-layer');
  if (!layer) return;
  if (RECENT_THROW_IDS.includes(p.throwId)) return;
  RECENT_THROW_IDS.push(p.throwId);
  if (RECENT_THROW_IDS.length > RECENT_THROW_LIMIT) RECENT_THROW_IDS.shift();

  const wrap = document.createElement('div');
  wrap.className = `projectile projectile-${p.kind} projectile-from-${p.originSide}`;
  // The splat coords are absolute on the layer; an inner sprite handles its
  // own entry transform so we can keep the splat centered on the target.
  wrap.style.setProperty('--tx', `${(p.x * 100).toFixed(2)}%`);
  wrap.style.setProperty('--ty', `${(p.y * 100).toFixed(2)}%`);
  // Slight randomized rotation so back-to-back throws of the same kind don't
  // look like cookie-cutter copies.
  const spin = (Math.random() * 720 - 360).toFixed(0);
  wrap.style.setProperty('--spin', `${spin}deg`);

  wrap.innerHTML = `
    <div class="projectile-sprite">${projectileSprite(p.kind)}</div>
    <div class="projectile-splat">${splatSprite(p.kind)}</div>
    <div class="projectile-name-pill">${escapeHtml(p.name)}</div>
  `;
  layer.appendChild(wrap);

  // Auto-cleanup after the animation cascade finishes. Total: ~440ms travel
  // + ~1400ms splat dwell + 280ms fade-out.
  window.setTimeout(() => {
    wrap.classList.add('is-clearing');
    window.setTimeout(() => wrap.remove(), 320);
  }, 1850);
}

function clearProjectiles(): void {
  const layer = document.getElementById('projectile-layer');
  if (layer) layer.innerHTML = '';
}

function projectileSprite(kind: ProjectileThrownPayload['kind']): string {
  switch (kind) {
    case 'tomato':
      return `
        <svg viewBox="0 0 64 64" width="68" height="68" aria-hidden="true">
          <ellipse cx="32" cy="36" rx="24" ry="22" fill="#E53E3E"/>
          <ellipse cx="24" cy="28" rx="6" ry="4" fill="#FF6E6E" opacity="0.8"/>
          <path d="M22 14c4-2 16-2 20 0c-2 6-8 8-10 8s-8-2-10-8z" fill="#2F855A"/>
          <path d="M32 14v-4" stroke="#1F4E33" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      `;
    case 'plane':
      return `
        <svg viewBox="0 0 64 64" width="78" height="78" aria-hidden="true">
          <path d="M4 32L60 8L48 60L34 38L52 16L24 34Z" fill="#FAFAF7" stroke="#0F0F14" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M24 34L34 38L30 50Z" fill="#E2E2DD" stroke="#0F0F14" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
      `;
    case 'pie':
      return `
        <svg viewBox="0 0 64 64" width="74" height="74" aria-hidden="true">
          <ellipse cx="32" cy="42" rx="26" ry="10" fill="#D4A373"/>
          <ellipse cx="32" cy="36" rx="26" ry="14" fill="#FFF8EC"/>
          <ellipse cx="32" cy="32" rx="20" ry="10" fill="#FFFDF8"/>
          <circle cx="32" cy="28" r="4" fill="#E53E3E"/>
        </svg>
      `;
    case 'sparkle':
      return `
        <svg viewBox="0 0 64 64" width="76" height="76" aria-hidden="true">
          <defs>
            <radialGradient id="sparkle-g" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#FFF7B0"/>
              <stop offset="60%" stop-color="#F6C242"/>
              <stop offset="100%" stop-color="#B27B0E"/>
            </radialGradient>
          </defs>
          <path d="M32 4l5 22 22 6-22 6-5 22-5-22-22-6 22-6z" fill="url(#sparkle-g)" stroke="#7A5500" stroke-width="1.4" stroke-linejoin="round"/>
          <circle cx="32" cy="32" r="4" fill="#FFFDEA"/>
        </svg>
      `;
  }
}

function splatSprite(kind: ProjectileThrownPayload['kind']): string {
  switch (kind) {
    case 'tomato':
      return `
        <svg viewBox="0 0 200 200" width="220" height="220" aria-hidden="true">
          <g fill="#E53E3E">
            <path d="M100 40c20 0 38 12 46 30c4 12 -2 22 -10 28c14 4 26 14 22 30c-4 16 -22 22 -36 16c2 12 -8 24 -22 24c-16 0 -22 -10 -22 -22c-12 6 -28 0 -32 -14c-4 -14 6 -26 18 -28c-12 -8 -16 -22 -10 -36c8 -16 26 -28 46 -28z"/>
            <circle cx="34" cy="60" r="9"/>
            <circle cx="170" cy="80" r="7"/>
            <circle cx="160" cy="160" r="11"/>
            <circle cx="40" cy="170" r="8"/>
            <circle cx="180" cy="40" r="5"/>
          </g>
          <ellipse cx="84" cy="86" rx="14" ry="8" fill="#FF7A7A" opacity="0.7"/>
        </svg>
      `;
    case 'plane':
      return `
        <svg viewBox="0 0 200 200" width="180" height="180" aria-hidden="true">
          <g fill="none" stroke="#0F0F14" stroke-width="3" stroke-linecap="round">
            <path d="M40 100 q60 -30 120 0"/>
            <path d="M50 120 q50 -20 100 0"/>
            <path d="M60 80 q40 -10 80 0"/>
          </g>
        </svg>
      `;
    case 'pie':
      return `
        <svg viewBox="0 0 200 200" width="240" height="240" aria-hidden="true">
          <g fill="#FFFDF8">
            <path d="M100 40c30 0 56 18 60 44c4 26 -16 36 -28 32c10 18 -2 38 -22 40c-20 2 -32 -10 -34 -24c-12 12 -36 8 -42 -10c-6 -18 8 -32 24 -32c-12 -8 -16 -28 -2 -40c10 -8 28 -10 44 -10z"/>
            <circle cx="48" cy="58" r="9"/>
            <circle cx="160" cy="50" r="6"/>
            <circle cx="170" cy="148" r="11"/>
            <circle cx="38" cy="156" r="9"/>
          </g>
          <circle cx="98" cy="92" r="6" fill="#E53E3E"/>
        </svg>
      `;
    case 'sparkle':
      return `
        <svg viewBox="0 0 200 200" width="220" height="220" aria-hidden="true">
          <g fill="#FFE680" stroke="#B27B0E" stroke-width="1.2" stroke-linejoin="round">
            <path d="M100 30l8 38 38 10 -38 10 -8 38 -8 -38 -38 -10 38 -10z"/>
            <path d="M40 60l3 14 14 4 -14 4 -3 14 -3 -14 -14 -4 14 -4z"/>
            <path d="M160 56l2 10 10 3 -10 3 -2 10 -2 -10 -10 -3 10 -3z"/>
            <path d="M154 154l3 12 12 3 -12 3 -3 12 -3 -12 -12 -3 12 -3z"/>
            <path d="M44 158l2 10 10 3 -10 3 -2 10 -2 -10 -10 -3 10 -3z"/>
          </g>
        </svg>
      `;
  }
}

function renderReveal(ui: HostUI, p: QuestionRevealPayload): void {
  const q = ui.lastQuestion;
  if (!q) return;
  const max = Math.max(1, ...p.counts);
  ui.root.innerHTML = `
    <div class="h-full flex flex-col bg-clutch-paper">
      <header class="flex items-center justify-between px-10 pt-6">
        ${gameHeaderHtml({
          rightSlotHtml: `<div class="ml-3 font-mono text-sm text-clutch-mute hidden md:inline">Question ${q.index + 1} / ${q.total}</div>`,
        })}
        <div class="text-sm text-clutch-mute">Showing results…</div>
      </header>
      <div class="px-10 mt-6 text-4xl md:text-5xl font-semibold">${escapeHtml(q.text)}</div>
      <div class="flex-1 grid grid-cols-4 items-end gap-6 px-10 pb-10 pt-6">
        ${q.options.map((opt, i) => {
          const t = TILE_DEFS[i]!;
          const isCorrect = i === p.correctIndex;
          const pct = Math.round((p.counts[i]! / max) * 100);
          return `
            <div class="flex flex-col items-center justify-end h-full">
              <div class="text-2xl font-bold mb-2">${p.counts[i]}</div>
              <div class="w-full rounded-t-3xl tile-${t.color} flex flex-col items-center justify-end text-white p-4 bar-grow ${isCorrect ? 'ring-4 ring-clutch-ink' : 'opacity-60'}"
                   style="height:${Math.max(15, pct)}%; min-height: 120px;">
                ${shapeSvg(t.shape, 60)}
                <div class="mt-3 text-lg font-semibold text-center break-words">${escapeHtml(opt)}</div>
                ${isCorrect ? `<div class="mt-2 text-xs uppercase tracking-widest font-bold bg-white/20 rounded-full px-2 py-1">Correct</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  wireGameHeader(ui);
}

// ----- Unified leaderboard / final view -----
//
// Mid-game and end-of-game both use the same layout: header with the
// clickable wordmark, podium hero block on top, full standings list below,
// and a control rail in the top right. The mode toggle drives the eyebrow
// text, the "Next" button (or countdown), and which control buttons appear.

interface BoardOpts {
  mode: 'midgame' | 'final';
  entries: LeaderboardEntry[];
  questionIndex: number;
  total: number;
}

function renderBoard(ui: HostUI, opts: BoardOpts): void {
  const isFinal = opts.mode === 'final';
  const sortedEntries = [...opts.entries].sort((a, b) => a.rank - b.rank);
  const top3 = sortedEntries.slice(0, 3);
  const rest = sortedEntries.slice(3);

  // Order for visual podium: 2nd, 1st, 3rd. Filter to keep undefined out.
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardEntry[];
  // Use gold/silver/bronze gradients (defined in main.css under
  // .host-podium-bar-gold/silver/bronze) so the podium colors match the
  // player leaderboard hero / row themes exactly.
  const podiumTones = new Map<number, string>([
    [1, 'host-podium-bar-gold'],
    [2, 'host-podium-bar-silver'],
    [3, 'host-podium-bar-bronze'],
  ]);
  // The podium-bar height % feeds into a CSS custom property so a 1-player
  // game still fills the screen dramatically instead of leaving a tall blank
  // strip below. Heights are tuned per-rank but uplift across the board when
  // the field is small.
  const baseHeight = new Map<number, number>([[1, 78], [2, 60], [3, 44]]);
  const fieldSize = sortedEntries.length;
  const isSmallField = fieldSize <= 2;

  const eyebrow = isFinal
    ? 'Game Over · Final standings'
    : `After question ${opts.questionIndex + 1} / ${opts.total}`;
  const headline = isFinal ? 'Final podium' : 'Standings';

  const isLastQuestion = !isFinal && opts.questionIndex + 1 >= opts.total;
  const railHtml = isFinal
    ? controlRailHtml({ showResults: true, showRotate: true, showHome: true })
    : controlRailHtml({
        showNext: { label: isLastQuestion ? 'Finish' : 'Next question' },
        showAutoAdvance: ui.autoAdvance,
      });

  const countdownHtml = isFinal
    ? `
      <div class="host-countdown">
        <div class="host-countdown-label">Auto-opening full results in <span id="countdown-num">8</span>s…</div>
        <button id="cancel-countdown" class="host-countdown-cancel">Stay here</button>
      </div>
    `
    : '';

  // Footer hint: mid-game shows what's coming next; final shows nothing
  // (the rotate/results buttons in the rail already speak for themselves).
  const footerHint = !isFinal
    ? (isLastQuestion
        ? 'Last question wraps next — get ready for the podium.'
        : `Question ${opts.questionIndex + 2} / ${opts.total} coming up`)
    : '';

  ui.root.innerHTML = `
    <div class="h-full flex flex-col bg-clutch-paper relative">
      <header class="host-board-head">
        ${gameHeaderHtml()}
        ${railHtml}
      </header>

      <main class="host-board-main host-board-field-${fieldSize <= 1 ? 'solo' : isSmallField ? 'small' : 'normal'}">
        <div class="host-board-top">
          <div class="host-board-eyebrow">${escapeHtml(eyebrow)}</div>
          <h2 class="host-board-headline">${escapeHtml(headline)}</h2>
          <div class="host-board-meta">${escapeHtml(`${fieldSize} ${fieldSize === 1 ? 'player' : 'players'}`)}</div>
        </div>

        ${podiumOrder.length > 0 ? `
          <div class="host-podium-stage">
            <div class="host-podium ${isSmallField ? 'host-podium-tight' : ''}">
              ${podiumOrder.map((e) => {
                const h = baseHeight.get(e.rank) ?? 40;
                return `
                  <div class="host-podium-col host-podium-rank-${e.rank}" style="--podium-h: ${h}%">
                    ${e.rank === 1 ? `<div class="host-podium-crown">${podiumCrownSvg()}</div>` : ''}
                    <div class="host-podium-name">${escapeHtml(e.name)}</div>
                    <div class="host-podium-score">${e.score}<span class="host-podium-pts">pts</span></div>
                    <div class="podium-bar host-podium-bar ${podiumTones.get(e.rank) ?? 'tile-blue'}">
                      <div class="host-podium-rank-num">${ordinalLabel(e.rank)}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${rest.length > 0 ? `
          <div class="host-board-rest">
            <div class="host-board-rest-label">Rest of the field</div>
            <div class="host-board-rest-list">
              ${rest.map((e, idx) => `
                <div class="host-board-rest-row" style="animation-delay: ${Math.min(idx, 9) * 60}ms">
                  <div class="host-board-rest-rank">#${e.rank}</div>
                  <div class="host-board-rest-name">${escapeHtml(e.name)}</div>
                  <div class="host-board-rest-score">${e.score}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${countdownHtml}

        ${footerHint ? `<div class="host-board-footer-hint">${escapeHtml(footerHint)}</div>` : ''}
      </main>
    </div>
  `;

  wireGameHeader(ui);
  wireControlRail(ui, {
    onRotate: () => void promptRotateSession(ui),
    onResults: () => ui.router.navigate(`/results/${ui.sessionId}`),
  });

  // Mid-game leaderboards auto-advance to the next question after 30s when
  // the host has the toggle on. Final boards use their own (longer) countdown
  // to the results page and skip this path.
  if (!isFinal && ui.autoAdvance) {
    startAutoAdvance(ui);
  }

  if (isFinal) {
    // Confetti for the room. Two staggered bursts so the moment feels earned.
    fireConfetti({ count: 160, duration: 2400, originY: 0.45 });
    window.setTimeout(() => fireConfetti({ count: 100, duration: 1900, originX: 0.2, originY: 0.5 }), 350);
    window.setTimeout(() => fireConfetti({ count: 100, duration: 1900, originX: 0.8, originY: 0.5 }), 700);
    // Cheer alongside the confetti — the burst lasts ~1s, the applause swell ~1.4s,
    // so the room is hyped while the bars are rising on the podium.
    getAudio().cheer();
    startFinalCountdown(ui);
  }
}

function ordinalLabel(rank: number): string {
  return rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
}

function podiumCrownSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor" aria-hidden="true">
      <path d="M3 8l4 4 5-7 5 7 4-4-1.5 11h-15z"/>
    </svg>
  `;
}

function startFinalCountdown(ui: HostUI): void {
  const FINAL_COUNTDOWN_S = 8;
  let remaining = FINAL_COUNTDOWN_S;
  const num = document.getElementById('countdown-num');
  const cancel = document.getElementById('cancel-countdown') as HTMLButtonElement | null;
  if (!num) return;

  let cancelled = false;
  const interval = window.setInterval(() => {
    if (cancelled) return;
    remaining--;
    if (num) num.textContent = String(Math.max(0, remaining));
    if (remaining <= 0) {
      window.clearInterval(interval);
      // Only navigate if the host hasn't kicked off rotation or left the page.
      if (!cancelled) ui.router.navigate(`/results/${ui.sessionId}`);
    }
  }, 1000);

  cancel?.addEventListener('click', () => {
    cancelled = true;
    window.clearInterval(interval);
    const wrap = cancel.closest('.host-countdown') as HTMLElement | null;
    if (wrap) wrap.classList.add('is-cancelled');
  });
}

// ----- New-session quiz picker modal (rotate session flow) -----
//
// Opens a centered modal with the host's quiz library; clicking one fires
// host:rotate_session and navigates the host to /host/<newId> when the ack
// returns. Players auto-migrate via the SessionReplaced server event.

async function promptRotateSession(ui: HostUI): Promise<void> {
  let quizzes: QuizSummary[] = [];
  try {
    quizzes = await listQuizzes();
  } catch (err) {
    toast('Could not load quizzes: ' + (err as Error).message, 'error');
    return;
  }

  const layer = document.createElement('div');
  layer.className = 'host-rotate-layer clutch-modal-backdrop';
  layer.innerHTML = `
    <div class="host-rotate-panel clutch-modal-panel">
      <div class="host-rotate-head">
        <div>
          <div class="text-xs uppercase tracking-[0.22em] text-clutch-mute">Start a new session</div>
          <h2 class="text-2xl font-semibold mt-1 tracking-tight">Pick the next quiz</h2>
          <p class="text-sm text-clutch-mute mt-1">Everyone in the room stays joined — no codes to re-enter.</p>
        </div>
        <button class="host-rotate-close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
        </button>
      </div>

      <div class="host-rotate-list">
        ${quizzes.length === 0
          ? `<div class="text-clutch-mute py-6 text-center">No quizzes yet. <a href="/" data-link class="underline">Upload one</a>.</div>`
          : quizzes.map((q) => `
              <button data-quiz-id="${escapeHtml(q.id)}" class="host-rotate-row">
                <div class="flex-1 text-left">
                  <div class="font-medium">${escapeHtml(q.name)}</div>
                  <div class="text-xs text-clutch-mute mt-0.5">${q.questionCount} question${q.questionCount === 1 ? '' : 's'}</div>
                </div>
                <span class="host-rotate-row-cta" aria-hidden="true">→</span>
              </button>
            `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(layer);
  void layer.offsetWidth;
  layer.classList.add('is-open');

  const close = (): void => {
    layer.classList.add('clutch-modal-leave');
    document.removeEventListener('keydown', onKey);
    window.setTimeout(() => layer.remove(), 180);
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  layer.querySelector('.host-rotate-close')!.addEventListener('click', close);
  layer.addEventListener('click', (e) => { if (e.target === layer) close(); });

  layer.querySelectorAll<HTMLButtonElement>('[data-quiz-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const quizId = btn.dataset.quizId!;
      btn.disabled = true;
      btn.classList.add('is-loading');
      try {
        const ack = await emitAck<CreateSessionAck | SimpleErrAck>(
          CLIENT_EVENTS.HostRotateSession,
          { sessionId: ui.sessionId, quizId },
        );
        if (!ack.ok) {
          toast('Could not start: ' + ack.reason, 'error');
          btn.disabled = false;
          btn.classList.remove('is-loading');
          return;
        }
        // Stash the session metadata for the new console (matches the home flow).
        sessionStorage.setItem(`clutch:host:${ack.sessionId}:code`, ack.code);
        sessionStorage.setItem(`clutch:host:${ack.sessionId}:publicHostUrl`, ack.publicHostUrl);
        close();
        ui.router.navigate(`/host/${ack.sessionId}`);
      } catch (err) {
        toast('Failed to start: ' + (err as Error).message, 'error');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
  });
}

function renderLeaderboard(ui: HostUI, p: LeaderboardPayload): void {
  renderBoard(ui, {
    mode: 'midgame',
    entries: p.entries,
    questionIndex: p.questionIndex,
    total: p.total,
  });
}

function renderPodium(ui: HostUI, p: GameOverPayload): void {
  renderBoard(ui, {
    mode: 'final',
    entries: p.final,
    questionIndex: ui.totalQuestions - 1,
    total: ui.totalQuestions,
  });
}

function renderWaiting(ui: HostUI, msg: string): void {
  ui.root.innerHTML = `
    <div class="h-full flex flex-col bg-clutch-paper">
      <header class="flex items-center px-10 pt-6">
        ${homeButtonHtml()}
      </header>
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div id="wordmark" class="mb-6"></div>
          <div class="text-2xl text-clutch-mute">${escapeHtml(msg)}</div>
        </div>
      </div>
    </div>
  `;
  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-4xl' });
  wireHomeButton(ui.router, ui.state !== 'final' && ui.state !== 'ended');
}

// Big-screen rendering: keep the code as a single, unbroken token. The dash
// previously used to chunk it (e.g. "AB12-CD") looked tidy on a small status
// row but read as a hyphen — more than one player typed the dash into the
// join form and bounced. Cleaner without it.
function formatCode(code: string): string {
  return code;
}

// ---------- leaderboard styling ----------
//
// Top 3 get medal-themed gradients (gold / silver / bronze) and a glow ring,
// 4th+ get a subtle paper card. The big-screen view uses these rich classes
// so the host's projector reads from the back of the room.

interface RankTheme {
  bg: string;
  ring: string;
  text: string;
  medalBg: string;
  medalText: string;
}

function rankTheme(rank: number): RankTheme {
  switch (rank) {
    case 1:
      // Gold — warm gradient with amber glow.
      return {
        bg: 'bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-xl shadow-amber-500/25 border border-amber-300/60',
        ring: 'ring-2 ring-amber-300/70',
        text: 'text-clutch-ink',
        medalBg: 'bg-white/85',
        medalText: 'text-amber-700',
      };
    case 2:
      // Silver — cool gradient, neutral ink.
      return {
        bg: 'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400 shadow-lg shadow-slate-400/25 border border-slate-200/60',
        ring: 'ring-2 ring-slate-200/80',
        text: 'text-clutch-ink',
        medalBg: 'bg-white/85',
        medalText: 'text-slate-600',
      };
    case 3:
      // Bronze — warm copper gradient with white type for contrast.
      return {
        bg: 'bg-gradient-to-br from-orange-300 via-amber-600 to-amber-800 shadow-lg shadow-amber-700/25 border border-amber-600/40',
        ring: 'ring-2 ring-amber-500/60',
        text: 'text-white',
        medalBg: 'bg-white/85',
        medalText: 'text-amber-800',
      };
    default:
      return {
        bg: 'bg-white shadow-sm border border-black/5',
        ring: '',
        text: 'text-clutch-ink',
        medalBg: 'bg-clutch-paper',
        medalText: 'text-clutch-mute',
      };
  }
}

function rankBadgeContent(rank: number): string {
  if (rank === 1) return crownSvg();
  if (rank === 2) return medalSvg();
  if (rank === 3) return medalSvg();
  return String(rank);
}

function crownSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M3 8l4 4 5-7 5 7 4-4-1.5 11h-15z" />
    </svg>
  `;
}

function medalSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 3l4 8 4-8" />
      <circle cx="12" cy="16" r="5" fill="currentColor" stroke="none" />
    </svg>
  `;
}

// Copy helper with fallback: the async Clipboard API only works in secure
// contexts (HTTPS / localhost). On http:// LAN hosts or older mobile browsers
// it throws or is missing, so we fall back to a hidden <textarea> + execCommand.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
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
