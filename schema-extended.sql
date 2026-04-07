-- MOLIAM Lead Capture CRM Pipeline Schema
-- Extensions for lead scoring, CRM sync, and automation

ALTER TABLE submissions ADD COLUMN budget TEXT;
ALTER TABLE submissions ADD COLUMN scope TEXT;
ALTER TABLE submissions ADD COLUMN pain_points TEXT;
ALTER TABLE submissions ADD COLUMN industry TEXT;
ALTER TABLE submissions ADD COLUMN urgency_level TEXT DEFAULT 'medium' CHECK(urgency_level IN ('low','medium','high','critical'));
ALTER TABLE submissions ADD COLUMN lead_score INTEGER DEFAULT 0;

-- New table: detailed lead analysis
CREATE TABLE IF NOT EXISTS lead_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  base_score INTEGER NOT NULL,
  industry_boost INTEGER DEFAULT 0,
  urgency_boost INTEGER DEFAULT 0,
  budget_fit_score INTEGER DEFAULT 50,
  total_score INTEGER NOT NULL,
  scored_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(submission_id) REFERENCES submissions(id)
);

-- New table: CRM sync log
CREATE TABLE IF NOT EXISTS crm_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','success','failed','retrying')),
  crm_provider TEXT DEFAULT null,
  crm_record_id TEXT DEFAULT null,
  payload TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  synced_at TEXT DEFAULT (datetime('now'))
);

-- New table: email automation log
CREATE TABLE IF NOT EXISTS email_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  sequence_name TEXT NOT NULL,
  step_number INTEGER DEFAULT 1,
  email_status TEXT DEFAULT 'queued' CHECK(email_status IN ('queued','sent','delivered','opened','clicked','failed')),
  sent_at TEXT DEFAULT null,
  template_id TEXT DEFAULT null,
  custom_data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- New table: notification audit (Discord/Slack)
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  channel_type TEXT CHECK(channel_type IN ('discord','slack','email')),
  status TEXT DEFAULT 'success' CHECK(status IN ('success','failed')),
  payload_preview TEXT,
  timestamp DATE DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_submission ON lead_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_emails_submission ON email_sequences(submission_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync ON crm_sync_log(submission_id);
