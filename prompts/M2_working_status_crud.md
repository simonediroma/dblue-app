# Macro 2 — Working Status CRUD + State Machine + Business Logic
> Prerequisito: M1 completato. GET /health OK, /auth/me OK, modelli User e Room presenti.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO MACRO 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implementare il modello WorkingStatus, le API CRUD per gestire il piano
di presenza dell'utente e tutta la business logic della state machine
(declared → confirmed, last-minute, auto-confirm, permesso/offTime).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tocca SOLO backend/src/.
Non toccare frontend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Modello WorkingStatus
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/models/working-status.model.ts

Schema Mongoose:

userId: ObjectId ref 'User', required
date: string YYYY-MM-DD, required
  → non usare Date — le date sono solo giorni, mai orari
status: enum [
  'in_office', 'remote', 'mission', 'leave', 'sick',
  'parental_leave', 'waiting_list', 'office_no_desk', 'pending'
], default 'pending'
isConfirmed: boolean, default false
  → true solo dopo check-in esplicito o auto-confirm
confirmedAt: Date, optional
room: string, optional
  → nome della sala al momento del check-in
isUsingDesk: boolean, optional
  → true = sta usando una scrivania, false = in riunione o no-desk
offTime: {
  type: enum ['morning', 'afternoon', 'custom'], optional
  hours: number, optional
}, optional
isRetrofit: boolean, default false
  → true se lo status è stato modificato retroattivamente
isLastMinuteUnbooking: boolean, default false
  → true se l'annullamento di una prenotazione In Office è avvenuto
    dopo mezzanotte del giorno precedente
timestamps: true

Vincoli:
- Indice unique su { userId, date } — un solo WS per utente per giorno
- Indice su { date, status } — per query di disponibilità e colleghi per giorno

Esporta tipo TypeScript IWorkingStatus.

Verifica: npm run lint passa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Service: business logic Working Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/services/working-status.service.ts

Implementa le seguenti funzioni. Tutta la business logic va qui — le route
chiamano il service, non implementano logica direttamente.

---

getStatusForUser(userId, month: string): Promise<IWorkingStatus[]>
  → Recupera tutti i WS dell'utente per il mese 'YYYY-MM'.
  → Per ogni giorno lavorativo del mese non presente nel DB ritorna
    un oggetto virtuale { date, status: 'pending', isConfirmed: false }
    in modo che il frontend riceva sempre la finestra completa.
  → Esclude sabati e domeniche.
  → Arricchisce ogni giorno con: bookedCount, totalCapacity,
    colleagueAvatars (max 10 utenti con status in_office/office_no_desk
    per quel giorno), projectTeammatesCount.

---

upsertStatus(userId, date, payload: {
  status: string, isUsingDesk?: boolean, room?: string
}): Promise<IWorkingStatus>

Regole:
  1. Non permettere modifiche se isConfirmed = true
     → 409 { error: 'Status già confermato, non modificabile' }
  2. Non permettere 'sick' per date diverse dal giorno corrente
     (eccezione: isRetrofit = true)
     → 400 { error: 'Malattia dichiarabile solo per il giorno corrente' }
  3. Calcolare isLastMinuteUnbooking: se il WS esistente è in_office/waiting_list
     e il nuovo status rimuove la prenotazione (remote/pending/leave/sick/mission)
     e la data è il giorno corrente o domani → impostare isLastMinuteUnbooking: true
  4. Upsert (findOneAndUpdate con upsert: true) su { userId, date }

---

bulkUpsertStatus(userId, updates: Array<{ date, status, isUsingDesk?, room? }>)
  → Chiama upsertStatus in sequenza per ogni data.
  → Non interrompere su errori parziali: raccoglie i risultati e ritorna
    { succeeded: IWorkingStatus[], failed: Array<{ date, error }> }

---

updateOffTime(userId, date, offTime: { type, hours? } | null): Promise<IWorkingStatus>
  → Aggiorna solo il campo offTime. Non tocca status o isConfirmed.

---

retrofitStatus(userId, date, payload): Promise<IWorkingStatus>
  → Come upsertStatus ma con isRetrofit: true.
  → Permesso solo per il mese di calendario precedente al corrente.
  → 400 se la data è nel mese corrente o precedente al mese scorso.

---

isLastMinute(date: string): boolean [funzione helper]
  → Ritorna true se la data è il giorno corrente o domani.

Verifica: npm run lint passa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Route /presence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/routes/presence.routes.ts

Tutte le route sono protette da requireAuth.

GET /presence?month=YYYY-MM
  → Chiama getStatusForUser(req.user._id, month)
  → Risponde con array di oggetti giorno arricchiti

POST /presence
  Body: { date: string, status: string, isUsingDesk?: boolean, room?: string }
  → Chiama upsertStatus(req.user._id, date, payload)
  → 200 con il WS aggiornato

POST /presence/bulk
  Body: { updates: Array<{ date, status, isUsingDesk?, room? }> }
  → Chiama bulkUpsertStatus
  → 200 con { succeeded, failed }

PATCH /presence/:date/offtime
  Body: { offTime: { type, hours? } | null }
  → Chiama updateOffTime
  → 200 con il WS aggiornato

POST /presence/:date/retrofit
  Body: { status: string, offTime?: object }
  → Chiama retrofitStatus
  → 200 con il WS aggiornato

Monta il router in index.ts su /presence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Auto-confirm via cron (mezzanotte)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/services/scheduler.ts

Installa node-cron se non presente: npm install node-cron @types/node-cron

Funzione autoConfirmStatuses():
  → Eseguita ogni giorno a 23:59 (cron: '59 23 * * *')
  → Trova tutti i WS del giorno corrente con:
      status in ['mission', 'leave', 'sick', 'parental_leave']
      isConfirmed: false
  → Li segna come isConfirmed: true, confirmedAt: now()
  → Logga quanti record sono stati auto-confermati

Importa e avvia lo scheduler in backend/src/index.ts dopo la connessione MongoDB.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE MACRO 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. npm run build → zero errori TypeScript
2. # Crea uno status (richiede cookie da /auth/dev-login):
   curl -X POST http://localhost:4000/presence \
     -H "Content-Type: application/json" \
     --cookie "token=<JWT>" \
     -d '{"date":"'$(date +%Y-%m-%d)'","status":"remote"}'
   → 200 con il WS creato

3. curl http://localhost:4000/presence?month=$(date +%Y-%m) --cookie "token=<JWT>"
   → Array con tutti i giorni lavorativi del mese, quello di oggi con status 'remote'

4. Tentare di impostare 'sick' su una data futura:
   → 400 { error: 'Malattia dichiarabile solo per il giorno corrente' }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare. Staga con git add.
- Aggiorna CLAUDE_MEMORY.md: M2 completata, prossimi step M3.
- Elenca file creati/modificati.
```
