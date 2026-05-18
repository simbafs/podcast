-- Podcast Sync Database Schema

-- Account state table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    rss_url TEXT,
    order_dir TEXT DEFAULT 'old-to-new',
    active_conn_id TEXT,
    current_episode_id TEXT,
    position_sec REAL DEFAULT 0,
    is_playing INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Episode progress table (one row per episode per account)
CREATE TABLE IF NOT EXISTS episode_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    episode_id TEXT NOT NULL,
    position_sec REAL NOT NULL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(account_id, episode_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_account ON episode_progress(account_id);
CREATE INDEX IF NOT EXISTS idx_progress_episode ON episode_progress(episode_id);
