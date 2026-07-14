import { useEffect } from 'react';
import type { PresenceUpdate } from '../types';
import { BASE_URL, getStoredToken } from '../services/api';

export function useWebSocket(onPresenceUpdate: (update: PresenceUpdate) => void) {
  useEffect(() => {
    const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws';

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let delay = 1000;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        delay = 1000;
        const today = new Date().toISOString().slice(0, 10);
        // Office capacity is role-scoped (getVisibleRooms) — the token lets the
        // backend resolve this connection's role and broadcast the matching
        // breakdown instead of a single value shared by every subscriber.
        ws.send(JSON.stringify({ type: 'subscribe', date: today, token: getStoredToken() }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; data: PresenceUpdate };
          if (msg.type === 'presence_update') {
            onPresenceUpdate(msg.data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 8000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);
}
