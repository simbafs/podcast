const STORAGE_KEYS = {
  ACCOUNT_ID: 'podcast_account_id',
  RSS_URL: 'podcast_rss_url',
  LAST_FETCHED_AT: 'podcast_last_fetched_at',
  EPISODES: 'podcast_episodes',
  ORDER: 'podcast_order',
};

export function getAccountId() {
  const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNT_ID);
  if (stored) return stored;

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  return null;
}

export function setAccountId(id) {
  localStorage.setItem(STORAGE_KEYS.ACCOUNT_ID, id);
}

export function getRssUrl() {
  return localStorage.getItem(STORAGE_KEYS.RSS_URL);
}

export function setRssUrl(url) {
  localStorage.setItem(STORAGE_KEYS.RSS_URL, url);
}

export function getLastFetchedAt() {
  const val = localStorage.getItem(STORAGE_KEYS.LAST_FETCHED_AT);
  return val ? parseInt(val, 10) : null;
}

export function setLastFetchedAt(timestamp) {
  localStorage.setItem(STORAGE_KEYS.LAST_FETCHED_AT, String(timestamp));
}

export function getEpisodes() {
  const val = localStorage.getItem(STORAGE_KEYS.EPISODES);
  return val ? JSON.parse(val) : [];
}

export function setEpisodes(episodes) {
  localStorage.setItem(STORAGE_KEYS.EPISODES, JSON.stringify(episodes));
}

export function getOrder() {
  const val = localStorage.getItem(STORAGE_KEYS.ORDER);
  return val === 'new-to-old' || val === 'old-to-new' ? val : 'old-to-new';
}

export function setOrder(order) {
  localStorage.setItem(STORAGE_KEYS.ORDER, order);
}