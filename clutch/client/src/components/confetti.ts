// Lightweight confetti. Spawns N absolutely-positioned divs inside a
// fixed-position overlay, each with randomized position/rotation/colour and
// a CSS animation. Self-cleans after the animation finishes.
//
// Used to celebrate a player jumping to #1 mid-game and at the final reveal.

const COLORS = ['#E53E3E', '#3182CE', '#ECC94B', '#38A169', '#0F0F14', '#FFFFFF'];

export interface ConfettiOptions {
  /** Total particles. Defaults to 80. */
  count?: number;
  /** Total duration in ms. Defaults to 1800. */
  duration?: number;
  /** Spread radius in viewport-relative units. 1 = whole viewport. */
  spread?: number;
  /** Start origin x in 0..1 (viewport-relative). Defaults to 0.5. */
  originX?: number;
  /** Start origin y in 0..1. Defaults to 0.35. */
  originY?: number;
}

export function fireConfetti(opts: ConfettiOptions = {}): void {
  const count = opts.count ?? 80;
  const duration = opts.duration ?? 1800;
  const spread = opts.spread ?? 0.7;
  const ox = opts.originX ?? 0.5;
  const oy = opts.originY ?? 0.35;

  const layer = document.createElement('div');
  layer.className = 'clutch-confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'clutch-confetti-piece';

    // Direction angle in radians, mostly upward (-π/2 ± spread).
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
    const distance = 0.45 * Math.min(vw, vh) * (0.6 + Math.random() * 0.8);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#FFFFFF';
    const size = 6 + Math.random() * 8;
    const rot = Math.random() * 720 - 360;
    const fall = 0.6 + Math.random() * 0.6;

    piece.style.setProperty('--cx', `${ox * vw}px`);
    piece.style.setProperty('--cy', `${oy * vh}px`);
    piece.style.setProperty('--dx', `${dx}px`);
    piece.style.setProperty('--dy', `${dy}px`);
    piece.style.setProperty('--rot', `${rot}deg`);
    piece.style.setProperty('--fall', `${fall * vh * 0.9}px`);
    piece.style.setProperty('--w', `${size}px`);
    piece.style.setProperty('--h', `${size * (Math.random() < 0.4 ? 1 : 0.45)}px`);
    piece.style.setProperty('--bg', color);
    piece.style.setProperty('--dur', `${duration}ms`);
    piece.style.setProperty('--delay', `${Math.random() * 200}ms`);

    layer.appendChild(piece);
  }

  window.setTimeout(() => layer.remove(), duration + 400);
}
