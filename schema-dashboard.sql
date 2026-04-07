CREATE TABLE IF NOT EXISTS client_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  plan TEXT DEFAULT starter,
  created_at TEXT DEFAULT (datetime(now))
);

CREATE TABLE IF NOT EXISTS client_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime(now)),
  FOREIGN KEY (client_id) REFERENCES client_profiles(id)
);

CREATE TABLE IF NOT EXISTS client_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  agent_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime(now)),
  FOREIGN KEY (client_id) REFERENCES client_profiles(id)
);
