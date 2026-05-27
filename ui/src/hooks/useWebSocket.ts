'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { wsUrl } from '@/utils/api'

interface ServerState {
	episode_id?: string
	position_sec?: number
	playing?: boolean
	master_id?: string
}

interface Command {
	type: 'play' | 'pause' | 'seek' | 'choose' | 'rss'
	episode_id?: string
	position_sec?: number
	url?: string
}

interface UseWSResult {
	role: 'master' | 'slave' | null
	state: ServerState
	connected: boolean
	reconnectCount: number
	send: (msg: object) => void
	command: Command | null
	clearCommand: () => void
}

export function useWebSocket(accountId: string | undefined): UseWSResult {
	const [role, setRole] = useState<'master' | 'slave' | null>(null)
	const [state, setState] = useState<ServerState>({})
	const [connected, setConnected] = useState(false)
	const [command, setCommand] = useState<Command | null>(null)
	const [reconnectCount, setReconnectCount] = useState(0)
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
				setReconnectCount(n => n + 1)
				reconnectRef.current = 0
			}

			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(event.data)
					if (msg.type === 'role') {
						setRole(msg.role)
					} else if (msg.type === 'state') {
						// WHY: server encodes state position as position_sec; previously read msg.position
						// Previous behavior: slave never received updated position during master seeks
						// New behavior: position sync uses msg.position_sec and updates slave UI correctly
						setState({ episode_id: msg.episode_id, position_sec: msg.position_sec, playing: msg.playing })
					} else if (['play', 'pause', 'seek', 'choose', 'rss'].includes(msg.type)) {
						setCommand(msg)
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

	const clearCommand = useCallback(() => {
		setCommand(null)
	}, [])

	return { role, state, connected, reconnectCount, send, command, clearCommand }
}
