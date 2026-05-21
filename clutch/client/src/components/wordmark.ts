// CLUTCH wordmark: elegant serif ↔ playful rounded.
//
// Animation tactic: two full wordmarks stacked on top of each other, one per
// typeface. On each beat, every letter is driven by a keyframe that staggers
// by index — so the transform sweeps left-to-right instead of all letters
// moving simultaneously. A short motion-blur fake (blur+opacity+skew) during
// the handoff hides the fact that the glyph shapes don't actually morph.

const WORD = 'CLUTCH';
const STAGGER_MS = 55;      // per-letter delay within one sweep
const PHASE_MS = 900;       // duration of one full crossfade
const HOLD_MS = 2400;       // pause between cycles

export function mountWordmark(el: HTMLElement, opts: { sizeClass?: string } = {}): () => void {
  const size = opts.sizeClass ?? 'text-5xl';
  el.innerHTML = `
    <span class="clutch-mark ${size}" aria-label="Clutch">
      <span class="face face-elegant" aria-hidden="true">${letters('elegant')}</span>
      <span class="face face-playful" aria-hidden="true">${letters('playful')}</span>
    </span>
  `;

  const mark = el.querySelector('.clutch-mark') as HTMLElement;
  let phase: 'elegant' | 'playful' = 'elegant';
  let disposed = false;

  const swap = (): void => {
    if (disposed) return;
    phase = phase === 'elegant' ? 'playful' : 'elegant';
    mark.classList.toggle('is-playful', phase === 'playful');
  };

  // Initial kickoff, then a steady rhythm. First swap is quicker so the
  // intro feels lively.
  const kick = window.setTimeout(swap, 700);
  const interval = window.setInterval(swap, HOLD_MS + PHASE_MS);

  return (): void => {
    disposed = true;
    clearTimeout(kick);
    clearInterval(interval);
  };
}

function letters(face: 'elegant' | 'playful'): string {
  return WORD.split('')
    .map((ch, i) => {
      const delay = i * STAGGER_MS;
      return `<span class="ltr ltr-${face}" style="--d:${delay}ms">${ch}</span>`;
    })
    .join('');
}
