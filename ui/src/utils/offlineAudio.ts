import { getDownload } from './db'

const objectUrlCache = new Map<string, string>()

export async function getOfflineAudioUrl(audioUrl: string, guid: string): Promise<string | null> {
	const record = await getDownload(guid)
	if (!record) return null

	const cached = objectUrlCache.get(guid)
	if (cached) return cached

	const url = URL.createObjectURL(record.blob)
	objectUrlCache.set(guid, url)
	return url
}

export function revokeOfflineUrl(guid: string) {
	const url = objectUrlCache.get(guid)
	if (url) {
		URL.revokeObjectURL(url)
		objectUrlCache.delete(guid)
	}
}
