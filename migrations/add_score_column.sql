-- Migration: Add score column to leads table for lead scoring
-- Purpose: Persist lead quality scores in D1 database
-- Status: PENDING RUN - Execute with: wrangler d1 execute <db-name> --file=migrations/add_score_column.sql

-- First, create the leads table if it doesn't exist
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If adding to existing table, uncomment the ALTER statement:
-- ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 0;
