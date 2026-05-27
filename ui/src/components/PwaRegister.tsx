'use client'
import { useMount } from '@/hooks/useMount'

export default function PwaRegister() {
	useMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/sw.js', { scope: '/', updateViaCache: 'none' })
				.catch(() => {})
		}
	})

	return null
}
