-- moliam-submissions Database Schema (CloudFlare D1)  
-- Auto-generated for serverless SQLite + Pages Functions deployment  

CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT DEFAULT NULL, company TEXT DEFAULT NULL, message TEXT NOT NULL, user_agent TEXT DEFAULT '', screen_resolution TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );  

CREATE TABLE IF NOT EXISTS leads (submission_id INTEGER PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE ON UPDATE NO ACTION, status TEXT DEFAULT 'new' CHECK(status IN ('new','contacted','converting','lost','won')), assigned_to TEXT DEFAULT NULL, notes TEXT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );  

CREATE TABLE IF NOT EXISTS rate_limits (hash_ip TEXT PRIMARY KEY, window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP, request_count INTEGER DEFAULT 1, last_request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);  

/* Index: fast lookups by email or IP hash */  
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);  
    CREATE INDEX IF NOT EXISTS idx_rate_limits_hash ON rate_limits(hash_ip);

INSERT OR IGNORE INTO submissions (id, name, email, message) VALUES (0, 'system_test', 'test@moliam.local', 'D1 connection test - safe for local testing only.');
