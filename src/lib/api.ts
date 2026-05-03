const API_BASE = ''

export interface AccountState {
  rssUrl: string | null
  activeEpisodeId: string
  activePositionSec: number
  activeState: 'playing' | 'paused' | 'ended'
  deviceId: string
  leaseUntil: number
}

export interface EpisodeProgress {
  episodeId: string
  positionSec: number
  durationSec?: number
  state: 'playing' | 'paused' | 'ended'
  updatedAt: number
}

export interface StateResponse {
  account: AccountState | null
  progress: Record<string, EpisodeProgress>
}

export interface ConflictError {
  error: 'conflict'
  activeSessionId: string
  activeDeviceId: string
  leaseUntil: number
}

export async function fetchState(accountId: string): Promise<StateResponse> {
  const res = await fetch(`${API_BASE}/api/state?accountId=${encodeURIComponent(accountId)}`)
  if (!res.ok) throw new Error('Failed to fetch state')
  return res.json()
}

export async function updateProgress(body: {
  accountId: string
  sessionId: string
  deviceId: string
  episodeId: string
  positionSec: number
  durationSec?: number
  state: EpisodeProgress['state']
  takeover?: boolean
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 409) {
    const conflict: ConflictError = await res.json()
    throw conflict
  }

  if (!res.ok) throw new Error('Failed to update progress')
}

export async function saveFeedUrl(accountId: string, rssUrl: string): Promise<{ rssUrl: string }> {
  const res = await fetch(`${API_BASE}/api/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, rssUrl }),
  })
  if (!res.ok) throw new Error('Failed to save feed URL')
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