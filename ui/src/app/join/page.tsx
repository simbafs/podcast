'use client'
import { useEffect, useState } from 'react'
import { Headphones } from 'lucide-react'

export default function JoinPage() {
	const [status, setStatus] = useState<'joining' | 'error' | 'invalid'>('joining')

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const accountId = params.get('account_id')

		if (!accountId) {
			setStatus('invalid')
			return
		}

		try {
			localStorage.setItem('account_id', JSON.stringify(accountId))
		} catch {
			setStatus('error')
			return
		}

		// Small delay so the user sees the page before redirect
		const id = setTimeout(() => {
			window.location.replace('/player')
		}, 800)

		return () => clearTimeout(id)
	}, [])

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950">
				<Headphones className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden="true" />
			</div>

			{status === 'joining' && (
				<>
					<p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
						Joining account…
					</p>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						Redirecting to player
					</p>
				</>
			)}

			{status === 'invalid' && (
				<>
					<p className="text-lg font-semibold tracking-tight text-red-600 dark:text-red-400">
						Invalid Link
					</p>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						This join link is missing the account ID.
					</p>
				</>
			)}

			{status === 'error' && (
				<>
					<p className="text-lg font-semibold tracking-tight text-red-600 dark:text-red-400">
						Something went wrong
					</p>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						Could not save the account. Please try again.
					</p>
				</>
			)}
		</div>
	)
}
