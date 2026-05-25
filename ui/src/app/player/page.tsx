'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount } from '@/hooks/useAccount'
import { useWebSocket } from '@/hooks/useWebSocket'
import { getEpisodes, type Episode } from '@/utils/api'
import AudioPlayer from '@/components/AudioPlayer'
import EpisodeList from '@/components/EpisodeList'
import SessionIndicator from '@/components/SessionIndicator'

export default function PlayerPage() {
	const router = useRouter()
	const { accountId, account, loading } = useAccount()
	const { role, state, connected, send } = useWebSocket(
		loading || !accountId ? undefined : accountId,
	)

	const [episodes, setEpisodes] = useState<Episode[]>([])
	const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
	const [feedTitle, setFeedTitle] = useState('')
	const [syncPosition, setSyncPosition] = useState(0)
	const [syncPlaying, setSyncPlaying] = useState<boolean | undefined>(undefined)
	const lastUpdateRef = useRef(0)

	useEffect(() => {
		if (!loading && !accountId) router.replace('/')
	}, [loading, accountId, router])

	useEffect(() => {
		if (!accountId) return
		getEpisodes(accountId)
			.then((res) => {
				setEpisodes(res.episodes)
				setFeedTitle(res.title)
			})
			.catch(() => {})
	}, [accountId])

	useEffect(() => {
		if (state.episode_id) {
			const ep = episodes.find((e) => e.guid === state.episode_id)
			if (ep) setCurrentEpisode(ep)
		}
		if (state.position_sec !== undefined) setSyncPosition(state.position_sec)
		if (state.playing !== undefined) setSyncPlaying(state.playing)
	}, [state, episodes])

	const handleTimeUpdate = useCallback(
		(pos: number) => {
			const now = Date.now()
			if (role !== 'master') return
			if (now - lastUpdateRef.current < 5000) return
			lastUpdateRef.current = now
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

	if (loading) return <div className="flex justify-center p-8">Loading...</div>
	if (!account) return null

	const audioUrl = currentEpisode?.audio_url || ''
	const readonly = role !== 'master'

	return (
		<div className="mx-auto flex min-h-screen max-w-2xl flex-col">
			<header className="flex items-center justify-between border-b px-4 py-3">
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-lg font-semibold">{feedTitle || 'Podcast Player'}</h1>
					{role && (
						<p className="text-xs text-zinc-500">
							{role.toUpperCase()} · {connected ? 'connected' : 'disconnected'}
						</p>
					)}
				</div>
				<div className="flex items-center gap-3">
					<SessionIndicator role={role} connected={connected} onTakeover={handleTakeover} />
					<Link
						href="/settings"
						className="text-sm text-zinc-500 underline-offset-2 hover:underline"
					>
						settings
					</Link>
				</div>
			</header>

			<main className="flex-1 overflow-y-auto">
				{episodes.length === 0 ? (
					<p className="p-8 text-center text-sm text-zinc-500">
						No episodes.{' '}
						<Link href="/settings" className="underline">
							Add an RSS URL
						</Link>
					</p>
				) : (
					<EpisodeList episodes={episodes} currentId={currentEpisode?.guid} onChoose={handleChoose} />
				)}
			</main>

			{currentEpisode && (
				<AudioPlayer
					audioUrl={audioUrl}
					initialPosition={syncPosition}
					playing={readonly ? syncPlaying : undefined}
					seekTo={readonly ? syncPosition : undefined}
					onTimeUpdate={handleTimeUpdate}
					onPlayPause={handlePlayPause}
					onSeek={handleSeek}
					readonly={readonly}
				/>
			)}
		</div>
	)
}
