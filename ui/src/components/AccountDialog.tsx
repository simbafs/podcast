'use client'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Headphones } from 'lucide-react'

interface AccountDialogProps {
	open: boolean
	onCreate: () => Promise<unknown>
	onJoin: (id: string) => Promise<unknown>
}

export default function AccountDialog({ open, onCreate, onJoin }: AccountDialogProps) {
	const [joinId, setJoinId] = useState('')
	const [err, setErr] = useState('')
	const [busy, setBusy] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	// Focus input when dialog opens
	useEffect(() => {
		if (open) {
			const id = setTimeout(() => inputRef.current?.focus(), 150)
			return () => clearTimeout(id)
		}
	}, [open])

	const handleCreate = async () => {
		setBusy(true)
		setErr('')
		try {
			await onCreate()
		} catch {
			setErr('Failed to create account. Please try again.')
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
			setErr('Account not found. Check the ID and try again.')
		} finally {
			setBusy(false)
		}
	}

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
					{/* Backdrop */}
					<motion.div
						className="absolute inset-0 bg-black/50"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					/>

					{/* Modal */}
					<motion.div
						role="dialog"
						aria-labelledby="dialog-title"
						aria-modal="true"
						className="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
						initial={{ scale: 0.9, opacity: 0, y: 20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.9, opacity: 0, y: 20 }}
						transition={{ type: 'spring', stiffness: 300, damping: 25 }}
					>
						<div className="flex flex-col items-center gap-6">
							{/* Icon */}
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950">
								<Headphones className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden="true" />
							</div>

							<div className="text-center">
								<h1 id="dialog-title" className="text-2xl font-bold tracking-tight">
									Podcast Player
								</h1>
								<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
									Sync your podcasts across devices
								</p>
							</div>

							<button
								type="button"
								onClick={handleCreate}
								disabled={busy}
								className="w-full rounded-xl bg-teal-600 px-4 py-3 font-medium text-white hover:bg-teal-500 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
							>
								{busy ? 'Creating…' : 'Create Account'}
							</button>

							<div className="flex w-full items-center gap-3">
								<hr className="flex-1 border-zinc-200 dark:border-zinc-700" />
								<span className="text-xs font-medium text-zinc-400">or join existing</span>
								<hr className="flex-1 border-zinc-200 dark:border-zinc-700" />
							</div>

							<form onSubmit={handleJoin} className="flex w-full flex-col gap-3">
								<div>
									<label htmlFor="join-id" className="sr-only">
										Account ID
									</label>
									<input
										ref={inputRef}
										id="join-id"
										type="text"
										value={joinId}
										onChange={(e) => setJoinId(e.target.value)}
										placeholder="Paste account ID…"
										autoComplete="off"
										spellCheck={false}
										className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder:text-zinc-500"
									/>
								</div>
								<button
									type="submit"
									disabled={busy || !joinId.trim()}
									className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
								>
									{busy ? 'Joining…' : 'Join'}
								</button>
							</form>

							{err && (
								<motion.p
									role="alert"
									aria-live="polite"
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									className="w-full rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:bg-red-950 dark:text-red-400"
								>
									{err}
								</motion.p>
							)}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
