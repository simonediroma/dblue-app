# Macro 1 — Auth + Core Models
> Prompt da incollare in Claude Code all'inizio della sessione M1.
> Prerequisito: `bash setup.sh` già eseguito, monorepo scaffoldato, `docker compose up -d` attivo.

---

```
Leggi CLAUDE.md, @CLAUDE_MEMORY.md e @docs/architecture.md prima di iniziare.
Poi esegui il piano seguente in ordine. Per ogni step verifica il criterio indicato prima di procedere al successivo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBIETTIVO MACRO 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Implementare l'intero layer di autenticazione e i modelli MongoDB core.
Al termine di questa macro un utente @deepblue.it può fare login con Google,
il suo profilo viene salvato su MongoDB, e il backend espone le API auth base.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tocca SOLO i file in backend/src/ e i file di configurazione root (.env.example).
Non toccare frontend/ in questa macro.
Non toccare presence---office-planner/ (prototipo — sola lettura).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Configurazione base Express
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/index.ts

Configura il server Express con:
- cors({ origin: process.env.APP_URL, credentials: true })
- express.json()
- cookie-parser
- Endpoint GET /health → { status: 'ok', timestamp: new Date().toISOString() }
- Connessione MongoDB via mongoose.connect(process.env.MONGODB_URI)
- Avvio server su process.env.PORT (default 4000)
- Gestione errori di startup con process.exit(1)

Verifica step 1: `npm run dev` si avvia, `curl http://localhost:4000/health` risponde 200.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Modello User
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/models/user.model.ts

Schema Mongoose con i seguenti campi:

googleId: string, required, unique
email: string, required, unique, lowercase
name: string, required
avatar: string (URL foto profilo Google)
role: enum ['employee', 'lab_responsible', 'admin_member', 'director', 'owner'], default 'employee'
teammates: [{ type: ObjectId, ref: 'User' }], max 5 elementi (validazione custom)
contract: {
  presenceDaysTarget: number, default 10  ← target mensile configurabile per contratto
}
preferences: {
  theme: enum ['light', 'dark', 'system'], default 'system'
  notifications: {
    waitingListPromotion: boolean, default true
    sickLeaveReminder: boolean, default true
  }
  accessibility: {
    reducedMotion: boolean, default false
    textSize: enum ['default', 'large'], default 'default'
  }
}
onboardingCompleted: boolean, default false
timestamps: true (createdAt, updatedAt automatici)

Indici: googleId (unique), email (unique).

Esporta il tipo TypeScript `IUser` dall'interfaccia del documento.

Verifica step 2: `npm run lint` passa senza errori TypeScript.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Modello Room
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/models/room.model.ts

Schema Mongoose:

name: string, required, trim
capacity: number, required, min 1
type: enum ['open_space', 'lab', 'admin', 'management'], default 'open_space'
  → open_space: sale prenotabili da tutti gli Employee
  → lab: prenotabile solo da Lab Responsible
  → admin: prenotabile solo da Admin Member
  → management: prenotabile solo da Director e Owner
isActive: boolean, default true
  → le room disattivate non compaiono nei flussi di prenotazione ma i dati storici restano
createdBy: ObjectId ref 'User', required
timestamps: true

Indice: { type: 1, isActive: 1 }.

Seed data — dopo la definizione dello schema aggiungi una funzione
`seedDefaultRooms(createdByUserId)` che crea le room di default se non esistono:
  - Red (open_space, capacity 20)
  - Green (open_space, capacity 20)
  - Blue (open_space, capacity 20)
  - DBLue Innovation Lab (lab, capacity 15)
  - Admin Room (admin, capacity 8)
  - Management Room (management, capacity 6)

La funzione verrà chiamata dopo il primo login Owner.

Verifica step 3: `npm run lint` passa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Configurazione Passport Google OAuth
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/config/passport.ts

