const STORAGE_KEYS = {
  ACCOUNT_ID: 'podcast_account_id',
  DEVICE_ID: 'podcast_device_id',
  SESSION_ID: 'podcast_session_id',
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
  return localStorage.getItem(STORAGE_KEYS.ACCOUNT_ID)
}

export function setAccountId(accountId: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCOUNT_ID, accountId)
}

export function clearAccount(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCOUNT_ID)
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID)
}