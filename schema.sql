-- D1 Database Schema for Podcast Sync

-- Account state table (one row per account)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    active_session_id TEXT,
    active_device_id TEXT,
    active_episode_id TEXT,
    lease_until INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Episode progress table (one row per episode per account)
CREATE TABLE IF NOT EXISTS episode_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    position_sec REAL NOT NULL DEFAULT 0,
    duration_sec REAL,
    state TEXT NOT NULL DEFAULT 'paused',
    last_session_id TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(account_id, episode_id)
);

CREATE INDEX idx_progress_account ON episode_progress(account_id);
CREATE INDEX idx_progress_episode ON episode_progress(episode_id);