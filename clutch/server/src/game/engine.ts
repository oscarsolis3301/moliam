import { v4 as uuid } from 'uuid';
import {
  OPTIONS_PER_QUESTION,
  QUESTION_DURATION_MS,
  REVEAL_TO_LEADERBOARD_MS,
  THROW_AMMO_PER_QUESTION,
  THROW_COOLDOWN_MS,
} from '../../../shared/constants.js';
import type {
  AnsweredCountPayload,
  GameOverPayload,
  LeaderboardEntry,
  LeaderboardPayload,
  PausedPayload,
  PerPlayerReveal,
  PlayerThrowInput,
  ProjectileThrownPayload,
  PublicPlayer,
  QuestionRevealPayload,
  QuestionStartHostPayload,
  QuestionStartPayload,
  ResumedPayload,
  RosterUpdatePayload,
  SessionReplacedPayload,
  SessionStateName,
  StateUpdatePayload,
} from '../../../shared/schemas.js';
import { SERVER_EVENTS } from '../../../shared/events.js';
import {
  getSessionById,
  insertSession,
  saveResults,
  updateSessionState,
  updateSessionTimers,
} from '../db/repositories/sessions.js';
import { getQuiz, type QuizWithQuestions } from '../db/repositories/quizzes.js';
import { generateUniqueSessionCode } from './codes.js';
import { codeExists } from '../db/repositories/sessions.js';
import { computeScore } from './scoring.js';
import { effectiveElapsedMs } from './timing.js';
import { logger } from '../lib/logger.js';
import { validateAnswer, validateNameUnique } from './validators.js';
import { shuffleQuiz } from './shuffle.js';
import {
  AUDIT_EVENTS,
  bumpPeakPlayerCount,
  recordEvent,
  setSessionEnded,
  setSessionFirstStarted,
  setSessionHostActor,
} from '../db/repositories/audit.js';

export interface LivePlayer {
  id: string;         // our player id (uuid)
  socketId: string;   // current socket id (may change on reconnect)
  name: string;
  score: number;
  /** For question index X, the chosen choice and elapsed ms at answer time. */
  answers: Map<number, { choiceIndex: number; elapsedMs: number; scoreDelta: number; correct: boolean }>;
  /**
   * If set to an index N, this player may not answer question N.
   * Set when the player joins mid-question.
   */
  lockedOutForIndex: number | null;
  /**
   * Per-question budget for the projectile mini-game (tomato/plane/pie/sparkle
   * thrown at the host screen while waiting on others). Resets every time a
   * new question advances. `lastThrowAt` enforces a short cooldown so a single
   * player can't carpet the screen.
   */
  throwAmmo: number;
  throwQuestionIndex: number | null;
  lastThrowAt: number;
}

export interface LiveSession {
  id: string;
  code: string;
  quiz: QuizWithQuestions;
  state: SessionStateName;
  currentQuestionIndex: number;
  startedAt: number | null;    // ms — when current question started
  pausedAt: number | null;
  pauseAccumMs: number;
  players: Map<string, LivePlayer>; // keyed by playerId
  socketToPlayer: Map<string, string>; // socketId -> playerId
  hostSocketIds: Set<string>;
  /** Deadline timer handle for auto-advancing question -> reveal. */
  deadlineTimer: NodeJS.Timeout | null;
  /** Auto-advance reveal -> leaderboard timer. */
  revealTimer: NodeJS.Timeout | null;
  /** Best-effort identifier of who created/runs the session, for audit. */
  hostActor: string | null;
}

export type EmitFn = (
  room: string,
  event: string,
  payload: unknown,
) => void;

export interface EngineDeps {
  emit: EmitFn;
}

export class GameEngine {
  private sessions = new Map<string, LiveSession>();
  private codeIndex = new Map<string, string>(); // code -> sessionId
  // Monotonic counter used to stamp each accepted throw with a stable id.
  // Lets the host de-dupe replayed broadcasts from a flaky reconnection.
  private throwIdCounter = 0;

  constructor(private deps: EngineDeps) {}

  // ---------- lookups ----------

