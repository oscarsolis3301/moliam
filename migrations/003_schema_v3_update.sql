-- ═══════════════════════════════════════════
-- Migration 003: Schema v2 → v3
-- Adds: contacts, appointments, client_messages, reschedule_queue
-- Enhances: invoices (line_items, updated_at, due_date index)
-- Migrates: existing submissions → contacts via email matching
-- ═══════════════════════════════════════════

-- 1. Unified contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  company TEXT,
  source TEXT NOT NULL DEFAULT 'form' CHECK(source IN ('form', 'calendly', 'manual')),
  lead_score INTEGER DEFAULT 0 CHECK(lead_score >= 0 AND lead_score <= 100),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'qualified', 'booked', 'client', 'inactive')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);

-- 2. Migrate existing submissions into contacts (dedupe by email, keep latest)
INSERT OR IGNORE INTO contacts (name, email, phone, company, source, lead_score, created_at)
  SELECT name, email, phone, company, 'form', COALESCE(lead_score, 0), created_at
  FROM submissions
  GROUP BY email
  ORDER BY created_at DESC;

-- 3. Add contact_id FK column to submissions (SQLite ALTER TABLE)
-- Note: SQLite doesn't support ADD CONSTRAINT, so FK is advisory
ALTER TABLE submissions ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- 4. Backfill contact_id on existing submissions
UPDATE submissions SET contact_id = (
  SELECT c.id FROM contacts c WHERE c.email = submissions.email LIMIT 1
) WHERE contact_id IS NULL;

-- 5. Appointments table (Calendly + manual bookings)
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER,
  prequalification_id INTEGER,
  client_name TEXT,
  client_email TEXT,
  calendar_event_id TEXT UNIQUE,
  calendar_link TEXT,
  booking_source TEXT DEFAULT 'web' CHECK(booking_source IN ('web', 'calendly', 'manual', 'phone')),
  scheduled_with TEXT DEFAULT 'Roman',
  appointment_datetime TEXT,
  scheduled_at TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  client_timezone TEXT DEFAULT 'America/Los_Angeles',
  reschedule_attempts INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_event ON appointments(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);

-- 6. Reschedule queue
CREATE TABLE IF NOT EXISTS reschedule_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TEXT,
  max_retries INTEGER DEFAULT 2,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'exhausted', 'resolved')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- 7. Client messages (two-way threading)
CREATE TABLE IF NOT EXISTS client_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER,
  sender_id INTEGER,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK(direction IN ('inbound', 'outbound')),
  channel TEXT DEFAULT 'portal' CHECK(channel IN ('portal', 'email', 'sms', 'discord')),
  subject TEXT,
  body TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_client_messages_contact ON client_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_direction ON client_messages(direction);
CREATE INDEX IF NOT EXISTS idx_client_messages_read ON client_messages(is_read);

-- 8. Enhance invoices (add missing columns if not present)
-- SQLite: ALTER TABLE ADD COLUMN is idempotent-safe (errors silently if exists)
ALTER TABLE invoices ADD COLUMN line_items TEXT;
ALTER TABLE invoices ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
