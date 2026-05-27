'use client'
import { motion } from 'framer-motion'
import { Play, Pause, Download, Loader2, Check } from 'lucide-react'
import type { Episode } from '@/utils/api'

interface DownloadStatus {
	guid: string
	downloaded: boolean
	progress: number
}

interface EpisodeListProps {
	episodes: Episode[]
	currentId?: string
	onChoose: (episode: Episode) => void
	downloadStatuses?: Map<string, DownloadStatus>
	onDownload?: (episode: Episode) => void
	onRemoveDownload?: (guid: string) => void
}

function formatDate(dateStr?: string) {
	if (!dateStr) return ''
	try {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}).format(new Date(dateStr))
	} catch {
		return dateStr
	}
}

const itemVariants = {
	hidden: { opacity: 0, y: 12 },
	visible: { opacity: 1, y: 0 },
}

export default function EpisodeList({
	episodes,
	currentId,
	onChoose,
	downloadStatuses,
	onDownload,
	onRemoveDownload,
}: EpisodeListProps) {
	return (
		<motion.ul
			className="divide-y divide-zinc-100 dark:divide-zinc-800"
			initial="hidden"
			animate="visible"
			variants={{
				visible: { transition: { staggerChildren: 0.04 } },
			}}
		>
			{episodes.map(ep => {
				const isCurrent = ep.guid === currentId
				return (
					<motion.li
						key={ep.guid}
						variants={itemVariants}
						className={`group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 focus-within:bg-zinc-50 dark:hover:bg-zinc-800/50 dark:focus-within:bg-zinc-800/50 ${
							isCurrent
								? 'border-l-2 border-teal-500 bg-teal-50/50 dark:border-teal-400 dark:bg-teal-950/30'
								: 'border-l-2 border-transparent'
						}`}
					>
						<button
							type="button"
							onClick={() => onChoose(ep)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault()
									onChoose(ep)
								}
							}}
							aria-label={isCurrent ? `Now playing: ${ep.title}` : `Play ${ep.title}`}
							className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${
								isCurrent
									? 'bg-teal-600 text-white shadow-sm shadow-teal-200 dark:shadow-teal-900'
									: 'bg-zinc-100 text-zinc-600 hover:bg-teal-600 hover:text-white dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-teal-600 dark:hover:text-white'
							}`}
						>
							{isCurrent ? (
								<Pause className="h-4 w-4" aria-hidden="true" />
							) : (
								<Play className="ml-0.5 h-4 w-4" aria-hidden="true" />
							)}
						</button>

						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
								{ep.title}
							</p>
							{ep.description && (
								<p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
									{ep.description}
								</p>
							)}
							<p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
								{formatDate(ep.pub_date)}
								{ep.duration ? <span> · {ep.duration}</span> : ''}
							</p>
						</div>

						{onDownload && (() => {
							const st = downloadStatuses?.get(ep.guid)
							if (st?.downloaded || (st?.progress === 1 && !st?.downloaded)) {
								return (
									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); onRemoveDownload?.(ep.guid) }}
										aria-label="Remove download"
										className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-teal-500 hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950"
									>
										<Check className="h-4 w-4" aria-hidden="true" />
									</button>
								)
							}
							if (st && st.progress > 0 && st.progress < 1) {
								return (
									<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
										<Loader2 className="h-4 w-4 animate-spin text-teal-500" aria-hidden="true" />
									</div>
								)
							}
							return (
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); onDownload(ep) }}
									aria-label="Download episode"
									className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 opacity-0 hover:bg-teal-50 hover:text-teal-600 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-teal-950 dark:hover:text-teal-400"
								>
									<Download className="h-4 w-4" aria-hidden="true" />
								</button>
							)
						})()}
					</motion.li>
				)
			})}
		</motion.ul>
	)
}
