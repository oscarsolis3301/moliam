import type { QuestionDraft } from '@shared/schemas.js';
import { OPTIONS_PER_QUESTION, TILE_DEFS } from '@shared/constants.js';
import { shapeSvg } from './shapes.js';

export interface QuizEditorInit {
  /** Initial quiz name (suggested or loaded). */
  name: string;
  /** Initial questions. Mutated-by-copy internally — the caller's array is not touched. */
  questions: QuestionDraft[];
  /** Button label for the primary save action. */
  saveLabel: string;
  /** Optional cancel / secondary-action label. If omitted no secondary button. */
  secondaryLabel?: string;
  /** Heading shown at the top of the panel. */
  heading: string;
  /** Called when user clicks save. Return a promise; the editor disables the
   *  button and surfaces thrown errors in the panel. */
  onSave: (draft: { name: string; questions: QuestionDraft[] }) => Promise<void>;
  /** Called on secondary action (cancel, back, etc.). */
  onSecondary?: () => void;
  /** When true (default), the editor stays mounted after save and surfaces an
   *  in-place "Saved" indicator. When false, the parent owns post-save
   *  behavior (e.g. closing the panel, navigating). */
  stayOnSave?: boolean;
}

/** Mount the editor into `container`. Returns a disposer. */
export function mountQuizEditor(container: HTMLElement, init: QuizEditorInit): () => void {
  // Deep-copy questions so we don't mutate caller state.
  const state: QuestionDraft[] = init.questions.map((q) => ({
    text: q.text,
    options: [...q.options],
    correctIndex: q.correctIndex,
  }));
  let name = init.name;
  let saving = false;
  let dirty = false;
  let lastSavedAt: number | null = null;
  const stayOnSave = init.stayOnSave !== false;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <h2 class="text-xl font-semibold">${escapeHtml(init.heading)}</h2>
      <div class="flex items-center gap-2">
        <div data-role="status" class="quiz-editor-status quiz-editor-status-clean" aria-live="polite">
          <span data-role="status-dot" class="quiz-editor-status-dot"></span>
          <span data-role="status-text">No changes yet</span>
        </div>
        ${init.secondaryLabel
          ? `<button data-role="secondary" class="text-sm text-clutch-mute hover:text-clutch-ink px-3 py-2 rounded-xl">${escapeHtml(init.secondaryLabel)}</button>`
          : ''
        }
      </div>
    </div>

    <label class="block text-sm font-medium mb-1">Quiz name</label>
    <input data-role="name" class="w-full rounded-xl border border-black/10 px-3 py-2 mb-5" />

    <div class="flex items-center justify-between mb-2">
      <div class="text-sm text-clutch-mute" data-role="count"></div>
      <button data-role="add" class="rounded-xl border border-dashed border-black/20 hover:border-clutch-ink px-3 py-2 text-sm font-medium">+ Add question</button>
    </div>

    <div data-role="list" class="space-y-3 max-h-[55vh] overflow-y-auto pr-2"></div>

    <div data-role="error" class="hidden mt-3 rounded-xl border border-clutch-red/30 bg-red-50 text-clutch-red text-sm px-3 py-2"></div>

    <div class="mt-5 flex justify-end gap-2">
      <button data-role="save" class="rounded-2xl bg-clutch-ink text-white font-semibold px-5 py-3 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed">${escapeHtml(init.saveLabel)}</button>
    </div>
  `;

  const nameInput = container.querySelector<HTMLInputElement>('[data-role="name"]')!;
  const listEl = container.querySelector<HTMLElement>('[data-role="list"]')!;
  const countEl = container.querySelector<HTMLElement>('[data-role="count"]')!;
  const addBtn = container.querySelector<HTMLButtonElement>('[data-role="add"]')!;
  const saveBtn = container.querySelector<HTMLButtonElement>('[data-role="save"]')!;
  const errEl = container.querySelector<HTMLElement>('[data-role="error"]')!;
  const secBtn = container.querySelector<HTMLButtonElement>('[data-role="secondary"]');
  const statusEl = container.querySelector<HTMLElement>('[data-role="status"]')!;
  const statusTextEl = container.querySelector<HTMLElement>('[data-role="status-text"]')!;

  nameInput.value = name;
  nameInput.addEventListener('input', () => { name = nameInput.value; markDirty(); });

  // Browser-level guard: if the host bumps Reload, navigates away, or closes the
  // tab while there are unsaved edits, surface the standard "Leave site?" prompt.
  // The text shown is browser-controlled; only the existence of the listener
  // matters. The disposer below removes it so this doesn't leak across renders.
  const beforeUnload = (e: BeforeUnloadEvent): void => {
    if (!dirty || !stayOnSave) return;
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', beforeUnload);

  addBtn.addEventListener('click', () => {
    state.push(emptyQuestion());
    renderList();
    markDirty();
    // scroll the new question into view and focus its text input
    const last = listEl.lastElementChild as HTMLElement | null;
    last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    last?.querySelector<HTMLInputElement>('[data-field="text"]')?.focus();
  });

  saveBtn.addEventListener('click', async () => {
    if (saving) return;
    errEl.classList.add('hidden');
    const err = validate(name, state);
    if (err) {
      showErr(err);
      return;
    }
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    setStatus('saving', 'Saving…');
    try {
      await init.onSave({ name: name.trim(), questions: state });
      lastSavedAt = Date.now();
      dirty = false;
      saveBtn.classList.add('quiz-editor-save-flash');
      window.setTimeout(() => saveBtn.classList.remove('quiz-editor-save-flash'), 700);
      setStatus('saved', 'Saved just now');
    } catch (e) {
      showErr((e as Error).message || 'Save failed.');
      setStatus('error', 'Save failed');
    } finally {
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = init.saveLabel;
    }
  });

  if (secBtn && init.onSecondary) {
    secBtn.addEventListener('click', () => init.onSecondary!());
  }

  // Refresh the "Saved Xs ago" label every 15s so it doesn't get stale.
  // Self-clears once the container is detached — the upload flow blows the
  // panel away on save, and we don't want this interval (and its closure
  // over the DOM) to leak indefinitely.
  const statusTimer = window.setInterval(() => {
    if (!container.isConnected) {
      window.clearInterval(statusTimer);
      window.removeEventListener('beforeunload', beforeUnload);
      return;
    }
    if (lastSavedAt && !dirty && !saving) {
      setStatus('saved', `Saved ${formatRelative(Date.now() - lastSavedAt)}`);
    }
  }, 15_000);

  function setStatus(kind: 'clean' | 'dirty' | 'saving' | 'saved' | 'error', text: string): void {
    statusEl.classList.remove(
      'quiz-editor-status-clean',
      'quiz-editor-status-dirty',
      'quiz-editor-status-saving',
      'quiz-editor-status-saved',
      'quiz-editor-status-error',
    );
    statusEl.classList.add(`quiz-editor-status-${kind}`);
    statusTextEl.textContent = text;
  }

  function markDirty(): void {
    if (saving) return;
    if (!dirty) {
      dirty = true;
      setStatus('dirty', 'Unsaved changes');
    }
  }

  function showErr(msg: string): void {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  function renderList(): void {
    countEl.textContent = `${state.length} question${state.length === 1 ? '' : 's'}`;
    listEl.innerHTML = '';
    state.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'rounded-2xl border border-black/5 bg-white p-4';
      card.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="flex flex-col items-center gap-1 mt-1">
            <div class="text-xs font-mono text-clutch-mute w-6 text-center">${idx + 1}.</div>
            <div class="flex flex-col gap-0.5">
              <button data-action="up" class="w-6 h-6 rounded-md text-clutch-mute hover:bg-black/5 hover:text-clutch-ink disabled:opacity-30 disabled:hover:bg-transparent" ${idx === 0 ? 'disabled' : ''} title="Move up" aria-label="Move up">▲</button>
              <button data-action="down" class="w-6 h-6 rounded-md text-clutch-mute hover:bg-black/5 hover:text-clutch-ink disabled:opacity-30 disabled:hover:bg-transparent" ${idx === state.length - 1 ? 'disabled' : ''} title="Move down" aria-label="Move down">▼</button>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <input data-field="text" class="w-full rounded-lg border border-black/10 px-2 py-1.5 mb-2 font-medium" placeholder="Question text…" />
            <div class="grid grid-cols-2 gap-2">
              ${[0, 1, 2, 3].map((oi) => {
                const tile = TILE_DEFS[oi]!;
                return `
                  <label data-role="opt-${oi}" class="flex items-center gap-2 rounded-lg border border-black/5 px-2 py-1">
                    <input type="radio" name="correct-${idx}" value="${oi}" data-field="correct" />
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-md tile-${tile.color} flex-shrink-0">${shapeSvg(tile.shape, 14)}</span>
                    <input data-field="opt" data-idx="${oi}" class="flex-1 min-w-0 rounded-md border border-black/10 px-2 py-1 text-sm" placeholder="Option ${oi + 1}" />
                  </label>
                `;
              }).join('')}
            </div>
          </div>
          <button data-action="delete" class="text-clutch-mute hover:text-clutch-red text-xl leading-none px-1" title="Delete question" aria-label="Delete question">✕</button>
        </div>
      `;

      const textInput = card.querySelector<HTMLInputElement>('[data-field="text"]')!;
      textInput.value = q.text;
      textInput.addEventListener('input', () => { state[idx]!.text = textInput.value; markDirty(); });

      card.querySelectorAll<HTMLInputElement>('[data-field="opt"]').forEach((input) => {
        const oi = Number(input.dataset.idx);
        input.value = q.options[oi] ?? '';
        input.addEventListener('input', () => {
          state[idx]!.options[oi] = input.value;
          markDirty();
        });
      });

      card.querySelectorAll<HTMLInputElement>(`input[name="correct-${idx}"]`).forEach((r) => {
        const ri = Number(r.value);
        r.checked = ri === q.correctIndex;
        r.addEventListener('change', () => {
          state[idx]!.correctIndex = Number(r.value);
          // Re-apply highlight without a full re-render
          updateCorrectHighlight(card, state[idx]!.correctIndex);
          markDirty();
        });
      });
      updateCorrectHighlight(card, q.correctIndex);

      card.querySelector('[data-action="delete"]')!.addEventListener('click', () => {
        if (state.length === 1) {
          showErr('A quiz must have at least one question.');
          return;
        }
        state.splice(idx, 1);
        renderList();
        markDirty();
      });
      card.querySelector('[data-action="up"]')!.addEventListener('click', () => {
        if (idx === 0) return;
        [state[idx - 1]!, state[idx]!] = [state[idx]!, state[idx - 1]!];
        renderList();
        markDirty();
      });
      card.querySelector('[data-action="down"]')!.addEventListener('click', () => {
        if (idx === state.length - 1) return;
        [state[idx + 1]!, state[idx]!] = [state[idx]!, state[idx + 1]!];
        renderList();
        markDirty();
      });

      listEl.append(card);
    });
  }

  renderList();

  return () => {
    window.clearInterval(statusTimer);
    window.removeEventListener('beforeunload', beforeUnload);
    container.innerHTML = '';
  };
}

