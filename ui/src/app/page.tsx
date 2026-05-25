'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { useMount } from '@/hooks/useMount'

export default function HomePage() {
	const router = useRouter()
	const { accountId, create, join } = useAccount()
	const [joinId, setJoinId] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	useMount(() => {
		if (accountId) router.replace('/player')
	})

	const handleCreate = async () => {
		setBusy(true)
		setError('')
		try {
			await create()
			router.push('/player')
		} catch {
			setError('Failed to create account')
		} finally {
			setBusy(false)
		}
	}

	const handleJoin = async (e: React.FormEvent) => {
		e.preventDefault()
		setBusy(true)
		setError('')
		try {
			await join(joinId.trim())
			router.push('/player')
		} catch {
			setError('Account not found')
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
			<h1 className="text-3xl font-bold">Podcast Player</h1>

			<button
				type="button"
				onClick={handleCreate}
				disabled={busy}
				className="rounded bg-zinc-900 px-6 py-3 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
			>
				{busy ? 'Creating...' : 'Create Account'}
			</button>

			<div className="flex w-full max-w-sm items-center gap-2">
				<hr className="flex-1 border-zinc-300 dark:border-zinc-700" />
				<span className="text-sm text-zinc-500">or</span>
				<hr className="flex-1 border-zinc-300 dark:border-zinc-700" />
			</div>

			<form onSubmit={handleJoin} className="flex w-full max-w-sm flex-col gap-2">
				<input
					type="text"
					value={joinId}
					onChange={(e) => setJoinId(e.target.value)}
					placeholder="Paste account ID"
					className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
				/>
				<button
					type="submit"
					disabled={busy || !joinId.trim()}
					className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
				>
					Join Account
				</button>
			</form>

			{error && <p className="text-sm text-red-500">{error}</p>}
		</div>
	)
}
