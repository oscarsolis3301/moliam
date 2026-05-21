// In-app replacements for the browser's native confirm()/alert() dialogs.
//
// Native dialogs show the URL ("10.20.44.88:3000 says") which looks
// unprofessional on LAN deployments and blocks the main thread. These async
// replacements render inside the app shell, respect Tailwind styling, and
// resolve to a boolean (confirm) or void (toast).

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** When true, the confirm button renders in the destructive red style. */
  destructive?: boolean;
}

type ToastKind = 'info' | 'success' | 'error';

/**
 * Show a modal and resolve to true if the user confirmed, false if they
 * cancelled (button, Esc key, or backdrop click). Only one confirm modal can
 * be open at a time — opening a second cancels the first.
 */
export function confirmModal(opts: ConfirmOptions): Promise<boolean> {
  // Close any stale modal first so rapid double-triggers don't stack.
  closeOpenConfirm(false);

  return new Promise<boolean>((resolve) => {
    const {
      title,
      message = '',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      destructive = false,
    } = opts;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const backdrop = document.createElement('div');
    backdrop.className =
      'fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-sm px-4 clutch-modal-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const confirmBtnClass = destructive
      ? 'bg-clutch-red hover:bg-red-700 text-white'
      : 'bg-clutch-ink hover:bg-black text-white';

    backdrop.innerHTML = `
      <div class="clutch-modal-panel w-full max-w-md rounded-3xl bg-white shadow-2xl p-7" role="dialog" aria-modal="true" aria-labelledby="clutch-modal-title">
        <h2 id="clutch-modal-title" class="text-xl font-semibold text-clutch-ink">${escapeHtml(title)}</h2>
        ${message ? `<p class="mt-2 text-clutch-mute leading-relaxed">${escapeHtml(message)}</p>` : ''}
        <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" data-role="cancel" class="rounded-2xl border border-black/10 text-clutch-ink px-5 py-2.5 font-semibold hover:bg-black/5 transition-colors">${escapeHtml(cancelText)}</button>
          <button type="button" data-role="confirm" class="rounded-2xl ${confirmBtnClass} px-5 py-2.5 font-semibold transition-colors">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const panel = backdrop.querySelector<HTMLElement>('.clutch-modal-panel')!;
    const confirmBtn = backdrop.querySelector<HTMLButtonElement>('[data-role="confirm"]')!;
    const cancelBtn = backdrop.querySelector<HTMLButtonElement>('[data-role="cancel"]')!;

    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      panel.classList.add('clutch-modal-leave');
      backdrop.classList.add('clutch-modal-leave');
      window.setTimeout(() => {
        backdrop.remove();
        document.removeEventListener('keydown', onKey);
        openConfirmCloser = null;
        try { previouslyFocused?.focus?.(); } catch { /* noop */ }
        resolve(result);
      }, 140);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Tab') trapFocus(e, [cancelBtn, confirmBtn]);
    };

    confirmBtn.addEventListener('click', () => finish(true));
    cancelBtn.addEventListener('click', () => finish(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finish(false); });
    document.addEventListener('keydown', onKey);

    openConfirmCloser = (result: boolean) => finish(result);

    // Focus the non-destructive default (cancel on destructive, confirm
    // otherwise) so an accidental Enter does the safe thing.
    requestAnimationFrame(() => {
      (destructive ? cancelBtn : confirmBtn).focus();
    });
  });
}

/**
 * Non-blocking toast for transient status messages. Replaces alert(). Stacks
 * multiple toasts vertically; each auto-dismisses after ~3s.
 */
export function toast(message: string, kind: ToastKind = 'info'): void {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  const palette: Record<ToastKind, string> = {
    info: 'bg-clutch-ink text-white',
    success: 'bg-clutch-green text-white',
    error: 'bg-clutch-red text-white',
  };
  el.className =
    `clutch-toast ${palette[kind]} rounded-2xl px-4 py-2.5 shadow-lg text-sm font-medium max-w-sm pointer-events-auto`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  container.appendChild(el);

  window.setTimeout(() => {
    el.classList.add('clutch-toast-leave');
    window.setTimeout(() => el.remove(), 200);
  }, 3000);
}

// ---------- internals ----------

let openConfirmCloser: ((result: boolean) => void) | null = null;
function closeOpenConfirm(result: boolean): void {
  openConfirmCloser?.(result);
}

function ensureToastContainer(): HTMLElement {
  let c = document.getElementById('clutch-toast-root');
  if (c) return c;
  c = document.createElement('div');
  c.id = 'clutch-toast-root';
  c.className =
    'fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none';
  document.body.appendChild(c);
  return c;
}

function trapFocus(e: KeyboardEvent, tabbables: HTMLElement[]): void {
  if (tabbables.length === 0) return;
  const first = tabbables[0]!;
  const last = tabbables[tabbables.length - 1]!;
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
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
