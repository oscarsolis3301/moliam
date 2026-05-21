import { v4 as uuid } from 'uuid';
import { getDb } from '../connection.js';
import type { SessionStateName } from '../../../../shared/schemas.js';

export interface SessionRow {
  id: string;
  code: string;
  quizId: string;
  state: SessionStateName;
  currentQuestionIndex: number;
  startedAt: number | null;
  pausedAt: number | null;
  pauseAccumMs: number;
  createdAt: number;
}

export function insertSession(args: {
  code: string;
  quizId: string;
}): SessionRow {
  const db = getDb();
  const id = uuid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions
     (id, code, quiz_id, state, current_question_index, started_at, paused_at, pause_accum_ms, created_at)
     VALUES (?, ?, ?, 'lobby', 0, NULL, NULL, 0, ?)`,
  ).run(id, args.code, args.quizId, now);

  return {
    id,
    code: args.code,
    quizId: args.quizId,
    state: 'lobby',
    currentQuestionIndex: 0,
    startedAt: null,
    pausedAt: null,
    pauseAccumMs: 0,
    createdAt: now,
  };
}

export function getSessionByCode(code: string): SessionRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, code, quiz_id as quizId, state,
              current_question_index as currentQuestionIndex,
              started_at as startedAt, paused_at as pausedAt,
              pause_accum_ms as pauseAccumMs, created_at as createdAt
       FROM sessions WHERE code = ?`,
    )
    .get(code) as SessionRow | undefined;
  return row ?? null;
}

export function getSessionById(id: string): SessionRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, code, quiz_id as quizId, state,
              current_question_index as currentQuestionIndex,
              started_at as startedAt, paused_at as pausedAt,
              pause_accum_ms as pauseAccumMs, created_at as createdAt
       FROM sessions WHERE id = ?`,
    )
    .get(id) as SessionRow | undefined;
  return row ?? null;
}

export function codeExists(code: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM sessions WHERE code = ?').get(code);
  return !!row;
}

export function updateSessionState(
  id: string,
  state: SessionStateName,
  currentQuestionIndex?: number,
): void {
  const db = getDb();
  if (currentQuestionIndex !== undefined) {
    db.prepare(
      'UPDATE sessions SET state = ?, current_question_index = ? WHERE id = ?',
    ).run(state, currentQuestionIndex, id);
  } else {
    db.prepare('UPDATE sessions SET state = ? WHERE id = ?').run(state, id);
  }
}

export function updateSessionTimers(
  id: string,
  args: { startedAt?: number | null; pausedAt?: number | null; pauseAccumMs?: number },
): void {
  const db = getDb();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (args.startedAt !== undefined) {
    fields.push('started_at = ?');
    vals.push(args.startedAt);
  }
  if (args.pausedAt !== undefined) {
    fields.push('paused_at = ?');
    vals.push(args.pausedAt);
  }
  if (args.pauseAccumMs !== undefined) {
    fields.push('pause_accum_ms = ?');
    vals.push(args.pauseAccumMs);
  }
  if (fields.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
}

export function markAllActiveSessionsEnded(): number {
  const db = getDb();
  const res = db
    .prepare(
      `UPDATE sessions SET state = 'ended'
       WHERE state NOT IN ('ended', 'final')`,
    )
    .run();
  return res.changes;
}

export function saveResults(
  sessionId: string,
  entries: Array<{ name: string; score: number; rank: number }>,
): void {
  const db = getDb();
  const del = db.prepare('DELETE FROM results WHERE session_id = ?');
  const ins = db.prepare(
    `INSERT INTO results (session_id, player_name, final_score, final_rank)
     VALUES (?, ?, ?, ?)`,
  );
  db.transaction(() => {
    del.run(sessionId);
    for (const e of entries) ins.run(sessionId, e.name, e.score, e.rank);
  })();
}

export function getResults(
  sessionId: string,
): Array<{ name: string; score: number; rank: number }> {
  const db = getDb();
  return db
    .prepare(
      `SELECT player_name as name, final_score as score, final_rank as rank
       FROM results WHERE session_id = ? ORDER BY rank ASC`,
    )
    .all(sessionId) as Array<{ name: string; score: number; rank: number }>;
}
