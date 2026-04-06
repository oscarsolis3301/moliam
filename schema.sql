-- ════════════════════════════════════════════
-- MOLIAM D1 Schema v4 — Unified Booking + Calendar System
-- Merges: schema.sql v3 + schema-bookings.sql + schema-dashboard.sql
-- Applied: 2026-04-06 (schema reconciliation)
-- ════════════════════════════════════════════

-- Users (admin + clients)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('superadmin', 'admin', 'client')),
  company TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT
);

-- Sessions (JWT-like token sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Projects (each client can have multiple)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'website' CHECK(type IN ('website', 'gbp', 'lsa', 'retainer')),
  status TEXT NOT NULL DEFAULT 'onboarding' CHECK(status IN ('onboarding', 'in_progress', 'review', 'active', 'paused', 'completed')),
  monthly_rate REAL DEFAULT 0,
  setup_fee REAL DEFAULT 0,
  start_date TEXT,
  next_billing TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Project updates/milestones (timeline for client dashboard)
CREATE TABLE IF NOT EXISTS project_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'update' CHECK(type IN ('update', 'milestone', 'deliverable', 'report', 'invoice')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Client profiles (from schema-dashboard.sql v1)
CREATE TABLE IF NOT EXISTS client_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  plan TEXT DEFAULT 'starter',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════
-- v4: Unified contacts (single record per person across all channels)
-- Merged from v3 with booking tracking columns from schema-bookings.sql
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  company TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('form', 'calendly', 'manual')),
  lead_score INTEGER DEFAULT 0 CHECK(lead_score >= 0 AND lead_score <= 100),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'qualified', 'booked', 'client', 'inactive')),
  prequalification_id INTEGER, -- NEW: FK to prequalifications if qualified
  calendar_event_id TEXT,      -- NEW: Track booked appointments
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_pq ON contacts(prequalification_id);

-- Submissions (form entries — linked to contacts)
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT NOT NULL,
  user_agent TEXT,
  screen_resolution TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  lead_score INTEGER DEFAULT 0,
  category TEXT DEFAULT 'cold',
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Leads (pipeline tracking — linked to submissions)
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER,
  status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  score INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL
);

-- ════════════════════════════════════════════
-- v4: Booking qualifications — from schema-bookings.sql
-- Qualification data for leads before booking
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prequalifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

   -- Budget qualification
  budget_range TEXT DEFAULT 'unknown' CHECK(budget_range IN ('unknown','under_1k','1k-5k','5k-10k','10k+')),
  max_budget REAL CHECK(max_budget >= 0),

   -- Timeline urgency
  timeline_urgency TEXT DEFAULT 'flexible' CHECK(timeline_urgency IN ('unknown','immediate','within_week','next_month','flexible')),
  project_start_date TEXT DEFAULT NULL,

   -- Industry/fit check
  primary_industry TEXT DEFAULT 'unknown' CHECK(primary_industry IN ('unknown','real_estate','financial_services','healthcare','retail','technology','other')),
  current_stack TEXT DEFAULT '',
  pain_points TEXT DEFAULT '',

   -- Qualification score (0-100)
  qualification_score INTEGER DEFAULT 0 CHECK(qualification_score >= 0 AND qualification_score <= 100),

  calendar_access_granted INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prequalifications_score ON prequalifications(qualification_score);
CREATE INDEX IF NOT EXISTS idx_prequalifications_submission ON prequalifications(submission_id);

