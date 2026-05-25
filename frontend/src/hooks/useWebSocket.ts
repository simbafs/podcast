import { useEffect, useRef, useCallback, useState } from "react";
import type { WSMessage } from "../lib/types";

interface UseWebSocketOptions {
  accountId: string;
  onMessage: (msg: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({
  accountId,
  onMessage,
  onConnect,
  onDisconnect,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const connIdRef = useRef<string>("conn-" + Math.random().toString(36).slice(2, 11));
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!accountId) return;

    const protocol = window.location.protocol === "https" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      onConnect?.();
      ws.send(JSON.stringify({ type: "auth", accountId, connId: connIdRef.current }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSMessage;
        if (msg.type === "connected") {
          connIdRef.current = msg.connId ?? connIdRef.current;
        }
        onMessage(msg);
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      onDisconnect?.();
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      setConnected(false);
      onDisconnect?.();
    };
  }, [accountId, onMessage, onConnect, onDisconnect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { send, connId: connIdRef, connected };
}