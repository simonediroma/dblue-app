# Stato Corrente
> Gitignored. Aggiornato da Claude a fine sessione.

**Ultima sessione:** 2026-06-18
**Branch corrente:** `claude/pensive-ptolemy-k79ei8` (pushato, PR #30 aperta)
**PR in corso:** #30 — fix error state + retry quando il fetch dei colleghi fallisce in Project Teammates

---

## Prossima sessione — inizia da qui

Fix bug "Project Teammates" mostra error state (PR #30):
- **Causa originale (PR #27):** fetch diretto di `getUsers()` già aggiunto, ma `.catch(() => {})` inghiottiva silenziosamente qualsiasi errore di rete/HTTP.
- **Fix PR #30:** aggiunto `colleaguesError` state + bottone Retry + guard su risposta non-array. Se il fetch fallisce, l'utente vede "Could not load colleagues" + Retry.
- **Se ancora vuoto dopo merge:** controllare `VITE_API_URL` nella Railway dashboard del frontend — potrebbe puntare a URL sbagliato o il backend non è raggiungibile.

**Pendente da sessione precedente:**
- Branch `claude/mpck-interface-audit-30cwoz` con mock audit Phase 1+2 — da aprire PR separata verso main.

**Prossimi step possibili:**
1. Merge/revisione PR #30 (error state teammates)
2. Verificare in produzione su Railway se l'errore ora è visibile (e diagnosticare la causa radice)
3. Aprire PR per `claude/mpck-interface-audit-30cwoz` (mock audit Phase 1+2)
4. E2E tests con Playwright (OAuth non ancora configurato)
5. Google OAuth (rimandato)

**Test backend:** scritti ma non eseguibili in ambiente remoto (MongoDB CDN bloccato). Per eseguire localmente: `MONGODB_URI_TEST=<atlas-uri> npm test` nella cartella `backend/`.

---

## Sequenza completa di sviluppo

### Prerequisiti (una-tantum, fuori da Claude Code)
- [x] Creare repo GitHub e connettere Claude Code
- [x] Creare progetto su Railway → collegare il repo GitHub → aggiungere plugin MongoDB
- [ ] Configurare Google OAuth su Google Cloud Console (redirect URI: URL pubblico Railway) — rimandato
- [x] Nelle variabili d'ambiente Railway (servizio backend): `MONGODB_URI`, `JWT_SECRET`, `APP_URL`, `BACKEND_URL`, `NODE_ENV=production` (OAuth rimandato)
- [x] Nelle variabili d'ambiente Railway (servizio frontend): `VITE_API_URL` = URL pubblico del backend Railway
- [ ] Credenziali SMTP (opzionale — senza di esse le email vengono simulate in console)

---

### Bootstrap (prima sessione in assoluto)

- [x] **M0** — Scaffold monorepo → `prompts/M0_scaffold.md`
  Crea cartelle, package.json, tsconfig, Dockerfile, railway.toml, placeholder src/.
  Pushato su PR #1 (`claude/sharp-mayer-u2wdwk`).

- [x] **Fix Railway frontend port** — PR #2 (`fix/railway-frontend-port`)
  nginx hardcodato su porta 80 → usa `${PORT}` via envsubst template (`/etc/nginx/templates/`).

---

### Backend — M1 → M6 (in sequenza, ogni macro = una sessione Claude Code)

- [x] **M1** — Auth + Core Models → `prompts/M1_auth_core_models.md`
  Express setup, modello User + Room, Google OAuth, JWT, dev-login fallback, route /auth /users /rooms
  Branch: `claude/zen-edison-riyzlr` — build TypeScript zero errori

- [x] **M2** — Working Status CRUD + State Machine → `prompts/M2_working_status_crud.md`
  Modello WorkingStatus, upsertStatus, bulkUpsert, offTime, retrofit, cron auto-confirm 23:59
  Branch: `claude/dreamy-wozniak-692bs4` — build TypeScript zero errori

- [x] **M3** — Desk Booking + Waiting List FIFO → `prompts/M3_desk_booking_waitinglist.md`
  capacity.service, FIFO promozione, endpoint /presence/:date/checkin, fix TODO rooms
  Branch: `claude/keen-babbage-wgq96x` — build TypeScript zero errori

- [x] **M4** — WebSocket + MongoDB Change Streams → `prompts/M4_websocket_changestreams.md`
  WS server con room pattern date→Set, Change Stream su WorkingStatus, heartbeat, replica set, docker-compose con rs0
  Branch: `claude/zealous-turing-id3yqf` — build TypeScript zero errori

- [x] **M5** — Stats API + Presence Days + RBAC → `prompts/M5_stats_presencedays_rbac.md`
  stats.service mensili/annuali/area, requireRole middleware centralizzato, RBAC colleghi
  Branch: `claude/ecstatic-curie-og52av` — build TypeScript zero errori

- [x] **M6** — Email + Retrofit + Permesso ore → `prompts/M6_email_retrofit_permesso.md`
  Nodemailer con guard dev, email promozione e malattia, /admin/retrofit, /admin/users, CRUD offTime
  Branch: `claude/dreamy-cori-gvl174` — build TypeScript zero errori

---

### Frontend — UI-1 → UI-4 (dopo M1-M6 completati, in sequenza)

- [x] **UI-1** — Setup + Copia POC + Auth → `prompts/UI-1_setup_auth.md`
  Copia presence---office-planner/ in frontend/src/, AuthContext, Login page, dev-login form, ProtectedRoute
  Branch: `claude/prossimo-task-vfcgsv` — npm run lint zero errori

- [x] **UI-2** — Working Status + Dati reali → `prompts/UI-2_working_status_data.md`
  api.ts esteso, usePresence con optimistic updates + rollback, useColleagues con hash colori
  Branch: `claude/zealous-noether-cu78zm` — npm run lint zero errori

- [x] **UI-3** — Check-in + Onboarding + Teammates → `prompts/UI-3_checkin_onboarding_teammates.md`
  checkIn API, RoomSelection con room reali, waiting list server-driven, salvataggio teammates

- [x] **UI-4** — Stats + Profile + WebSocket → `prompts/UI-4_stats_profile_websocket.md`
  Stats con dati reali, preferenze persistite, useWebSocket con backoff, integrazione in App.tsx
  Branch: `claude/compassionate-cray-0fn6i5` — npm run build zero errori

---

## Blockers aperti

- Credenziali Google OAuth (rimandato — da configurare quando pronto)
- Credenziali SMTP (opzionale — in dev le email vengono loggate in console)

---

## PR roadmap (una PR per macro)

| PR | Macro | Contenuto |
|----|-------|-----------|
| PR-1 | Setup | Monorepo scaffolding, docker-compose, CLAUDE.md |
| PR-2 | M1 | Auth, User model, Room model, JWT, dev-login |
| PR-3 | M2 | WorkingStatus CRUD, state machine, cron |
| PR-4 | M3 | Desk booking, waiting list FIFO, check-in |
| PR-5 | M4 | WebSocket, Change Streams, replica set |
| PR-6 | M5 | Stats API, RBAC middleware |
| PR-7 | M6 | Email, retrofit, permesso ore |
| PR-8 | UI-1 | Frontend setup, Auth, Login |
| PR-9 | UI-2 | Status e colleghi reali |
| PR-10 | UI-3 | Check-in, onboarding, teammates |
| PR-11 | UI-4 | Stats, preferenze, WebSocket real-time | ✅ merged (#13) |
| PR-12 | Mock Audit | Phase 1+2: fix stanze, isCurrentDay, COLLEAGUES rimossi, org stats reali | branch pronto, PR da aprire |

---

## File di riferimento progetto

| File | Scopo |
|------|-------|
| `DEV_SETUP_GUIDE.md` | Guida completa setup ambiente + deploy Railway |
| `docs/architecture.md` | Stack tecnico, schema I/O, env vars, flusso OAuth, WS pattern |
| `docs/lessons.md` | Pattern consolidati, errori da evitare, decisioni prese |
| `prompts/M1_auth_core_models.md` | Prompt Claude Code — backend M1 |
| `prompts/M2_working_status_crud.md` | Prompt Claude Code — backend M2 |
| `prompts/M3_desk_booking_waitinglist.md` | Prompt Claude Code — backend M3 |
| `prompts/M4_websocket_changestreams.md` | Prompt Claude Code — backend M4 |
| `prompts/M5_stats_presencedays_rbac.md` | Prompt Claude Code — backend M5 |
| `prompts/M6_email_retrofit_permesso.md` | Prompt Claude Code — backend M6 |
| `prompts/UI-1_setup_auth.md` | Prompt Claude Code — frontend UI-1 |
| `prompts/UI-2_working_status_data.md` | Prompt Claude Code — frontend UI-2 |
| `prompts/UI-3_checkin_onboarding_teammates.md` | Prompt Claude Code — frontend UI-3 |
| `prompts/UI-4_stats_profile_websocket.md` | Prompt Claude Code — frontend UI-4 |

---

## PR completate

| PR GitHub | Branch | Descrizione |
|-----------|--------|-------------|
| #1 | `claude/sharp-mayer-u2wdwk` | M0 — scaffold monorepo backend + frontend |
| #2 | `fix/railway-frontend-port` | Fix nginx: porta dinamica Railway via `${PORT}` |
| #4 | `claude/zen-edison-riyzlr` | M1 — Auth, User model, Room model, JWT, dev-login, route /auth /users /rooms |
| #6 | `claude/keen-babbage-wgq96x` | M3 — Desk booking, waiting list FIFO, check-in |
| #7 | `claude/zealous-turing-id3yqf` | M4 — WebSocket, Change Streams, replica set |
| #8 | `claude/ecstatic-curie-og52av` | M5 — Stats API, RBAC middleware, requireRole centralizzato |
| #8 | `claude/prossimo-task-vfcgsv` | UI-1 — Frontend setup, componenti POC, AuthContext, Login, ProtectedRoute |
| #13 | `claude/compassionate-cray-0fn6i5` | UI-4 — Stats, preferenze, WebSocket real-time |
| TBD | `claude/mpck-interface-audit-30cwoz` | Mock audit Phase 1+2 — stanze reali, isCurrentDay, COLLEAGUES rimossi, org stats API, colleghi reali |
