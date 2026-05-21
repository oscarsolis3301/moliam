import { v4 as uuid } from 'uuid';
import { getDb } from '../connection.js';
import type { QuestionDraft, QuizDraft, QuizSummary } from '../../../../shared/schemas.js';

export interface QuizWithQuestions {
  id: string;
  name: string;
  createdAt: number;
  questions: Array<{
    id: string;
    position: number;
    text: string;
    options: string[];
    correctIndex: number;
  }>;
}

export function createQuiz(draft: QuizDraft): string {
  const db = getDb();
  const quizId = uuid();
  const now = Date.now();

  const insertQuiz = db.prepare(
    'INSERT INTO quizzes (id, name, created_at) VALUES (?, ?, ?)',
  );
  const insertQuestion = db.prepare(
    `INSERT INTO questions (id, quiz_id, position, text, options_json, correct_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    insertQuiz.run(quizId, draft.name, now);
    draft.questions.forEach((q: QuestionDraft, idx: number) => {
      insertQuestion.run(
        uuid(),
        quizId,
        idx,
        q.text,
        JSON.stringify(q.options),
        q.correctIndex,
      );
    });
  })();

  return quizId;
}

export function listQuizzes(): QuizSummary[] {
  const db = getDb();
  // Smoke-test fixtures (created by tests/clutch-smoke.mjs and similar) are
  // never useful in the dashboard. Filter at the SQL level so every consumer
  // gets a clean list — case-insensitive match catches "Smoke Test Quiz",
  // "smoke-test", " smoke test playground", etc.
  const rows = db
    .prepare(
      `SELECT q.id, q.name, q.created_at as createdAt,
              (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as questionCount
       FROM quizzes q
       WHERE LOWER(q.name) NOT LIKE '%smoke test%'
         AND LOWER(q.name) NOT LIKE '%smoke-test%'
       ORDER BY q.created_at DESC`,
    )
    .all() as Array<{ id: string; name: string; createdAt: number; questionCount: number }>;
  return rows;
}

export function getQuiz(id: string): QuizWithQuestions | null {
  const db = getDb();
  const quiz = db
    .prepare('SELECT id, name, created_at as createdAt FROM quizzes WHERE id = ?')
    .get(id) as { id: string; name: string; createdAt: number } | undefined;
  if (!quiz) return null;

  const questions = db
    .prepare(
      `SELECT id, position, text, options_json as optionsJson, correct_index as correctIndex
       FROM questions WHERE quiz_id = ? ORDER BY position ASC`,
    )
    .all(id) as Array<{
    id: string;
    position: number;
    text: string;
    optionsJson: string;
    correctIndex: number;
  }>;

  return {
    ...quiz,
    questions: questions.map((q) => ({
      id: q.id,
      position: q.position,
      text: q.text,
      options: JSON.parse(q.optionsJson) as string[],
      correctIndex: q.correctIndex,
    })),
  };
}

export function deleteQuiz(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM quizzes WHERE id = ?').run(id);
  return res.changes > 0;
}

/**
 * Updates a quiz: replaces name and all questions. Running sessions hold an
 * in-memory snapshot of the quiz taken at session-create time, so edits do NOT
 * affect games that are already in progress.
 *
 * Returns true if the quiz existed and was updated, false if it was not found.
 */
export function updateQuiz(id: string, draft: QuizDraft): boolean {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM quizzes WHERE id = ?').get(id);
  if (!exists) return false;

  const updateName = db.prepare('UPDATE quizzes SET name = ? WHERE id = ?');
  const deleteQs = db.prepare('DELETE FROM questions WHERE quiz_id = ?');
  const insertQ = db.prepare(
    `INSERT INTO questions (id, quiz_id, position, text, options_json, correct_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    updateName.run(draft.name, id);
    deleteQs.run(id);
    draft.questions.forEach((q: QuestionDraft, idx: number) => {
      insertQ.run(uuid(), id, idx, q.text, JSON.stringify(q.options), q.correctIndex);
    });
  })();

  return true;
}

/** Copies a quiz and all its questions under a new name. Returns the new id,
 *  or null if the source didn't exist. */
export function duplicateQuiz(id: string, newName?: string): string | null {
  const source = getQuiz(id);
  if (!source) return null;
  const name = (newName ?? `${source.name} (copy)`).trim().slice(0, 100);
  return createQuiz({
    name,
    questions: source.questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
    })),
  });
}
