import type { Router } from '../lib/router.js';
import { mountWordmark } from '../components/wordmark.js';
import { mountQuizEditor } from '../components/quizEditor.js';
import {
  CLUTCH_API_BASE,
  deleteQuiz,
  duplicateQuiz,
  listQuizzes,
  saveQuiz,
  uploadQuiz,
} from '../lib/api.js';
import { emitAck, getSocket } from '../lib/socket.js';
import { confirmModal, toast } from '../components/modal.js';
import { openPinGate } from '../components/pinGate.js';
import { hasValidStoredAuth } from '../lib/host-auth.js';
import type { QuestionDraft, QuizSummary, CreateSessionAck, SimpleErrAck } from '@shared/schemas.js';
import { CLIENT_EVENTS } from '@shared/events.js';

export async function renderHome(
  app: HTMLElement,
  router: Router,
  // 'chooser' = the host-or-join landing card (route "/").
  // 'host'    = the quiz dashboard, gated behind the PIN (route "/host").
  // Both share the same admin check and helper closures, so they live in one
  // entry point — the route just decides which one to mount.
  entryMode: 'chooser' | 'host' = 'chooser',
): Promise<void> {
  // Non-admins (anonymous or regular users) can only JOIN games. Admins see
  // the full chooser + quiz dashboard. We fetch isAdmin once on mount; if
  // the endpoint fails we fall back to join-only to avoid leaking host UI.
  let isAdmin = false;
  try {
    const r = await fetch(`${CLUTCH_API_BASE}/me`, { credentials: 'same-origin' });
    if (r.ok) {
      const j = (await r.json()) as { isAdmin?: boolean };
      isAdmin = !!j.isAdmin;
    }
  } catch { /* default: isAdmin = false */ }

  if (!isAdmin) {
    // Skip the chooser entirely and take the player straight to the join
    // form. The Host card would 403 at every request anyway.
    router.replace('/play');
    return;
  }

  // Dashboard search state. MUST be initialized before any code path that can
  // exit renderHome — otherwise the closures defined below will hit a TDZ
  // ("Cannot access 'allQuizzes' before initialization") when they run after
  // the function has returned. The /host entry path returns synchronously
  // before reaching the original declaration site, so hoist the bindings
  // here.
  let allQuizzes: QuizSummary[] = [];
  let searchQuery = '';

  if (entryMode === 'host') {
    void enterHostMode();
    return;
  }

  renderChooser();

  function renderChooser(): void {
    app.innerHTML = `
      <div class="min-h-full flex flex-col bg-clutch-paper relative">
        ${moliamBadge()}
        <header class="pt-12 pb-2 text-center">
          <div id="wordmark" class="inline-block"></div>
          <p class="mt-3 text-clutch-mute">Run a quiz. Any room. Any time.</p>
        </header>

        <main class="flex-1 flex items-center justify-center px-6 py-10">
          <div class="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">
            <button id="choose-host" class="choose-card group rounded-4xl bg-white border border-black/5 shadow-lg p-8 sm:p-10 text-left hover:-translate-y-0.5 hover:shadow-xl transition-all">
              <div class="choose-icon bg-clutch-ink text-white">
                ${hostIconSvg()}
              </div>
              <div class="mt-5 text-2xl font-semibold text-clutch-ink">Host a game</div>
              <div class="mt-1 text-sm text-clutch-mute">Pick a quiz, share the code, run the show.</div>
              <div class="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-clutch-ink group-hover:gap-2 transition-all">
                Start hosting
                <span aria-hidden="true">→</span>
              </div>
            </button>

            <button id="choose-join" class="choose-card group rounded-4xl bg-white border border-black/5 shadow-lg p-8 sm:p-10 text-left hover:-translate-y-0.5 hover:shadow-xl transition-all">
              <div class="choose-icon bg-clutch-blue text-white">
                ${joinIconSvg()}
              </div>
              <div class="mt-5 text-2xl font-semibold text-clutch-ink">Join a game</div>
              <div class="mt-1 text-sm text-clutch-mute">Got a code? Jump in on your phone.</div>
              <div class="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-clutch-blue group-hover:gap-2 transition-all">
                Enter a code
                <span aria-hidden="true">→</span>
              </div>
            </button>
          </div>
        </main>

        <footer class="pb-8 text-center text-xs text-clutch-mute">
          Self-hosted. No accounts. No AI. Just quizzes.
        </footer>
      </div>
    `;
    mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-6xl' });
    // The "Host a game" card navigates to /host so the URL reflects the
    // current view (deep-linkable, browser-back works). The route handler in
    // main.ts re-enters this file with entryMode='host', which then runs the
    // PIN gate before rendering the dashboard.
    document.getElementById('choose-host')!.addEventListener('click', () => {
      router.navigate('/host');
    });
    document.getElementById('choose-join')!.addEventListener('click', () => {
      router.navigate('/play');
    });
  }

  // Gate the dashboard behind the host PIN. If the browser already has a
  // valid token from a prior unlock, skip straight to the dashboard so
  // returning hosts don't re-type 3301 every visit. Cancelling the gate
  // sends them back to the chooser instead of stranding them on a blank
  // /host URL.
  async function enterHostMode(): Promise<void> {
    if (await hasValidStoredAuth()) {
      void renderDashboard();
      return;
    }
    const token = await openPinGate({
      title: 'Host mode',
      message: 'Enter the host PIN to manage and run quizzes.',
    });
    if (!token) {
      router.navigate('/');
      return;
    }
    void renderDashboard();
  }

  async function renderDashboard(): Promise<void> {
    app.innerHTML = `
    <div class="min-h-full flex flex-col relative">
      <header class="px-8 pt-10 pb-4 flex items-center justify-between">
        <a id="back-to-chooser" href="/" data-link
           class="inline-flex items-center gap-1.5 rounded-2xl bg-white/80 backdrop-blur-sm border border-black/5 shadow-sm hover:shadow-md hover:bg-white text-clutch-mute hover:text-clutch-ink transition-all px-3 py-2 text-sm font-medium"
           aria-label="Back to chooser">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6"/>
          </svg>
          <span>Back</span>
        </a>
        <div id="wordmark"></div>
      </header>

      <main class="flex-1 px-8 pb-12 max-w-5xl w-full mx-auto">
        <div class="mt-6 mb-10 text-center">
          <h1 class="text-3xl md:text-4xl font-semibold tracking-tight">Run a quiz. Any room. Any time.</h1>
          <p class="mt-3 text-clutch-mute">Upload an Excel, share the code, play.</p>
        </div>

        <section class="grid md:grid-cols-2 gap-6">
          <div class="rounded-3xl bg-white shadow-sm border border-black/5 p-6">
            <h2 class="text-xl font-semibold mb-1">Build a new quiz</h2>
            <p class="text-sm text-clutch-mute mb-4">
              Author one in the browser, or upload a spreadsheet to seed the questions.
            </p>

            <button id="new-blank" type="button" class="host-create-card mb-4">
              <span class="host-create-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 5v14"/>
                  <path d="M5 12h14"/>
                </svg>
              </span>
              <span class="flex-1 min-w-0">
                <span class="block host-create-title">Start from scratch</span>
                <span class="block host-create-subtitle">Open the editor and build question by question</span>
              </span>
              <span class="host-create-arrow" aria-hidden="true">→</span>
            </button>

            <div class="flex items-center gap-3 my-3 text-[0.7rem] uppercase tracking-[0.2em] text-clutch-mute">
              <div class="flex-1 h-px bg-black/5"></div>
              <span>or import</span>
              <div class="flex-1 h-px bg-black/5"></div>
            </div>

            <label class="block rounded-2xl border-2 border-dashed border-black/10 hover:border-clutch-blue transition-colors p-5 text-center cursor-pointer">
              <input id="file" type="file" accept=".xlsx,.xls,.csv" class="hidden" />
              <div id="dropzone-text" class="text-clutch-mute text-sm">Drop or click to upload .xlsx / .csv</div>
              <div class="text-xs text-clutch-mute/80 mt-1">
                Col A: question, B: correct, C/D/E: wrong — up to 100 Qs.
                <a href="${CLUTCH_API_BASE}/quizzes/template" class="text-clutch-blue underline" onclick="event.stopPropagation()">Download template</a>
              </div>
            </label>
            <div id="upload-error" class="mt-3 text-sm text-clutch-red hidden"></div>
          </div>

          <div class="rounded-3xl bg-white shadow-sm border border-black/5 p-6">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xl font-semibold">Your quizzes</h2>
              <button id="refresh" class="text-sm text-clutch-mute hover:text-clutch-ink">Refresh</button>
            </div>
            <div class="relative mb-3">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-clutch-mute pointer-events-none">
                ${searchIconSvg()}
              </span>
              <input id="quiz-search" type="search" autocomplete="off" spellcheck="false"
                placeholder="Search quizzes by name…"
                class="w-full rounded-2xl border border-black/10 pl-10 pr-9 py-2.5 text-sm focus:border-clutch-ink focus:outline-none placeholder:text-clutch-mute/70" />
              <button id="quiz-search-clear" type="button" aria-label="Clear search"
                class="hidden absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-clutch-mute hover:text-clutch-ink hover:bg-black/5">
                ${clearIconSvg()}
              </button>
            </div>
            <div id="quiz-list" class="space-y-2"></div>
          </div>
        </section>

        <section id="review" class="hidden mt-10 rounded-3xl bg-white border border-black/5 shadow-sm p-6"></section>

        <a href="/audit" data-link class="audit-entry-card group mt-10 block rounded-3xl p-6 sm:p-7 relative overflow-hidden">
          <div class="audit-entry-glow" aria-hidden="true"></div>
          <div class="relative flex items-center gap-5">
            <div class="audit-entry-icon">
              ${auditEntryIconSvg()}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs uppercase tracking-[0.22em] text-white/60 mb-1">New</div>
              <div class="text-xl sm:text-2xl font-semibold text-white">Audit dashboard</div>
              <div class="text-sm text-white/70 mt-1">
                Review every session — players, accuracy, timeline. Export a branded PDF in one click.
              </div>
            </div>
            <div class="audit-entry-cta hidden sm:flex">
              <span>Open</span>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </a>

        <footer class="mt-16 text-center text-xs text-clutch-mute">
          Self-hosted. No accounts. No AI. Just quizzes.
        </footer>
      </main>
    </div>
  `;

  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-4xl' });
  // The Back link is a real <a href="/" data-link>, so the SPA router handles
  // navigation back to the chooser. No JS click handler needed here.

  await refreshQuizList();
  wireUpload();
  wireSearch();
  document.getElementById('refresh')!.addEventListener('click', () => void refreshQuizList());
  document.getElementById('new-blank')!.addEventListener('click', () => {
    showEditorForNew('Untitled quiz', [emptyQuestion()]);
  });
  }

  // (allQuizzes / searchQuery are declared at the top of renderHome — see
  // note there about the TDZ trap when entering via /host.)

  async function refreshQuizList(): Promise<void> {
    const list = document.getElementById('quiz-list')!;
    list.innerHTML = `<div class="text-sm text-clutch-mute">Loading…</div>`;
    try {
      allQuizzes = await listQuizzes();
      applyQuizFilter();
    } catch (err) {
      list.innerHTML = `<div class="text-sm text-clutch-red">Failed to load: ${escapeHtml((err as Error).message)}</div>`;
    }
  }

  function wireSearch(): void {
    const input = document.getElementById('quiz-search') as HTMLInputElement | null;
    const clearBtn = document.getElementById('quiz-search-clear') as HTMLButtonElement | null;
    if (!input) return;
    input.addEventListener('input', () => {
      searchQuery = input.value;
      if (clearBtn) clearBtn.classList.toggle('hidden', input.value.length === 0);
      applyQuizFilter();
    });
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      searchQuery = '';
      clearBtn.classList.add('hidden');
      applyQuizFilter();
      input.focus();
    });
  }

  function applyQuizFilter(): void {
    const list = document.getElementById('quiz-list');
    if (!list) return;
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? allQuizzes.filter((quiz) => quiz.name.toLowerCase().includes(q))
      : allQuizzes;
    if (filtered.length === 0) {
      list.innerHTML = q
        ? `<div class="text-sm text-clutch-mute">No quizzes match "${escapeHtml(searchQuery.trim())}".</div>`
        : `<div class="text-sm text-clutch-mute">No quizzes yet. Upload one to get started.</div>`;
      return;
    }
    renderQuizList(list, filtered);
  }

  function renderQuizList(list: HTMLElement, quizzes: QuizSummary[]): void {
    list.innerHTML = '';
    for (const q of quizzes) {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between rounded-2xl border border-black/5 px-4 py-3 hover:bg-black/[0.02] gap-3';
      row.innerHTML = `
        <div class="min-w-0 flex-1">
          <div class="font-medium truncate">${escapeHtml(q.name)}</div>
          <div class="text-xs text-clutch-mute">${q.questionCount} question${q.questionCount === 1 ? '' : 's'} · ${new Date(q.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button data-action="host"      class="rounded-xl px-3 py-2 bg-clutch-ink text-white text-sm font-medium hover:bg-black">Host</button>
          <button data-action="edit"      class="rounded-xl px-2.5 py-2 text-clutch-mute hover:text-clutch-ink hover:bg-black/5 text-sm"      title="Edit"      aria-label="Edit">✎</button>
          <button data-action="duplicate" class="rounded-xl px-2.5 py-2 text-clutch-mute hover:text-clutch-ink hover:bg-black/5 text-sm"      title="Duplicate" aria-label="Duplicate">⎘</button>
          <button data-action="delete"    class="rounded-xl px-2.5 py-2 text-clutch-mute hover:text-clutch-red  hover:bg-red-50 text-sm"      title="Delete"    aria-label="Delete">✕</button>
        </div>
      `;
      row.querySelector('[data-action="host"]')!.addEventListener('click', () => void startHost(q.id));
      row.querySelector('[data-action="edit"]')!.addEventListener('click', () => router.navigate(`/quiz/${q.id}`));
      row.querySelector('[data-action="duplicate"]')!.addEventListener('click', async () => {
        try {
          await duplicateQuiz(q.id);
          await refreshQuizList();
        } catch (err) {
          toast('Duplicate failed: ' + (err as Error).message, 'error');
        }
      });
      row.querySelector('[data-action="delete"]')!.addEventListener('click', async () => {
        const ok = await confirmModal({
          title: `Delete "${q.name}"?`,
          message: 'This permanently removes the quiz and any past session history for it.',
          confirmText: 'Delete',
          destructive: true,
        });
        if (!ok) return;
        try {
          await deleteQuiz(q.id);
          await refreshQuizList();
        } catch (err) {
          toast('Delete failed: ' + (err as Error).message, 'error');
        }
      });
      list.append(row);
    }
  }

  async function startHost(quizId: string): Promise<void> {
    try {
      const s = getSocket();
      if (!s.connected) {
        await new Promise<void>((resolve) => s.once('connect', () => resolve()));
      }
      const ack = await emitAck<CreateSessionAck | SimpleErrAck>(
        CLIENT_EVENTS.HostCreateSession,
        { quizId },
      );
      if (!ack.ok) {
        toast('Failed to create session: ' + ack.reason, 'error');
        return;
      }
      sessionStorage.setItem(`clutch:host:${ack.sessionId}:code`, ack.code);
      sessionStorage.setItem(`clutch:host:${ack.sessionId}:publicHostUrl`, ack.publicHostUrl);
      router.navigate(`/host/${ack.sessionId}`);
    } catch (err) {
      toast('Failed to start: ' + (err as Error).message, 'error');
    }
  }

  function wireUpload(): void {
    const input = document.getElementById('file') as HTMLInputElement;
    const errBox = document.getElementById('upload-error') as HTMLElement;
    input.addEventListener('change', async () => {
      errBox.classList.add('hidden');
      const file = input.files?.[0];
      if (!file) return;
      const res = await uploadQuiz(file);
      if (!res.ok) {
        errBox.classList.remove('hidden');
        errBox.innerHTML = res.errors
          .map((e) => `Row ${e.row}: ${escapeHtml(e.reason)}`)
          .join('<br>');
        input.value = '';
        return;
      }
      showEditorForNew(res.suggestedName, res.questions);
      input.value = '';
    });
  }

  function showEditorForNew(suggestedName: string, questions: QuestionDraft[]): void {
    const el = document.getElementById('review')!;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    mountQuizEditor(el, {
      heading: 'Review and save',
      name: suggestedName,
      questions,
      saveLabel: 'Save quiz',
      secondaryLabel: 'Cancel',
      onSave: async (draft) => {
        await saveQuiz(draft);
        el.classList.add('hidden');
        el.innerHTML = '';
        await refreshQuizList();
      },
      onSecondary: () => {
        el.classList.add('hidden');
        el.innerHTML = '';
      },
    });
  }
}

