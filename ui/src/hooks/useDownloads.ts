'use client'
import { useCallback, useEffect, useState } from 'react'
import { saveDownload, removeDownload, listDownloads, hasDownload } from '@/utils/db'
import type { Episode } from '@/utils/api'

interface DownloadStatus {
	guid: string
	downloaded: boolean
	progress: number
}

export function useDownloads() {
	const [downloads, setDownloads] = useState<Episode[]>([])
	const [statuses, setStatuses] = useState<Map<string, DownloadStatus>>(new Map())

	const refresh = useCallback(async () => {
		const records = await listDownloads()
		const eps: Episode[] = records.map(r => ({
			guid: r.guid,
			title: r.title,
			description: r.episode.description || '',
			audio_url: r.audioUrl,
			pub_date: r.episode.pub_date || '',
			duration: r.episode.duration || '',
		}))
		setDownloads(eps)
	}, [])

	useEffect(() => { refresh() }, [refresh])

	const download = useCallback(async (episode: Episode) => {
		setStatuses(prev => {
			const next = new Map(prev)
			next.set(episode.guid, { guid: episode.guid, downloaded: false, progress: 0 })
			return next
		})

		try {
			const res = await fetch(episode.audio_url)
			const reader = res.body?.getReader()
			if (!reader) throw new Error('No reader')

			const contentLength = Number(res.headers.get('Content-Length') || 0)
			const chunks: BlobPart[] = []
			let received = 0

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				chunks.push(value)
				received += value.length
				if (contentLength) {
					setStatuses(prev => {
						const next = new Map(prev)
						next.set(episode.guid, { guid: episode.guid, downloaded: false, progress: received / contentLength })
						return next
					})
				}
			}

			const blob = new Blob(chunks, { type: 'audio/mpeg' })
			await saveDownload({
				guid: episode.guid,
				title: episode.title,
				audioUrl: episode.audio_url,
				blob,
				downloadedAt: new Date().toISOString(),
				episode: {
					guid: episode.guid,
					title: episode.title,
					description: episode.description || '',
					pub_date: episode.pub_date || '',
					duration: episode.duration || '',
				},
			})

			setStatuses(prev => {
				const next = new Map(prev)
				next.set(episode.guid, { guid: episode.guid, downloaded: true, progress: 1 })
				return next
			})
			refresh()
		} catch {
			setStatuses(prev => {
				const next = new Map(prev)
				next.delete(episode.guid)
				return next
			})
		}
	}, [refresh])

	const remove = useCallback(async (guid: string) => {
		await removeDownload(guid)
		setStatuses(prev => {
			const next = new Map(prev)
			next.delete(guid)
			return next
		})
		refresh()
	}, [refresh])

	const checkStatus = useCallback(async (guid: string): Promise<DownloadStatus> => {
		const downloaded = await hasDownload(guid)
		return { guid, downloaded, progress: downloaded ? 1 : 0 }
	}, [])

	return { downloads, statuses, download, remove, checkStatus, refresh }
}
