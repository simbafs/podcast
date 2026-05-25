'use client'
import type { Episode } from '@/utils/api'

interface EpisodeListProps {
	episodes: Episode[]
	currentId?: string
	onChoose: (episode: Episode) => void
}

export default function EpisodeList({ episodes, currentId, onChoose }: EpisodeListProps) {
	return (
		<ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
			{episodes.map((ep) => (
				<li
					key={ep.guid}
					className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
						ep.guid === currentId ? 'bg-zinc-100 dark:bg-zinc-800' : ''
					}`}
				>
					<button
						type="button"
						onClick={() => onChoose(ep)}
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 hover:bg-zinc-900 hover:text-white dark:bg-zinc-700 dark:text-zinc-300"
					>
						{ep.guid === currentId ? (
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
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{ep.title}</p>
						<p className="text-xs text-zinc-500">
							{ep.pub_date ? new Date(ep.pub_date).toLocaleDateString() : ''}
							{ep.duration ? ` · ${ep.duration}` : ''}
						</p>
					</div>
				</li>
			))}
		</ul>
	)
}
