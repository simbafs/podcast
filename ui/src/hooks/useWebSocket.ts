'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { wsUrl } from '@/utils/api'

interface ServerState {
	episode_id?: string
	position_sec?: number
	playing?: boolean
	master_id?: string
}

interface UseWSResult {
	role: 'master' | 'slave' | null
	state: ServerState
	connected: boolean
	send: (msg: object) => void
}

export function useWebSocket(accountId: string | undefined): UseWSResult {
	const [role, setRole] = useState<'master' | 'slave' | null>(null)
	const [state, setState] = useState<ServerState>({})
	const [connected, setConnected] = useState(false)
	const wsRef = useRef<WebSocket | null>(null)
	const reconnectRef = useRef<number>(0)

	useEffect(() => {
		if (!accountId) return

		let ws: WebSocket
		let closed = false
		const id = accountId

		function connect() {
			ws = new WebSocket(wsUrl(id))
			wsRef.current = ws

			ws.onopen = () => {
				setConnected(true)
				reconnectRef.current = 0
			}

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data)
					if (msg.type === 'role') {
						setRole(msg.role)
					} else if (msg.type === 'state') {
						setState({ episode_id: msg.episode_id, position_sec: msg.position, playing: msg.playing })
					} else if (msg.type === 'taken_over') {
						// state update already handled via individual role messages
					}
				} catch {
					/* ignore */
				}
			}

			ws.onclose = () => {
				setConnected(false)
				if (!closed) {
					const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 30000)
					reconnectRef.current++
					setTimeout(connect, delay)
				}
			}

			ws.onerror = () => ws.close()
		}

		connect()

		return () => {
			closed = true
			ws.close()
		}
	}, [accountId])

	const send = useCallback((msg: object) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(msg))
		}
	}, [])

	return { role, state, connected, send }
}
