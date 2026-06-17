# Macro 6 — Email Notifications + Retrofit + Permesso (ore)
> Prerequisito: M5 completato. Stats API funzionante, RBAC centralizzato.
> Questa è l'ultima macro backend. Dopo questa, il backend è feature-complete.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO MACRO 6
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tre feature indipendenti da implementare in questa macro:
1. Email transazionali (promozione da waiting list, conferma malattia)
2. Retrofit: correzione del mese precedente da parte di Director/Owner
3. Permesso ore: gestione ore di permesso frazioni di giornata

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tocca SOLO backend/src/.
Non toccare frontend/ e presence---office-planner/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Email service (Nodemailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Non usare SendGrid per ora — Nodemailer con SMTP è sufficiente e senza SDK
aggiuntivi. Per Railway usiamo un SMTP esterno (Gmail OAuth o Mailgun SMTP).

npm install nodemailer @types/nodemailer

File: backend/src/services/email.service.ts

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Guard: se SMTP_HOST non è configurato, loggare invece di inviare
const emailEnabled = !!process.env.SMTP_HOST;

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!emailEnabled) {
    console.log(`[Email] (simulato) A: ${to} | Oggetto: ${subject}`);
    return;
  }
  await transporter.sendMail({
    from: `"Presence App" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export async function sendWaitingListPromotion(to: string, date: string): Promise<void> {
  await sendMail(
    to,
    `✅ Posto confermato in ufficio — ${date}`,
    `<p>Buone notizie! Un posto si è liberato e sei stato promosso dalla waiting list.</p>
     <p><strong>Data:</strong> ${date}</p>
     <p>Ricordati di fare check-in entro le 10:00.</p>`
  );
}

export async function sendSickLeaveConfirmation(to: string, date: string): Promise<void> {
  await sendMail(
    to,
    `Malattia registrata — ${date}`,
    `<p>La tua malattia per il giorno <strong>${date}</strong> è stata registrata.</p>
     <p>Recupera presto!</p>`
  );
}
```

Aggiungi in .env.example:
  # Email (opzionale in dev — se assente, le email vengono simulate in console)
  SMTP_HOST=
  SMTP_PORT=587
  SMTP_USER=
  SMTP_PASS=
  SMTP_FROM=

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Collega le email ai trigger
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In backend/src/services/capacity.service.ts, funzione promoteFromWaitingList:
  Dopo l'aggiornamento status → in_office, recupera l'email dell'utente e chiama
  sendWaitingListPromotion(user.email, date) in background (fire-and-forget, no await).

In backend/src/services/working-status.service.ts, funzione upsertStatus:
  Quando il payload.status è 'sick' (solo per il giorno corrente):
  → Recupera l'email dell'utente.
  → Chiama sendSickLeaveConfirmation(user.email, date) in background.

Nota: sia sendWaitingListPromotion che sendSickLeaveConfirmation non devono
mai bloccare il flusso principale — wrappale in un .catch(console.error).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Retrofit: correzione mese precedente (Director/Owner)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Il retrofit permette a Director/Owner di correggere il status di un utente
per il mese di calendario precedente, dopo che il mese si è chiuso.

File: backend/src/routes/admin.routes.ts

POST /admin/retrofit/:userId/:date
  Protetto da requireAuth + requireRole('director', 'owner').
  Body: { status: string, offTime?: { type, hours? } }

  Logica:
  1. Verifica che la data sia nel mese di calendario precedente al corrente.
     → 400 se è nel mese corrente o prima del mese scorso.
  2. Carica l'utente target per userId.
     → 404 se non esiste.
  3. Chiama retrofitStatus(userId, date, { ...payload, isRetrofit: true })
     (già implementata in M2).
  4. Risponde 200 con il WS aggiornato e un campo `retroffittedBy: req.user.id`.

GET /admin/users
  Protetto da requireAuth + requireRole('director', 'owner').
  → Ritorna lista completa di tutti gli utenti con campi:
    { id, name, email, role, avatar, onboardingCompleted,
      contract.presenceDaysTarget }
  → Usato dal pannello di amministrazione per selezionare l'utente target del retrofit.

PATCH /admin/users/:userId/role
  Protetto da requireAuth + requireRole('owner').
  Body: { role: IUser['role'] }
  → Aggiorna il ruolo dell'utente.
  → 400 se il ruolo non è valido.
  → 403 se il richiedente non è owner.
  → Non permettere di cambiare il proprio ruolo (self-demotion accidentale).

Monta il router in index.ts su /admin.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Permesso ore: CRUD offTime
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Il permesso ore è già modellato nel campo offTime del WorkingStatus (M2).
Aggiungere il CRUD dedicato per renderlo più esplicito.

In backend/src/routes/presence.routes.ts aggiungi:

GET /presence/:date/offtime
  Protetta da requireAuth.
  → Recupera il campo offTime del WS per quella data.
  → 404 se il WS non esiste.
  → 200 con { date, offTime } (offTime può essere null).

PATCH /presence/:date/offtime
  Già implementata in M2 — verifica che sia presente.
  → Se mancante, aggiungila: chiama updateOffTime(req.user._id, date, req.body.offTime).

DELETE /presence/:date/offtime
  Protetta da requireAuth.
  → Equivale a PATCH con offTime: null.
  → Chiama updateOffTime(req.user._id, date, null).
  → 200 con il WS aggiornato.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Documentazione final state
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aggiorna docs/architecture.md con:
  - Schema finale di tutti gli endpoint (lista completa con metodo, path, auth, ruoli)
  - Schema ENV vars completo (aggiungi le variabili SMTP aggiunte in M6)

Aggiorna docs/lessons.md con:
  - Nota su email fire-and-forget: non bloccare il response loop con sendMail
  - Nota su SMTP simulato in dev: pattern emailEnabled guard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE MACRO 6
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. npm run build → zero errori TypeScript

2. Email simulata in dev (SMTP_HOST non configurato):
   POST /presence con status 'sick' per oggi
   → Log in console: "[Email] (simulato) A: dev@deepblue.it | Oggetto: Malattia..."

3. Promozione waiting list con email simulata:
   → Prenota due utenti IN_OFFICE con capacità 1
   → Annulla il primo → log email simulata promozione

4. Retrofit (con token director):
   POST /admin/retrofit/<userId>/<data-mese-scorso>
   Body: { "status": "remote" }
   → 200 con il WS aggiornato e isRetrofit: true

5. Retrofit su data mese corrente:
   → 400

6. PATCH /admin/users/:id/role (con token owner):
   Body: { "role": "lab_responsible" }
   → 200

7. PATCH /admin/users/:id/role (con token director):
   → 403

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE — BACKEND FEATURE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Esegui `npm run build` → deve passare pulito.
- Crea il commit: git commit -m "feat(backend): M2-M6 completo — presence CRUD, booking, websocket, stats, email, retrofit"
- Aggiorna CLAUDE_MEMORY.md:
    - Tutte le macro M1-M6 completate
    - Prossimi step: UI-1 → UI-2 → UI-3 → UI-4 (frontend wiring)
    - Documenta eventuali SMTP credenziali da procurarsi per staging
- Elenca tutti i file creati/modificati in questa macro.
```
