'use client'
import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Share2, Copy, Check, X } from 'lucide-react'

interface ShareDialogProps {
	open: boolean
	accountId: string
	onClose: () => void
}

export default function ShareDialog({ open, accountId, onClose }: ShareDialogProps) {
	const [copied, setCopied] = useState(false)

	const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join?account_id=${encodeURIComponent(accountId)}`

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(shareUrl)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			/* ignore */
		}
	}, [shareUrl])

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
						onClick={onClose}
					/>

					{/* Modal */}
					<motion.div
						role="dialog"
						aria-labelledby="share-title"
						aria-modal="true"
						className="relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
						initial={{ scale: 0.9, opacity: 0, y: 20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.9, opacity: 0, y: 20 }}
						transition={{ type: 'spring', stiffness: 300, damping: 25 }}
					>
						{/* Close button */}
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>

						<div className="flex flex-col items-center gap-6">
							{/* Icon */}
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950">
								<Share2 className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden="true" />
							</div>

							<div className="text-center">
								<h2 id="share-title" className="text-lg font-bold tracking-tight">
									Share Account
								</h2>
								<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
									Scan with phone camera to join as slave
								</p>
							</div>

							{/* QR Code */}
							<div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-white">
								<QRCodeSVG
									value={shareUrl}
									size={180}
									bgColor="#ffffff"
									fgColor="#18181b"
									level="M"
								/>
							</div>

							{/* URL */}
							<div className="flex w-full items-center gap-2">
								<input
									type="text"
									readOnly
									value={shareUrl}
									aria-label="Share URL"
									className="min-w-0 flex-1 truncate rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
								/>
								<button
									type="button"
									onClick={handleCopy}
									aria-label={copied ? 'Copied' : 'Copy URL'}
									className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
										copied
											? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
											: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
									}`}
								>
									{copied ? (
										<Check className="h-4 w-4" aria-hidden="true" />
									) : (
										<Copy className="h-4 w-4" aria-hidden="true" />
									)}
								</button>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
