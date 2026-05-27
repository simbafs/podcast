'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { useWebSocket } from '@/hooks/useWebSocket'
import { getEpisodes, type Episode } from '@/utils/api'
import AccountDialog from '@/components/AccountDialog'
import AudioPlayer from '@/components/AudioPlayer'
import EpisodeList from '@/components/EpisodeList'
import SessionIndicator from '@/components/SessionIndicator'
import ThemeToggle from '@/components/ThemeToggle'
import { Rss, LogOut, Copy, ArrowUpDown, Share2 } from 'lucide-react'
import ShareDialog from '@/components/ShareDialog'

export default function PlayerPage() {
	const { accountId, account, loading, create, join, update, logout } = useAccount()
	const { role, state, connected, send, command, clearCommand } = useWebSocket(
		loading || !accountId ? undefined : accountId,
	)

	const [episodes, setEpisodes] = useState<Episode[]>([])
	const [feedTitle, setFeedTitle] = useState('')
	const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
	const [syncPosition, setSyncPosition] = useState(0)
	const [syncPlaying, setSyncPlaying] = useState<boolean | undefined>(undefined)
	const [commandPending, setCommandPending] = useState(false)
	const lastUpdateRef = useRef(0)
	const latestPositionRef = useRef(0)
	const currentGuidRef = useRef<string | undefined>(undefined)
	const syncPlayingRef = useRef(syncPlaying)
	syncPlayingRef.current = syncPlaying

	// RSS & sort state
	const [rssUrl, setRssUrl] = useState('')
	const [orderDir, setOrderDir] = useState<string>('old-to-new')
	const [savingRss, setSavingRss] = useState(false)

	useEffect(() => {
		if (!account) return
		setRssUrl(account.rss_url) // eslint-disable-line react-hooks/set-state-in-effect
		setOrderDir(account.order_dir)
		setSyncPosition(account.position_sec)
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
		if (accountId) loadEpisodes() // eslint-disable-line react-hooks/set-state-in-effect
	}, [accountId, loadEpisodes])

	// Sorted episodes
	const sortedEpisodes = useMemo(() => {
		return sortEpisodes(episodes, orderDir)
	}, [episodes, orderDir])

	// Handle relayed commands (master acts on them)
	useEffect(() => {
		if (!command) return

		switch (command.type) {
			case 'play':
				if (role === 'master') setSyncPlaying(true) // eslint-disable-line react-hooks/set-state-in-effect
				break
			case 'pause':
				if (role === 'master') setSyncPlaying(false) // eslint-disable-line react-hooks/set-state-in-effect
				break
			case 'seek':
				if (role === 'master' && command.position_sec !== undefined) setSyncPosition(command.position_sec)
				break
			case 'choose':
				if (command.episode_id) {
					const ep = episodes.find(e => e.guid === command.episode_id)
					if (ep) {
						setCurrentEpisode(ep)
						currentGuidRef.current = ep.guid
						if (role === 'master') setSyncPosition(0)
					}
				}
				break
			case 'rss':
				if (command.url !== undefined) {
					setRssUrl(command.url)
					loadEpisodes()
				}
				break
		}

		clearCommand()
	}, [command, role, episodes, clearCommand, loadEpisodes])

	// Sync state from WebSocket
	useEffect(() => {
		if (state.episode_id) {
			const ep = episodes.find(e => e.guid === state.episode_id)
			if (ep) {
				setCurrentEpisode(ep) // eslint-disable-line react-hooks/set-state-in-effect
				currentGuidRef.current = ep.guid
			}
		}
		if (state.episode_id) {
			if (state.position_sec !== undefined) {
				setSyncPosition(state.position_sec) // eslint-disable-line react-hooks/set-state-in-effect
				latestPositionRef.current = state.position_sec
			}
			if (state.playing !== undefined) {
				setSyncPlaying(state.playing) // eslint-disable-line react-hooks/set-state-in-effect
				setCommandPending(false) // eslint-disable-line react-hooks/set-state-in-effect
			}
		}
	}, [state, episodes])

	// Master: send state on any user action with immediate effect
	const handlePlayPause = useCallback(
		(playing: boolean) => {
			if (role === 'master') {
				setSyncPlaying(playing)
				send({
					type: 'state',
					episode_id: currentGuidRef.current,
					position_sec: latestPositionRef.current,
					playing,
				})
			} else {
				setCommandPending(true)
				send({ type: playing ? 'play' : 'pause' })
			}
		},
		[role, send],
	)

	const handleSeek = useCallback(
		(pos: number) => {
			latestPositionRef.current = pos
			if (role === 'master') {
				setSyncPosition(pos)
				send({
					type: 'state',
					episode_id: currentGuidRef.current,
					position_sec: pos,
					playing: syncPlayingRef.current,
				})
			} else {
				setCommandPending(true)
				send({ type: 'seek', position_sec: pos })
			}
		},
		[role, send],
	)

	const handleChoose = useCallback(
		(ep: Episode) => {
			setCurrentEpisode(ep)
			currentGuidRef.current = ep.guid
			if (role === 'master') {
				setSyncPosition(0)
				latestPositionRef.current = 0
				send({
					type: 'state',
					episode_id: ep.guid,
					position_sec: 0,
					playing: true,
				})
			} else {
				setSyncPosition(0)
				setCommandPending(true)
				send({ type: 'choose', episode_id: ep.guid })
			}
		},
		[role, send],
	)

	// Periodic position sync (master only, rate-limited to 5s)
	const handleTimeUpdate = useCallback(
		(pos: number) => {
			if (role !== 'master') return
			latestPositionRef.current = pos
			if (Date.now() - lastUpdateRef.current < 5000) return
			lastUpdateRef.current = Date.now()
			send({
				type: 'state',
				episode_id: currentGuidRef.current,
				position_sec: pos,
				playing: syncPlayingRef.current,
			})
		},
		[role, send],
	)

	// Save RSS URL via WebSocket
	const handleSaveRss = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			if (!rssUrl.trim()) return
			setSavingRss(true)
			send({ type: 'rss', url: rssUrl.trim() })
			// Let server persist before reloading episodes
			await new Promise(r => setTimeout(r, 100))
			await loadEpisodes()
			setSavingRss(false)
		},
		[rssUrl, send, loadEpisodes],
	)

	// Toggle sort order (REST — no real-time sync needed)
	const toggleOrder = useCallback(async () => {
		const next = orderDir === 'old-to-new' ? 'new-to-old' : 'old-to-new'
		setOrderDir(next)
		try {
			await update({ order_dir: next })
		} catch {
			/* ignore */
		}
	}, [orderDir, update])

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

	const copyId = useCallback(() => {
		if (accountId) navigator.clipboard.writeText(accountId)
	}, [accountId])

	const [shareOpen, setShareOpen] = useState(false)
	const showAccountDialog = !loading && !accountId && !account
	const audioUrl = currentEpisode?.audio_url || ''

	// Loading skeleton
	if (loading) {
		return <LoadingSkeleton />
	}

	return (
		<>
			{accountId && (
				<ShareDialog
					open={shareOpen}
					accountId={accountId}
					onClose={() => setShareOpen(false)}
				/>
			)}
			<AccountDialog open={showAccountDialog} onCreate={create} onJoin={join} />

			{!showAccountDialog && (
				<div className="mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden">
					{/* Utility bar */}
					<div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
						<button
							type="button"
							onClick={copyId}
							aria-label="Copy account ID"
							title="Copy account ID"
							className="flex items-center gap-1.5 truncate text-xs text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded px-1.5 py-1 dark:hover:text-zinc-200"
						>
							<Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
							<span className="truncate">
								{accountId ? accountId.slice(0, 8) + '…' : ''}
							</span>
						</button>
						<div className="flex items-center gap-2">
							<ThemeToggle />
							<button
								type="button"
								onClick={() => setShareOpen(true)}
								aria-label="Share account"
								className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-zinc-800 dark:hover:text-teal-400"
							>
								<Share2 className="h-4 w-4" aria-hidden="true" />
							</button>
							<SessionIndicator
								role={role}
								connected={connected}
								onTakeover={handleTakeover}
							/>
							<button
								type="button"
								onClick={handleLogout}
								aria-label="Logout"
								className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-zinc-800"
							>
								<LogOut className="h-4 w-4" aria-hidden="true" />
							</button>
						</div>
					</div>

					{/* RSS control block */}
					<div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
						<form onSubmit={handleSaveRss} className="flex gap-2">
							<div className="relative min-w-0 flex-1">
								<Rss
									className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
									aria-hidden="true"
								/>
								<input
									type="url"
									value={rssUrl}
									onChange={(e) => setRssUrl(e.target.value)}
									placeholder="https://example.com/feed.xml"
									autoComplete="url"
									spellCheck={false}
									className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder:text-zinc-500"
								/>
							</div>
							<button
								type="submit"
								disabled={savingRss || !rssUrl.trim()}
								className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-500 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
							>
								{savingRss ? 'Saving…' : 'Save'}
							</button>
						</form>
						<div className="mt-2 flex items-center gap-2">
							<button
								type="button"
								onClick={toggleOrder}
								aria-label={`Sort: ${orderDir === 'old-to-new' ? 'Old to New' : 'New to Old'}`}
								className="flex items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
							>
								<ArrowUpDown className="h-3 w-3" aria-hidden="true" />
								{orderDir === 'old-to-new' ? 'Old → New' : 'New → Old'}
							</button>
							{feedTitle && (
								<span className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
									{feedTitle}
								</span>
							)}
						</div>
					</div>

					{/* Episode list */}
					<main
						className="min-h-0 flex-1 overflow-y-auto os-scrollbar"
						style={{ overscrollBehavior: 'contain' } as React.CSSProperties}
					>
						{episodes.length === 0 ? (
							<div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
								<Rss className="h-10 w-10 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
								<p className="text-sm text-zinc-500 dark:text-zinc-400">
									{rssUrl
										? 'No episodes found.'
										: 'Enter an RSS URL above to load episodes.'}
								</p>
							</div>
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
						playing={syncPlaying}
						role={role === 'master' ? 'master' : 'slave'}
						seekTo={syncPosition}
						episodes={sortedEpisodes}
						currentGuid={currentEpisode?.guid}
						onTimeUpdate={handleTimeUpdate}
						onPlayPause={handlePlayPause}
						onSeek={handleSeek}
						onChoose={handleChoose}
						commandPending={commandPending}
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

function SkeletonBar({ className }: { className?: string }) {
	return (
		<div
			className={`h-4 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className ?? ''}`}
		/>
	)
}

function LoadingSkeleton() {
	return (
		<div className="mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden">
			<div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
				<SkeletonBar className="h-5 w-20" />
				<div className="flex items-center gap-2">
					<SkeletonBar className="h-8 w-8 rounded-full" />
					<SkeletonBar className="h-5 w-16 rounded-full" />
				</div>
			</div>

			<div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
				<div className="flex gap-2">
					<SkeletonBar className="h-11 flex-1 rounded-xl" />
					<SkeletonBar className="h-11 w-16 rounded-xl" />
				</div>
				<SkeletonBar className="mt-2 h-5 w-32 rounded-full" />
			</div>

			<div className="flex-1 divide-y divide-zinc-100 px-4 py-4 dark:divide-zinc-800">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="flex items-start gap-3 py-3">
						<SkeletonBar className="h-9 w-9 shrink-0 rounded-full" />
						<div className="min-w-0 flex-1">
							<SkeletonBar className="h-4 w-3/4" />
							<SkeletonBar className="mt-1.5 h-3 w-full" />
							<SkeletonBar className="mt-1.5 h-3 w-1/4" />
						</div>
					</div>
				))}
			</div>

			<div className="border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
				<SkeletonBar className="mb-2 h-3 w-1/2" />
				<div className="mb-2 flex items-center gap-2">
					<SkeletonBar className="h-3 w-10" />
					<SkeletonBar className="h-1 flex-1 rounded-full" />
					<SkeletonBar className="h-3 w-10" />
				</div>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<SkeletonBar className="h-10 w-10 rounded-full" />
					</div>
					<SkeletonBar className="h-3 w-20" />
				</div>
			</div>
		</div>
	)
}
