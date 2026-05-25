'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { Episode } from '@/utils/api'

interface AudioPlayerProps {
	audioUrl: string
	initialPosition?: number
	playing?: boolean
	episodes: Episode[]
	currentGuid?: string
	onTimeUpdate?: (pos: number) => void
	onPlayPause?: (playing: boolean) => void
	onSeek?: (pos: number) => void
	onChoose?: (episode: Episode) => void
	readonly?: boolean
	seekTo?: number
}

function useVolume() {
	return useLocalStorage('player_volume', 1)
}

export default function AudioPlayer({
	audioUrl,
	initialPosition = 0,
	playing: externalPlaying,
	episodes,
	currentGuid,
	onTimeUpdate,
	onPlayPause,
	onSeek,
	onChoose,
	readonly,
	seekTo,
}: AudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null)
	const [playing, setPlaying] = useState(false)
	const [position, setPosition] = useState(initialPosition)
	const [duration, setDuration] = useState(0)
	const [volume, setVolume] = useVolume()
	const seekingRef = useRef(false)

	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return
		setPosition(initialPosition)
		audio.volume = volume
		if (!audioUrl) return

		audio.src = audioUrl
		const onLoaded = () => {
			audio.currentTime = initialPosition
			setDuration(audio.duration || 0)
		}
		audio.addEventListener('loadedmetadata', onLoaded)
		return () => audio.removeEventListener('loadedmetadata', onLoaded)
	}, [audioUrl])

	useEffect(() => {
		if (externalPlaying === undefined) return
		const audio = audioRef.current
		if (!audio) return
		if (externalPlaying && audio.paused) {
			audio.play()
			setPlaying(true)
		} else if (!externalPlaying && !audio.paused) {
			audio.pause()
			setPlaying(false)
		}
	}, [externalPlaying])

	useEffect(() => {
		if (seekTo === undefined) return
		setPosition(seekTo)
		const audio = audioRef.current
		if (!audio || Math.abs(audio.currentTime - seekTo) < 3) return
		audio.currentTime = seekTo
	}, [seekTo])

	const currentIndex = episodes.findIndex((e) => e.guid === currentGuid)
	const hasPrev = currentIndex > 0
	const hasNext = currentIndex < episodes.length - 1

	const handlePrev = useCallback(() => {
		if (!hasPrev || readonly || !onChoose) return
		onChoose(episodes[currentIndex - 1])
	}, [hasPrev, readonly, onChoose, episodes, currentIndex])

	const handleNext = useCallback(() => {
		if (!hasNext || readonly || !onChoose) return
		onChoose(episodes[currentIndex + 1])
	}, [hasNext, readonly, onChoose, episodes, currentIndex])

	const handleTimeUpdate = useCallback(() => {
		if (seekingRef.current) return
		const audio = audioRef.current
		if (!audio) return
		setPosition(audio.currentTime)
		onTimeUpdate?.(audio.currentTime)
	}, [onTimeUpdate])

	const handlePlayPause = useCallback(() => {
		const audio = audioRef.current
		if (!audio || readonly) return
		if (audio.paused) {
			audio.play()
			setPlaying(true)
			onPlayPause?.(true)
		} else {
			audio.pause()
			setPlaying(false)
			onPlayPause?.(false)
		}
	}, [onPlayPause, readonly])

	const handleSeek = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (readonly) return
			const pos = Number(e.target.value)
			seekingRef.current = true
			setPosition(pos)
			if (audioRef.current) audioRef.current.currentTime = pos
			onSeek?.(pos)
		},
		[onSeek, readonly],
	)

	const handleVolume = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const v = Number(e.target.value)
			setVolume(v)
			if (audioRef.current) audioRef.current.volume = v
		},
		[setVolume],
	)

	return (
		<div className="flex flex-col gap-2 border-t bg-white p-3 dark:bg-zinc-900">
			{/* Progress bar row */}
			<div className="flex items-center gap-2">
				<span className="w-10 text-right text-xs tabular-nums text-zinc-500">
					{formatTime(position)}
				</span>
				<input
					type="range"
					min={0}
					max={duration || 0}
					value={position}
					onChange={handleSeek}
					onMouseUp={() => (seekingRef.current = false)}
					onTouchEnd={() => (seekingRef.current = false)}
					className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900 dark:bg-zinc-700"
				/>
				<span className="w-10 text-xs tabular-nums text-zinc-500">{formatTime(duration)}</span>
			</div>

			{/* Controls row */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handlePrev}
						disabled={!hasPrev || readonly}
						className="flex h-8 w-8 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
					>
						<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<polygon points="19,20 9,12 19,4" />
							<rect x="5" y="4" width="2" height="16" />
						</svg>
					</button>

					<button
						type="button"
						onClick={handlePlayPause}
						disabled={!audioUrl || readonly}
						className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
					>
						{playing ? (
							<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<rect x="6" y="4" width="4" height="16" />
								<rect x="14" y="4" width="4" height="16" />
							</svg>
						) : (
							<svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<polygon points="5,3 19,12 5,21" />
							</svg>
						)}
					</button>

					<button
						type="button"
						onClick={handleNext}
						disabled={!hasNext || readonly}
						className="flex h-8 w-8 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
					>
						<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<polygon points="5,4 15,12 5,20" />
							<rect x="17" y="4" width="2" height="16" />
						</svg>
					</button>
				</div>

				{/* Volume */}
				<div className="flex items-center gap-1.5">
					<svg className="h-3.5 w-3.5 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
						<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
					</svg>
					<input
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={volume}
						onChange={handleVolume}
						className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900 dark:bg-zinc-700"
					/>
				</div>
			</div>

			<audio
				ref={audioRef}
				onTimeUpdate={handleTimeUpdate}
				onEnded={handleNext}
				preload="metadata"
			/>
		</div>
	)
}

function formatTime(sec: number): string {
	if (!sec || !isFinite(sec)) return '0:00'
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return `${m}:${s.toString().padStart(2, '0')}`
}
