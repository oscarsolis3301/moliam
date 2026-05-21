import type { Router } from '../lib/router.js';
import { mountWordmark } from '../components/wordmark.js';
import { mountQuizEditor } from '../components/quizEditor.js';
import { getQuiz, updateQuiz } from '../lib/api.js';
import { toast } from '../components/modal.js';

export async function renderEditQuiz(
  app: HTMLElement,
  router: Router,
  quizId: string,
): Promise<void> {
  app.innerHTML = `
    <div class="min-h-full flex flex-col">
      <header class="px-8 pt-10 pb-4 flex items-center justify-between">
        <div id="wordmark"></div>
        <a id="back-to-quizzes" href="/host" data-link
           class="inline-flex items-center gap-1.5 rounded-2xl border border-black/10 bg-white shadow-sm px-3.5 py-2 text-sm font-medium text-clutch-mute hover:text-clutch-ink hover:bg-black/[0.03] hover:shadow-md transition-all"
           aria-label="Back to quizzes">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
          <span>Back to quizzes</span>
        </a>
      </header>
      <main class="flex-1 px-8 pb-12 max-w-4xl w-full mx-auto">
        <div id="editor-panel" class="rounded-3xl bg-white border border-black/5 shadow-sm p-6"></div>
        <p class="mt-4 text-xs text-clutch-mute">
          Edits apply to future games only. Sessions already in progress keep the version they started with.
        </p>
      </main>
    </div>
  `;

  mountWordmark(document.getElementById('wordmark')!, { sizeClass: 'text-4xl' });

  const panel = document.getElementById('editor-panel')!;
  panel.innerHTML = `<div class="text-sm text-clutch-mute">Loading quiz…</div>`;

  try {
    const quiz = await getQuiz(quizId);
    mountQuizEditor(panel, {
      heading: 'Edit quiz',
      name: quiz.name,
      questions: quiz.questions.map((q) => ({
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
      })),
      saveLabel: 'Save changes',
      // No secondary "Back" inside the editor — the page already has a Back
      // button in the header. Keeping it inside the editor doubled the
      // affordance and made it easy to click "Back" thinking it would save.
      onSave: async (draft) => {
        await updateQuiz(quizId, draft);
        toast('Changes saved', 'success');
      },
      stayOnSave: true,
    });
  } catch (err) {
    panel.innerHTML = `
      <div class="text-center py-10">
        <div class="text-xl font-semibold mb-2">Couldn't load quiz</div>
        <div class="text-sm text-clutch-red mb-6">${escapeHtml((err as Error).message)}</div>
        <a href="/" data-link class="rounded-2xl bg-clutch-ink text-white px-5 py-3 font-semibold">Back</a>
      </div>
    `;
  }
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
