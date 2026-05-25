'use client'
import { useEffect, useRef, useState } from 'react'

interface AccountDialogProps {
	open: boolean
	onCreate: () => Promise<unknown>
	onJoin: (id: string) => Promise<unknown>
}

function useDialogOpen(ref: React.RefObject<HTMLDialogElement | null>, open: boolean) {
	useEffect(() => {
		const el = ref.current
		if (!el) return
		if (open && !el.open) el.showModal()
		else if (!open && el.open) el.close()
	}, [open, ref])
}

export default function AccountDialog({ open, onCreate, onJoin }: AccountDialogProps) {
	const ref = useRef<HTMLDialogElement>(null)
	const [joinId, setJoinId] = useState('')
	const [err, setErr] = useState('')
	const [busy, setBusy] = useState(false)

	useDialogOpen(ref, open)

	const handleCreate = async () => {
		setBusy(true)
		setErr('')
		try {
			await onCreate()
		} catch {
			setErr('Failed to create account')
		} finally {
			setBusy(false)
		}
	}

	const handleJoin = async (e: React.FormEvent) => {
		e.preventDefault()
		setBusy(true)
		setErr('')
		try {
			await onJoin(joinId.trim())
		} catch {
			setErr('Account not found')
		} finally {
			setBusy(false)
		}
	}

	return (
		<dialog
			ref={ref}
			className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-900"
			onClose={() => setErr('')}
		>
			<div className="flex flex-col gap-6">
				<h1 className="text-center text-2xl font-bold">Podcast Player</h1>

				<button
					type="button"
					onClick={handleCreate}
					disabled={busy}
					className="w-full rounded bg-zinc-900 px-4 py-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
				>
					{busy ? 'Creating…' : 'Create Account'}
				</button>

				<div className="flex items-center gap-3">
					<hr className="flex-1 border-zinc-300 dark:border-zinc-700" />
					<span className="text-sm text-zinc-500">or join existing</span>
					<hr className="flex-1 border-zinc-300 dark:border-zinc-700" />
				</div>

				<form onSubmit={handleJoin} className="flex flex-col gap-2">
					<input
						type="text"
						value={joinId}
						onChange={(e) => setJoinId(e.target.value)}
						placeholder="Paste account ID"
						className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800"
					/>
					<button
						type="submit"
						disabled={busy || !joinId.trim()}
						className="w-full rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
					>
						{busy ? 'Joining…' : 'Join'}
					</button>
				</form>

				{err && <p className="text-center text-sm text-red-500">{err}</p>}
			</div>
		</dialog>
	)
}
