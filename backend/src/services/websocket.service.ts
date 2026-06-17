import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const rooms = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) return ws.terminate();
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(pingInterval));

  wss.on('connection', (ws) => {
    (ws as any).isAlive = true;
    ws.on('pong', () => { (ws as any).isAlive = true; });

    let subscribedDate: string | null = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && isValidDate(msg.date)) {
          if (subscribedDate) leaveRoom(subscribedDate, ws);
          subscribedDate = msg.date;
          joinRoom(msg.date, ws);
        }
      } catch { /* ignora messaggi malformati */ }
    });

    ws.on('close', () => {
      if (subscribedDate) leaveRoom(subscribedDate, ws);
    });

    ws.on('ping', () => ws.pong());
  });
}

export function broadcastToDate(date: string, payload: object): void {
  const subscribers = rooms.get(date);
  if (!subscribers) return;
  const msg = JSON.stringify({ type: 'presence_update', data: payload });
  subscribers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

function joinRoom(date: string, ws: WebSocket): void {
  if (!rooms.has(date)) rooms.set(date, new Set());
  rooms.get(date)!.add(ws);
}

function leaveRoom(date: string, ws: WebSocket): void {
  rooms.get(date)?.delete(ws);
  if (rooms.get(date)?.size === 0) rooms.delete(date);
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
