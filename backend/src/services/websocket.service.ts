import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { verifyToken } from '../config/jwt';
import { User } from '../models/user.model';
import type { Role } from './capacity.service';

const rooms = new Map<string, Set<WebSocket>>();

// Resolved once per connection from its subscribe token — office capacity is
// role-scoped (getVisibleRooms), so every subscriber of the same date can still
// need a different breakdown. Falls back to the most restrictive role if the
// token is missing/invalid rather than over-exposing room-restricted capacity.
const roleByConnection = new WeakMap<WebSocket, Role>();
const FALLBACK_ROLE: Role = 'employee';

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
      (async () => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'subscribe' && isValidDate(msg.date)) {
            if (subscribedDate) leaveRoom(subscribedDate, ws);
            roleByConnection.set(ws, await resolveRole(msg.token));
            subscribedDate = msg.date;
            joinRoom(msg.date, ws);
          }
        } catch { /* ignora messaggi malformati */ }
      })();
    });

    ws.on('close', () => {
      if (subscribedDate) leaveRoom(subscribedDate, ws);
      roleByConnection.delete(ws);
    });

    ws.on('ping', () => ws.pong());
  });
}

async function resolveRole(token: unknown): Promise<Role> {
  if (typeof token !== 'string') return FALLBACK_ROLE;
  const payload = verifyToken(token);
  if (!payload) return FALLBACK_ROLE;
  const user = await User.findById(payload.sub).select('role').lean();
  return user?.role ?? FALLBACK_ROLE;
}

export async function broadcastToDate(date: string, getBreakdown: (role: Role) => Promise<object>): Promise<void> {
  const subscribers = rooms.get(date);
  if (!subscribers || subscribers.size === 0) return;

  const byRole = new Map<Role, WebSocket[]>();
  for (const ws of subscribers) {
    const role = roleByConnection.get(ws) ?? FALLBACK_ROLE;
    (byRole.get(role) ?? byRole.set(role, []).get(role)!).push(ws);
  }

  await Promise.all(
    Array.from(byRole.entries()).map(async ([role, sockets]) => {
      const payload = await getBreakdown(role);
      const msg = JSON.stringify({ type: 'presence_update', data: payload });
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }
    })
  );
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
