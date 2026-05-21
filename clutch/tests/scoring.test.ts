import { describe, it, expect } from 'vitest';
import { computeScore } from '../server/src/game/scoring.js';
import { QUESTION_DURATION_MS } from '../shared/constants.js';

describe('scoring', () => {
  it('wrong answer is always 0', () => {
    expect(computeScore({ correct: false, elapsedMs: 0 })).toBe(0);
    expect(computeScore({ correct: false, elapsedMs: 5000 })).toBe(0);
    expect(computeScore({ correct: false, elapsedMs: QUESTION_DURATION_MS })).toBe(0);
  });

  it('fastest correct is ~1000', () => {
    expect(computeScore({ correct: true, elapsedMs: 0 })).toBe(1000);
  });

  it('slowest correct (at deadline) is 500', () => {
    expect(computeScore({ correct: true, elapsedMs: QUESTION_DURATION_MS })).toBe(500);
  });

  it('halfway through yields ~750', () => {
    const score = computeScore({ correct: true, elapsedMs: QUESTION_DURATION_MS / 2 });
    expect(score).toBeGreaterThanOrEqual(745);
    expect(score).toBeLessThanOrEqual(755);
  });

  it('elapsed past deadline clamps to 500', () => {
    expect(
      computeScore({ correct: true, elapsedMs: QUESTION_DURATION_MS + 10_000 }),
    ).toBe(500);
  });

  it('negative elapsed clamps to 0 -> 1000', () => {
    expect(computeScore({ correct: true, elapsedMs: -500 })).toBe(1000);
  });
});
