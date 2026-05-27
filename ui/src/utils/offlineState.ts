const KEY = 'podcast-offline-state'

interface OfflineState {
	episodeId: string
	positionSec: number
	playing: boolean
	timestamp: number
}

export function saveState(state: OfflineState) {
	try {
		localStorage.setItem(KEY, JSON.stringify(state))
	} catch {
		/* ignore */
	}
}

export function loadState(): OfflineState | null {
	try {
		const raw = localStorage.getItem(KEY)
		return raw ? JSON.parse(raw) : null
	} catch {
		return null
	}
}

export function clearState() {
	try {
		localStorage.removeItem(KEY)
	} catch {
		/* ignore */
	}
}
