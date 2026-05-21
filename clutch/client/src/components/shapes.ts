import type { Shape } from '@shared/constants.js';

export function shapeSvg(shape: Shape, size = 96): string {
  const s = size;
  const stroke = 'white';
  const fill = 'white';
  switch (shape) {
    case 'triangle':
      return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">
        <polygon points="50,12 92,88 8,88" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
      </svg>`;
    case 'diamond':
      return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">
        <polygon points="50,8 92,50 50,92 8,50" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
      </svg>`;
    case 'circle':
      return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">
        <circle cx="50" cy="50" r="40" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
      </svg>`;
    case 'square':
      return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">
        <rect x="14" y="14" width="72" height="72" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
      </svg>`;
  }
}
