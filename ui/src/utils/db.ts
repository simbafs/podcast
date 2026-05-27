const DB_NAME = 'podcast-db'
const DB_VERSION = 1
const STORE = 'downloads'

interface DownloadRecord {
	guid: string
	title: string
	audioUrl: string
	blob: Blob
	downloadedAt: string
	episode: { guid: string; title: string; description?: string; pub_date?: string; duration?: string }
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)
		req.onupgradeneeded = () => {
			const db = req.result
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: 'guid' })
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

export async function saveDownload(record: DownloadRecord): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		tx.objectStore(STORE).put(record)
		tx.oncomplete = () => { db.close(); resolve() }
		tx.onerror = () => { db.close(); reject(tx.error) }
	})
}

export async function getDownload(guid: string): Promise<DownloadRecord | undefined> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly')
		const req = tx.objectStore(STORE).get(guid)
		req.onsuccess = () => { db.close(); resolve(req.result || undefined) }
		req.onerror = () => { db.close(); reject(req.error) }
	})
}

export async function removeDownload(guid: string): Promise<void> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		tx.objectStore(STORE).delete(guid)
		tx.oncomplete = () => { db.close(); resolve() }
		tx.onerror = () => { db.close(); reject(tx.error) }
	})
}

export async function listDownloads(): Promise<DownloadRecord[]> {
	const db = await openDB()
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly')
		const req = tx.objectStore(STORE).getAll()
		req.onsuccess = () => { db.close(); resolve(req.result) }
		req.onerror = () => { db.close(); reject(req.error) }
	})
}

export async function hasDownload(guid: string): Promise<boolean> {
	const record = await getDownload(guid)
	return !!record
}
