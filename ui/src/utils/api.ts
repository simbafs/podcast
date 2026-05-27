const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface Account {
	id: string
	rss_url: string
	order_dir: string
	current_episode_id: string
	position_sec: number
}

export interface Episode {
	title: string
	description?: string
	pub_date?: string
	audio_url: string
	duration?: string
	guid: string
}

export async function createAccount(): Promise<Account> {
	const res = await fetch(`${base}/api/accounts`, { method: 'POST' })
	if (!res.ok) throw new Error('create account failed')
	return res.json()
}

export async function getAccount(id: string): Promise<Account> {
	const res = await fetch(`${base}/api/accounts/${encodeURIComponent(id)}`)
	if (!res.ok) throw new Error('get account failed')
	return res.json()
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
	const res = await fetch(`${base}/api/accounts/${encodeURIComponent(id)}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	})
	if (!res.ok) throw new Error('update account failed')
	return res.json()
}

export interface FeedResponse {
	title: string
	episodes: Episode[]
}

export async function getEpisodes(id: string): Promise<FeedResponse> {
	const res = await fetch(`${base}/api/accounts/${encodeURIComponent(id)}/feed`)
	if (!res.ok) throw new Error('get episodes failed')
	return res.json()
}

export function wsUrl(id: string): string {
	const wsBase = base.replace(/^http/, 'ws')
	return `${wsBase}/api/accounts/${encodeURIComponent(id)}/ws`
}

export function getProxyAudioUrl(audioUrl: string): string {
	return `${base}/api/proxy/audio?url=${encodeURIComponent(audioUrl)}`
}
