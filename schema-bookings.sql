-- Booking System Schema Extension for MOLIAM
-- Apply with: wrangler d1 execute moliam-db --file=./schema-bookings.sql

-- Pre-qualification form data
CREATE TABLE IF NOT EXISTS prequalifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  
  -- Budget qualification
  budget_range TEXT DEFAULT 'unknown' CHECK(budget_range IN ('unknown','under_1k','1k-5k','5k-10k','10k+')) ,
  max_budget NUMBER CHECK(max_budget >= 0),
  
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

-- Booking appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prequalification_id INTEGER REFERENCES prequalifications(id) ON DELETE CASCADE,
  
  -- Calendar integration data (Cal.com or Calendly)
  calendar_event_id TEXT DEFAULT NULL,
  calendar_link TEXT DEFAULT NULL,
  booking_source TEXT DEFAULT 'web' CHECK(booking_source IN ('web','email','referral')),
  
  -- Appointment details
  scheduled_with TEXT NOT NULL,
  appointment_datetime TEXT NOT NULL,
  
  -- Status tracking
  status TEXT DEFAULT 'confirmed' CHECK(status IN ('pending','confirmed','completed','cancelled','no_show','rescheduled')),
  
  -- Reminder system
  reminder_sent_1hr INTEGER DEFAULT 0,
  reminder_sent_24hr INTEGER DEFAULT 0,
  pre_call_brief_sent INTEGER DEFAULT 0,
  
  -- No-show prevention tracking
  no_show_count INTEGER DEFAULT 0 CHECK(no_show_count >= 0),
  reschedule_attempts INTEGER DEFAULT 0 CHECK(reschedule_attempts >= 0),
  
  client_timezone TEXT DEFAULT 'America/Los_Angeles',
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Booking history/audit trail
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('booked','confirmed','reminder_sent','brief_sent','completed','rescheduled','no_show','auto_denied')),
  metadata TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Calendar sync settings
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

-- Auto-rescheduling queue for no-shows
CREATE TABLE IF NOT EXISTS reschedule_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  retry_count INTEGER DEFAULT 1,
  next_retry_at TEXT DEFAULT NULL,
  max_retries INTEGER DEFAULT 2,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','resolved','abandoned')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_prequalifications_score ON prequalifications(qualification_score);
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_booking_log_created ON booking_audit_log(created_at);

-- Initialize calendar defaults
INSERT INTO calendar_settings (id, provider, default_duration, buffer_minutes, max_appointments_per_day)
VALUES (1, 'calendly', 30, 15, 8)
ON CONFLICT(id) DO NOTHING;
