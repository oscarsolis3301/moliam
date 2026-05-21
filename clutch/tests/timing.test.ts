import { describe, it, expect } from 'vitest';
import { effectiveElapsedMs, isWithinGrace, computeDeadline } from '../server/src/game/timing.js';
import { QUESTION_DURATION_MS } from '../shared/constants.js';

describe('timing', () => {
  it('computes raw elapsed when not paused', () => {
    const startedAt = 1_000_000;
    const now = startedAt + 5000;
    expect(effectiveElapsedMs({ now, startedAt, pausedAt: null, pauseAccumMs: 0 })).toBe(5000);
  });

  it('subtracts accumulated pauses', () => {
    const startedAt = 1_000_000;
    const now = startedAt + 10_000;
    expect(effectiveElapsedMs({ now, startedAt, pausedAt: null, pauseAccumMs: 3000 })).toBe(7000);
  });

  it('subtracts live pause time', () => {
    const startedAt = 1_000_000;
    const pausedAt = startedAt + 5000;
    const now = pausedAt + 2000; // 2s into pause
    expect(effectiveElapsedMs({ now, startedAt, pausedAt, pauseAccumMs: 0 })).toBe(5000);
  });

  it('multiple pause cycles accumulate correctly', () => {
    const startedAt = 1_000_000;
    // 2s elapsed, pause for 3s, 3s elapsed, pause for 5s, 1s elapsed = 6s effective
    let pauseAccum = 0;
    pauseAccum += 3000;
    pauseAccum += 5000;
    const now = startedAt + 2000 + 3000 + 3000 + 5000 + 1000; // 14s wall
    expect(effectiveElapsedMs({ now, startedAt, pausedAt: null, pauseAccumMs: pauseAccum })).toBe(6000);
  });

  it('isWithinGrace: before deadline', () => {
    expect(
      isWithinGrace({
        now: 1_005_000,
        startedAt: 1_000_000,
        pausedAt: null,
        pauseAccumMs: 0,
      }),
    ).toBe(true);
  });

  it('isWithinGrace: within grace window', () => {
    expect(
      isWithinGrace({
        now: 1_020_500, // 20.5s elapsed, grace is 1000ms
        startedAt: 1_000_000,
        pausedAt: null,
        pauseAccumMs: 0,
      }),
    ).toBe(true);
  });

  it('isWithinGrace: past grace', () => {
    expect(
      isWithinGrace({
        now: 1_000_000 + QUESTION_DURATION_MS + 2000,
        startedAt: 1_000_000,
        pausedAt: null,
        pauseAccumMs: 0,
      }),
    ).toBe(false);
  });

  it('computeDeadline shifts forward by paused time', () => {
    const startedAt = 1_000_000;
    const d1 = computeDeadline({ startedAt, pausedAt: null, pauseAccumMs: 0 });
    expect(d1).toBe(startedAt + QUESTION_DURATION_MS);

    const d2 = computeDeadline({ startedAt, pausedAt: null, pauseAccumMs: 4000 });
    expect(d2).toBe(startedAt + QUESTION_DURATION_MS + 4000);
  });
});
