import { getDb } from '../connection.js';
import { getQuiz } from './quizzes.js';

// Canonical event names. Kept as a const-of-strings rather than an enum so the
// values are usable in SQL without an extra import on the read side.
export const AUDIT_EVENTS = {
  QuizCreated: 'quiz.created',
  QuizUpdated: 'quiz.updated',
  QuizDuplicated: 'quiz.duplicated',
  QuizDeleted: 'quiz.deleted',
  SessionCreated: 'session.created',
  SessionStarted: 'session.started',
  SessionPaused: 'session.paused',
  SessionResumed: 'session.resumed',
  SessionQuestionAdvanced: 'session.question_advanced',
  SessionQuestionSkipped: 'session.question_skipped',
  SessionEnded: 'session.ended',
  PlayerJoined: 'player.joined',
  PlayerRejoined: 'player.rejoined',
  PlayerAnswered: 'player.answered',
} as const;

export type AuditEventName = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

export interface RecordEventArgs {
  event: AuditEventName | string;
  sessionId?: string | null;
  quizId?: string | null;
  actor?: string | null;
  details?: Record<string, unknown> | null;
  ts?: number;
}

export function recordEvent(args: RecordEventArgs): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_events (ts, event, session_id, quiz_id, actor, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    args.ts ?? Date.now(),
    args.event,
    args.sessionId ?? null,
    args.quizId ?? null,
    args.actor ?? null,
    args.details ? JSON.stringify(args.details) : null,
  );
}

export function setSessionHostActor(sessionId: string, actor: string): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET host_actor = ? WHERE id = ?').run(actor, sessionId);
}

export function setSessionFirstStarted(sessionId: string, ts: number): void {
  const db = getDb();
  // Only set on first transition out of lobby — never overwrite a real start.
  db.prepare(
    `UPDATE sessions SET first_started_at = ?
     WHERE id = ? AND first_started_at IS NULL`,
  ).run(ts, sessionId);
}

export function setSessionEnded(sessionId: string, ts: number): void {
  const db = getDb();
  db.prepare(
    `UPDATE sessions SET ended_at = ?
     WHERE id = ? AND ended_at IS NULL`,
  ).run(ts, sessionId);
}

export function bumpPeakPlayerCount(sessionId: string, count: number): void {
  const db = getDb();
  db.prepare(
    `UPDATE sessions SET peak_player_count = ?
     WHERE id = ? AND peak_player_count < ?`,
  ).run(count, sessionId, count);
}

export interface SessionAuditSummary {
  sessionId: string;
  code: string;
  quizId: string;
  quizName: string | null;
  state: string;
  hostActor: string | null;
  createdAt: number;
  firstStartedAt: number | null;
  endedAt: number | null;
  /** firstStartedAt → endedAt if both set; null otherwise. */
  durationMs: number | null;
  peakPlayerCount: number;
  /** Distinct names that ever joined (from audit_events) — survives reconnects. */
  joinedPlayerCount: number;
  questionCount: number;
  answerCount: number;
  finalRanks: number;
}

export function listSessionAudits(opts: { limit?: number; offset?: number } = {}): SessionAuditSummary[] {
  const db = getDb();
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = db
    .prepare(
      `SELECT
         s.id            as sessionId,
         s.code          as code,
         s.quiz_id       as quizId,
         q.name          as quizName,
         s.state         as state,
         s.host_actor    as hostActor,
         s.created_at    as createdAt,
         s.first_started_at as firstStartedAt,
         s.ended_at      as endedAt,
         s.peak_player_count as peakPlayerCount,
         (SELECT COUNT(DISTINCT json_extract(a.details, '$.name'))
            FROM audit_events a
            WHERE a.session_id = s.id
              AND a.event = 'player.joined') as joinedPlayerCount,
         (SELECT COUNT(*) FROM audit_events a
            WHERE a.session_id = s.id
              AND a.event IN ('session.question_advanced', 'session.question_skipped')) as questionCount,
         (SELECT COUNT(*) FROM audit_events a
            WHERE a.session_id = s.id
              AND a.event = 'player.answered') as answerCount,
         (SELECT COUNT(*) FROM results r WHERE r.session_id = s.id) as finalRanks
       FROM sessions s
       LEFT JOIN quizzes q ON q.id = s.quiz_id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<Omit<SessionAuditSummary, 'durationMs'>>;
  return rows.map((r) => ({
    ...r,
    durationMs:
      r.firstStartedAt !== null && r.endedAt !== null
        ? Math.max(0, r.endedAt - r.firstStartedAt)
        : null,
  }));
}

export interface AuditEventRow {
  id: number;
  ts: number;
  event: string;
  sessionId: string | null;
  quizId: string | null;
  actor: string | null;
  details: Record<string, unknown> | null;
}

export function listSessionEvents(sessionId: string): AuditEventRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, ts, event, session_id as sessionId, quiz_id as quizId, actor, details
       FROM audit_events
       WHERE session_id = ?
       ORDER BY id ASC`,
    )
    .all(sessionId) as Array<Omit<AuditEventRow, 'details'> & { details: string | null }>;
  return rows.map((r) => ({
    ...r,
    details: r.details ? (JSON.parse(r.details) as Record<string, unknown>) : null,
  }));
}