function emptyQuestion(): QuestionDraft {
  return { text: '', options: ['', '', '', ''], correctIndex: 0 };
}

// Brand badge in the top-left of the home view. Anchored absolutely so it
// floats over the existing centered header without disturbing its layout.
// Plain href (no data-link, no target=_blank) — clicking it leaves Clutch
// for moliam.com's root, exactly as requested.
function moliamBadge(): string {
  return `
    <a href="https://moliam.com/" rel="noopener"
       title="moliam.com"
       class="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 inline-flex items-center justify-center rounded-full bg-white/70 backdrop-blur-sm border border-black/5 shadow-sm hover:shadow-md hover:bg-white hover:-translate-y-0.5 transition-all p-1.5">
      <img src="/moliam-logo.png" alt="moliam.com"
           class="w-10 h-10 sm:w-12 sm:h-12 object-contain"
           draggable="false" />
    </a>
  `;
}

function hostIconSvg(): string {
  // Screen + stand — stylised "present to the room" glyph.
  return `
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <path d="M8 10l3 2-3 2" />
    </svg>
  `;
}

function searchIconSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  `;
}

function clearIconSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  `;
}

function auditEntryIconSvg(): string {
  // Stylised dashboard glyph: chart bars + ring.
  return `
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 19V8" />
      <path d="M9 19v-6" />
      <path d="M14 19v-9" />
      <path d="M19 19V5" />
      <path d="M3 19h18" />
    </svg>
  `;
}

function joinIconSvg(): string {
  // Phone outline — matches the "phones show answer tiles" metaphor.
  return `
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M10 18h4" />
    </svg>
  `;
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
