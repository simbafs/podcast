'use client'

interface SessionIndicatorProps {
	role: 'master' | 'slave' | null
	connected: boolean
	onTakeover?: () => void
}

export default function SessionIndicator({ role, connected, onTakeover }: SessionIndicatorProps) {
	return (
		<div className="flex items-center gap-2">
			<span
				className={`inline-block h-2 w-2 rounded-full ${
					connected ? 'bg-green-500' : 'bg-red-500'
				}`}
			/>
			{role === 'slave' && (
				<button
					type="button"
					onClick={onTakeover}
					className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200"
				>
					takeover
				</button>
			)}
		</div>
	)
}
