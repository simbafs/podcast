const ACCOUNT_KEY = "podcast_account_id";
const RSS_URL_KEY = "podcast_rss_url";
const EPISODES_KEY = "podcast_episodes";
const ORDER_KEY = "podcast_order";
const LAST_FETCHED_KEY = "podcast_last_fetched";

export function getAccountId(): string {
  return localStorage.getItem(ACCOUNT_KEY) ?? "";
}

export function setAccountId(id: string): void {
  localStorage.setItem(ACCOUNT_KEY, id);
}

export function getRssUrl(): string {
  return localStorage.getItem(RSS_URL_KEY) ?? "";
}

export function setRssUrl(url: string): void {
  localStorage.setItem(RSS_URL_KEY, url);
}

export function getEpisodes(): import("./types").Episode[] {
  const raw = localStorage.getItem(EPISODES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setEpisodes(episodes: import("./types").Episode[]): void {
  localStorage.setItem(EPISODES_KEY, JSON.stringify(episodes));
}

export function getOrder(): string {
  return localStorage.getItem(ORDER_KEY) ?? "old-to-new";
}

export function setOrder(order: string): void {
  localStorage.setItem(ORDER_KEY, order);
}

export function getLastFetchedAt(): number {
  return Number(localStorage.getItem(LAST_FETCHED_KEY) ?? 0);
}

export function setLastFetchedAt(ts: number): void {
  localStorage.setItem(LAST_FETCHED_KEY, String(ts));
}

export function clearAccount(): void {
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.removeItem(RSS_URL_KEY);
  localStorage.removeItem(EPISODES_KEY);
  localStorage.removeItem(ORDER_KEY);
  localStorage.removeItem(LAST_FETCHED_KEY);
}