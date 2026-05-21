-- Auditing: per-session summary fields + an append-only event log.
--
-- The existing `sessions.started_at` column stores the start of the CURRENT
-- question (it is reset on every advance), so it cannot be used as a
-- session-level "when did the game first begin" timestamp. We add explicit
-- analytics columns rather than overload that field, and a `host_actor` so we
-- can attribute who created/ran each session.

ALTER TABLE sessions ADD COLUMN host_actor TEXT;
ALTER TABLE sessions ADD COLUMN first_started_at INTEGER;
ALTER TABLE sessions ADD COLUMN ended_at INTEGER;
ALTER TABLE sessions ADD COLUMN peak_player_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_host_actor ON sessions(host_actor);

CREATE TABLE IF NOT EXISTS audit_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  event       TEXT NOT NULL,
  session_id  TEXT,
  quiz_id     TEXT,
  actor       TEXT,
  details     TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_events_session ON audit_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event   ON audit_events(event);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts      ON audit_events(ts);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor   ON audit_events(actor);
