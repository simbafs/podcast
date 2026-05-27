'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Loader2, Trash2, Play, X } from 'lucide-react'
import type { Episode } from '@/utils/api'

interface DownloadStatus {
	guid: string
	downloaded: boolean
	progress: number
}

interface PendingDownload {
	episode: Episode
	status: DownloadStatus
}

interface DownloadDialogProps {
	open: boolean
	onClose: () => void
	downloads: Episode[]
	pendingEpisodes: Episode[]
	downloadStatuses: Map<string, DownloadStatus>
	onPlay: (ep: Episode) => void
	onRemove: (guid: string) => void
}

export default function DownloadDialog({
	open,
	onClose,
	downloads,
	pendingEpisodes,
	downloadStatuses,
	onPlay,
	onRemove,
}: DownloadDialogProps) {
	const pending: PendingDownload[] = pendingEpisodes
		.map(ep => ({
			episode: ep,
			status: downloadStatuses.get(ep.guid) || { guid: ep.guid, downloaded: false, progress: 0 },
		}))
		.filter(p => p.status.progress < 1)

	const hasPending = pending.length > 0
	const hasSaved = downloads.length > 0

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

						{!hasPending && !hasSaved ? (
							<p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
								No downloaded episodes yet.
							</p>
						) : (
							<div className="-mx-6 flex-1 overflow-y-auto px-6">
								{/* Pending downloads */}
								{hasPending && (
									<div className="pb-3">
										<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
											Downloading
										</p>
										<div className="space-y-2">
											{pending.map(p => (
												<div
													key={p.episode.guid}
													className="flex items-center gap-2 rounded-xl px-3 py-2"
												>
													<Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-500" aria-hidden="true" />
													<div className="min-w-0 flex-1">
														<p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
															{p.episode.title}
														</p>
														<div className="mt-1 flex items-center gap-2">
															<div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
																<div
																	className="h-full rounded-full bg-teal-500 transition-all"
																	style={{ width: `${p.status.progress * 100}%` }}
																/>
															</div>
															<span className="text-xs tabular-nums text-zinc-400">
																{Math.round(p.status.progress * 100)}%
															</span>
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Separator */}
								{hasPending && hasSaved && (
									<div className="border-t border-zinc-200 dark:border-zinc-700" />
								)}

								{/* Saved episodes */}
								{hasSaved && (
									<div className={hasPending ? 'pt-3' : ''}>
										{hasPending && (
											<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
												Saved
											</p>
										)}
										<div className="space-y-1">
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
									</div>
								)}
							</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
