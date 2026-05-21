import { describe, it, expect } from 'vitest';
import { validateAnswer, validateNameUnique } from '../server/src/game/validators.js';
import type { LivePlayer, LiveSession } from '../server/src/game/engine.js';
import { QUESTION_DURATION_MS } from '../shared/constants.js';

function makeSession(overrides: Partial<LiveSession> = {}): LiveSession {
  return {
    id: 's1',
    code: 'ABCDEF',
    quiz: {
      id: 'q1',
      name: 'Q',
      createdAt: 0,
      questions: [
        { id: 'qx', position: 0, text: 'hi', options: ['a','b','c','d'], correctIndex: 0 },
      ],
    },
    state: 'question',
    currentQuestionIndex: 0,
    startedAt: 1_000_000,
    pausedAt: null,
    pauseAccumMs: 0,
    players: new Map(),
    socketToPlayer: new Map(),
    hostSocketIds: new Set(),
    deadlineTimer: null,
    revealTimer: null,
    hostActor: null,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<LivePlayer> = {}): LivePlayer {
  return {
    id: 'p1',
    socketId: 'sock1',
    name: 'Alice',
    score: 0,
    answers: new Map(),
    lockedOutForIndex: null,
    throwAmmo: 0,
    throwQuestionIndex: null,
    lastThrowAt: 0,
    ...overrides,
  };
}

describe('validateAnswer', () => {
  it('accepts a clean in-window answer', () => {
    const s = makeSession();
    const p = makePlayer();
    expect(validateAnswer({
      session: s, player: p,
      questionIndex: 0, choiceIndex: 1,
      now: s.startedAt! + 3000,
    })).toEqual({ ok: true });
  });

  it('rejects when session state is not "question"', () => {
    const s = makeSession({ state: 'lobby' });
    const p = makePlayer();
    const r = validateAnswer({
      session: s, player: p, questionIndex: 0, choiceIndex: 0, now: 1_001_000,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects when paused', () => {
    const s = makeSession({ pausedAt: 1_005_000 });
    const p = makePlayer();
    const r = validateAnswer({
      session: s, player: p, questionIndex: 0, choiceIndex: 0, now: 1_006_000,
    });
    expect(r.ok).toBe(false);
  });

  it('rejects for wrong question index', () => {
    const s = makeSession();
    const p = makePlayer();
    const r = validateAnswer({
      session: s, player: p, questionIndex: 99, choiceIndex: 0, now: s.startedAt! + 1000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/different question/i);
  });

  it('rejects a late joiner locked out for this question', () => {
    const s = makeSession();
    const p = makePlayer({ lockedOutForIndex: 0 });
    const r = validateAnswer({
      session: s, player: p, questionIndex: 0, choiceIndex: 0, now: s.startedAt! + 1000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/next round/i);
  });

  it('accepts once question advances past lockout', () => {
    const s = makeSession({ currentQuestionIndex: 1,
      quiz: { id:'q',name:'n',createdAt:0,questions:[
        { id:'q1', position:0, text:'a', options:['a','b','c','d'], correctIndex:0 },
        { id:'q2', position:1, text:'b', options:['a','b','c','d'], correctIndex:0 },
      ] } });
    const p = makePlayer({ lockedOutForIndex: 0 });
    const r = validateAnswer({
      session: s, player: p, questionIndex: 1, choiceIndex: 0, now: s.startedAt! + 500,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a duplicate answer', () => {
    const s = makeSession();
    const p = makePlayer({
      answers: new Map([[0, { choiceIndex: 1, elapsedMs: 1000, scoreDelta: 900, correct: true }]]),
    });
    const r = validateAnswer({
      session: s, player: p, questionIndex: 0, choiceIndex: 2, now: s.startedAt! + 2000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/already/i);
  });

  it('rejects answer after deadline + grace', () => {
    const s = makeSession();
    const p = makePlayer();
    const r = validateAnswer({
      session: s, player: p, questionIndex: 0, choiceIndex: 0,
      now: s.startedAt! + QUESTION_DURATION_MS + 2000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/late/i);
  });

  it('accepts answer within grace window', () => {
    const s = makeSession();
    const p = makePlayer();
    const r = validateAnswer({
      session: s, player: p, questionIndex: 0, choiceIndex: 0,
      now: s.startedAt! + QUESTION_DURATION_MS + 500,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects out-of-range choice', () => {
    const s = makeSession();
    const p = makePlayer();
    const r = validateAnswer({
      session: s, player: p, questionIndex: 0, choiceIndex: 99, now: s.startedAt! + 500,
    });
    expect(r.ok).toBe(false);
  });
});

describe('validateNameUnique', () => {
  it('accepts a novel name', () => {
    const s = makeSession();
    expect(validateNameUnique(s, 'Alice').ok).toBe(true);
  });

  it('rejects a case-insensitive duplicate', () => {
    const s = makeSession();
    s.players.set('p1', {
      id: 'p1',
      socketId: 'x',
      name: 'Alice',
      score: 0,
      answers: new Map(),
      lockedOutForIndex: null,
      throwAmmo: 0,
      throwQuestionIndex: null,
      lastThrowAt: 0,
    });
    const r = validateNameUnique(s, 'alice');
    expect(r.ok).toBe(false);
  });
});
