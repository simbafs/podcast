const API_BASE = ''

export interface AccountState {
  accountId: string
  rssUrl: string | null
  order: 'new-to-old' | 'old-to-new'
  activeSessionId: string
}

export interface EpisodeProgress {
  episodeId: string
  positionSec: number
  updatedAt: number
}

export interface StateResponse {
  account: AccountState | null
  progress: Record<string, EpisodeProgress>
}

export interface ApiError {
  error: string
  message: string
}

export async function fetchState(accountId: string, sessionId: string): Promise<StateResponse> {
  const res = await fetch(
    `${API_BASE}/api/state?accountId=${encodeURIComponent(accountId)}&sessionId=${encodeURIComponent(sessionId)}`
  )
  if (!res.ok) {
    const err: ApiError = await res.json()
    throw new Error(err.message || 'Failed to fetch state')
  }
  return res.json()
}

export async function updateProgress(body: {
  accountId: string
  sessionId: string
  episodeId: string
  positionSec: number
}): Promise<{ success: boolean; activeSessionId: string }> {
  const res = await fetch(`${API_BASE}/api/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err: ApiError = await res.json()
    throw new Error(err.message || 'Failed to update progress')
  }

  return res.json()
}

export async function saveFeedUrl(
  accountId: string,
  sessionId: string,
  rssUrl: string,
  order?: 'new-to-old' | 'old-to-new'
): Promise<{ rssUrl: string; order: string }> {
  const res = await fetch(`${API_BASE}/api/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, sessionId, rssUrl, order }),
  })

  if (!res.ok) {
    const err: ApiError = await res.json()
    throw new Error(err.message || 'Failed to save feed URL')
  }

  return res.json()
}

export async function takeover(accountId: string, sessionId: string): Promise<{ success: boolean; activeSessionId: string }> {
  const res = await fetch(`${API_BASE}/api/takeover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, sessionId }),
  })

  if (!res.ok) {
    const err: ApiError = await res.json()
    throw new Error(err.message || 'Failed to takeover')
  }

  return res.json()
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface Episode {
  id: string
  title: string
  audioUrl: string
  duration: number
  pubDate?: number
}