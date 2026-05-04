import { Episode } from './api'

const STORAGE_KEYS = {
  ACCOUNT_ID: 'podcast_account_id',
  DEVICE_ID: 'podcast_device_id',
  SESSION_ID: 'podcast_session_id',
  RSS_URL: 'podcast_rss_url',
  LAST_FETCHED_AT: 'podcast_last_fetched_at',
  EPISODES: 'podcast_episodes',
  ORDER: 'podcast_order',
} as const

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
  if (!deviceId) {
    deviceId = generateUUID()
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId)
  }
  return deviceId
}

export function getSessionId(): string {
  let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID)
  if (!sessionId) {
    sessionId = generateUUID()
    sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId)
  }
  return sessionId
}

export function getAccountId(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  const urlAccountId = urlParams.get('account')
  if (urlAccountId) {
    setAccountId(urlAccountId)
    window.history.replaceState({}, '', window.location.pathname)
    return urlAccountId
  }
  return localStorage.getItem(STORAGE_KEYS.ACCOUNT_ID)
}

export function setAccountId(accountId: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCOUNT_ID, accountId)
}

export function clearAccount(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCOUNT_ID)
  localStorage.removeItem(STORAGE_KEYS.RSS_URL)
  localStorage.removeItem(STORAGE_KEYS.LAST_FETCHED_AT)
  localStorage.removeItem(STORAGE_KEYS.EPISODES)
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID)
}

export function getRssUrl(): string | null {
  return localStorage.getItem(STORAGE_KEYS.RSS_URL)
}

export function setRssUrl(url: string): void {
  localStorage.setItem(STORAGE_KEYS.RSS_URL, url)
}

export function getLastFetchedAt(): number | null {
  const val = localStorage.getItem(STORAGE_KEYS.LAST_FETCHED_AT)
  return val ? parseInt(val, 10) : null
}

export function setLastFetchedAt(timestamp: number): void {
  localStorage.setItem(STORAGE_KEYS.LAST_FETCHED_AT, String(timestamp))
}

export function getEpisodes(): Episode[] {
  const val = localStorage.getItem(STORAGE_KEYS.EPISODES)
  return val ? JSON.parse(val) : []
}

export function setEpisodes(episodes: Episode[]): void {
  localStorage.setItem(STORAGE_KEYS.EPISODES, JSON.stringify(episodes))
}

export function shouldRefetch(): boolean {
  const lastFetched = getLastFetchedAt()
  if (!lastFetched) return false
  const DAY_MS = 24 * 60 * 60 * 1000
  return Date.now() - lastFetched > DAY_MS
}

export function getOrder(): 'new-to-old' | 'old-to-new' {
  const val = localStorage.getItem(STORAGE_KEYS.ORDER)
  return (val === 'new-to-old' || val === 'old-to-new') ? val : 'old-to-new'
}

export function setOrder(order: 'new-to-old' | 'old-to-new'): void {
  localStorage.setItem(STORAGE_KEYS.ORDER, order)
}