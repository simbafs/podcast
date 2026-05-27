'use client'
import { WifiOff } from 'lucide-react'

interface OfflineBannerProps {
	show: boolean
}

export default function OfflineBanner({ show }: OfflineBannerProps) {
	if (!show) return null

	return (
		<div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-medium text-white">
			<WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
			Offline — changes will sync when connected
		</div>
	)
}
