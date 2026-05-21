import { getHostAuthState, verifyHostPin } from '../lib/api.js';
import { persistToken } from '../lib/host-auth.js';

// Host-mode PIN gate. Opens a themed modal styled to match the rest of the
// chooser/dashboard: clutch-paper backdrop, rounded-3xl panel, clutch-ink
// primary button. Resolves with the verified token on success, or null if the
// user cancels.
//
// On the wire it talks to /api/host-auth/{state,verify}. State is fetched on
// open so a returning user who already burned attempts sees the lockout
// countdown immediately instead of typing into a doomed field.

export interface PinGateOptions {
  title?: string;
  message?: string;
}

export function openPinGate(opts: PinGateOptions = {}): Promise<string | null> {
  const title = opts.title ?? 'Host mode';
  const message = opts.message ?? 'Enter the host PIN to continue.';

  return new Promise<string | null>((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const backdrop = document.createElement('div');
    backdrop.className =
      'fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-sm px-4 clutch-modal-backdrop';
    backdrop.setAttribute('role', 'presentation');

    backdrop.innerHTML = `
      <div class="clutch-modal-panel w-full max-w-md rounded-3xl bg-white shadow-2xl p-7" role="dialog" aria-modal="true" aria-labelledby="pin-gate-title">
        <div class="flex items-center gap-3 mb-1">
          <div class="rounded-2xl bg-clutch-ink/5 text-clutch-ink p-2">
            ${lockSvg()}
          </div>
          <div>
            <h2 id="pin-gate-title" class="text-xl font-semibold text-clutch-ink">${escapeHtml(title)}</h2>
            <p class="text-sm text-clutch-mute">${escapeHtml(message)}</p>
          </div>
        </div>

        <form id="pin-form" class="mt-5 space-y-3" novalidate>
          <label for="pin-input" class="text-xs uppercase tracking-[0.2em] text-clutch-mute">PIN</label>
          <input
            id="pin-input"
            name="pin"
            type="password"
            inputmode="numeric"
            autocomplete="off"
            spellcheck="false"
            maxlength="32"
            autocapitalize="off"
            placeholder="••••"
            class="w-full rounded-2xl border border-black/10 px-4 py-3 text-2xl font-mono text-center tracking-[0.6em] focus:border-clutch-ink focus:outline-none focus:placeholder-transparent" />

          <div id="pin-meta" class="text-xs text-clutch-mute min-h-[1.25rem]"></div>
          <div id="pin-err"  class="hidden text-sm text-clutch-red text-center"></div>

          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button type="button" data-role="cancel" class="rounded-2xl border border-black/10 text-clutch-ink px-5 py-2.5 font-semibold hover:bg-black/5 transition-colors">Cancel</button>
            <button type="submit" data-role="submit" class="rounded-2xl bg-clutch-ink hover:bg-black text-white px-5 py-2.5 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Unlock</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(backdrop);

    const panel = backdrop.querySelector<HTMLElement>('.clutch-modal-panel')!;
    const form = backdrop.querySelector<HTMLFormElement>('#pin-form')!;
    const input = backdrop.querySelector<HTMLInputElement>('#pin-input')!;
    const submitBtn = backdrop.querySelector<HTMLButtonElement>('[data-role="submit"]')!;
    const cancelBtn = backdrop.querySelector<HTMLButtonElement>('[data-role="cancel"]')!;
    const metaEl = backdrop.querySelector<HTMLElement>('#pin-meta')!;
    const errEl = backdrop.querySelector<HTMLElement>('#pin-err')!;

    let settled = false;
    let lockoutTicker: number | null = null;

    const finish = (result: string | null): void => {
      if (settled) return;
      settled = true;
      if (lockoutTicker !== null) window.clearInterval(lockoutTicker);
      panel.classList.add('clutch-modal-leave');
      backdrop.classList.add('clutch-modal-leave');
      window.setTimeout(() => {
        backdrop.remove();
        document.removeEventListener('keydown', onKey);
        try { previouslyFocused?.focus?.(); } catch { /* noop */ }
        resolve(result);
      }, 140);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); }
    };

    document.addEventListener('keydown', onKey);
    cancelBtn.addEventListener('click', () => finish(null));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finish(null); });

    // Numeric-only sanitization. The PIN is expected to be digits, but we
    // leave maxlength generous in case it ever changes.
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/[^0-9]/g, '');
      if (cleaned !== input.value) input.value = cleaned;
      errEl.classList.add('hidden');
    });

    const showError = (msg: string): void => {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
      errEl.classList.add('shake');
      window.setTimeout(() => errEl.classList.remove('shake'), 500);
    };

    const setMeta = (msg: string): void => {
      metaEl.textContent = msg;
    };

    const enterLockout = (lockedFor: number): void => {
      submitBtn.disabled = true;
      input.disabled = true;
      const renderCountdown = (): void => {
        const remaining = Math.max(0, lockedFor - 1000);
        lockedFor = remaining;
        if (remaining <= 0) {
          // Server may not have actually reset yet, but the UI re-enables so
          // the user can try — the next verify call will tell the truth.
          if (lockoutTicker !== null) {
            window.clearInterval(lockoutTicker);
            lockoutTicker = null;
          }
          submitBtn.disabled = false;
          input.disabled = false;
          setMeta('Try again now.');
          input.focus();
          return;
        }
        const mins = Math.floor(remaining / 60_000);
        const secs = Math.floor((remaining % 60_000) / 1000);
        setMeta(`Locked. Try again in ${mins}:${secs.toString().padStart(2, '0')}.`);
      };
      renderCountdown();
      lockoutTicker = window.setInterval(renderCountdown, 1000);
    };

    // Pre-flight: if the server says this IP is locked already, jump straight
    // into countdown mode without requiring a wasted submit.
    void getHostAuthState().then((s) => {
      if (settled || !s) return;
      if (s.locked) {
        enterLockout(s.lockedFor);
        return;
      }
      if (s.remainingAttempts < s.maxAttempts) {
        setMeta(`${s.remainingAttempts} of ${s.maxAttempts} attempts remaining.`);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = input.value.trim();
      if (!pin) { showError('PIN is required.'); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Checking…';
      try {
        const result = await verifyHostPin(pin);
        if (result.ok) {
          persistToken(result.token);
          finish(result.token);
          return;
        }
        // Failure: surface reason + remaining attempts. Lockout switches into
        // countdown mode and disables the form.
        if (result.retryAfterMs && result.retryAfterMs > 0) {
          showError(result.reason);
          enterLockout(result.retryAfterMs);
          return;
        }
        const left = result.remainingAttempts;
        if (typeof left === 'number') {
          setMeta(`${left} of 5 attempts remaining.`);
        }
        showError(result.reason || 'Incorrect PIN.');
        input.value = '';
        input.focus();
      } catch (err) {
        showError((err as Error).message || 'Verification failed.');
      } finally {
        if (!settled) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Unlock';
        }
      }
    });

    requestAnimationFrame(() => {
      try { input.focus(); } catch { /* noop */ }
    });
  });
}

function lockSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
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
