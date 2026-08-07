import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { verifyToken } from '../config/jwt';
import { User } from '../models/user.model';
import { getVisibleRoomsForUser, VisibleRoom } from './capacity.service';

const rooms = new Map<string, Set<WebSocket>>();

// Resolved once per connection from its subscribe token — office capacity is
// per-user (getVisibleRoomsForUser), not per-role: due utenti con lo stesso ruolo
// possono avere accessi diversi in modalità dblue-office. Falls back to the most
// restrictive access (employee role, nessuna stanza extra) if the token is
// missing/invalid rather than over-exposing room-restricted capacity.
const visibleRoomsByConnection = new WeakMap<WebSocket, VisibleRoom[]>();
const FALLBACK_ROLE = 'employee' as const;

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
            visibleRoomsByConnection.set(ws, await resolveVisibleRooms(msg.token));
            subscribedDate = msg.date;
            joinRoom(msg.date, ws);
          }
        } catch { /* ignora messaggi malformati */ }
      })();
    });

    ws.on('close', () => {
      if (subscribedDate) leaveRoom(subscribedDate, ws);
      visibleRoomsByConnection.delete(ws);
    });

    ws.on('ping', () => ws.pong());
  });
}

async function resolveVisibleRooms(token: unknown): Promise<VisibleRoom[]> {
  if (typeof token !== 'string') return getVisibleRoomsForUser({ role: FALLBACK_ROLE });
  const payload = verifyToken(token);
  if (!payload) return getVisibleRoomsForUser({ role: FALLBACK_ROLE });
  const user = await User.findById(payload.sub).select('role dblueOfficeRooms').lean();
  return getVisibleRoomsForUser({ role: user?.role ?? FALLBACK_ROLE, dblueOfficeRooms: user?.dblueOfficeRooms });
}

// Chiave stabile per raggruppare connessioni con lo stesso identico accesso —
// stessa ottimizzazione di prima (un solo calcolo per gruppo), ma la chiave ora è
// l'insieme di stanze visibili invece del ruolo, corretto anche quando due utenti
// con lo stesso ruolo hanno accessi diversi (modalità dblue-office).
function roomAccessKey(visibleRooms: VisibleRoom[]): string {
  return visibleRooms.map((r) => r.id ?? r.name).sort().join('|');
}

export async function broadcastToDate(
  date: string,
  getBreakdown: (visibleRooms: VisibleRoom[]) => Promise<object>
): Promise<void> {
  const subscribers = rooms.get(date);
  if (!subscribers || subscribers.size === 0) return;

  const byAccess = new Map<string, { visibleRooms: VisibleRoom[]; sockets: WebSocket[] }>();
  for (const ws of subscribers) {
    const visibleRooms = visibleRoomsByConnection.get(ws) ?? [];
    const key = roomAccessKey(visibleRooms);
    const group = byAccess.get(key) ?? { visibleRooms, sockets: [] };
    group.sockets.push(ws);
    byAccess.set(key, group);
  }

  await Promise.all(
    Array.from(byAccess.values()).map(async ({ visibleRooms, sockets }) => {
      const payload = await getBreakdown(visibleRooms);
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
