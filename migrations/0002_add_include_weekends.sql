-- Add include_weekends preference to users table
-- Default to 0 (false) - weekends are excluded by default

ALTER TABLE users ADD COLUMN include_weekends INTEGER DEFAULT 0;
