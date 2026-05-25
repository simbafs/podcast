'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { useMount } from '@/hooks/useMount'

export default function SettingsPage() {
	const router = useRouter()
	const { accountId, account, loading, update, logout } = useAccount()
	const [rssUrl, setRssUrl] = useState('')
	const [saving, setSaving] = useState(false)
	const [msg, setMsg] = useState('')

	useMount(() => {
		if (!loading && !accountId) router.replace('/')
	})

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!rssUrl.trim()) return
		setSaving(true)
		setMsg('')
		try {
			await update({ rss_url: rssUrl.trim() })
			setMsg('Saved')
			setRssUrl('')
		} catch {
			setMsg('Failed to save')
		} finally {
			setSaving(false)
		}
	}

	const handleLogout = () => {
		logout()
		router.replace('/')
	}

	if (loading || !account) return <div className="flex justify-center p-8">Loading...</div>

	return (
		<div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Settings</h1>
				<Link href="/player" className="text-sm text-zinc-500 underline-offset-2 hover:underline">
					back to player
				</Link>
			</div>

			<section className="rounded border p-4">
				<h2 className="mb-2 text-sm font-medium">Account ID</h2>
				<p className="mb-2 text-xs text-zinc-500">
					Share this ID to sync across devices:
				</p>
				<code className="block break-all rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
					{accountId}
				</code>
			</section>

			<section className="rounded border p-4">
				<h2 className="mb-2 text-sm font-medium">RSS Feed URL</h2>
				<form onSubmit={handleSave} className="flex flex-col gap-2">
					<input
						type="url"
						value={rssUrl}
						onChange={(e) => setRssUrl(e.target.value)}
						placeholder="https://example.com/feed.xml"
						className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
					/>
					<div className="flex items-center gap-2">
						<button
							type="submit"
							disabled={saving || !rssUrl.trim()}
							className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
						>
							{saving ? 'Saving...' : 'Save'}
						</button>
						{msg && <span className="text-xs text-zinc-500">{msg}</span>}
					</div>
				</form>
			</section>

			<section className="rounded border border-red-200 p-4 dark:border-red-900">
				<button
					type="button"
					onClick={handleLogout}
					className="text-sm text-red-500 underline-offset-2 hover:underline"
				>
					Logout (clear local account)
				</button>
			</section>
		</div>
	)
}
