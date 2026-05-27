'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Trash2, Play, X } from 'lucide-react'
import type { Episode } from '@/utils/api'

interface DownloadDialogProps {
	open: boolean
	onClose: () => void
	downloads: Episode[]
	onPlay: (ep: Episode) => void
	onRemove: (guid: string) => void
}

export default function DownloadDialog({ open, onClose, downloads, onPlay, onRemove }: DownloadDialogProps) {
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
				>
					<motion.div
						className="absolute inset-0 bg-black/50"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
					/>

					<motion.div
						role="dialog"
						aria-labelledby="downloads-title"
						aria-modal="true"
						className="relative flex max-h-[80vh] w-full max-w-sm flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
						initial={{ scale: 0.9, opacity: 0, y: 20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.9, opacity: 0, y: 20 }}
						transition={{ type: 'spring', stiffness: 300, damping: 25 }}
					>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>

						<div className="flex items-center gap-3 pb-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950">
								<Download className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
							</div>
							<h2 id="downloads-title" className="text-lg font-bold tracking-tight">
								Downloads
							</h2>
						</div>

						{downloads.length === 0 ? (
							<p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
								No downloaded episodes yet.
							</p>
						) : (
							<div className="-mx-6 flex-1 space-y-1 overflow-y-auto px-6">
								{downloads.map(ep => (
									<div
										key={ep.guid}
										className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
									>
										<button
											type="button"
											onClick={() => onPlay(ep)}
											aria-label={`Play ${ep.title}`}
											className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 hover:bg-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:bg-teal-900 dark:text-teal-300 dark:hover:bg-teal-800"
										>
											<Play className="h-3.5 w-3.5" aria-hidden="true" />
										</button>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
												{ep.title}
											</p>
										</div>
										<button
											type="button"
											onClick={() => onRemove(ep.guid)}
											aria-label={`Remove ${ep.title}`}
											className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950"
										>
											<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
										</button>
									</div>
								))}
							</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