function formatRelative(ms: number): string {
  if (ms < 30_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return '1 hr ago';
  return `${hrs} hr ago`;
}

function updateCorrectHighlight(card: HTMLElement, correctIndex: number): void {
  for (let oi = 0; oi < OPTIONS_PER_QUESTION; oi++) {
    const el = card.querySelector<HTMLElement>(`[data-role="opt-${oi}"]`);
    if (!el) continue;
    el.classList.toggle('ring-2', oi === correctIndex);
    el.classList.toggle('ring-clutch-green', oi === correctIndex);
    el.classList.toggle('bg-green-50', oi === correctIndex);
  }
}

function emptyQuestion(): QuestionDraft {
  return { text: '', options: ['', '', '', ''], correctIndex: 0 };
}

function validate(name: string, qs: QuestionDraft[]): string | null {
  if (!name.trim()) return 'Quiz name is required.';
  if (qs.length === 0) return 'Quiz must have at least one question.';
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i]!;
    const where = `Question ${i + 1}`;
    if (!q.text.trim()) return `${where}: question text is required.`;
    if (q.options.some((o) => !o.trim())) {
      return `${where}: every answer must be filled in.`;
    }
    const lower = q.options.map((o) => o.trim().toLowerCase());
    if (new Set(lower).size !== lower.length) {
      return `${where}: duplicate answer values.`;
    }
    if (q.correctIndex < 0 || q.correctIndex >= OPTIONS_PER_QUESTION) {
      return `${where}: pick a correct answer.`;
    }
  }
  return null;
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
