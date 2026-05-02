const API_BASE = ''

export interface AccountState {
  activeEpisodeId: string
  positionSec: number
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

export async function transition(body: {
  accountId: string
  sessionId: string
  deviceId: string
  from: {
    episodeId: string
    positionSec: number
    state: EpisodeProgress['state']
  }
  to: {
    episodeId: string
    positionSec: number
    state: EpisodeProgress['state']
  }
  takeover?: boolean
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/playback/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 409) {
    const conflict: ConflictError = await res.json()
    throw conflict
  }

  if (!res.ok) throw new Error('Failed to transition')
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function takeover(body: {
  accountId: string
  sessionId: string
  deviceId: string
  episodeId: string
  positionSec: number
  state: EpisodeProgress['state']
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/playback/takeover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error('Failed to takeover')
}