  getBySessionId(id: string): LiveSession | null {
    return this.sessions.get(id) ?? null;
  }
  getByCode(code: string): LiveSession | null {
    const id = this.codeIndex.get(code);
    return id ? this.sessions.get(id) ?? null : null;
  }
  activeSessionCount(): number {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.state !== 'ended') count++;
    }
    return count;
  }

  // ---------- room name helpers ----------

  private room(id: string): string { return `session:${id}`; }
  private hostRoom(id: string): string { return `session:${id}:host`; }

  // ---------- host actions ----------

  createSession(quizId: string, actor?: string | null): { sessionId: string; code: string } {
    const sourceQuiz = getQuiz(quizId);
    if (!sourceQuiz) throw new Error('Quiz not found');
    if (sourceQuiz.questions.length === 0) throw new Error('Quiz has no questions');

    // Per-session randomization: each play sees questions in a different
    // order, with each question's options also shuffled. Source quiz on disk
    // is never mutated — see game/shuffle.ts.
    const quiz = shuffleQuiz(sourceQuiz);

    const code = generateUniqueSessionCode(codeExists);
    const row = insertSession({ code, quizId });

    const live: LiveSession = {
      id: row.id,
      code: row.code,
      quiz,
      state: 'lobby',
      currentQuestionIndex: 0,
      startedAt: null,
      pausedAt: null,
      pauseAccumMs: 0,
      players: new Map(),
      socketToPlayer: new Map(),
      hostSocketIds: new Set(),
      deadlineTimer: null,
      revealTimer: null,
      hostActor: actor ?? null,
    };
    this.sessions.set(row.id, live);
    this.codeIndex.set(row.code, row.id);
    logger.info({ sessionId: row.id, code: row.code, quizId, actor }, 'session created');

    if (actor) setSessionHostActor(row.id, actor);
    recordEvent({
      event: AUDIT_EVENTS.SessionCreated,
      sessionId: row.id,
      quizId,
      actor: actor ?? null,
      details: { code: row.code, quizName: quiz.name, questionCount: quiz.questions.length },
    });

    return { sessionId: row.id, code: row.code };
  }

  registerHostSocket(sessionId: string, socketId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.hostSocketIds.add(socketId);
    return true;
  }

  detachSocket(socketId: string): void {
    for (const s of this.sessions.values()) {
      if (s.hostSocketIds.delete(socketId)) {
        // host disconnect is not fatal; another tab may still hold it.
      }
      const pid = s.socketToPlayer.get(socketId);
      if (pid) {
        s.socketToPlayer.delete(socketId);
        // We do NOT delete the player from the scoreboard — a refresh can
        // rejoin using the same name and keep their score. Remove from roster
        // entirely only if there's no other socket for this player.
        const player = s.players.get(pid);
        if (player && player.socketId === socketId) {
          // Keep the LivePlayer; their name stays on the scoreboard so ranks
          // don't shuffle if they just hit refresh. A new join with the same
          // name will find them and reattach.
        }
      }
    }
  }

  // ---------- player join ----------

  joinByCode(args: {
    code: string;
    name: string;
    socketId: string;
    actor?: string | null;
  }):
    | { ok: true; sessionId: string; playerId: string; lateForCurrent: boolean }
    | { ok: false; reason: string } {
    const s = this.getByCode(args.code);
    if (!s) return { ok: false, reason: 'Session not found.' };
    if (s.state === 'ended' || s.state === 'final') {
      return { ok: false, reason: 'This game has already finished.' };
    }

    // If a player with this name already exists and has no active socket, reattach.
    const existing = this.findPlayerByName(s, args.name);
    if (existing) {
      // Check if "already taken" by a currently-connected socket.
      const alive = [...s.socketToPlayer.entries()].some(
        ([, pid]) => pid === existing.id,
      );
      if (alive) {
        return { ok: false, reason: 'That name is already taken. Pick another.' };
      }
      // Reattach.
      existing.socketId = args.socketId;
      s.socketToPlayer.set(args.socketId, existing.id);
      this.broadcastRoster(s);
      const lateForCurrent = existing.lockedOutForIndex === s.currentQuestionIndex;
      recordEvent({
        event: AUDIT_EVENTS.PlayerRejoined,
        sessionId: s.id,
        actor: args.actor ?? null,
        details: { name: existing.name, playerId: existing.id, lateForCurrent },
      });
      return { ok: true, sessionId: s.id, playerId: existing.id, lateForCurrent };
    }

    // Fresh join
    const nameCheck = validateNameUnique(s, args.name);
    if (!nameCheck.ok) return { ok: false, reason: nameCheck.reason };

    const player: LivePlayer = {
      id: uuid(),
      socketId: args.socketId,
      name: args.name,
      score: 0,
      answers: new Map(),
      lockedOutForIndex: s.state === 'question' ? s.currentQuestionIndex : null,
      throwAmmo: 0,
      throwQuestionIndex: null,
      lastThrowAt: 0,
    };
    s.players.set(player.id, player);
    s.socketToPlayer.set(args.socketId, player.id);
    this.broadcastRoster(s);
    this.broadcastStateUpdate(s);

    bumpPeakPlayerCount(s.id, s.players.size);
    recordEvent({
      event: AUDIT_EVENTS.PlayerJoined,
      sessionId: s.id,
      actor: args.actor ?? null,
      details: {
        name: player.name,
        playerId: player.id,
        lateForCurrent: player.lockedOutForIndex !== null,
        rosterSize: s.players.size,
      },
    });

    logger.info(
      { sessionId: s.id, code: s.code, name: args.name, lateForCurrent: player.lockedOutForIndex !== null },
      'player joined',
    );
    return {
      ok: true,
      sessionId: s.id,
      playerId: player.id,
      lateForCurrent: player.lockedOutForIndex !== null,
    };
  }

  private findPlayerByName(s: LiveSession, name: string): LivePlayer | null {
    const lower = name.toLowerCase();
    for (const p of s.players.values()) {
      if (p.name.toLowerCase() === lower) return p;
    }
    return null;
  }

  // ---------- lifecycle ----------

  startGame(sessionId: string, actor?: string | null): void {
    const s = this.requireSession(sessionId);
    if (s.state !== 'lobby') {
      logger.warn({ sessionId, state: s.state }, 'startGame ignored, not in lobby');
      // Thrown, not silently returned: the socket handler wraps this in the
      // action ack so the host UI can route to the correct view (finished
      // screen / results) instead of showing an unresponsive Start button.
      throw new Error(`Session is in state "${s.state}", not lobby`);
    }
    const ts = Date.now();
    setSessionFirstStarted(s.id, ts);
    recordEvent({
      event: AUDIT_EVENTS.SessionStarted,
      sessionId: s.id,
      quizId: s.quiz.id,
      actor: actor ?? s.hostActor ?? null,
      details: { rosterSize: s.players.size, totalQuestions: s.quiz.questions.length, ts },
    });
    this.advanceToQuestion(s, 0);
  }

  nextQuestion(sessionId: string, actor?: string | null): void {
    const s = this.requireSession(sessionId);
    if (s.state !== 'leaderboard' && s.state !== 'reveal') {
      logger.warn({ sessionId, state: s.state }, 'nextQuestion ignored');
      return;
    }
    const next = s.currentQuestionIndex + 1;
    if (next >= s.quiz.questions.length) {
      this.endGame(sessionId, actor ?? null);
    } else {
      this.advanceToQuestion(s, next, actor ?? null);
    }
  }

  skipQuestion(sessionId: string, actor?: string | null): void {
    const s = this.requireSession(sessionId);
    if (s.state !== 'question') {
      logger.warn({ sessionId, state: s.state }, 'skipQuestion ignored');
      return;
    }
    recordEvent({
      event: AUDIT_EVENTS.SessionQuestionSkipped,
      sessionId: s.id,
      actor: actor ?? s.hostActor ?? null,
      details: { questionIndex: s.currentQuestionIndex },
    });
    this.endQuestion(s);
  }

  pause(sessionId: string, actor?: string | null): void {
    const s = this.requireSession(sessionId);
    if (s.state !== 'question' || s.pausedAt !== null) return;
    s.pausedAt = Date.now();
    updateSessionTimers(s.id, { pausedAt: s.pausedAt });
    this.clearDeadlineTimer(s);
    const payload: PausedPayload = { pausedAt: s.pausedAt };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.Paused, payload);
    recordEvent({
      event: AUDIT_EVENTS.SessionPaused,
      sessionId: s.id,
      actor: actor ?? s.hostActor ?? null,
      details: { questionIndex: s.currentQuestionIndex, pausedAt: s.pausedAt },
    });
    logger.info({ sessionId: s.id, code: s.code }, 'session paused');
  }

  resume(sessionId: string, actor?: string | null): void {
    const s = this.requireSession(sessionId);
    if (s.state !== 'question' || s.pausedAt === null || s.startedAt === null) return;
    const now = Date.now();
    const pausedFor = now - s.pausedAt;
    s.pauseAccumMs += pausedFor;
    s.pausedAt = null;
    updateSessionTimers(s.id, { pausedAt: null, pauseAccumMs: s.pauseAccumMs });

    const newDeadline = s.startedAt + s.pauseAccumMs + QUESTION_DURATION_MS;
    const remainingMs = Math.max(0, newDeadline - now);
    s.deadlineTimer = setTimeout(() => this.endQuestion(s), remainingMs);

    const payload: ResumedPayload = { newDeadline };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.Resumed, payload);
    recordEvent({
      event: AUDIT_EVENTS.SessionResumed,
      sessionId: s.id,
      actor: actor ?? s.hostActor ?? null,
      details: { questionIndex: s.currentQuestionIndex, pausedForMs: pausedFor, newDeadline },
    });
    logger.info({ sessionId: s.id, code: s.code, newDeadline }, 'session resumed');
  }

  /**
   * Recreate the lobby with the same connected players. Creates a brand-new
   * session, migrates every active player socket from the old room into the
   * new one (preserving names but resetting scores), and returns the new
   * session id+code so the host can navigate. The old session is finalized.
   *
   * This is what powers "Start a new session" on the final screen — players
   * never re-enter a code or their name.
   */
  rotateSession(args: {
    oldSessionId: string;
    quizId: string;
    actor?: string | null;
  }): { sessionId: string; code: string } {
    const old = this.sessions.get(args.oldSessionId);
    if (!old) throw new Error('Old session not found');

    // Snapshot the active player sockets BEFORE we end the old session — once
    // we mark it ended, finalizers may scrub the maps.
    const carryover: Array<{ socketId: string; name: string }> = [];
    for (const [socketId, playerId] of old.socketToPlayer.entries()) {
      const p = old.players.get(playerId);
      if (!p) continue;
      carryover.push({ socketId, name: p.name });
    }
    const oldHostSocketIds = new Set(old.hostSocketIds);

    // Create the new session via the standard path so audit/quiz selection
    // logic stays in one place.
    const created = this.createSession(args.quizId, args.actor ?? null);
    const next = this.sessions.get(created.sessionId);
    if (!next) throw new Error('New session vanished');

    // Re-attach players to the new session: leave the old room, join the new
    // one, create a fresh LivePlayer keyed by name with score=0.
    const oldRoom = this.room(args.oldSessionId);
    const newRoom = this.room(created.sessionId);
    for (const { socketId, name } of carryover) {
      // Remove from old maps so the finalize step below is a clean teardown.
      old.socketToPlayer.delete(socketId);
      // Create or reattach in new session.
      const player: LivePlayer = {
        id: uuid(),
        socketId,
        name,
        score: 0,
        answers: new Map(),
        lockedOutForIndex: null,
        throwAmmo: 0,
        throwQuestionIndex: null,
        lastThrowAt: 0,
      };
      next.players.set(player.id, player);
      next.socketToPlayer.set(socketId, player.id);
    }

    // Move host sockets too — the host tab is staying in the room visually,
    // but the underlying session id changed.
    const oldHostRoom = this.hostRoom(args.oldSessionId);
    const newHostRoom = this.hostRoom(created.sessionId);
    for (const hostSocketId of oldHostSocketIds) {
      next.hostSocketIds.add(hostSocketId);
    }
    old.hostSocketIds.clear();

    // Use the io adapter via deps.emit's underlying server… we don't have a
    // direct `socket.leave/join` here, so we rely on the socket layer to move
    // sockets. Emit a broadcast on the OLD room first so the socket handler
    // can rebind. Then end the old session.
    bumpPeakPlayerCount(created.sessionId, next.players.size);
    if (next.players.size > 0) this.broadcastRoster(next);

    // The actual room swap happens on the socket-handler side because Engine
    // doesn't hold io directly. We emit SessionReplaced so the socket handler
    // can move the socket into the new room before any further broadcasts.
    const payload: SessionReplacedPayload = {
      oldSessionId: args.oldSessionId,
      newSessionId: created.sessionId,
      newCode: created.code,
      totalQuestions: next.quiz.questions.length,
    };
    this.deps.emit(oldRoom, SERVER_EVENTS.SessionReplaced, payload);
    this.deps.emit(oldHostRoom, SERVER_EVENTS.SessionReplaced, payload);
    void newRoom; void newHostRoom; // touched so the names stay self-documenting

    // Finalize the old session as ended. Don't run endGame's full results
    // save (no real game happened on the old session in many cases — the
    // common path is "rotation immediately after final results"). We still
    // persist the audit "ended" event for analytics.
    this.clearAllTimers(old);
    if (old.state !== 'final' && old.state !== 'ended') {
      old.state = 'ended';
      updateSessionState(old.id, 'ended');
      const endedAt = Date.now();
      setSessionEnded(old.id, endedAt);
      recordEvent({
        event: AUDIT_EVENTS.SessionEnded,
        sessionId: old.id,
        quizId: old.quiz.id,
        actor: args.actor ?? old.hostActor ?? null,
        details: { endedAt, reason: 'rotated', newSessionId: created.sessionId },
      });
    }
    // Drop the old code from the lookup so a stranger can't join the dead room.
    this.codeIndex.delete(old.code);

    logger.info(
      { oldSessionId: args.oldSessionId, newSessionId: created.sessionId, carryover: carryover.length },
      'session rotated',
    );
    return created;
  }

  endGame(sessionId: string, actor?: string | null): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    this.clearAllTimers(s);
    s.state = 'final';
    updateSessionState(s.id, 'final');

    const entries = this.rankPlayers(s);
    saveResults(s.id, entries);
    const payload: GameOverPayload = { final: entries };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.GameOver, payload);
    this.broadcastStateUpdate(s);

    const endedAt = Date.now();
    setSessionEnded(s.id, endedAt);
    recordEvent({
      event: AUDIT_EVENTS.SessionEnded,
      sessionId: s.id,
      quizId: s.quiz.id,
      actor: actor ?? s.hostActor ?? null,
      details: {
        endedAt,
        playerCount: entries.length,
        peakPlayerCount: s.players.size,
        topThree: entries.slice(0, 3),
      },
    });

    logger.info({ sessionId: s.id, code: s.code, players: entries.length }, 'game over');
  }

  // ---------- answers ----------

  submitAnswer(args: {
    socketId: string;
    sessionId: string;
    questionIndex: number;
    choiceIndex: number;
    actor?: string | null;
  }): { accepted: boolean; reason?: string } {
    const s = this.sessions.get(args.sessionId);
    if (!s) return { accepted: false, reason: 'Session not found.' };
    const playerId = s.socketToPlayer.get(args.socketId);
    if (!playerId) return { accepted: false, reason: 'Not in session.' };
    const player = s.players.get(playerId);
    if (!player) return { accepted: false, reason: 'Not in session.' };

    const now = Date.now();
    const validation = validateAnswer({
      session: s,
      player,
      questionIndex: args.questionIndex,
      choiceIndex: args.choiceIndex,
      now,
    });
    if (!validation.ok) return { accepted: false, reason: validation.reason };

    const q = s.quiz.questions[args.questionIndex];
    if (!q) return { accepted: false, reason: 'No such question.' };

    const elapsedMs = effectiveElapsedMs({
      now,
      startedAt: s.startedAt!,
      pausedAt: s.pausedAt,
      pauseAccumMs: s.pauseAccumMs,
    });
    const correct = args.choiceIndex === q.correctIndex;
    const delta = computeScore({ correct, elapsedMs });
    player.answers.set(args.questionIndex, {
      choiceIndex: args.choiceIndex,
      elapsedMs,
      scoreDelta: delta,
      correct,
    });
    player.score += delta;

    recordEvent({
      event: AUDIT_EVENTS.PlayerAnswered,
      sessionId: s.id,
      actor: args.actor ?? null,
      details: {
        name: player.name,
        playerId: player.id,
        questionIndex: args.questionIndex,
        choiceIndex: args.choiceIndex,
        correct,
        elapsedMs,
        scoreDelta: delta,
        newScore: player.score,
      },
    });

    // Broadcast answered count to host only. Include who just answered and
    // who's still pending so the host UI can surface a toast and a live
    // "waiting on" hint without a second round-trip.
    const countPayload: AnsweredCountPayload = {
      count: this.countAnsweredActive(s, args.questionIndex),
      total: this.countActivePlayers(s, args.questionIndex),
      lastAnsweredName: player.name,
      pendingNames: this.pendingActiveNames(s, args.questionIndex),
    };
    this.deps.emit(this.hostRoom(s.id), SERVER_EVENTS.AnsweredCount, countPayload);

    // If everyone eligible has answered, end question early.
    if (countPayload.count >= countPayload.total && countPayload.total > 0) {
      this.endQuestion(s);
    }

    return { accepted: true };
  }

  // ---------- waiting-room throws ----------

  /**
   * Accept a projectile fling from a phone and re-broadcast it to the host
   * for rendering. Gated to the question state, requires the player to have
   * already locked an answer (so the mini-game only fills the *waiting* gap),
   * and rate-limited per player. Bandwidth and ammo budgets are tight on
   * purpose — a chaotic 50-player room shouldn't drown the screen.
   */
  submitThrow(args: {
    socketId: string;
    sessionId: string;
    questionIndex: number;
    kind: PlayerThrowInput['kind'];
    x: number;
    y: number;
    vx: number;
    vy: number;
    originSide: PlayerThrowInput['originSide'];
  }): { accepted: boolean; reason?: string; ammoLeft?: number } {
    const s = this.sessions.get(args.sessionId);
    if (!s) return { accepted: false, reason: 'Session not found.' };
    if (s.state !== 'question') {
      return { accepted: false, reason: 'Throws are closed.' };
    }
    if (s.pausedAt !== null) {
      return { accepted: false, reason: 'Game paused.' };
    }
    if (args.questionIndex !== s.currentQuestionIndex) {
      return { accepted: false, reason: 'Question already moved on.' };
    }
    const playerId = s.socketToPlayer.get(args.socketId);
    if (!playerId) return { accepted: false, reason: 'Not in session.' };
    const player = s.players.get(playerId);
    if (!player) return { accepted: false, reason: 'Not in session.' };
    if (player.lockedOutForIndex === args.questionIndex) {
      return { accepted: false, reason: 'Sit this round out.' };
    }
    // Only after the player has locked their answer — the throw mini-game
    // exists to fill the wait, not to distract them from picking.
    if (!player.answers.has(args.questionIndex)) {
      return { accepted: false, reason: 'Answer first.' };
    }

    // Reset ammo on a new question.
    if (player.throwQuestionIndex !== args.questionIndex) {
      player.throwQuestionIndex = args.questionIndex;
      player.throwAmmo = THROW_AMMO_PER_QUESTION;
      player.lastThrowAt = 0;
    }
    if (player.throwAmmo <= 0) {
      return { accepted: false, reason: 'Out of ammo.', ammoLeft: 0 };
    }
    const now = Date.now();
    if (now - player.lastThrowAt < THROW_COOLDOWN_MS) {
      return { accepted: false, reason: 'Cooling down.', ammoLeft: player.throwAmmo };
    }

    player.throwAmmo -= 1;
    player.lastThrowAt = now;
    this.throwIdCounter += 1;

    const payload: ProjectileThrownPayload = {
      name: player.name,
      kind: args.kind,
      x: args.x,
      y: args.y,
      vx: args.vx,
      vy: args.vy,
      originSide: args.originSide,
      throwId: `${s.id}:${this.throwIdCounter}`,
    };
    this.deps.emit(this.hostRoom(s.id), SERVER_EVENTS.ProjectileThrown, payload);
    return { accepted: true, ammoLeft: player.throwAmmo };
  }

  // ---------- question flow ----------

  private advanceToQuestion(s: LiveSession, index: number, actor?: string | null): void {
    this.clearAllTimers(s);
    s.state = 'question';
    s.currentQuestionIndex = index;
    s.startedAt = Date.now();
    s.pausedAt = null;
    s.pauseAccumMs = 0;
    updateSessionState(s.id, 'question', index);
    updateSessionTimers(s.id, {
      startedAt: s.startedAt,
      pausedAt: null,
      pauseAccumMs: 0,
    });

    // Clear lockouts for players who were locked out for the PREVIOUS index —
    // they are eligible starting this question.
    for (const p of s.players.values()) {
      if (p.lockedOutForIndex !== null && p.lockedOutForIndex < index) {
        p.lockedOutForIndex = null;
      }
    }

    const q = s.quiz.questions[index];
    if (!q) {
      this.endGame(s.id);
      return;
    }
    const deadline = s.startedAt + QUESTION_DURATION_MS;

    const publicPayload: QuestionStartPayload = {
      index,
      total: s.quiz.questions.length,
      startedAt: s.startedAt,
      deadline,
      optionsCount: OPTIONS_PER_QUESTION,
      options: q.options,
    };
    const hostPayload: QuestionStartHostPayload = {
      ...publicPayload,
      text: q.text,
    };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.QuestionStart, publicPayload);
    this.deps.emit(this.hostRoom(s.id), SERVER_EVENTS.QuestionStartHost, hostPayload);
    this.broadcastStateUpdate(s);

    s.deadlineTimer = setTimeout(() => this.endQuestion(s), QUESTION_DURATION_MS);

    recordEvent({
      event: AUDIT_EVENTS.SessionQuestionAdvanced,
      sessionId: s.id,
      actor: actor ?? s.hostActor ?? null,
      details: {
        questionIndex: index,
        totalQuestions: s.quiz.questions.length,
        rosterSize: s.players.size,
        startedAt: s.startedAt,
        deadline,
      },
    });

    logger.info(
      { sessionId: s.id, code: s.code, index, deadline },
      'question started',
    );
  }

  private endQuestion(s: LiveSession): void {
    if (s.state !== 'question') return;
    this.clearDeadlineTimer(s);
    s.state = 'reveal';
    updateSessionState(s.id, 'reveal');

    const q = s.quiz.questions[s.currentQuestionIndex];
    if (!q) { this.endGame(s.id); return; }

    const counts = new Array<number>(OPTIONS_PER_QUESTION).fill(0);
    for (const p of s.players.values()) {
      const a = p.answers.get(s.currentQuestionIndex);
      if (a) counts[a.choiceIndex]!++;
    }

    const ranked = this.rankPlayers(s);
    const rankByName = new Map(ranked.map((r) => [r.name, r.rank]));

    const perPlayer: PerPlayerReveal[] = [];
    for (const p of s.players.values()) {
      const a = p.answers.get(s.currentQuestionIndex);
      perPlayer.push({
        name: p.name,
        correct: a?.correct ?? false,
        delta: a?.scoreDelta ?? 0,
        newScore: p.score,
        rank: rankByName.get(p.name) ?? ranked.length,
      });
    }

    const payload: QuestionRevealPayload = {
      questionIndex: s.currentQuestionIndex,
      correctIndex: q.correctIndex,
      correctText: q.options[q.correctIndex] ?? '',
      counts,
      perPlayer,
    };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.QuestionReveal, payload);
    this.broadcastStateUpdate(s);
    logger.info(
      { sessionId: s.id, code: s.code, index: s.currentQuestionIndex },
      'question revealed',
    );

    // Auto-advance to leaderboard after a short pause.
    s.revealTimer = setTimeout(() => this.showLeaderboard(s), REVEAL_TO_LEADERBOARD_MS);
  }

  private showLeaderboard(s: LiveSession): void {
    if (s.state !== 'reveal') return;
    s.revealTimer = null;
    s.state = 'leaderboard';
    updateSessionState(s.id, 'leaderboard');

    const entries = this.rankPlayers(s).slice(0, 5);
    const payload: LeaderboardPayload = {
      entries,
      questionIndex: s.currentQuestionIndex,
      total: s.quiz.questions.length,
    };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.Leaderboard, payload);
    this.broadcastStateUpdate(s);
  }

  // ---------- helpers ----------

  private countAnsweredActive(s: LiveSession, index: number): number {
    let c = 0;
    for (const p of s.players.values()) {
      if (p.lockedOutForIndex === index) continue;
      if (p.answers.has(index)) c++;
    }
    return c;
  }

  private countActivePlayers(s: LiveSession, index: number): number {
    let c = 0;
    for (const p of s.players.values()) {
      if (p.lockedOutForIndex === index) continue;
      c++;
    }
    return c;
  }

  // Names of active (non-locked-out) players who have not submitted an answer
  // for the given question. Sorted alphabetically for stable rendering on the
  // host. Used to feed the "waiting on" hint shown beside the answer bar.
  private pendingActiveNames(s: LiveSession, index: number): string[] {
    const names: string[] = [];
    for (const p of s.players.values()) {
      if (p.lockedOutForIndex === index) continue;
      if (p.answers.has(index)) continue;
      names.push(p.name);
    }
    names.sort((a, b) => a.localeCompare(b));
    return names;
  }

  private rankPlayers(s: LiveSession): LeaderboardEntry[] {
    const arr = [...s.players.values()]
      .map<PublicPlayer>((p) => ({ name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return arr.map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private broadcastRoster(s: LiveSession): void {
    const payload: RosterUpdatePayload = {
      players: [...s.players.values()].map((p) => ({ name: p.name, score: p.score })),
    };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.RosterUpdate, payload);
  }

  private broadcastStateUpdate(s: LiveSession): void {
    const payload: StateUpdatePayload = {
      state: s.state,
      currentQuestionIndex: s.currentQuestionIndex,
      playerCount: s.players.size,
      totalQuestions: s.quiz.questions.length,
    };
    this.deps.emit(this.room(s.id), SERVER_EVENTS.StateUpdate, payload);
  }

  private requireSession(id: string): LiveSession {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`Session not found: ${id}`);
    return s;
  }

  private clearDeadlineTimer(s: LiveSession): void {
    if (s.deadlineTimer) { clearTimeout(s.deadlineTimer); s.deadlineTimer = null; }
  }

  private clearAllTimers(s: LiveSession): void {
    this.clearDeadlineTimer(s);
    if (s.revealTimer) { clearTimeout(s.revealTimer); s.revealTimer = null; }
  }

  /** Called on shutdown: mark every active session as ended. */
  finalizeAll(): void {
    const ts = Date.now();
    for (const s of this.sessions.values()) {
      if (s.state !== 'final' && s.state !== 'ended') {
        this.clearAllTimers(s);
        s.state = 'ended';
        updateSessionState(s.id, 'ended');
        setSessionEnded(s.id, ts);
        recordEvent({
          event: AUDIT_EVENTS.SessionEnded,
          sessionId: s.id,
          quizId: s.quiz.id,
          actor: s.hostActor ?? null,
          details: { endedAt: ts, reason: 'server_shutdown', playerCount: s.players.size },
        });
      }
    }
  }

  /**
   * Rehydrate a session from DB for read-only access (e.g. GET /api/sessions/:code).
   * Not used for live-game reconstruction — that memory is intentionally lost.
   */
  rehydrateRead(sessionId: string): { state: SessionStateName } | null {
    const row = getSessionById(sessionId);
    return row ? { state: row.state } : null;
  }
}
