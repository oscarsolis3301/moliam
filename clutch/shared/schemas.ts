import { z } from 'zod';
import {
  NAME_MAX,
  NAME_MIN,
  OPTIONS_PER_QUESTION,
  SESSION_CODE_LENGTH,
  THROW_KINDS,
} from './constants.js';

export const SessionStateSchema = z.enum([
  'lobby',
  'question',
  'reveal',
  'leaderboard',
  'final',
  'ended',
]);
export type SessionStateName = z.infer<typeof SessionStateSchema>;

export const PlayerNameSchema = z
  .string()
  .trim()
  .min(NAME_MIN)
  .max(NAME_MAX)
  .regex(/^[^\s].*[^\s]$|^\S$/, 'name may not have leading or trailing whitespace');

export const SessionCodeSchema = z
  .string()
  .length(SESSION_CODE_LENGTH)
  .regex(/^[A-Z2-9]+$/, 'invalid session code');

export const QuestionDraftSchema = z.object({
  text: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).length(OPTIONS_PER_QUESTION),
  correctIndex: z.number().int().min(0).max(OPTIONS_PER_QUESTION - 1),
});
export type QuestionDraft = z.infer<typeof QuestionDraftSchema>;

export const QuizDraftSchema = z.object({
  name: z.string().trim().min(1).max(100),
  questions: z.array(QuestionDraftSchema).min(1).max(100),
});
export type QuizDraft = z.infer<typeof QuizDraftSchema>;

export const QuizSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  questionCount: z.number().int().nonnegative(),
  createdAt: z.number().int(),
});
export type QuizSummary = z.infer<typeof QuizSummarySchema>;

// ---------- Socket payloads ----------

export const HostCreateSessionSchema = z.object({ quizId: z.string().uuid() });
export const HostSessionActionSchema = z.object({ sessionId: z.string().uuid() });
export const HostRotateSessionSchema = z.object({
  sessionId: z.string().uuid(),
  quizId: z.string().uuid(),
});

export const PlayerJoinSchema = z.object({
  code: SessionCodeSchema,
  name: PlayerNameSchema,
});

export const PlayerAnswerSchema = z.object({
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().nonnegative(),
  choiceIndex: z.number().int().min(0).max(OPTIONS_PER_QUESTION - 1),
});

// Projectile thrown from a player's phone at the big screen during the
// waiting window after they've answered. `x` and `y` are normalized [0, 1]
// splat coordinates so the host can re-project them onto its own viewport
// regardless of resolution; `vx`/`vy` are normalized velocity (-1..1) for
// the entry trajectory. `originSide` lets the host pick a sensible spawn
// edge so the projectile flies in from off-screen.
export const PlayerThrowSchema = z.object({
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().nonnegative(),
  kind: z.enum(THROW_KINDS),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  vx: z.number().min(-2).max(2),
  vy: z.number().min(-2).max(2),
  originSide: z.enum(['left', 'right', 'bottom', 'top']),
});
export type PlayerThrowInput = z.infer<typeof PlayerThrowSchema>;

// ---------- Server -> client payloads (types only; runtime validation
// only needed on the receiving side. Kept here as canonical shapes.) ----------

export interface PublicPlayer {
  name: string;
  score: number;
}

export interface PerPlayerReveal {
  name: string;
  correct: boolean;
  delta: number;
  newScore: number;
  rank: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  rank: number;
}

export interface StateUpdatePayload {
  state: SessionStateName;
  currentQuestionIndex: number;
  playerCount: number;
  totalQuestions: number;
}

export interface QuestionStartPayload {
  index: number;
  total: number;
  startedAt: number;
  deadline: number;
  optionsCount: number;
  // Option text is sent to players so they can see the answers on their phones
  // and pick by content as well as by shape/color. The question text itself
  // stays host-only — players still have to look at the big screen for the
  // prompt.
  options: string[];
}

export interface QuestionStartHostPayload extends QuestionStartPayload {
  text: string;
}

export interface QuestionRevealPayload {
  questionIndex: number;
  correctIndex: number;
  // Human-readable text of the correct option, retained for the player reveal
  // screen so it can confirm the answer even if the player scrolled past it.
  correctText: string;
  counts: number[];
  perPlayer: PerPlayerReveal[];
}

export interface LeaderboardPayload {
  entries: LeaderboardEntry[];
  questionIndex: number;
  total: number;
}

export interface PausedPayload {
  pausedAt: number;
}

export interface ResumedPayload {
  newDeadline: number;
}

export interface GameOverPayload {
  final: LeaderboardEntry[];
}

export interface SessionReplacedPayload {
  // Old session id players can use to confirm the swap is for them.
  oldSessionId: string;
  newSessionId: string;
  newCode: string;
  totalQuestions: number;
}

export interface StartCountdownPayload {
  // Absolute server deadline (ms since epoch) at which the first question will
  // begin. Clients render their countdown by clamping `(deadline - now) / step`
  // so quick reconnects mid-countdown still land on the right number.
  deadline: number;
  // Total countdown duration in ms — useful for animating progress rings
  // independently of the deadline.
  durationMs: number;
}

export interface RotateSessionAck {
  ok: true;
  sessionId: string;
  code: string;
  publicHostUrl: string;
}

export interface AnsweredCountPayload {
  count: number;
  total: number;
  // Name of the player whose answer triggered this update (so the host can
  // show a transient "X answered" toast). Optional because legacy clients on
  // older servers may receive payloads without it.
  lastAnsweredName?: string;
  // Names of every active player who has not yet answered the current
  // question — lets the host see at a glance who they're waiting on.
  pendingNames?: string[];
}

export interface RosterUpdatePayload {
  players: PublicPlayer[];
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

export interface JoinAckOk {
  ok: true;
  playerId: string;
  sessionId: string;
  currentState: SessionStateName;
  currentQuestionIndex: number;
  totalQuestions: number;
  sessionCode: string;
  lateForCurrent: boolean;
}

export interface JoinAckErr {
  ok: false;
  reason: string;
}

export type JoinAck = JoinAckOk | JoinAckErr;

export interface AnswerAck {
  accepted: boolean;
  reason?: string;
}

export interface ThrowAck {
  accepted: boolean;
  reason?: string;
  // Remaining ammo this player has for the current question. Lets the phone
  // reflect the cooldown / out-of-ammo state immediately on ack.
  ammoLeft?: number;
}

export interface ProjectileThrownPayload {
  // The thrower's display name, shown on a small pill above the splat. Kept
  // optional so a future spectator-broadcast can elide it.
  name: string;
  kind: 'tomato' | 'plane' | 'pie' | 'sparkle';
  x: number;
  y: number;
  vx: number;
  vy: number;
  originSide: 'left' | 'right' | 'bottom' | 'top';
  // Server-assigned monotonic id so the host can de-dupe replays from a
  // flaky reconnection.
  throwId: string;
}

export interface CreateSessionAck {
  ok: true;
  sessionId: string;
  code: string;
  publicHostUrl: string;
}

export interface SimpleErrAck {
  ok: false;
  reason: string;
}
