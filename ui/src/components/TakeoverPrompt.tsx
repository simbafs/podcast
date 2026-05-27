'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpFromLine, X } from 'lucide-react'

interface TakeoverPromptProps {
	open: boolean
	localPosition: number
	serverPosition: number
	onTakeover: () => void
	onDismiss: () => void
}

function formatTime(sec: number): string {
	if (!sec || !isFinite(sec)) return '0:00'
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return `${m}:${s.toString().padStart(2, '0')}`
}

export default function TakeoverPrompt({
	open,
	localPosition,
	serverPosition,
	onTakeover,
	onDismiss,
}: TakeoverPromptProps) {
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-x-0 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-800 dark:bg-amber-950"
					initial={{ opacity: 0, y: 40, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 40, scale: 0.95 }}
					transition={{ type: 'spring', stiffness: 300, damping: 25 }}
				>
					<div className="flex-1">
						<p className="text-sm font-medium text-amber-900 dark:text-amber-100">
							Offline progress found
						</p>
						<p className="text-xs text-amber-700 dark:text-amber-300">
							Listened to {formatTime(localPosition)} (server: {formatTime(serverPosition)})
						</p>
					</div>
					<button
						type="button"
						onClick={onTakeover}
						aria-label="Takeover with offline progress"
						className="flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
					>
						<ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden="true" />
						Takeover
					</button>
					<button
						type="button"
						onClick={onDismiss}
						aria-label="Dismiss"
						className="flex h-7 w-7 items-center justify-center rounded-full text-amber-500 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:bg-amber-900"
					>
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