export function listRecentEvents(opts: { limit?: number; offset?: number; event?: string; actor?: string } = {}): AuditEventRow[] {
  const db = getDb();
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 1000));
  const offset = Math.max(0, opts.offset ?? 0);
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.event) { where.push('event = ?'); params.push(opts.event); }
  if (opts.actor) { where.push('actor = ?'); params.push(opts.actor); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit, offset);
  const rows = db
    .prepare(
      `SELECT id, ts, event, session_id as sessionId, quiz_id as quizId, actor, details
       FROM audit_events
       ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params) as Array<Omit<AuditEventRow, 'details'> & { details: string | null }>;
  return rows.map((r) => ({
    ...r,
    details: r.details ? (JSON.parse(r.details) as Record<string, unknown>) : null,
  }));
}

export interface SessionAuditDetail extends SessionAuditSummary {
  events: AuditEventRow[];
  /**
   * Per-player roll-up: total answers, correct answers, final score (if recorded),
   * first-join timestamp. Useful for "did Bob actually play or just hover".
   */
  players: Array<{
    name: string;
    joinedAt: number;
    answers: number;
    correct: number;
    finalScore: number | null;
    finalRank: number | null;
  }>;
  /**
   * Quiz snapshot at audit time. We pull the current quiz so we can render the
   * actual question + answer text in the timeline and per-player breakdown.
   * The engine works off an in-memory snapshot taken at session-create time, so
   * this can drift if the quiz was edited mid-session — but for review it's the
   * authoritative reference.
   */
  quiz: {
    id: string;
    name: string;
    questions: Array<{ position: number; text: string; options: string[]; correctIndex: number }>;
  } | null;
}

export function getSessionAudit(sessionId: string): SessionAuditDetail | null {
  const summaries = listSessionAudits({ limit: 1, offset: 0 });
  const direct = summaries.find((s) => s.sessionId === sessionId);
  // Fall back to a targeted query if the session isn't in the recent slice
  // (long-tail history). We only need the row shape, not pagination.
  let summary: SessionAuditSummary | undefined = direct;
  if (!summary) {
    const all = listSessionAudits({ limit: 500, offset: 0 });
    summary = all.find((s) => s.sessionId === sessionId);
  }
  if (!summary) return null;

  const events = listSessionEvents(sessionId);

  const playerMap = new Map<string, { joinedAt: number; answers: number; correct: number }>();
  for (const e of events) {
    const name = (e.details && typeof e.details['name'] === 'string'
      ? (e.details['name'] as string)
      : null);
    if (!name) continue;
    if (e.event === 'player.joined' || e.event === 'player.rejoined') {
      if (!playerMap.has(name)) {
        playerMap.set(name, { joinedAt: e.ts, answers: 0, correct: 0 });
      }
    } else if (e.event === 'player.answered') {
      const entry = playerMap.get(name) ?? { joinedAt: e.ts, answers: 0, correct: 0 };
      entry.answers++;
      if (e.details && e.details['correct'] === true) entry.correct++;
      playerMap.set(name, entry);
    }
  }

  // Pull in final ranks for richness — players whose results are recorded
  // appear with their final score/rank, others get null.
  const db = getDb();
  const finalRows = db
    .prepare(
      `SELECT player_name as name, final_score as score, final_rank as rank
       FROM results WHERE session_id = ?`,
    )
    .all(sessionId) as Array<{ name: string; score: number; rank: number }>;
  const finalByName = new Map(finalRows.map((r) => [r.name, r]));

  const players = [...playerMap.entries()]
    .map(([name, v]) => {
      const final = finalByName.get(name);
      return {
        name,
        joinedAt: v.joinedAt,
        answers: v.answers,
        correct: v.correct,
        finalScore: final?.score ?? null,
        finalRank: final?.rank ?? null,
      };
    })
    .sort((a, b) => (a.finalRank ?? 1e9) - (b.finalRank ?? 1e9));

  const quizFull = summary.quizId ? getQuiz(summary.quizId) : null;
  const quiz = quizFull
    ? {
        id: quizFull.id,
        name: quizFull.name,
        questions: quizFull.questions
          .map((q) => ({ position: q.position, text: q.text, options: q.options, correctIndex: q.correctIndex }))
          .sort((a, b) => a.position - b.position),
      }
    : null;

  return { ...summary, events, players, quiz };
}
