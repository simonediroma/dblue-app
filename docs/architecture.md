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
│   └── src/
│       ├── components/     ← componenti UI
│       ├── pages/          ← pagine/route
│       ├── hooks/          ← custom hooks (usePresence, useWebSocket, ecc.)
│       ├── services/       ← chiamate API centralizzate
│       ├── types/          ← TypeScript interfaces
│       ├── utils/          ← helpers puri
│       └── context/        ← React context (AuthContext, ecc.)
├── backend/
│   └── src/
│       ├── routes/         ← route Express (auth.ts, presence.ts, ecc.)
│       ├── models/         ← Mongoose schema/models
│       ├── middleware/      ← auth guard, error handler, ecc.
│       ├── services/       ← business logic
│       └── config/         ← db.ts, passport.ts, websocket.ts
├── docs/                   ← questo file + lessons.md
├── CLAUDE.md
├── CLAUDE_MEMORY.md        ← gitignored
├── docker-compose.yml      ← MongoDB locale per sviluppo
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
| `MONGODB_URI` | Backend | Connection string MongoDB |
| `JWT_SECRET` | Backend | Firma token sessione (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Entrambi | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Backend only | OAuth 2.0 secret (mai sul frontend) |
| `APP_URL` | Backend | URL pubblico del frontend (CORS) |
| `PORT` | Backend | Default 4000 |
| `NODE_ENV` | Backend | `development` / `production` |
| `VITE_API_URL` | Frontend (build) | URL del backend |

---

## Autenticazione — Flusso

```
1. Frontend → GET /auth/google           (redirect a Google)
2. Google   → GET /auth/google/callback  (con code)
3. Backend  → scambia code con token Google
4. Backend  → verifica email (@facile.it only)
5. Backend  → crea/aggiorna User su MongoDB
6. Backend  → genera JWT, setta cookie httpOnly
7. Frontend → autenticato, riceve profilo utente
```

**Restrizione dominio:** solo email `@facile.it` ammesse (da verificare nel callback OAuth).

---

## WebSocket — Pattern

- Il server WS è integrato nell'app Express (non separato).
- I client si iscrivono a "room" identificate da `${data}_${sedeId}` (es. `2026-06-16_MILAN`).
- MongoDB Change Streams ascoltano la collection `presences`.
- Ogni change event viene propagato solo ai client nella room corrispondente.

```typescript
// Subscription message dal client
{ type: "subscribe", room: "2026-06-16_MILAN" }

// Event push dal server
{ type: "presence_update", room: "2026-06-16_MILAN", data: { ... } }
```

---

## Prototipo di Riferimento

`presence---office-planner/` — prototipo UI da Google AI Studio (React + Gemini).
**Non modificare.** Usare solo come riferimento visivo per componenti e UX.
Lo stack del prototipo (frontend-only, Gemini API) è completamente diverso dal target.

---

## Comandi Utili

```bash
# Sviluppo locale
docker compose up -d               # avvia MongoDB su :27017
cd backend && npm run dev          # backend su :4000
cd frontend && npm run dev         # frontend su :3000

# Verifica
curl http://localhost:4000/health  # health check backend

# Build produzione
cd backend && npm run build        # compila TypeScript → dist/
cd frontend && npm run build       # genera dist/ per Nginx

# Deploy Railway (manuale)
railway up --service presence-backend
railway up --service presence-frontend
```
