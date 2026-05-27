'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { Play, Pause, SkipBack, SkipForward, Volume2, Loader2 } from 'lucide-react'
import type { Episode } from '@/utils/api'

interface AudioPlayerProps {
	audioUrl: string
	initialPosition?: number
	playing?: boolean
	role: 'master' | 'slave'
	episodes: Episode[]
	currentGuid?: string
	onTimeUpdate?: (pos: number) => void
	onPlayPause?: (playing: boolean) => void
	onSeek?: (pos: number) => void
	onChoose?: (episode: Episode) => void
	seekTo?: number
	commandPending?: boolean
}

function useVolume() {
	return useLocalStorage('player_volume', 1)
}

function formatTime(sec: number): string {
	if (!sec || !isFinite(sec)) return '0:00'
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({
	audioUrl,
	initialPosition = 0,
	playing: externalPlaying,
	role,
	episodes,
	currentGuid,
	onTimeUpdate,
	onPlayPause,
	onSeek,
	onChoose,
	seekTo,
	commandPending,
}: AudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null)
	const [playing, setPlaying] = useState(false)
	const [position, setPosition] = useState(initialPosition)
	const [duration, setDuration] = useState(0)
	const [volume, setVolume] = useVolume()
	const seekingRef = useRef(false)
	const playingRef = useRef(false)
	const lastServerPosRef = useRef(0)
	const lastServerTimeRef = useRef(0)
	const positionRef = useRef(initialPosition)
	const initialPositionRef = useRef(initialPosition)
	initialPositionRef.current = initialPosition
	const srcRef = useRef<string | undefined>(undefined)
	const onTimeUpdateRef = useRef(onTimeUpdate)
	const onSeekRef = useRef(onSeek)
	const onPlayPauseRef = useRef(onPlayPause)
	const onChooseRef = useRef(onChoose)
	const roleRef = useRef(role)
	onTimeUpdateRef.current = onTimeUpdate
	onSeekRef.current = onSeek
	onPlayPauseRef.current = onPlayPause
	onChooseRef.current = onChoose
	roleRef.current = role
	const isMaster = role === 'master'

	useEffect(() => {
		if (!audioUrl) return
		const audio = audioRef.current
		if (!audio) return
		if (srcRef.current === audioUrl) return
		srcRef.current = audioUrl
		audio.src = audioUrl
	}, [audioUrl])

	const handleLoadedMetadata = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return
		if (initialPositionRef.current > 0) {
			audio.currentTime = initialPositionRef.current
		}
		setDuration(audio.duration || 0)
	}, [])

	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return
		audio.volume = volume
	}, [volume])

	useEffect(() => {
		playingRef.current = externalPlaying === true
	}, [externalPlaying])

	useEffect(() => {
		if (externalPlaying === undefined) return
		const audio = audioRef.current
		if (!audio) return
		if (isMaster) {
			if (externalPlaying && audio.paused) {
				const p = audio.play()
				if (p !== undefined) p.catch(() => {})
			} else if (!externalPlaying && !audio.paused) {
				audio.pause()
			}
		}
		setPlaying(externalPlaying)
	}, [externalPlaying, isMaster])

	// Slave: advance position from last known server position + wall clock time
	useEffect(() => {
		if (isMaster || duration === 0) return
		const interval = setInterval(() => {
			if (playingRef.current && !seekingRef.current) {
				const elapsed = (Date.now() - lastServerTimeRef.current) / 1000
				setPosition(Math.min(lastServerPosRef.current + elapsed, duration))
			}
		}, 250)
		return () => clearInterval(interval)
	}, [isMaster, duration])

	useEffect(() => {
		if (seekTo === undefined) return
		setPosition(seekTo)
		positionRef.current = seekTo
		lastServerPosRef.current = seekTo
		lastServerTimeRef.current = Date.now()
		if (!isMaster) return
		const audio = audioRef.current
		if (!audio) return
		audio.currentTime = seekTo
	}, [seekTo, isMaster])

	const currentEpisode = episodes.find(e => e.guid === currentGuid)
	const currentIndex = episodes.findIndex(e => e.guid === currentGuid)
	const hasPrev = currentIndex > 0
	const hasNext = currentIndex < episodes.length - 1

	const handlePrev = useCallback(() => {
		if (!hasPrev || !onChooseRef.current) return
		onChooseRef.current(episodes[currentIndex - 1])
	}, [hasPrev, episodes, currentIndex])

	const handleNext = useCallback(() => {
		if (!hasNext || !onChooseRef.current) return
		onChooseRef.current(episodes[currentIndex + 1])
	}, [hasNext, episodes, currentIndex])

	const handleTimeUpdate = useCallback(() => {
		if (seekingRef.current) return
		const audio = audioRef.current
		if (!audio) return
		setPosition(audio.currentTime)
		positionRef.current = audio.currentTime
		onTimeUpdateRef.current?.(audio.currentTime)
	}, [])

	const handlePlayPause = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return
		if (roleRef.current === 'master') {
			// Master: control audio element directly
			if (audio.paused) {
				audio.play()
				setPlaying(true)
				onPlayPauseRef.current?.(true)
			} else {
				audio.pause()
				setPlaying(false)
				onPlayPauseRef.current?.(false)
			}
		} else {
			// Slave: send command, parent will handle state
			if (playingRef.current) {
				onPlayPauseRef.current?.(false)
			} else {
				onPlayPauseRef.current?.(true)
			}
		}
	}, [])

	const handleSeek = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const pos = Number(e.target.value)
			seekingRef.current = true
			setPosition(pos)
			positionRef.current = pos
		},
		[],
	)

	const handleSeekEnd = useCallback(() => {
		seekingRef.current = false
		onSeekRef.current?.(positionRef.current)
	}, [])

	const handleVolume = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const v = Number(e.target.value)
			setVolume(v)
			if (audioRef.current) audioRef.current.volume = v
		},
		[setVolume],
	)

	const progressPct = duration > 0 ? (position / duration) * 100 : 0

	return (
		<div className="flex flex-col gap-2 border-t border-zinc-200 bg-white/80 px-4 pb-4 pt-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
			{/* Track title */}
			{currentEpisode && (
				<div className="flex items-center justify-between gap-2">
					<p className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
						{currentEpisode.title}
					</p>
				</div>
			)}

			{/* Progress bar */}
			<div className="flex items-center gap-2">
				<span className="w-10 text-right text-xs tabular-nums text-zinc-400">
					{formatTime(position)}
				</span>
				<div className="relative flex-1">
					<div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
					<div
						className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-teal-500 to-teal-400 dark:from-teal-600 dark:to-teal-500"
						style={{ width: `${progressPct}%` }}
					/>
					<input
						type="range"
						min={0}
						max={duration || 0}
						value={position}
						onChange={handleSeek}
						onMouseUp={handleSeekEnd}
						onTouchEnd={handleSeekEnd}
						disabled={!audioUrl}
						aria-label="Seek position"
						className="relative z-10 h-4 w-full cursor-pointer opacity-0"
					/>
				</div>
				<span className="w-10 text-xs tabular-nums text-zinc-400">
					{formatTime(duration)}
				</span>
			</div>

			{/* Controls row */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handlePrev}
						disabled={!hasPrev}
						aria-label="Previous episode"
						className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					>
						<SkipBack className="h-4 w-4" aria-hidden="true" />
					</button>

					<button
						type="button"
						onClick={handlePlayPause}
						disabled={!audioUrl}
						aria-label={playing ? 'Pause' : 'Play'}
						className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm shadow-teal-200 hover:bg-teal-500 active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:shadow-teal-900 dark:focus-visible:ring-offset-zinc-900"
					>
						{commandPending ? (
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
						) : playing ? (
							<Pause className="h-5 w-5" aria-hidden="true" />
						) : (
							<Play className="ml-0.5 h-5 w-5" aria-hidden="true" />
						)}
					</button>

					<button
						type="button"
						onClick={handleNext}
						disabled={!hasNext}
						aria-label="Next episode"
						className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					>
						<SkipForward className="h-4 w-4" aria-hidden="true" />
					</button>

					{/* Equalizer when playing */}
					{playing && (
						<div className="ml-2 flex items-end gap-[2px]" aria-hidden="true">
							<div className="equalizer-bar w-[3px] rounded-full bg-teal-500" />
							<div className="equalizer-bar w-[3px] rounded-full bg-teal-400" />
							<div className="equalizer-bar w-[3px] rounded-full bg-teal-500" />
							<div className="equalizer-bar w-[3px] rounded-full bg-teal-400" />
						</div>
					)}
				</div>

				{/* Volume */}
				<div className="flex items-center gap-1.5">
					<Volume2 className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
					<div className="relative h-4 w-20">
						<div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
						<div
							className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-teal-500 dark:bg-teal-600"
							style={{ width: `${volume * 100}%` }}
						/>
						<input
							type="range"
							min={0}
							max={1}
							step={0.05}
							value={volume}
							onChange={handleVolume}
							aria-label="Volume"
							className="relative z-10 h-4 w-full cursor-pointer opacity-0"
						/>
					</div>
				</div>
			</div>

			<audio
				ref={audioRef}
				onTimeUpdate={handleTimeUpdate}
				onEnded={handleNext}
				onLoadedMetadata={handleLoadedMetadata}
				preload="metadata"
			/>
		</div>
	)
}
