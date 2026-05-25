'use client'
import { motion } from 'framer-motion'
import { Play, Pause } from 'lucide-react'
import type { Episode } from '@/utils/api'

interface EpisodeListProps {
	episodes: Episode[]
	currentId?: string
	onChoose: (episode: Episode) => void
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

export default function EpisodeList({ episodes, currentId, onChoose }: EpisodeListProps) {
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
					</motion.li>
				)
			})}
		</motion.ul>
	)
}
