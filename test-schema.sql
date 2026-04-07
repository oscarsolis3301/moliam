-- Diagnostic queries to understand users table schema
-- PRAGMA table_info(users) would show columns but D1 might not support it

-- Try to select distinct existing column pattern by doing partial inserts
SELECT name FROM sqlite_master WHERE type='table' AND name='users';
