# Lezioni Imparate — Presence App

Lezioni operative emerse durante lo sviluppo. Da consultare prima di implementare qualcosa di nuovo.

---

## Generali (universali)

**Ogni unità di lavoro è indipendente**
Un errore su un elemento non deve mai bloccare gli altri. Pattern: `try/catch` per elemento nel loop principale, log dell'errore, `continue`.

**Lazy loading per moduli pesanti**
Moduli con import costosi (ML, cloud SDK, scraping) vanno importati solo quando la funzionalità viene effettivamente usata, non al top-level. Evita timeout e startup lenti.

**Batch prima di parallelizzare**
Pre-carica tutti i dati necessari in un unico batch prima di parallelizzare con thread/async. Ogni operazione I/O separata in loop moltiplica i costi e i tempi.

**Singleton per client costosi**
Client verso API esterne (DB, cloud) vanno istanziati una volta sola e riusati. La connessione Mongoose va aperta una volta all'avvio, non per ogni request.

---

## Database — MongoDB

**Evita query N+1**
Una query per elemento in un loop è sempre un bug di performance. Usare `find({ _id: { $in: ids } })` per batch lookup.

**Change Streams richiedono replica set**
MongoDB Change Streams non funzionano su istanze standalone. Il plugin MongoDB di Railway non ha il replica set abilitato — usare MongoDB Atlas (anche M0 free supporta Change Streams). Copiare la connection string Atlas come variabile `MONGODB_URI` nel servizio backend Railway.

In locale con Docker, avviare MongoDB con `--replSet rs0` e inizializzare il replica set con un servizio one-shot (`mongo-init` in docker-compose.yml). Attendere ~10 secondi dopo `docker compose up -d` prima di avviare il backend. URI locale: `mongodb://localhost:27017/presence?replicaSet=rs0`.

**Indici su colonne filtrate frequentemente**
Qualsiasi campo usato in query `find()` va indicizzato. Definire gli indici nello schema Mongoose, non aggiungerli manualmente.

```typescript
// Corretto: indice definito nello schema
workingStatusSchema.index({ date: 1, status: 1 });
workingStatusSchema.index({ userId: 1, date: 1 }, { unique: true });
```

**Transazioni solo quando necessario**
Le transazioni Mongoose richiedono replica set e hanno overhead. Usarle solo per operazioni che devono essere atomiche (es. promozione dalla waiting list + aggiornamento contatore).

---

## Auth — Google OAuth + JWT

**Validare il dominio email nel callback**
Google OAuth non filtra per dominio — va fatto manualmente nel callback di Passport.js:
```typescript
if (!profile.emails?.[0]?.value?.endsWith('@dblue.it')) {
  return done(null, false, { message: 'Accesso riservato a @dblue.it' });
}
```

**JWT in cookie httpOnly, non in localStorage**
Storare il JWT in `localStorage` espone a XSS. Usare sempre cookie `httpOnly` + `sameSite: 'lax'` + `secure: true` in produzione.

**Refresh token separato dal access token**
Il JWT di sessione (access token) deve avere scadenza breve (es. 1h). Gestire il refresh con un token separato a lunga scadenza, ruotato ad ogni uso.

---

## WebSocket

**Gestire la riconnessione sul client**
Il client WebSocket deve implementare riconnessione automatica con exponential backoff. Non assumere che la connessione resti aperta.

**Non mandare broadcast globali**
Propagare gli eventi solo alle room interessate, non a tutti i client connessi. La room key è la data (`YYYY-MM-DD`). Il payload include già la disponibilità per stanza (`rooms[]`) e il totale aggregato (`totalBooked`, `totalCapacity`): non servono subscription separate per stanza.

**Heartbeat per rilevare connessioni zombie**
Implementare ping/pong ogni 30s. Se il client non risponde entro 60s, chiudere la connessione e pulire la room.

---

## API e Integrazioni

**Exponential backoff su tutte le chiamate esterne**
Rate limiting e errori temporanei sono la norma. Backoff: 2s → 4s → 8s → 16s, max 4 retry.

**Credenziali sempre da variabili d'ambiente**
Mai hardcodare API key, token, password nel codice o nei file committati. Usare `.env` + `.gitignore`.

**CORS configurato esplicitamente**
Non usare `cors()` senza opzioni in produzione. Specificare sempre `origin`, `credentials: true` e i metodi ammessi.

---

## Specifiche del Progetto

**Email fire-and-forget: non bloccare il response loop con sendMail**
Le email transazionali (promozione waiting list, conferma malattia) non devono mai bloccare la response al client. Usare il pattern fire-and-forget: chiamare la funzione email senza `await` e agganciare un `.catch(console.error)`. Così un timeout SMTP non degrada l'esperienza utente.
```typescript
sendWaitingListPromotion(email, date).catch((err) =>
  console.error('sendWaitingListPromotion error:', err)
);
```

**SMTP simulato in dev: pattern emailEnabled guard**
Creare una variabile `const emailEnabled = !!process.env.SMTP_HOST` all'avvio del modulo email. Se non configurata, loggare l'email in console invece di inviarla. Questo elimina la necessità di un server SMTP in locale e rende i test più semplici. Le variabili SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) sono opzionali in dev — documentarle in `.env.example` con i valori vuoti.
