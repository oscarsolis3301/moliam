import type { LivePlayer, LiveSession } from './engine.js';
import { OPTIONS_PER_QUESTION } from '../../../shared/constants.js';
import { isWithinGrace } from './timing.js';

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateNameUnique(
  session: LiveSession,
  name: string,
): ValidationResult {
  const lower = name.toLowerCase();
  for (const p of session.players.values()) {
    if (p.name.toLowerCase() === lower) {
      return { ok: false, reason: 'That name is already taken. Pick another.' };
    }
  }
  return { ok: true };
}

export function validateAnswer(args: {
  session: LiveSession;
  player: LivePlayer;
  questionIndex: number;
  choiceIndex: number;
  now: number;
}): ValidationResult {
  const { session, player, questionIndex, choiceIndex, now } = args;

  if (session.state !== 'question') {
    return { ok: false, reason: 'Not accepting answers right now.' };
  }
  if (session.pausedAt !== null) {
    return { ok: false, reason: 'Game is paused.' };
  }
  if (questionIndex !== session.currentQuestionIndex) {
    return { ok: false, reason: 'Answer for a different question.' };
  }
  if (choiceIndex < 0 || choiceIndex >= OPTIONS_PER_QUESTION) {
    return { ok: false, reason: 'Invalid choice.' };
  }
  if (player.lockedOutForIndex === questionIndex) {
    return { ok: false, reason: 'Joining next round.' };
  }
  if (player.answers.has(questionIndex)) {
    return { ok: false, reason: 'Already answered.' };
  }
  if (session.startedAt === null) {
    return { ok: false, reason: 'Question has not started.' };
  }
  if (
    !isWithinGrace({
      now,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      pauseAccumMs: session.pauseAccumMs,
    })
  ) {
    return { ok: false, reason: 'Too late.' };
  }
  return { ok: true };
}
