'use client'
import { useCallback, useEffect, useState } from 'react'
import { createAccount, getAccount, updateAccount, type Account } from '@/utils/api'
import { useLocalStorage } from './useLocalStorage'

export function useAccount() {
	const [accountId, setAccountId] = useLocalStorage<string>('account_id', '')
	const [account, setAccount] = useState<Account | null>(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (accountId) {
			setLoading(true)
			getAccount(accountId)
				.then(setAccount)
				.catch(() => setAccountId(''))
				.finally(() => setLoading(false))
		}
	}, [accountId])

	const create = useCallback(async () => {
		const acc = await createAccount()
		setAccountId(acc.id)
		setAccount(acc)
		return acc
	}, [setAccountId])

	const join = useCallback(
		async (id: string) => {
			const acc = await getAccount(id)
			setAccountId(acc.id)
			setAccount(acc)
			return acc
		},
		[setAccountId],
	)

	const update = useCallback(
		async (data: Partial<Account>) => {
			if (!accountId) throw new Error('no account')
			const acc = await updateAccount(accountId, data)
			setAccount(acc)
			return acc
		},
		[accountId],
	)

	const logout = useCallback(() => {
		setAccountId('')
		setAccount(null)
	}, [setAccountId])

	return { accountId, account, loading, create, join, update, logout }
}
