'use client'
import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

function getStored(): ThemeMode {
	if (typeof window === 'undefined') return 'system'
	try {
		const v = localStorage.getItem('theme')
		if (v === 'light' || v === 'dark' || v === 'system') return v
	} catch {
		/* ignore */
	}
	return 'system'
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
	if (mode === 'system') {
		return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light'
	}
	return mode
}

function apply(effective: 'light' | 'dark') {
	const root = document.documentElement
	root.classList.toggle('dark', effective === 'dark')
	root.style.colorScheme = effective
}

export function useTheme() {
	const [mode, setModeState] = useState<ThemeMode>(getStored)

	const setMode = useCallback((m: ThemeMode) => {
		try {
			localStorage.setItem('theme', m)
		} catch {
			/* ignore */
		}
		setModeState(m)
		apply(resolve(m))
	}, [])

	useEffect(() => {
		apply(resolve(mode))
		const mq = window.matchMedia('(prefers-color-scheme: dark)')
		const handler = () => {
			if (getStored() === 'system') apply(resolve('system'))
		}
		mq.addEventListener('change', handler)
		return () => mq.removeEventListener('change', handler)
	}, [mode])

	return { mode, setMode }
}
