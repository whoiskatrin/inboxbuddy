-- Add default meeting duration and meeting title prefix settings

ALTER TABLE users ADD COLUMN default_meeting_duration INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN meeting_title_prefix TEXT DEFAULT '';
