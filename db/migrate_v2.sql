-- Migration v2: allow multiple attempts per manager+call
-- Run this in Neon SQL Editor

DROP INDEX IF EXISTS unique_manager_call;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attempt_number INT DEFAULT 1;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE;
