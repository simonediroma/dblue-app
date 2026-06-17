# Macro 4 — WebSocket Server + MongoDB Change Streams
> Prerequisito: M3 completato. Desk booking, waiting list e check-in funzionano.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO MACRO 4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implementare aggiornamenti real-time: quando un utente modifica il proprio
status, tutti gli altri utenti connessi ricevono l'aggiornamento della
disponibilità di quell'ufficio senza fare refresh.

Architettura:
  MongoDB Change Stream → WebSocket server → client browser

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tocca SOLO backend/src/.
Non toccare frontend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Prerequisito: MongoDB Replica Set
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I Change Streams richiedono un replica set (non funzionano su standalone).

In docker-compose.yml, aggiorna il servizio MongoDB per avviarlo con
`--replSet rs0`:
  command: ["--replSet", "rs0", "--bind_ip_all"]

Aggiungi un servizio one-shot `mongo-init` che attende MongoDB e poi
esegue `rs.initiate()`:
  image: mongo:7
  depends_on: [mongodb]
  restart: "no"
  entrypoint: >
    bash -c "sleep 5 &&
    mongosh --host mongodb:27017 --eval \"rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb:27017'}]})\" &&
    echo 'Replica set inizializzato'"

Aggiorna la MONGODB_URI in .env.example:
  MONGODB_URI=mongodb://localhost:27017/presence?replicaSet=rs0

Nota per il dev: dopo `docker compose down -v && docker compose up -d`,
attendere ~10 secondi per l'inizializzazione del replica set.

Aggiungi questa nota in docs/lessons.md sotto una sezione "MongoDB Change Streams".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Installa dipendenze WebSocket
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
npm install ws @types/ws

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — WebSocket server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/services/websocket.service.ts

Implementa il WebSocket server che si aggancia all'HTTP server di Express.

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// Mappa: date → Set<WebSocket>
const rooms = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let subscribedDate: string | null = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && isValidDate(msg.date)) {
          // Unsub dalla data precedente
          if (subscribedDate) leaveRoom(subscribedDate, ws);
          // Sub alla nuova data
          subscribedDate = msg.date;
          joinRoom(msg.date, ws);
        }
      } catch { /* ignora messaggi malformati */ }
    });

    ws.on('close', () => {
      if (subscribedDate) leaveRoom(subscribedDate, ws);
    });

    // Heartbeat: risponde ai ping del client
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
```

In backend/src/index.ts:
- Cambia da `app.listen(...)` a `const server = http.createServer(app)`
- Poi `initWebSocket(server)` prima di `server.listen(...)`
- Importa `http` da 'http'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — MongoDB Change Stream
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/services/change-stream.service.ts

```typescript
import WorkingStatusModel from '../models/working-status.model';
import { getBookedCount, getTotalCapacity } from './capacity.service';
import { broadcastToDate } from './websocket.service';

export async function startChangeStream(): Promise<void> {
  const changeStream = WorkingStatusModel.watch(
    [{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }],
    { fullDocument: 'updateLookup' }
  );

  changeStream.on('change', async (change) => {
    // Estrai la data dal documento modificato
    const doc = (change as any).fullDocument;
    if (!doc?.date) return;

    const date = doc.date as string;

    try {
      const [bookedCount, totalCapacity] = await Promise.all([
        getBookedCount(date),
        getTotalCapacity(date),
      ]);

      broadcastToDate(date, { date, bookedCount, totalCapacity });
    } catch (err) {
      console.error('[ChangeStream] Errore broadcast:', err);
    }
  });

  changeStream.on('error', (err) => {
    console.error('[ChangeStream] Errore stream:', err);
    // Il Change Stream non si auto-riconnette — logga e lascia che il processo
    // si riavvii (Railway lo fa automaticamente in caso di crash).
  });

  console.log('[ChangeStream] Avviato su collezione WorkingStatus');
}
```

In backend/src/index.ts, dopo la connessione MongoDB e prima di server.listen:
  await startChangeStream();

Nota: startChangeStream va chiamato DOPO mongoose.connect, non prima.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Heartbeat WebSocket (keep-alive)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In backend/src/services/websocket.service.ts, aggiungi un heartbeat
per rilevare connessioni zombie:

```typescript
// Aggiungere in initWebSocket, dopo la creazione del wss:
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if ((ws as any).isAlive === false) return ws.terminate();
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 30_000);  // ogni 30 secondi

wss.on('close', () => clearInterval(pingInterval));

// Sul singolo ws.on('connection'):
(ws as any).isAlive = true;
ws.on('pong', () => { (ws as any).isAlive = true; });
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE MACRO 4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. npm run build → zero errori TypeScript

2. docker compose down -v && docker compose up -d
   → Attendere 10s → npm run dev
   → Log: "MongoDB connesso" + "[ChangeStream] Avviato" + "Backend in ascolto su :4000"

3. Test WebSocket con wscat (installa con: npm install -g wscat):
   wscat -c ws://localhost:4000/ws
   → Invia: {"type":"subscribe","date":"YYYY-MM-DD"}
   → Poi in un altro terminale aggiorna uno status con curl
   → wscat deve ricevere: {"type":"presence_update","data":{"date":"...","bookedCount":1,"totalCapacity":60}}

4. Verifica heartbeat: tieni la connessione aperta 31+ secondi
   → Non deve essere terminata

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare. Staga con git add.
- Aggiorna CLAUDE_MEMORY.md: M4 completata, prossimi step M5.
- Aggiorna docs/lessons.md con la nota sul replica set MongoDB.
- Elenca file creati/modificati.
```
