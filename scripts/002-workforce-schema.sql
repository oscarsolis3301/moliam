-- ════════════════════════════════════════
-- MOLIAM D1 Schema v3 - Workforce Module
-- ════════════════════════════════════════
-- Multi-Tenant Workforce Management System
-- Features: Clock-in/out, GPS tracking, Geofences, Timesheets, CA OT compliance

-- Workforce workers (employees/contractors)
CREATE TABLE IF NOT EXISTS workforce_workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  employee_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'worker' CHECK(role IN ('admin', 'manager', 'worker', 'dispatcher')),
  department TEXT,
  hourly_rate REAL DEFAULT 0,
  overtime_rate REAL DEFAULT 0, -- CA OT: 1.5x after 8hrs/day, 40hrs/week
  max_daily_hours REAL DEFAULT 8,
  max_weekly_hours REAL DEFAULT 40,
  geofence_id INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'terminated', 'on_leave')),
  timezone TEXT DEFAULT 'America/Los_Angeles',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (geofence_id) REFERENCES workforce_geofences(id) ON DELETE SET NULL
);

-- Workforce clock-in/out logs with GPS tracking and geofence checks
CREATE TABLE IF NOT EXISTS workforce_clock_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  clock_in_time TEXT NOT NULL,
  clock_out_time TEXT,
  clock_out_duration REAL DEFAULT 0, -- duration in hours
  location_lat REAL,
  location_lng REAL,
  geofence_status TEXT DEFAULT 'inside' CHECK(geofence_status IN ('inside', 'outside', 'unknown')),
  accuracy_meters INTEGER,
  battery_level INTEGER, -- device battery at clock-in
  device_info TEXT, -- user_agent for device fingerprinting
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'broken_shift', 'completed')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES workforce_workers(id) ON DELETE CASCADE
);

-- Geofence boundaries for workers (circular radius geofencing)
CREATE TABLE IF NOT EXISTS workforce_geofences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  radius_meters INTEGER DEFAULT 100, -- 100m default radius
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Timesheets with automatic CA OT calculation
CREATE TABLE IF NOT EXISTS workforce_timesheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  week_start_date TEXT NOT NULL, -- Monday of the work week
  week_end_date TEXT NOT NULL, -- Sunday
  total_hours REAL DEFAULT 0,
  regular_hours REAL DEFAULT 8,
  overtime_hours_regular REAL DEFAULT 0, -- 1.5x OT after 8hrs/day
  overtime_hours_weekend REAL DEFAULT 0, -- 2x OT on weekends
  daily_totals TEXT, -- JSON: {"Monday": 8.5, "Tuesday": 9.2, ...}
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'denied', 'payroll_processed')),
  submitted_at TEXT,
  approved_at TEXT,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES workforce_workers(id) ON DELETE CASCADE
);

-- Timesheet entries - individual day records with clock times
CREATE TABLE IF NOT EXISTS workforce_timesheet_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheet_id INTEGER NOT NULL,
  entry_date TEXT NOT NULL, -- YYYY-MM-DD format
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  break_duration REAL DEFAULT 0, -- in hours
  total_hours REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (timesheet_id) REFERENCES workforce_timesheets(id) ON DELETE CASCADE
);

-- Alerts for missed clock-ins and overtime warnings
CREATE TABLE IF NOT EXISTS workforce_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL CHECK(alert_type IN ('missed_clock_in', 'overtime_warning', 'geofence_violation', 'shift_missed', 'unauthorized_overtime')),
  severity TEXT DEFAULT 'warning' CHECK(severity IN ('info', 'warning', 'critical', 'emergency')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  acknowledged_by INTEGER,
  acknowledged_at TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES workforce_workers(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Shift schedules for workers
CREATE TABLE IF NOT EXISTS workforce_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  shift_date TEXT NOT NULL, -- YYYY-MM-DD
  scheduled_start TEXT NOT NULL,
  scheduled_end TEXT,
  break_duration_minutes INTEGER DEFAULT 30,
  location_id INTEGER, -- geofence/location reference
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES workforce_workers(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES workforce_geofences(id) ON DELETE SET NULL
);

-- Indexes for workforce tables - prioritize high-frequency queries
CREATE INDEX IF NOT EXISTS idx_workforce_workers_user ON workforce_workers(user_id);
CREATE INDEX IF NOT EXISTS idx_workforce_workers_status ON workforce_workers(status);
CREATE INDEX IF NOT EXISTS idx_workforce_workers_department ON workforce_workers(department);
CREATE INDEX IF NOT EXISTS idx_workforce_clock_logs_worker_date ON workforce_clock_logs(worker_id, clock_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_workforce_clock_logs_active ON workforce_clock_logs(weekly WHERE status='active');
CREATE INDEX IF NOT EXISTS idx_workforce_geofences_center ON workforce_geofences(center_lat, center_lng);
CREATE INDEX IF NOT EXISTS idx_workforce_timesheets_worker_week ON workforce_timesheets(worker_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_workforce_timesheets_status ON workforce_timesheets(status);
CREATE INDEX IF NOT EXISTS idx_workforce_timesheet_entries_timesheet ON workforce_timesheet_entries(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_workforce_alerts_worker_unread ON workforce_alerts(worker_id, is_read ASC);
CREATE INDEX IF NOT EXISTS idx_workforce_shifts_worker_date ON workforce_shifts(worker_id, shift_date DESC);
