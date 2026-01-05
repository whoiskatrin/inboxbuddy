-- MeetMe D1 Database Schema
-- Initial migration for conversation tracking

-- Conversations table - stores all scheduling conversation metadata
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,                          -- UUID
    owner_email TEXT NOT NULL,                    -- Authenticated Google email (owner)
    thread_id TEXT UNIQUE,                        -- Email thread identifier for threading replies
    latest_message_id TEXT,                       -- Most recent Message-ID for In-Reply-To header
    subject TEXT,                                 -- Email subject line
    participants TEXT,                            -- JSON array of participant emails
    status TEXT CHECK(status IN (
        'new',                                    -- Just received, not yet processed
        'parsing',                                -- AI is analyzing the conversation
        'proposed',                               -- Time slots have been proposed
        'awaiting_confirmation',                  -- Waiting for participant to confirm
        'scheduled',                              -- Meeting booked on calendar
        'declined',                               -- Meeting was declined/cancelled by participant
        'cancelled',                              -- Owner cancelled the meeting
        'error'                                   -- Something went wrong
    )) DEFAULT 'new',
    proposed_slots TEXT,                          -- JSON array of proposed time slots
    selected_slot TEXT,                           -- JSON object with confirmed slot details
    calendar_event_id TEXT,                       -- Google Calendar event ID once booked
    meeting_title TEXT,                           -- Extracted/generated meeting title
    meeting_duration_minutes INTEGER DEFAULT 30,  -- Meeting duration
    last_activity INTEGER,                        -- Unix timestamp of last update
    reminder_count INTEGER DEFAULT 0,             -- Number of reminders sent
    last_reminder_at INTEGER,                     -- Unix timestamp of last reminder
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Users table - stores registered user information
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                          -- UUID
    email TEXT UNIQUE NOT NULL,                   -- Google email (primary identifier)
    name TEXT,                                    -- Display name from Google
    google_id TEXT UNIQUE,                        -- Google user ID
    timezone TEXT DEFAULT 'America/Los_Angeles',  -- User's preferred timezone
    working_hours_start INTEGER DEFAULT 9,        -- Start of working hours (24h)
    working_hours_end INTEGER DEFAULT 17,         -- End of working hours (24h)
    working_days TEXT DEFAULT '[1,2,3,4,5]',      -- JSON array of working days (1=Mon, 7=Sun)
    buffer_minutes INTEGER DEFAULT 15,            -- Buffer time between meetings
    is_active INTEGER DEFAULT 1,                  -- Whether the account is active
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Email log - tracks all inbound/outbound emails for debugging
CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,                          -- UUID
    conversation_id TEXT,                         -- Foreign key to conversations
    direction TEXT CHECK(direction IN ('inbound', 'outbound')),
    from_email TEXT NOT NULL,
    to_emails TEXT,                               -- JSON array
    cc_emails TEXT,                               -- JSON array
    subject TEXT,
    message_id TEXT,                              -- Email Message-ID header
    in_reply_to TEXT,                             -- In-Reply-To header
    references_header TEXT,                       -- References header
    body_preview TEXT,                            -- First 500 chars of body
    raw_headers TEXT,                             -- JSON of all headers (for debugging)
    processed_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_email);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_email_log_conversation ON email_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_log_message_id ON email_log(message_id);
