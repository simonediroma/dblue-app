# Macro 3 — Desk Booking + Waiting List FIFO
> Prerequisito: M2 completato. POST /presence funziona, modello WorkingStatus presente.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO MACRO 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implementare la logica di prenotazione scrivania con FIFO per la waiting list.
Quando l'ufficio è pieno, le prenotazioni IN_OFFICE entrano in WAITING_LIST.
Quando una scrivania si libera, il primo in lista viene promosso automaticamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tocca SOLO backend/src/.
Non toccare frontend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Capacity service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/services/capacity.service.ts

Implementa le seguenti funzioni.

---

getTotalCapacity(date: string): Promise<number>
  → Somma la capacity di tutte le Room di tipo 'open_space' con isActive: true.
  → Cache in memoria per 60 secondi (la capacity cambia raramente).

getBookedCount(date: string): Promise<number>
  → Conta i WorkingStatus per quella data con status in
    ['in_office', 'office_no_desk'].
  → NB: waiting_list NON conta come booked.

isCapacityAvailable(date: string): Promise<boolean>
  → Ritorna true se getBookedCount < getTotalCapacity.

getWaitingList(date: string): Promise<IWorkingStatus[]>
  → Trova tutti i WS con status 'waiting_list' per quella data.
  → Ordinati per createdAt ASC (FIFO).

---

promoteFromWaitingList(date: string): Promise<void>
  → Dopo una cancellazione da IN_OFFICE, chiama questa funzione.
  → Controlla se isCapacityAvailable(date).
  → Se sì: prende il primo della getWaitingList (createdAt più vecchio).
  → Aggiorna il suo status a 'in_office'.
  → Logga: "WaitingList: utente <userId> promosso per data <date>"
  → L'invio email di notifica arriverà in M6 — per ora solo il log.

---

getPresenceBreakdown(date: string): Promise<PresenceBreakdown>
  → Calcola la disponibilità per stanza da usare nel broadcast WebSocket (M4).
  → Interfaccia da definire nello stesso file:

```typescript
export interface RoomOccupancy {
  name: string;
  booked: number;
  capacity: number;
}

export interface PresenceBreakdown {
  date: string;
  rooms: RoomOccupancy[];
  extras: number;      // in_office/office_no_desk senza room assegnata (campo room null/vuoto)
  totalBooked: number; // sum(rooms.booked) + extras
  totalCapacity: number; // sum(rooms.capacity)
}
```

  Implementazione:
  1. Carica tutte le Room attive (isActive: true) dal DB.
  2. Per ogni room: conta i WorkingStatus per quella data con
     status in ['in_office', 'office_no_desk'] e campo room === room.name.
  3. Extras: conta i WS con status in ['in_office', 'office_no_desk'] e
     campo room null o vuoto string.
  4. totalBooked = somma dei booked di tutte le rooms + extras.
  5. totalCapacity = somma della capacity di tutte le rooms attive.
  → Nota: non usare la cache di getTotalCapacity qui — la funzione serve
    per broadcast real-time e deve essere sempre fresca.

Verifica: npm run lint passa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Modifica working-status.service.ts per usare capacity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In backend/src/services/working-status.service.ts:

Modifica upsertStatus per gestire la capacità:
  - Quando il payload.status è 'in_office':
    1. Chiama isCapacityAvailable(date)
    2. Se pieno: imposta status 'waiting_list' invece di 'in_office'
    3. Il WS salvato avrà status 'waiting_list'

  - Quando il payload.status rimuove una prenotazione IN_OFFICE
    (il WS precedente era 'in_office' o 'office_no_desk', e il nuovo non lo è):
    1. Aggiorna lo status normalmente
    2. Poi chiama promoteFromWaitingList(date) in background (fire-and-forget, no await)

  - Quando il payload.status rimuove una prenotazione WAITING_LIST:
    - Nessuna promozione necessaria — rimuove dalla coda e basta.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Check-in endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/routes/presence.routes.ts — aggiungi:

POST /presence/:date/checkin
  Body: { room?: string, isUsingDesk?: boolean }
  Protetta da requireAuth.

  Logica:
  1. Cerca il WS dell'utente per quella data.
     → Se non esiste: 404 { error: 'Nessuna prenotazione trovata per questa data' }
  2. Verifica che il WS.status sia IN_OFFICE, OFFICE_NO_DESK o WAITING_LIST.
     → Se è WAITING_LIST: non permettere check-in → 400 { error: 'Sei in waiting list, non puoi fare check-in' }
     → Se è REMOTE: check-in senza sala → imposta isConfirmed: true, confirmedAt: now()
     → Per altri status non aspettarsi check-in → 400 { error: 'Check-in non applicabile per questo status' }
  3. Aggiorna: isConfirmed: true, confirmedAt: now(), room (se passata), isUsingDesk (se passato).
  4. Risponde 200 con il WS aggiornato.

  Vincolo: il check-in è permesso solo per il giorno corrente.
  → Se la data non è oggi: 400 { error: 'Il check-in è possibile solo per il giorno corrente' }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Completa il TODO in rooms.routes.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In backend/src/routes/rooms.routes.ts, il PATCH /rooms/:id aveva un TODO
sul controllo prenotazioni attive.

Implementa ora il check:
  Quando isActive passa da true a false:
  → Cerca tutti i WS futuri (date > oggi) con status in_office/waiting_list/office_no_desk
    che appartengono a questa room (campo room === room.name).
  → Se count > 0: rispondi 409 { error: 'Room con prenotazioni attive', count }
  → Se 0: procedi con il soft delete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE MACRO 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Setup: usa due utenti diversi (due token dev con email diverse).

1. npm run build → zero errori TypeScript

2. Utente A prenota IN_OFFICE con capacità piena (es. abbassa la capacity
   della Room a 1 via MongoDB Compass o Mongo Express, poi prenota):
   → Risposta: status 'in_office'

3. Utente B prenota IN_OFFICE sulla stessa data piena:
   → Risposta: status 'waiting_list'

4. Utente A cancella la prenotazione (POST /presence con status 'remote'):
   → 200 OK
   → Verifica MongoDB: il WS di Utente B è diventato 'in_office'

5. Check-in Utente A (Remote):
   POST /presence/oggi/checkin → 200 con isConfirmed: true

6. Check-in su data futura:
   → 400 { error: 'Il check-in è possibile solo per il giorno corrente' }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare. Staga con git add.
- Aggiorna CLAUDE_MEMORY.md: M3 completata, prossimi step M4.
- Elenca file creati/modificati.
```
