import { QUESTION_DURATION_MS } from '../../../shared/constants.js';

/**
 * Kahoot-style speed scoring.
 * Correct answer: 1000 * (1 - (elapsed / duration) / 2)
 *   fastest correct ≈ 1000, slowest correct = 500.
 * Wrong or no answer: 0.
 *
 * elapsedMs is clamped to [0, duration].
 */
export function computeScore(args: {
  correct: boolean;
  elapsedMs: number;
  durationMs?: number;
}): number {
  if (!args.correct) return 0;
  const duration = args.durationMs ?? QUESTION_DURATION_MS;
  const elapsed = Math.max(0, Math.min(args.elapsedMs, duration));
  const raw = 1000 * (1 - elapsed / duration / 2);
  return Math.round(raw);
}
