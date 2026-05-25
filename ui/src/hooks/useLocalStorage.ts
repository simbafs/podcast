'use client'
import { useCallback, useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
	const [stored, setStored] = useState<T>(initialValue)

	useEffect(() => {
		try {
			const item = localStorage.getItem(key)
			if (item) setStored(JSON.parse(item))
		} catch {
			/* ignore */
		}
	}, [key])

	const setValue = useCallback(
		(value: T) => {
			setStored(value)
			try {
				localStorage.setItem(key, JSON.stringify(value))
			} catch {
				/* ignore */
			}
		},
		[key],
	)

	return [stored, setValue]
}