Configura passport con GoogleStrategy (passport-google-oauth20):
- clientID: process.env.GOOGLE_CLIENT_ID
- clientSecret: process.env.GOOGLE_CLIENT_SECRET
- callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`
- scope: ['profile', 'email']

Nel callback della strategy:
1. Estrai email dal profilo Google
2. Verifica che l'email termini con '@deepblue.it'
   → se no: chiama done(null, false, { message: 'Accesso riservato a @deepblue.it' })
3. Cerca utente in MongoDB per googleId
4. Se non esiste: crea nuovo User con i dati del profilo Google
5. Se esiste: aggiorna name e avatar con i dati freschi di Google (potrebbero cambiare)
6. Chiama done(null, user)

Importa e inizializza passport in backend/src/index.ts.

Verifica step 4: `npm run lint` passa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — Utility JWT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/config/jwt.ts

Esporta due funzioni:

signToken(userId: string): string
  → genera JWT con payload { sub: userId }
  → scadenza: 7 giorni
  → secret: process.env.JWT_SECRET

verifyToken(token: string): { sub: string } | null
  → verifica JWT, ritorna payload o null in caso di errore/scadenza

File: backend/src/middleware/auth.middleware.ts

Middleware Express `requireAuth`:
  1. Legge il cookie 'token' dalla request
  2. Chiama verifyToken
  3. Se non valido: risponde 401 { error: 'Non autenticato' }
  4. Carica l'utente da MongoDB tramite il sub del payload
  5. Se utente non trovato: risponde 401
  6. Aggiunge l'utente a req.user e chiama next()

Aggiungi la dichiarazione TypeScript di req.user in backend/src/types/express.d.ts:
  declare global { namespace Express { interface Request { user?: IUser } } }

Verifica step 5: `npm run lint` passa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — Route Auth
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/routes/auth.routes.ts

GET /auth/google
  → passport.authenticate('google', { session: false })

GET /auth/google/callback
  → passport.authenticate('google', { session: false, failureRedirect: `${process.env.APP_URL}/login?error=unauthorized` })
  → su successo: genera JWT con signToken, setta cookie httpOnly:
      res.cookie('token', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000  // 7 giorni
      })
  → redirige a process.env.APP_URL

POST /auth/logout
  → clearCookie('token')
  → risponde 200 { message: 'Logout effettuato' }

GET /auth/me  [protetta da requireAuth]
  → risponde con il profilo utente corrente (senza googleId):
      { id, email, name, avatar, role, teammates, contract, preferences, onboardingCompleted }

Monta il router in index.ts su /auth.

Verifica step 6: build TypeScript senza errori (`npm run build`).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6b — Login alternativo per sviluppo (dev-only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aggiungere alle route auth un endpoint di fallback per quando OAuth non è
configurabile (es. problemi di dominio in ambiente dev).

In backend/src/routes/auth.routes.ts aggiungi:

POST /auth/dev-login
→ Attivo SOLO se process.env.NODE_ENV !== 'production'
  Se chiamato in production: risponde 404 immediatamente.

Logica:
1. Legge dal body: { username: string, password: string }
2. Confronta con le env var DEV_LOGIN_USER e DEV_LOGIN_PASS
   → Se non corrispondono: 401 { error: 'Credenziali non valide' }
3. Cerca l'utente nel DB per email === process.env.DEV_LOGIN_USER
   → Se non esiste: lo crea con i seguenti valori di default:
      googleId: 'dev-login',
      email: process.env.DEV_LOGIN_USER,
      name: process.env.DEV_LOGIN_NAME ?? 'Dev User',
      role: (process.env.DEV_LOGIN_ROLE as IUser['role']) ?? 'director'
4. Genera JWT con signToken e setta cookie httpOnly (stessa logica del callback Google)
5. Risponde 200 { ok: true }

Aggiungi le variabili in .env.example (con commento che indica dev-only):
  # Dev login alternativo (solo NODE_ENV=development)
  DEV_LOGIN_USER=dev@deepblue.it
  DEV_LOGIN_PASS=changeme
  DEV_LOGIN_NAME=Dev User
  DEV_LOGIN_ROLE=director

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — Route Users (base)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/routes/users.routes.ts

Tutte le route sono protette da requireAuth.

GET /users
  → ritorna lista tutti gli utenti con soli i campi pubblici: { id, name, email, avatar, role }
  → usato nel flusso selezione teammate e nella rubrica aziendale
  → supporta query param ?search=stringa per filtrare per name/email (case-insensitive)

PATCH /users/me/teammates
  Body: { teammates: string[] }  ← array di userId
  → valida che gli id esistano e siano al massimo 5
  → aggiorna il campo teammates dell'utente corrente
  → risponde con il profilo aggiornato

PATCH /users/me/preferences
  Body: Partial<IUser['preferences']>
  → aggiorna solo i campi inviati (merge parziale, non sovrascrittura totale)
  → risponde con preferences aggiornate

PATCH /users/me/onboarding
  → imposta onboardingCompleted: true per l'utente corrente
  → risponde 200 { onboardingCompleted: true }

Monta il router in index.ts su /users.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — Route Rooms (base)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File: backend/src/routes/rooms.routes.ts

GET /rooms  [requireAuth]
  → ritorna le room attive: { id, name, capacity, type }
  → filtra per il ruolo dell'utente:
      - employee: solo open_space
      - lab_responsible: open_space + lab
      - admin_member: open_space + admin
      - director: open_space + management
      - owner: tutte

POST /rooms  [requireAuth, solo owner]
  Body: { name, capacity, type }
  → crea nuova room, setta createdBy = req.user._id
  → se il richiedente non è owner: 403 { error: 'Permesso negato' }

PATCH /rooms/:id  [requireAuth, solo owner]
  Body: Partial<{ name, capacity, isActive }>
  → aggiorna room. Se isActive passa a false e ci sono prenotazioni future attive,
    risponde 409 { error: 'Room con prenotazioni attive', count: N }
    (il check prenotazioni sarà implementato in M3 — per ora placeholder con commento TODO)

DELETE /rooms/:id  [requireAuth, solo owner]
  → equivale a PATCH isActive: false (soft delete)

Monta il router in index.ts su /rooms.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICA FINALE MACRO 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esegui in ordine:

1. npm run build  → zero errori TypeScript
2. npm run dev    → "MongoDB connesso" + "Backend in ascolto su :4000"
3. curl http://localhost:4000/health  → { "status": "ok" }
4. curl http://localhost:4000/auth/me  → 401 (non autenticato, corretto)
5. curl http://localhost:4000/users   → 401 (non autenticato, corretto)
6. curl http://localhost:4000/rooms   → 401 (non autenticato, corretto)
7. curl -X POST http://localhost:4000/auth/dev-login \
     -H "Content-Type: application/json" \
     -d '{"username":"dev@deepblue.it","password":"changeme"}' \
   → 200 { "ok": true } + cookie 'token' settato

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AL TERMINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Non committare.
- Staga tutti i file modificati con git add.
- Aggiorna CLAUDE_MEMORY.md:
    - Marca M1 come completata
    - Scrivi "Prossima sessione — inizia da qui: Macro 2 — Working Status CRUD"
    - Elenca eventuali TODO o blockers trovati durante l'implementazione
- Riporta la lista di tutti i file creati o modificati.
```
