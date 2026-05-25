'use client'
import { Crown, ArrowUpFromLine } from 'lucide-react'

interface SessionIndicatorProps {
	role: 'master' | 'slave' | null
	connected: boolean
	onTakeover?: () => void
}

export default function SessionIndicator({ role, connected, onTakeover }: SessionIndicatorProps) {
	return (
		<div className="flex items-center gap-2">
			<span
				role="status"
				aria-label={connected ? 'Connected' : 'Disconnected'}
				className={`inline-block h-2 w-2 rounded-full ${
					connected
						? 'bg-green-500 pulse-dot'
						: 'bg-red-500'
				}`}
			/>
			{role === 'master' && (
				<span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
					<Crown className="h-3 w-3" aria-hidden="true" />
					master
				</span>
			)}
			{role === 'slave' && (
				<span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
					slave
				</span>
			)}
			{role === 'slave' && (
				<button
					type="button"
					onClick={onTakeover}
					aria-label="Take over as master"
					className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
				>
					<ArrowUpFromLine className="h-3 w-3" aria-hidden="true" />
					takeover
				</button>
			)}
		</div>
	)
}
