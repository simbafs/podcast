CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    rss_url TEXT NOT NULL DEFAULT '',
    order_dir TEXT NOT NULL DEFAULT 'old-to-new',
    current_episode_id TEXT NOT NULL DEFAULT '',
    position_sec REAL NOT NULL DEFAULT 0
);
