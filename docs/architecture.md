# Presence App — Architettura e Riferimenti Tecnici

## Progetto

**Presence App** — Gestione presenze in ufficio con prenotazione scrivania e pianificazione team.

**Obiettivo:** Permettere ai dipendenti di segnalare la propria presenza, prenotare una scrivania e vedere chi è in ufficio in tempo reale.

---

## Stack Tecnico

| Layer | Tecnologia | Note |
|-------|-----------|------|
| Frontend | React 19 + TypeScript + Vite 6 | SPA, path alias `@/` per `src/` |
| Styling | Tailwind CSS v4 | Utility-first, no CSS separato |
| Backend | Node.js 20 + Express.js + TypeScript | REST API + WebSocket server |
| Database | MongoDB Atlas (M0 dev, M10 prod) | Mongoose ODM |
| Real-time | WebSockets (`ws`) + MongoDB Change Streams | Aggiornamenti live disponibilità |
| Auth | Google OAuth 2.0 (Passport.js) | Solo Google Sign-In, JWT per sessioni |
| Deploy dev | Railway | Auto-deploy da branch `develop` |
| Deploy prod | Railway Pro o GCP Cloud Run | MongoDB Atlas M10 |

---

## Architettura

Pattern: **monorepo** con separazione netta frontend/backend.

Il backend espone API REST + un server WebSocket integrato (stesso processo Express).
Il frontend è una SPA che consuma le API e mantiene una connessione WebSocket persistente per gli aggiornamenti real-time.
MongoDB Change Streams alimentano il server WebSocket: ogni modifica al DB viene propagata ai client connessi.

```
[Browser]
   ↕ HTTP (REST API)
   ↕ WebSocket
[Express Server :4000]
   ↓ Mongoose
[MongoDB Atlas]
   ↓ Change Streams
[Express WebSocket Server]
   ↑ push eventi
[Browser]
```

### Struttura Monorepo

```
presence-app/
├── frontend/
│   ├── src/
│   │   ├── components/     ← componenti UI
│   │   ├── pages/          ← pagine/route
│   │   ├── hooks/          ← custom hooks (usePresence, useWebSocket, ecc.)
│   │   ├── services/       ← chiamate API centralizzate (api.ts)
│   │   ├── types/          ← TypeScript interfaces
│   │   ├── utils/          ← helpers puri
│   │   └── context/        ← React context (AuthContext, ecc.)
│   ├── Dockerfile
│   └── railway.toml
├── backend/
│   ├── src/
│   │   ├── routes/         ← route Express (auth.ts, presence.ts, ecc.)
│   │   ├── models/         ← Mongoose schema/models
│   │   ├── middleware/     ← requireAuth, requireRole
│   │   ├── services/       ← business logic
│   │   ├── config/         ← passport.ts, jwt.ts
│   │   └── types/          ← express.d.ts e altri type augment
│   ├── Dockerfile
│   └── railway.toml
├── presence---office-planner/  ← prototipo AI Studio — SOLA LETTURA
├── prompts/                    ← prompt Claude Code (M0→M6, UI-1→UI-4)
├── docs/                       ← architecture.md, lessons.md
├── CLAUDE.md
├── CLAUDE_MEMORY.md            ← gitignored
└── .env.example
```

---

## Infrastruttura

| Risorsa | Dev | Prod |
|---------|-----|------|
| Backend | Railway service | Railway Pro / Cloud Run |
| Frontend | Railway service | Railway Pro / Cloud Run |
| Database | Railway MongoDB plugin | MongoDB Atlas M10 |
| Auth | Google OAuth (credenziali dev) | Google OAuth (credenziali prod) |
| Region | EU (Railway default) | europe-west1 (GCP) |

---

## Variabili d'Ambiente

