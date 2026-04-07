-- ═══════════════════════════════════════════
-- MOLIAM D1 Schema v3 — Unified Contacts + Appointments + Messages
-- ═══════════════════════════════════════════

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

-- ═══════════════════════════════════════════
-- v3: Unified contacts (single record per person across all channels)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  company TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('form', 'calendly', 'manual')),
  lead_score INTEGER DEFAULT 0 CHECK(lead_score >= 0 AND lead_score <= 100),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'qualified', 'booked', 'client', 'inactive')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);

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

-- ═══════════════════════════════════════════
-- v3: Appointments (Calendly webhook sync + manual bookings)
-- ═══════════════════════════════════════════
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

-- Reschedule queue (retry logic for failed reschedules)
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

-- ═══════════════════════════════════════════
-- v3: Client messages (two-way threading with direction)
-- ═══════════════════════════════════════════
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

-- ═══════════════════════════════════════════
-- Invoices (enhanced with line_items + updated_at)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date TEXT,
  sent_at TEXT,
  paid_at TEXT,
  description TEXT,
  line_items TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ═══════════════════════════════════════════
-- Rate limiting (direct IP + endpoint + timestamp)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (ip, endpoint, timestamp)
);

-- ═══════════════════════════════════════════
-- Core indexes
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
-- Compound indexes from 3ed857b → 2708e4a reverted commit, added now per Task 1:
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip, endpoint);
CREATE INDEX IF NOT EXISTS idx_contacts_email_source ON contacts(email, source);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);
