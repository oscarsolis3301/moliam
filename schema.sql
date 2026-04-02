-- MOLIAM D1 Database Schema
-- Apply with: wrangler d1 execute moliam-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT NULL,
  company TEXT DEFAULT NULL,
  message TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  screen_resolution TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new' CHECK(status IN ('new','contacted','converting','lost','won')),
  assigned_to TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  hash_ip TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 1,
  window_start TEXT DEFAULT (datetime('now')),
  last_request_timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
