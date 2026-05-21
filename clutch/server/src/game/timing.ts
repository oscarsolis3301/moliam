import { QUESTION_DURATION_MS, ANSWER_GRACE_MS } from '../../../shared/constants.js';

/**
 * Given the current pause state, compute the effective elapsed time of the
 * question: wall-clock elapsed since startedAt, minus all accumulated pause
 * time, minus any time from the current live pause.
 *
 * now, startedAt, pausedAt: unix ms
 */
export function effectiveElapsedMs(args: {
  now: number;
  startedAt: number;
  pausedAt: number | null;
  pauseAccumMs: number;
}): number {
  const raw = args.now - args.startedAt;
  const live = args.pausedAt !== null ? args.now - args.pausedAt : 0;
  return Math.max(0, raw - args.pauseAccumMs - live);
}

/** When will this question hit deadline on the wall clock, given current pause state? */
export function computeDeadline(args: {
  startedAt: number;
  pausedAt: number | null;
  pauseAccumMs: number;
  durationMs?: number;
}): number {
  const duration = args.durationMs ?? QUESTION_DURATION_MS;
  // Deadline = startedAt + pauseAccumMs + duration, shifted by any live pause.
  // While paused, deadline is not wall-clock-meaningful; we still return the
  // non-live-shifted value because the client shows "paused" state anyway.
  const base = args.startedAt + args.pauseAccumMs + duration;
  if (args.pausedAt === null) return base;
  // While paused, the deadline slides forward every ms. We expose "now + remaining".
  // Caller should re-emit a deadline on resume.
  const elapsedBeforePause = args.pausedAt - args.startedAt - args.pauseAccumMs;
  const remaining = duration - elapsedBeforePause;
  return args.pausedAt + remaining;
}

/**
 * Is the submission within the deadline + grace window, taking pauses into
 * account? A late submission (after grace) should be rejected.
 */
export function isWithinGrace(args: {
  now: number;
  startedAt: number;
  pausedAt: number | null;
  pauseAccumMs: number;
  durationMs?: number;
  graceMs?: number;
}): boolean {
  const duration = args.durationMs ?? QUESTION_DURATION_MS;
  const grace = args.graceMs ?? ANSWER_GRACE_MS;
  const elapsed = effectiveElapsedMs({
    now: args.now,
    startedAt: args.startedAt,
    pausedAt: args.pausedAt,
    pauseAccumMs: args.pauseAccumMs,
  });
  return elapsed <= duration + grace;
}
