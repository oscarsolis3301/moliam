import type { Router } from '../lib/router.js';
import { mountWordmark } from '../components/wordmark.js';
import { CLUTCH_API_BASE, listQuizzes } from '../lib/api.js';
import { emitAck } from '../lib/socket.js';
import { CLIENT_EVENTS } from '@shared/events.js';
import type { CreateSessionAck, QuizSummary, SimpleErrAck } from '@shared/schemas.js';
import { toast } from '../components/modal.js';

interface ResultsResponse {
  ok: true;
  sessionId: string;
  state: string;
  results: Array<{ name: string; score: number; rank: number }>;
}

export async function renderResults(
  app: HTMLElement,
  router: Router,
  sessionId: string,
): Promise<void> {
  app.innerHTML = `<div class="h-full flex items-center justify-center text-clutch-mute">Loading…</div>`;
  try {
    const res = await fetch(`${CLUTCH_API_BASE}/sessions/${sessionId}/results`);
    const json = (await res.json()) as ResultsResponse | { ok: false; error: string };
    if (!('ok' in json) || !json.ok) {
      app.innerHTML = `<div class="h-full flex items-center justify-center text-clutch-red">Not found.</div>`;
      return;
    }
    render(app, router, json);
  } catch {
    app.innerHTML = `<div class="h-full flex items-center justify-center text-clutch-red">Failed to load.</div>`;
  }
}

// We treat the viewer as the host for the just-finished session if the
// browser holds the same host metadata the host console stashed when it
// created or joined the session. This is best-effort: if the host opened
// results in a new tab/device, the "Start new quiz" CTA stays hidden.
function isHostForSession(sessionId: string): boolean {
  try {
    return sessionStorage.getItem(`clutch:host:${sessionId}:code`) !== null;
  } catch { return false; }
}

function render(app: HTMLElement, router: Router, data: ResultsResponse): void {
  const isHost = isHostForSession(data.sessionId);
  app.innerHTML = `
    <div class="min-h-full flex flex-col bg-clutch-paper">
      <header class="px-8 pt-8 flex items-center justify-between gap-3 flex-wrap">
        <div id="wordmark"></div>
        <div class="flex items-center gap-2">
          ${isHost ? `
            <button id="new-quiz-btn"
              class="inline-flex items-center gap-1.5 rounded-2xl bg-clutch-ink text-white shadow-sm px-4 py-2 text-sm font-semibold hover:bg-black active:scale-[0.99] transition-all"
              aria-label="Start a new quiz with the same party">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7"/>
                <path d="M21 4v5h-5"/>
              </svg>
              <span>New quiz · same party</span>
            </button>
          ` : ''}
          <a href="/" data-link
             class="inline-flex items-center gap-1.5 rounded-2xl border border-black/10 bg-white shadow-sm px-3.5 py-2 text-sm font-medium text-clutch-mute hover:text-clutch-ink hover:bg-black/[0.03] hover:shadow-md transition-all"
             aria-label="Back to home">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 11.5L12 4l9 7.5"/>
              <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>
            </svg>
            <span>Home</span>
          </a>
        </div>
      </header>
      <main class="flex-1 px-8 pb-12 max-w-3xl w-full mx-auto">
        <h1 class="text-4xl font-semibold mt-8 mb-2">Final results</h1>
        ${isHost ? `
          <p class="text-sm text-clutch-mute mb-6">
            Players still on this game keep their seat. Pick another quiz to play with the same party — no codes to re-enter.
          </p>
        ` : `<div class="mb-6"></div>`}
        ${data.results.length === 0 ? `
          <div class="rounded-3xl bg-white border border-black/5 p-8 text-center text-clutch-mute">No results recorded for this session.</div>
        ` : `
        <div class="space-y-2">
          ${data.results.map((r) => `
            <div class="flex items-center gap-4 rounded-3xl bg-white border border-black/5 px-5 py-4 shadow-sm">
              <div class="font-mono text-2xl font-bold w-10 ${r.rank <= 3 ? 'text-clutch-ink' : 'text-clutch-mute'}">${r.rank}</div>
              <div class="flex-1 text-xl font-semibold">${escapeHtml(r.name)}</div>
              <div class="font-mono text-xl font-bold">${r.score}</div>
            </div>
          `).join('')}
        </div>
        `}
      </main>
    </div>
  `;
  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-3xl' });

  if (isHost) {
    const btn = document.getElementById('new-quiz-btn');
    btn?.addEventListener('click', () => { void promptRotateSession(router, data.sessionId); });
  }
}

// Quiz picker modal that fires `host:rotate_session` for the current session.
// Players still connected to the room are migrated by the engine and bounce
// straight into the new lobby — no codes, no re-typed names.
async function promptRotateSession(router: Router, oldSessionId: string): Promise<void> {
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
          <p class="text-sm text-clutch-mute mt-1">Everyone still connected stays joined — no codes to re-enter.</p>
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
          { sessionId: oldSessionId, quizId },
        );
        if (!ack.ok) {
          toast('Could not start: ' + ack.reason, 'error');
          btn.disabled = false;
          btn.classList.remove('is-loading');
          return;
        }
        sessionStorage.setItem(`clutch:host:${ack.sessionId}:code`, ack.code);
        sessionStorage.setItem(`clutch:host:${ack.sessionId}:publicHostUrl`, ack.publicHostUrl);
        close();
        router.navigate(`/host/${ack.sessionId}`);
      } catch (err) {
        toast('Failed to start: ' + (err as Error).message, 'error');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
  });
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
