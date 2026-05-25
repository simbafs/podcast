'use client'
import { useRouter } from 'next/navigation'
import { useMount } from '@/hooks/useMount'

export default function HomePage() {
	const router = useRouter()
	useMount(() => router.replace('/player'))
	return null
}
