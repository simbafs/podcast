'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

interface AudioPlayerProps {
	audioUrl: string
	initialPosition?: number
	playing?: boolean
	onTimeUpdate?: (pos: number) => void
	onPlayPause?: (playing: boolean) => void
	onSeek?: (pos: number) => void
	readonly?: boolean
	seekTo?: number
}

export default function AudioPlayer({
	audioUrl,
	initialPosition = 0,
	playing: externalPlaying,
	onTimeUpdate,
	onPlayPause,
	onSeek,
	readonly,
	seekTo,
}: AudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null)
	const [playing, setPlaying] = useState(false)
	const [position, setPosition] = useState(initialPosition)
	const [duration, setDuration] = useState(0)
	const seekingRef = useRef(false)

	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return

		audio.src = audioUrl
		audio.currentTime = initialPosition
		setPosition(initialPosition)

		audio.onloadedmetadata = () => setDuration(audio.duration || 0)
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
		const audio = audioRef.current
		if (!audio || Math.abs(audio.currentTime - seekTo) < 3) return
		audio.currentTime = seekTo
		setPosition(seekTo)
	}, [seekTo])

	const handleTimeUpdate = useCallback(() => {
		if (seekingRef.current) return
		const audio = audioRef.current
		if (!audio) return
		const pos = audio.currentTime
		setPosition(pos)
		onTimeUpdate?.(pos)
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

	return (
		<div className="flex items-center gap-4 border-t bg-white p-4 dark:bg-zinc-900">
			<button
				type="button"
				onClick={handlePlayPause}
				className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
				disabled={!audioUrl || readonly}
			>
				{playing ? (
					<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<rect x="6" y="4" width="4" height="16" />
						<rect x="14" y="4" width="4" height="16" />
					</svg>
				) : (
					<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<polygon points="5,3 19,12 5,21" />
					</svg>
				)}
			</button>

			<div className="flex flex-1 items-center gap-2">
				<span className="w-12 text-right text-xs tabular-nums text-zinc-500">
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
				<span className="w-12 text-xs tabular-nums text-zinc-500">{formatTime(duration)}</span>
			</div>

			<audio ref={audioRef} onTimeUpdate={handleTimeUpdate} preload="metadata" />
		</div>
	)
}

function formatTime(sec: number): string {
	if (!sec || !isFinite(sec)) return '0:00'
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return `${m}:${s.toString().padStart(2, '0')}`
}