-- ════════════════════════════════════════════
-- v4: Appointments — unified booking table (from both schemas combined)
-- Dual FK support: can link to contacts OR submissions via prequalification_id
-- Combines v3 contact tracking + bookings.js reminder columns + no-shou tracking
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

   -- Dual FK support: can link to either contacts OR submissions via prequalification_id
  contact_id INTEGER,            -- From schema.sql v3 (existing)
  prequalification_id INTEGER,   -- From schema-bookings.sql (newer)

   -- Contact info fallback (for manual bookings without contact record)
  client_name TEXT,
  client_email TEXT,

    -- Calendar integration data (Cal.com or Calendly) - restored UNIQUE constraint from v3 to prevent duplicate Calendly webhook inserts
  calendar_event_id TEXT UNIQUE,         -- UNIQUE if booked via calendly webhook from schema.sql v3
  calendar_link TEXT,
  booking_source TEXT DEFAULT 'web' CHECK(booking_source IN ('web','calendly','manual','phone')),

   -- Booking metadata from schema-bookings.sql plus v4 updates
  scheduled_with TEXT NOT NULL DEFAULT 'Roman',
  appointment_datetime TEXT,     -- FROM schema.sql v3
  scheduled_at TEXT,             -- Alternative timestamp field

   -- Status tracking with full enum coverage
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled','no_show','rescheduled')),

   -- Reminder system (from schema-bookings.sql)
  reminder_sent_1hr INTEGER DEFAULT 0,
  reminder_sent_24hr INTEGER DEFAULT 0,
  pre_call_brief_sent INTEGER DEFAULT 0,

   -- No-show prevention tracking
  no_show_count INTEGER DEFAULT 0 CHECK(no_show_count >= 0),
  reschedule_attempts INTEGER DEFAULT 0 CHECK(reschedule_attempts >= 0),

  client_timezone TEXT DEFAULT 'America/Los_Angeles',
  notes TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

   -- Dual FK support from schema.sql v3 + bookings.js
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (prequalification_id) REFERENCES prequalifications(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_event ON appointments(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pq ON appointments(prequalification_id);

-- Reschedule queue (retry logic for failed reschedules) - from both schemas combined
CREATE TABLE IF NOT EXISTS reschedule_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TEXT,
  max_retries INTEGER DEFAULT 2,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','resolved','abandoned','exhausted')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reschedule_queue_status ON reschedule_queue(status);

-- Booking history/audit trail - from schema-bookings.sql (NEW)
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('booked','confirmed','reminder_sent','brief_sent','completed','rescheduled','no_show','auto_denied')),
  metadata TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_log_action ON booking_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_booking_log_appointment ON booking_audit_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_booking_log_created ON booking_audit_log(created_at);

-- Calendar sync settings - from schema-bookings.sql (NEW)
CREATE TABLE IF NOT EXISTS calendar_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  provider TEXT DEFAULT 'calendly' CHECK(provider IN ('calendly','cal_com','custom')),
  event_type_id TEXT DEFAULT NULL,
  availability_schedule TEXT DEFAULT '{"mon-fri":"09:00-17:00"}',
  default_duration INTEGER DEFAULT 30,
  buffer_minutes INTEGER DEFAULT 15,
  max_appointments_per_day INTEGER DEFAULT 8,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Initialize calendar defaults from schema-bookings.sql
INSERT OR IGNORE INTO calendar_settings (id, provider, default_duration, buffer_minutes, max_appointments_per_day)
VALUES (1, 'calendly', 30, 15, 8);

-- ════════════════════════════════════════════
-- v4: Client messages — unified threading with dual FK support (from both schemas merged)
-- schema.sql v3 + client_messages structure from dashboard
-- Combines v3's contact_id+sender_id approach with dashboard's client_profiles reference
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS client_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Dual FK: optional contact or user sender reference from schema.sql v3 plus client_profiles link
  contact_id INTEGER,                 -- FK to contacts.id for contacts who messaged
  sender_id INTEGER,                  -- FK to users.admin for internal notes (v3 style)
  client_id INTEGER,                  -- Optional FK to client_profiles for B2B accounts

    -- Threading and channel support from both sources - added 'dashboard' alongside existing 'discord' to preserve existing client_messages data with channel='discord' from production
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK(direction IN ('inbound', 'outbound')),
  channel TEXT DEFAULT 'portal' CHECK(channel IN ('portal', 'email', 'sms', 'discord', 'dashboard')),
  subject TEXT,

  body TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,

   -- Timestamp and foreign key support from merged schemas
  created_at TEXT DEFAULT (datetime('now')),

   -- Multiple FK chains for flexible messaging
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES client_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_messages_contact ON client_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_direction ON client_messages(direction);
CREATE INDEX IF NOT EXISTS idx_client_messages_read ON client_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_client_messages_client ON client_messages(client_id);

-- ════════════════════════════════════════════
-- Client activity tracking — from schema-dashboard.sql (NEW)
-- Audit activity log for client dashboard events
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS client_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  agent_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES client_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_activity_client ON client_activity(client_id);

-- ════════════════════════════════════════════
-- Invoices (enhanced line_items + updated_at from schema.sql v3)
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,        -- FK to users.id for B2B billing or client_profiles.id for self-serve
  invoice_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date TEXT,
  sent_at TEXT,
  paid_at TEXT,
  description TEXT,
  line_items TEXT,                 -- JSON array of invoice items
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ════════════════════════════════════════════
-- Rate limiting (direct IP + endpoint + timestamp) from schema.sql v3
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (ip, endpoint, timestamp)
);

-- ════════════════════════════════════════════
-- Core indexes for all merged tables - performance optimization
-- ════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
