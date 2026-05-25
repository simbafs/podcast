'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { useWebSocket } from '@/hooks/useWebSocket'
import { getEpisodes, type Episode } from '@/utils/api'
import AccountDialog from '@/components/AccountDialog'
import AudioPlayer from '@/components/AudioPlayer'
import EpisodeList from '@/components/EpisodeList'
import SessionIndicator from '@/components/SessionIndicator'

export default function PlayerPage() {
	const { accountId, account, loading, create, join, update, logout } = useAccount()
	const { role, state, connected, send } = useWebSocket(
		loading || !accountId ? undefined : accountId,
	)

	const [episodes, setEpisodes] = useState<Episode[]>([])
	const [feedTitle, setFeedTitle] = useState('')
	const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
	const [syncPosition, setSyncPosition] = useState(0)
	const [syncPlaying, setSyncPlaying] = useState<boolean | undefined>(undefined)
	const lastUpdateRef = useRef(0)

	// RSS & sort state
	const [rssUrl, setRssUrl] = useState('')
	const [orderDir, setOrderDir] = useState<string>('old-to-new')
	const [savingRss, setSavingRss] = useState(false)

	useEffect(() => {
		if (!account) return
		setRssUrl(account.rss_url)
		setOrderDir(account.order_dir)
	}, [account])

	// Fetch episodes when account is ready or RSS URL changes
	const loadEpisodes = useCallback(async () => {
		if (!accountId) return
		try {
			const res = await getEpisodes(accountId)
			setEpisodes(res.episodes)
			setFeedTitle(res.title)
		} catch {
			/* ignore */
		}
	}, [accountId])

	useEffect(() => {
		if (accountId) loadEpisodes()
	}, [accountId, loadEpisodes])

	// Sorted episodes
	const sortedEpisodes = useMemo(() => {
		return sortEpisodes(episodes, orderDir)
	}, [episodes, orderDir])

	// Sync state from WebSocket
	useEffect(() => {
		if (state.episode_id) {
			const ep = episodes.find((e) => e.guid === state.episode_id)
			if (ep) setCurrentEpisode(ep)
		}
		if (state.position_sec !== undefined) setSyncPosition(state.position_sec)
		if (state.playing !== undefined) setSyncPlaying(state.playing)
	}, [state, episodes])

	// Save RSS URL
	const handleSaveRss = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			if (!rssUrl.trim()) return
			setSavingRss(true)
			try {
				await update({ rss_url: rssUrl.trim() })
				await loadEpisodes()
			} catch {
				/* ignore */
			} finally {
				setSavingRss(false)
			}
		},
		[rssUrl, update, loadEpisodes],
	)

	// Toggle sort order
	const toggleOrder = useCallback(async () => {
		const next = orderDir === 'old-to-new' ? 'new-to-old' : 'old-to-new'
		setOrderDir(next)
		try {
			await update({ order_dir: next })
		} catch {
			/* ignore */
		}
	}, [orderDir, update])

	// WebSocket callbacks
	const handleTimeUpdate = useCallback(
		(pos: number) => {
			if (role !== 'master') return
			if (Date.now() - lastUpdateRef.current < 5000) return
			lastUpdateRef.current = Date.now()
			send({ type: 'update', episode_id: state.episode_id || currentEpisode?.guid, position_sec: pos })
		},
		[role, send, state.episode_id, currentEpisode],
	)

	const handlePlayPause = useCallback(
		(playing: boolean) => {
			send({ type: playing ? 'play' : 'stop' })
		},
		[send],
	)

	const handleSeek = useCallback(
		(pos: number) => {
			send({ type: 'seek', position_sec: pos })
		},
		[send],
	)

	const handleChoose = useCallback(
		(ep: Episode) => {
			setCurrentEpisode(ep)
			send({ type: 'choose', episode_id: ep.guid })
		},
		[send],
	)

	const handleTakeover = useCallback(() => {
		send({ type: 'takeover' })
	}, [send])

	const handleLogout = useCallback(() => {
		logout()
		setEpisodes([])
		setCurrentEpisode(null)
		setFeedTitle('')
		setRssUrl('')
	}, [logout])

	// Copy account ID to clipboard
	const copyId = useCallback(() => {
		if (accountId) navigator.clipboard.writeText(accountId)
	}, [accountId])

	const showAccountDialog = !loading && !accountId && !account
	const audioUrl = currentEpisode?.audio_url || ''
	const readonly = role !== 'master'
	const orderLabel = orderDir === 'old-to-new' ? 'Old → New' : 'New → Old'

	if (loading) return <div className="flex justify-center p-8 text-sm text-zinc-500">Loading…</div>

	return (
		<>
			<AccountDialog open={showAccountDialog} onCreate={create} onJoin={join} />

			{!showAccountDialog && (
				<div className="mx-auto flex min-h-screen max-w-2xl flex-col">
					{/* Utility bar */}
					<div className="flex items-center justify-between border-b px-4 py-1.5 text-xs text-zinc-500">
						<button
							type="button"
							onClick={copyId}
							title="Copy account ID"
							className="truncate hover:text-zinc-800 dark:hover:text-zinc-200"
						>
							{accountId ? accountId.slice(0, 8) + '…' : ''}
						</button>
						<div className="flex items-center gap-3">
							<SessionIndicator role={role} connected={connected} onTakeover={handleTakeover} />
							<button
								type="button"
								onClick={handleLogout}
								className="hover:text-red-500"
							>
								logout
							</button>
						</div>
					</div>

					{/* RSS control block */}
					<div className="border-b px-4 py-3">
						<form onSubmit={handleSaveRss} className="flex gap-2">
							<input
								type="url"
								value={rssUrl}
								onChange={(e) => setRssUrl(e.target.value)}
								placeholder="https://example.com/feed.xml"
								className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
							/>
							<button
								type="submit"
								disabled={savingRss || !rssUrl.trim()}
								className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
							>
								{savingRss ? 'Saving…' : 'Save'}
							</button>
						</form>
						<div className="mt-2 flex items-center gap-2">
							<button
								type="button"
								onClick={toggleOrder}
								className="rounded border px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
							>
								{orderLabel}
							</button>
							{feedTitle && (
								<span className="truncate text-xs text-zinc-500">{feedTitle}</span>
							)}
						</div>
					</div>

					{/* Episode list */}
					<main className="flex-1 overflow-y-auto">
						{episodes.length === 0 ? (
							<p className="p-8 text-center text-sm text-zinc-500">
								{rssUrl ? 'No episodes found.' : 'Enter an RSS URL above to load episodes.'}
							</p>
						) : (
							<EpisodeList
								episodes={sortedEpisodes}
								currentId={currentEpisode?.guid}
								onChoose={handleChoose}
							/>
						)}
					</main>

					{/* Audio player */}
					<AudioPlayer
						audioUrl={audioUrl}
						initialPosition={syncPosition}
						playing={readonly ? syncPlaying : undefined}
						seekTo={readonly ? syncPosition : undefined}
						episodes={sortedEpisodes}
						currentGuid={currentEpisode?.guid}
						onTimeUpdate={handleTimeUpdate}
						onPlayPause={handlePlayPause}
						onSeek={handleSeek}
						onChoose={handleChoose}
						readonly={readonly}
					/>
				</div>
			)}
		</>
	)
}

function sortEpisodes(episodes: Episode[], order: string): Episode[] {
	return [...episodes].sort((a, b) => {
		const da = a.pub_date ? new Date(a.pub_date).getTime() : 0
		const db = b.pub_date ? new Date(b.pub_date).getTime() : 0
		return order === 'old-to-new' ? da - db : db - da
	})
}