| Variabile | Backend/Frontend | Descrizione |
|-----------|-----------------|-------------|
| `MONGODB_URL` | Backend | Connection string MongoDB — Railway la genera automaticamente dal plugin con questo nome esatto |
| `JWT_SECRET` | Backend | Firma token sessione (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Backend | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Backend only | OAuth 2.0 secret (mai sul frontend) |
| `APP_URL` | Backend | URL pubblico del frontend (CORS) |
| `BACKEND_URL` | Backend | URL pubblico del backend (callback OAuth) |
| `PORT` | Backend | Default 4000 — Railway lo sovrascrive automaticamente |
| `NODE_ENV` | Backend | `development` / `production` |
| `DEV_LOGIN_USER` | Backend | Email utente dev (solo NODE_ENV=development) |
| `DEV_LOGIN_PASS` | Backend | Password utente dev (solo NODE_ENV=development) |
| `DEV_LOGIN_ROLE` | Backend | Ruolo utente dev, default `director` |
| `SMTP_HOST` | Backend | Server SMTP per email — opzionale, senza di esso le email vengono simulate |
| `SMTP_PORT` | Backend | Default 587 |
| `SMTP_USER` | Backend | Utente SMTP |
| `SMTP_PASS` | Backend | Password SMTP |
| `SMTP_FROM` | Backend | Mittente email, default = SMTP_USER |
| `VITE_API_URL` | Frontend (build) | URL pubblico del backend |
| `VITE_DEV_LOGIN_ENABLED` | Frontend (build) | `true` solo in staging, mai in prod |

---

## Autenticazione — Flusso

```
1. Frontend → GET /auth/google           (redirect a Google)
2. Google   → GET /auth/google/callback  (con code)
3. Backend  → scambia code con token Google
4. Backend  → verifica email (@dblue.it only)
5. Backend  → crea/aggiorna User su MongoDB
6. Backend  → genera JWT, setta cookie httpOnly
7. Frontend → autenticato, riceve profilo utente
```

**Restrizione dominio:** solo email `@dblue.it` ammesse (da verificare nel callback OAuth).

---

## WebSocket — Pattern

- Il server WS è integrato nell'app Express (non separato).
- I client si iscrivono a "room" identificate dalla data (`YYYY-MM-DD`).
- MongoDB Change Streams ascoltano la collection `workingstatuses`.
- Ogni change event calcola la disponibilità **per stanza** e l'aggregato totale
  per la data modificata, e lo propaga solo ai client iscritti a quella data.

```typescript
// Subscription message dal client (invariato — ci si iscrive alla data)
{ type: "subscribe", date: "2026-06-16" }

// Event push dal server — payload per stanza + aggregato
{
  type: "presence_update",
  data: {
    date: "2026-06-16",
    rooms: [
      { name: "open_space", booked: 12, capacity: 30 },
      { name: "lab_dev",    booked: 5,  capacity: 8  }
    ],
    extras: 2,           // in_office/office_no_desk senza room assegnata
    totalBooked: 19,     // sum(rooms.booked) + extras
    totalCapacity: 38    // sum(rooms.capacity)
  }
}
```

La vista complessiva usa `totalBooked`/`totalCapacity`.
La vista per stanza usa l'array `rooms`.
Il totale è sempre `sum(rooms.booked) + extras` — non viene calcolato sul frontend.

---

## Prototipo di Riferimento

`presence---office-planner/` — prototipo UI da Google AI Studio (React + Gemini).
**Non modificare.** Usare solo come riferimento visivo per componenti e UX.
Lo stack del prototipo (frontend-only, Gemini API) è completamente diverso dal target.

---

## Endpoint API — Stato Finale (M1–M6)

| Metodo | Path | Auth | Ruoli |
|--------|------|------|-------|
| GET | /health | No | — |
| GET | /auth/google | No | — |
| GET | /auth/google/callback | No | — |
| POST | /auth/dev-login | No (solo dev) | — |
| GET | /auth/me | JWT | tutti |
| POST | /auth/logout | JWT | tutti |
| GET | /users/me | JWT | tutti |
| PATCH | /users/me | JWT | tutti |
| PATCH | /users/me/teammates | JWT | tutti |
| GET | /rooms | JWT | tutti |
| POST | /rooms | JWT | owner |
| PATCH | /rooms/:id | JWT | owner |
| DELETE | /rooms/:id | JWT | owner |
| GET | /presence?month=YYYY-MM | JWT | tutti |
| POST | /presence | JWT | tutti |
| POST | /presence/bulk | JWT | tutti |
| GET | /presence/:date/offtime | JWT | tutti |
| PATCH | /presence/:date/offtime | JWT | tutti |
| DELETE | /presence/:date/offtime | JWT | tutti |
| POST | /presence/:date/checkin | JWT | tutti |
| POST | /presence/:date/retrofit | JWT | tutti |
| GET | /stats/me?month=YYYY-MM | JWT | tutti |
| GET | /stats/area?month=YYYY-MM | JWT | director, owner |
| GET | /stats/annual?year=YYYY | JWT | director, owner |
| GET | /stats/presence-days/:userId | JWT | director, owner |
| POST | /admin/retrofit/:userId/:date | JWT | director, owner |
| GET | /admin/users | JWT | director, owner |
| PATCH | /admin/users/:userId/role | JWT | owner |

---

## Comandi Utili

```bash
# Build (verifica locale TypeScript)
cd backend && npm run build        # compila TypeScript → dist/
cd frontend && npm run build       # genera dist/ per Nginx

# Lint (usato come verifica in ogni macro)
cd backend && npm run lint         # tsc --noEmit
cd frontend && npm run lint        # tsc --noEmit
```

**Deploy:** Railway fa il deploy automaticamente ad ogni `git push`.
Non serve Railway CLI né Docker in locale — tutto gira su Railway.
