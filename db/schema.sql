-- Account state table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    rss_url TEXT,
    order_dir TEXT DEFAULT 'old-to-new',
    current_episode_id TEXT,
    position_sec REAL DEFAULT 0,
);

CREATE INDEX IF NOT EXISTS idx_progress_account ON episode_progress(account_id);
