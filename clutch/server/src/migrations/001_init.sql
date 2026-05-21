-- Initial schema for Clutch
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS quizzes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  text          TEXT NOT NULL,
  options_json  TEXT NOT NULL,
  correct_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_position
  ON questions(quiz_id, position);

CREATE TABLE IF NOT EXISTS sessions (
  id                      TEXT PRIMARY KEY,
  code                    TEXT NOT NULL UNIQUE,
  quiz_id                 TEXT NOT NULL REFERENCES quizzes(id),
  state                   TEXT NOT NULL,
  current_question_index  INTEGER NOT NULL DEFAULT 0,
  started_at              INTEGER,
  paused_at               INTEGER,
  pause_accum_ms          INTEGER NOT NULL DEFAULT 0,
  created_at              INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);

CREATE TABLE IF NOT EXISTS results (
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_name   TEXT NOT NULL,
  final_score   INTEGER NOT NULL,
  final_rank    INTEGER NOT NULL,
  PRIMARY KEY (session_id, player_name)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  INTEGER NOT NULL
);
