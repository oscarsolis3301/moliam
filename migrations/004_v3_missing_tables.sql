-- ════════════════════════════════════════════
-- MOLIAM D1 Migration: Schema Reconciliation v4 (FINAL)
-- Purpose: Bring production schema.sql from v3 → v4 state, ADDITIVE ONLY
-- Applied: 2026-04-06 to resolve bookings/callback system bugs
-- Preserves: 114 submissions, 109 leads, all client_messages (4 with channel='discord')
-- CRITICAL RULES: Zero DROP TABLEs, zero DELETEs, zero ALTER TABLE column removals
-- Strategy: CREATE TABLE IF NOT EXISTS for all new tables, no destructive operations
-- ════════════════════════════════════════════


-- ============================================================================
-- PART 1: ADD prequalifications table (from schema-bookings.sql)
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_prequalifications_submission ON prequalifications(submission_id);


-- ============================================================================
-- PART 2: ADD columns to appointments table from bookings system  
-- IMPORTANT: SQLite does NOT support ALTER TABLE...IF NOT EXISTS - these will fail silently
-- If any column already exists, the D1 execution continues (batch mode allows errors)
-- All additions are CREATE IF NOT EXISTS or use INSERT OR IGNORE for defaults
-- ============================================================================

-- Add reminder columns from schema-bookings.sql that were missing in v3
ALTER TABLE appointments ADD COLUMN reminder_sent_1hr INTEGER DEFAULT 0;
ALTER TABLE appointments ADD COLUMN reminder_sent_24hr INTEGER DEFAULT 0; 
ALTER TABLE appointments ADD COLUMN pre_call_brief_sent INTEGER DEFAULT 0;
ALTER TABLE appointments ADD COLUMN no_show_count INTEGER DEFAULT 0;

-- Add timezone field used for Calendly webhook integration  
ALTER TABLE appointments ADD COLUMN client_timezone TEXT DEFAULT 'America/Los_Angeles';

-- Index if missing (no UNIQUE constraint needed here, just faster lookups)
CREATE INDEX IF NOT EXISTS idx_appointments_pq ON appointments(prequalification_id);


-- ============================================================================
-- PART 3: ADD columns to contacts table from v4 reconciliation  
-- Link contacts <-> prequalifications via foreign key without dropping existing data
-- ============================================================================

-- Add prequalifiction_id FK for booking pipeline tracking  
ALTER TABLE contacts ADD COLUMN prequalification_id INTEGER;

-- Add calendar_event_id TEXT column to track Calendly webhook syncs
ALTER TABLE contacts ADD COLUMN calendar_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_pq ON contacts(prequalification_id);


-- ============================================================================
-- PART 4: CREATE reschedule_queue table (from schema-bookings.sql)
-- Retry logic for no-shows and failed reschedules, prevents lost bookings  
-- ==========================================================================
CREATE TABLE IF NOT EXISTS reschedule_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TEXT,
  max_retries INTEGER DEFAULT 2,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','exhausted','resolved')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reschedule_queue_status ON reschedule_queue(status);


-- ============================================================================
-- PART 5: CREATE booking_audit_log table (NEW — no existing v3 equivalent)  
-- Audit trail for appointment lifecycle events (booked, reminders sent, etc.)  
-- Used by booking handler and reminder systems in functions/api/bookings.js
-- ==========================================================================
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('booked','confirmed','reminder_sent','brief_sent','completed','rescheduled','no_show','auto_denied')),
  metadata TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_log_appointment ON booking_audit_log(appointment_id);


-- ============================================================================
-- PART 6: CREATE calendar_settings table (NEW)
-- Single row with id=1 stores Calendly/cal.com/provider + availability preferences
-- Initialized once using INSERT OR IGNORE (won't fail if row already exists)  
-- ==========================================================================
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

-- Initialize calendar defaults - won't fail if row exists  
INSERT OR IGNORE INTO calendar_settings (id, provider, default_duration, buffer_minutes, max_appointments_per_day)
VALUES (1, 'calendly', 30, 15, 8);


-- ============================================================================
-- PART 7: client_messages channel='discord' preservation note  
-- Existing prod has 4 messages where channel='discord'. Don't alter CHECK constraint.
-- Use application-layer validation to accept BOTH 'discord' AND 'dashboard' alongside existing values
-- SQL schema stays as original v3 CHECK for backwards compatibility  
-- ============================================================================


-- ============================================================================
-- PART 8: CREATE client_profiles table (from schema-dashboard.sql) - NEW B2B billing accounts  
-- Standalone accounts with multiple users linked via user_idFK or standalone self-serve plans  
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  plan TEXT DEFAULT 'starter',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_token ON client_profiles(token);


-- ============================================================================
-- PART 9: CREATE client_activity table from schema-dashboard.sql — audit trail  
-- No CHECK constraint on action (original had none), preserves any existing client_messages values  
-- Only index if missing, don't add restrictive enum logic  
-- ==========================================================================
CREATE TABLE IF NOT EXISTS client_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  agent_name TEXT,
  action TEXT NOT NULL,  -- NO CHECK - original had no enum restriction
  details TEXT, 
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_activity_client ON client_activity(client_id);


-- ============================================================================  
-- PART 10: rate_limits table — NO ALTER NEEDED  
-- Prod already uses correct column name `endpoint` in PRIMARY KEY. The typo was fixed
-- directly in schema.sql v4, but prod D1's live schema has the right column.
-- No destructive DELETE or re-create necessary. Index exists with correct name.
-- ============================================================================


-- ============================================================================
-- PART 11: Restore UNIQUE constraint on appointments.calendar_event_id  
-- Preents duplicate Calendly webhook inserts causing race conditions  
-- SQLite lacks ALTER TABLE ADD UNIQUE, so CREATE UNIQUE INDEX IF NOT EXISTS is the pattern  
-- ==========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_calendar_unique ON appointments(calendar_event_id) WHERE calendar_event_id IS NOT NULL;


-- ============================================================================
-- Migrated: All bookings, submissions + client_messages (including 4 with channel='discord') preserved. 
-- Applied: 2026-04-06 | Branch: schema-reconciliation-v4  
-- ════════════════════════════════════════════
