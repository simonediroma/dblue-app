# Documento Riepilogativo — Spec vs Implementazione
> Analisi completa di ogni requisito specificato nelle macro M0–M6 (backend) e UI-1–UI-4 (frontend)  
> Data revisione: 2026-06-18

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| ✅ | Implementato correttamente |
| ⚠️ | Implementato con discrepanza rispetto alle spec |
| ❌ | Non implementato |
| ➕ | Implementato in più (extra rispetto alle spec originali) |

---

## M0 — Scaffold Monorepo

| Requisito | Status | Note |
|-----------|--------|------|
| Struttura monorepo `frontend/`, `backend/`, `docs/` | ✅ | |
| `.gitignore` e `.env.example` | ✅ | |
| Backend: Express + TypeScript + Mongoose + Passport + JWT + WS | ✅ | |
| Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4 | ✅ | |
| Dockerfile backend | ✅ | |
| Dockerfile frontend (nginx) | ✅ | |
| `railway.toml` per ogni servizio | ✅ | |
| MongoDB replica set con docker-compose | ✅ | docker-compose con rs0 + mongo-init one-shot |
| nginx su porta dinamica `${PORT}` | ✅ | tramite envsubst template in `/etc/nginx/templates/` |

---

## M1 — Auth & Core Models

### Autenticazione

| Requisito | Status | Note |
|-----------|--------|------|
| Google OAuth 2.0 con Passport.js | ✅ | |
| Restrizione dominio @dblue.it | ✅ | `passport.ts` |
| JWT 7 giorni | ✅ | `signToken()` in `jwt.ts` |
| Cookie httpOnly, sameSite: lax, secure in prod | ⚠️ | Backend setta il cookie correttamente. In Railway, frontend e backend sono su domini diversi: il browser blocca i cookie cross-origin con `sameSite: lax`. Soluzione adottata: token in **sessionStorage** + `Authorization: Bearer`. sessionStorage si svuota alla chiusura del tab (più sicuro di localStorage). Decisione architetturale consapevole, non un bug. |
| `GET /auth/google` | ✅ | |
| `GET /auth/google/callback` | ✅ | |
| `POST /auth/dev-login` | ✅ | attivo solo se `ENABLE_DEV_LOGIN=true` |
| `GET /auth/me` | ✅ | |
| `POST /auth/logout` | ✅ | |

### User Model

| Requisito | Status | Note |
|-----------|--------|------|
| googleId, email, name, avatar | ✅ | |
| role (5 valori: employee, lab_responsible, admin_member, director, owner) | ✅ | |
| teammates (max 5, ref User) | ✅ | |
| contract.presenceDaysTarget | ✅ | |
| preferences.theme (light/dark/system) | ✅ | |
| preferences.notifications.waitingListPromotion | ✅ | |
| preferences.notifications.sickLeaveReminder | ✅ | |
| preferences.notifications.statusReminder11/18 | ➕ | non nelle spec originali — nessuna email corrispondente |
| preferences.notifications.projectTeammateBooking | ➕ | non nelle spec originali — nessuna email corrispondente |
| preferences.notifications.monthlyOverview | ➕ | non nelle spec originali — nessuna email corrispondente |
| preferences.notifications.newActivity | ➕ | non nelle spec originali — nessuna email corrispondente |
| preferences.accessibility.reducedMotion | ✅ | |
| preferences.accessibility.textSize | ✅ | |
| preferences.accessibility.screenReader | ➕ | non nelle spec originali |
| preferences.accessibility.highContrast | ➕ | non nelle spec originali |
| onboardingCompleted | ✅ | |

### Room Model

| Requisito | Status | Note |
|-----------|--------|------|
| name, capacity, type, isActive, createdBy | ✅ | |
| Tipi: open_space, lab, admin, management | ✅ | |
| Seed stanze default (Red, Green, Blue, Lab, Admin, Management) | ✅ | capacità: 20/20/20/15/8/6 |
| `GET /rooms` filtrato per ruolo (lab → lab_responsible, admin → admin_member, management → director/owner) | ✅ | |
| Validazione tipo stanza al booking in `upsertStatus`/`checkin` | ❌ | Il filtro esiste solo lato `GET /rooms`. `POST /presence` e `POST /presence/:date/checkin` non ri-validano che il ruolo possa accedere alla stanza scelta. |

### User Routes

| Requisito | Status | Note |
|-----------|--------|------|
| `GET /users` con ricerca nome/email | ✅ | |
| `PATCH /users/me/teammates` (max 5) | ✅ | |
| `PATCH /users/me/preferences` | ✅ | |
| `PATCH /users/me/onboarding` | ✅ | |

### Room Routes

| Requisito | Status | Note |
|-----------|--------|------|
| `GET /rooms` filtrato per ruolo | ✅ | |
| `POST /rooms` (owner only) | ✅ | |
| `PATCH /rooms/:id` (owner only) | ✅ | |
| `DELETE /rooms/:id` — soft delete (isActive: false) | ✅ | |
| Prevent deletion se esistono prenotazioni future | ⚠️ | Le spec richiedono questo controllo — da verificare se è implementato nella route DELETE |

---

## M2 — Working Status CRUD + State Machine

### Working Status Model

| Requisito | Status | Note |
|-----------|--------|------|
| userId, date (YYYY-MM-DD string), status | ✅ | date è stringa, non Date object |
| isConfirmed, confirmedAt | ✅ | |
| room, isUsingDesk | ✅ | |
| offTime (type: morning/afternoon/custom, hours?) | ✅ | |
| isRetrofit, isLastMinuteUnbooking | ✅ | |
| 9 valori status (in_office, remote, mission, leave, sick, parental_leave, waiting_list, office_no_desk, pending) | ✅ | |
| Unique constraint (userId, date) | ✅ | |
| Indici su `{date, status}` e `{userId, date}` | ✅ | |

### Business Logic

| Requisito | Status | Note |
|-----------|--------|------|
| `getStatusForUser()` — calendario mensile completo | ✅ | |
| Giorni mancanti restituiti come `pending` virtuale | ✅ | |
| Esclusione weekend | ✅ | |
| Arricchimento con bookedCount, totalCapacity | ✅ | |
| colleagueAvatars (max 10) per giorno | ✅ | |
| projectTeammatesCount per giorno | ✅ | |
| `upsertStatus()` — blocco se `isConfirmed: true` | ✅ | |
| Sick solo per giorno corrente (eccetto retrofit) | ✅ | |
| isLastMinuteUnbooking flag (cancellazione prenotazione oggi o domani) | ✅ | `isLastMinute(date)` |
| Auto-downgrade in_office → waiting_list se capacità esaurita | ✅ | |
| `bulkUpsertStatus()` con partial failure handling | ✅ | |
| `updateOffTime()` | ✅ | |
| `retrofitStatus()` — solo mese precedente, flag `isRetrofit: true` | ✅ | |
| Cron auto-confirm 23:59 per mission/leave/sick/parental_leave | ✅ | `scheduler.ts` |

### Presence Routes

| Requisito | Status | Note |
|-----------|--------|------|
| `GET /presence?month=YYYY-MM` | ✅ | |
| `POST /presence` | ✅ | |
| `POST /presence/bulk` | ✅ | |
| `GET /presence/:date/offtime` | ✅ | |
| `PATCH /presence/:date/offtime` | ✅ | |
| `DELETE /presence/:date/offtime` | ✅ | |
| `POST /presence/:date/retrofit` | ✅ | |
| `GET /presence/:date/colleagues` | ➕ | non nelle spec; usato dal frontend in DailyDetail |

---

## M3 — Desk Booking + Waiting List FIFO

| Requisito | Status | Note |
|-----------|--------|------|
| `getTotalCapacity(date)` con cache 60s | ✅ | somma capacità stanze open_space |
| `getBookedCount(date)` | ✅ | conta in_office + office_no_desk |
| `isCapacityAvailable(date)` | ✅ | |
| `getWaitingList(date)` FIFO per createdAt | ✅ | |
| `promoteFromWaitingList(date)` — promozione automatica | ✅ | |
| `getPresenceBreakdown(date)` per broadcast WS | ✅ | |
| `POST /presence/:date/checkin` — solo oggi | ✅ | |
| Check-in in_office con selezione stanza | ✅ | |
| Check-in remote senza stanza | ✅ | |
| Blocco check-in se status è waiting_list | ✅ | |
| Cancellazione booking → promozione waiting list + email automatica | ✅ | chiamata dentro `upsertStatus` |

---

## M4 — WebSocket + MongoDB Change Streams

| Requisito | Status | Note |
|-----------|--------|------|
| WS server integrato con Express su :4000, path `/ws` | ✅ | |
| Subscription per data: `{ type: "subscribe", date: "YYYY-MM-DD" }` | ✅ | |
| Heartbeat/ping-pong ogni 30s | ✅ | |
| Auto-reconnect con exponential backoff (client) | ✅ | max ~8s in `useWebSocket.ts` |
| Change Stream su WorkingStatus (insert/update/replace/delete) | ✅ | `change-stream.service.ts` |
| Ricalcolo capacity alla modifica | ✅ | |
| Broadcast `PresenceBreakdown` a tutti i subscriber della data | ✅ | |
| Payload `presence_update` con rooms[], extras, totalBooked, totalCapacity | ✅ | |
| MongoDB replica set rs0 | ✅ | docker-compose locale + Railway |

---

## M5 — Stats API + RBAC

### Stats Service

| Requisito | Status | Note |
|-----------|--------|------|
| `getMonthlyStats()` — presenceDaysConfirmed | ✅ | |
| `getMonthlyStats()` — presenceDaysTarget | ✅ | da `contract.presenceDaysTarget` |
| `getMonthlyStats()` — distribution (inOffice/remote/mission/leave/sick) | ✅ | |
| `getMonthlyStats()` — unbooking (standard + lastMinute) | ✅ | |
| `getAnnualStats()` — monthlyBreakdown[] | ✅ | |
| `getAnnualStats()` — solo mesi completati (< mese corrente) | ⚠️ | Da verificare nel codice che il filtro `month < currentMonth` sia effettivo |
| `getAnnualStats()` — totalUnbooking, averageMonthlyPresenceDays | ✅ | |
| `getAreaStats()` — totalUsers, avgPresenceDaysConfirmed | ✅ | |
| `getAreaStats()` — usersAboveTarget, usersBelowTarget | ✅ | |
| `getAreaStats()` — totalUnbooking | ✅ | |

### Stats Routes

| Requisito | Status | Note |
|-----------|--------|------|
| `GET /stats/monthly?month=YYYY-MM` | ✅ | |
| `GET /stats/annual?year=YYYY` | ✅ | |
| `GET /stats/area?month=YYYY-MM` (director/owner only) | ✅ | |
| `GET /admin/stats/:userId/monthly` | ➕ | non nelle spec; usato da `Organisation.tsx` |

### RBAC

| Requisito | Status | Note |
|-----------|--------|------|
| `requireRole()` factory middleware centralizzato | ✅ | `rbac.middleware.ts` |
| Creazione/modifica/cancellazione stanze → owner only | ✅ | |
| Area stats → director/owner only | ✅ | |
| Visibilità colleghi director/owner → tutti | ✅ | |
| Visibilità colleghi employee/lab_responsible/admin_member → solo propria area + projectTeammates | ❌ | Nessun campo `area`/`department` nel modello User. `getColleaguePresences()` restituisce tutti i colleghi senza filtro per area. Il filtro per area non è implementabile senza aggiungere il campo al modello. |

---

## M6 — Email + Retrofit + Off-Time

### Email Service

| Requisito | Status | Note |
|-----------|--------|------|
| Nodemailer con SMTP configurabile | ✅ | |
| Fallback console.log se SMTP non configurato (dev) | ✅ | |
| Email promozione waiting list | ✅ | `sendWaitingListPromotion()` |
| Email conferma malattia | ✅ | `sendSickLeaveConfirmation()` |
| Pattern fire-and-forget (non bloccante) | ✅ | |

### Admin Routes

| Requisito | Status | Note |
|-----------|--------|------|
| `POST /admin/retrofit/:userId/:date` (director/owner) | ✅ | |
| Blocco retrofit mese corrente o date future | ✅ | |
| Flag `isRetrofit: true` | ✅ | |
| `GET /admin/users` con ruoli e presenceDaysTarget | ✅ | |
| `PATCH /admin/users/:userId/role` (owner only) | ✅ | |
| Blocco auto-demozione | ✅ | |
| `POST /admin/seed` | ➕ | non nelle spec; utile per test/demo con 80+ colleghi |

### Off-Time

| Requisito | Status | Note |
|-----------|--------|------|
| `GET /presence/:date/offtime` | ✅ | |
| `PATCH /presence/:date/offtime` (morning/afternoon/custom + hours) | ✅ | |
| `DELETE /presence/:date/offtime` | ✅ | |

---

## UI-1 — Setup + Auth

| Requisito | Status | Note |
|-----------|--------|------|
| Copia prototipo in `frontend/src/` | ✅ | |
| Data dinamica (rimosso hard-coded '2026-10-09') | ✅ | |
| API client base con `credentials: 'include'` | ⚠️ | Usa `Authorization: Bearer` con token da localStorage — non cookie. |
| `getMe()`, `logout()`, `getUsers()`, `updateTeammates()`, `updatePreferences()`, `completeOnboarding()` | ✅ | |
| 401 → redirect automatico a /login | ✅ | |
| `AuthContext` con `useAuth()` hook | ✅ | |
| Loading state su mount | ✅ | |
| `logout()` → pulizia user + redirect /login | ✅ | |
| Login page con Google OAuth button | ✅ | |
| Dev login form (VITE_DEV_LOGIN_ENABLED) | ✅ | |
| Messaggio errore su ?error=unauthorized | ✅ | |
| Router: /login pubblico, `/*` → ProtectedRoute | ✅ | |
| ProtectedRoute redirect a /login se non autenticato | ✅ | |
| userName/userRole dall'utente autenticato (non hardcoded) | ✅ | |
| Onboarding mostrato solo se `!onboardingCompleted` | ✅ | |
| `onLogout` callback passato al Profile | ✅ | |

---

## UI-2 — Working Status Data

| Requisito | Status | Note |
|-----------|--------|------|
| `getPresence(month)` | ✅ | |
| `upsertStatus(date, payload)` | ✅ | |
| `bulkUpsertStatus(updates)` | ✅ | |
| `updateOffTime(date, offTime)` | ✅ | |
| `usePresence` hook con optimistic updates + rollback su errore | ✅ | |
| App.tsx: rimozione INITIAL_DAYS | ✅ | |
| Caricamento mese corrente + successivo al mount | ✅ | |
| Skeleton loader durante il caricamento | ✅ | |
| `useColleagues` hook con hash colori deterministico | ✅ | 12 colori Tailwind |
| Rimozione import `COLLEAGUES` hardcoded | ✅ | |
| Colleghi in DailyDetail e Onboarding da API | ✅ | |

---

## UI-3 — Check-in, Onboarding, Teammates

| Requisito | Status | Note |
|-----------|--------|------|
| `checkIn(date, room?, isUsingDesk?)` in api.ts | ✅ | |
| `getRooms()` in api.ts | ✅ | |
| handleCheckIn per status Remote | ✅ | |
| Rollback su errore API con toast | ✅ | |
| RoomSelection con stanze reali da API | ✅ | |
| Stanze caricate al mount e passate ai componenti | ✅ | |
| Waiting list: nessun check locale capacity, decide il backend | ✅ | |
| Risposta API include status effettivamente assegnato | ✅ | |
| Onboarding: `updateTeammates()` → `completeOnboarding()` | ✅ | |
| Teammates in Profile: add/remove con persistenza API | ✅ | |
| Caricamento teammates al mount (se onboardingCompleted) | ✅ | |

---

## UI-4 — Stats, Preferenze, WebSocket

| Requisito | Status | Note |
|-----------|--------|------|
| `getStatsMonthly(month)` | ✅ | |
| `getStatsAnnual(year)` | ✅ | |
| Interface `MonthlyStats`, `AnnualStats` in api.ts | ✅ | |
| Stats component con dati reali | ✅ | |
| Bar chart da `monthlyBreakdown` | ✅ | |
| Vista director/owner con area stats | ✅ | → `Organisation.tsx` completo |
| `handleSetThemeMode` → `updatePreferences({ theme })` | ✅ | |
| Toggle notifications → `updatePreferences({ notifications })` | ✅ | |
| Toggle accessibility → `updatePreferences({ accessibility })` | ✅ | |
| `useWebSocket(onPresenceUpdate)` hook | ✅ | |
| Subscribe alla data odierna al connect | ✅ | |
| Auto-reconnect con exponential backoff | ✅ | |
| Aggiornamento `days` state su messaggio `presence_update` | ✅ | |
| Tipo `Day`/`DayPresence` esteso con `rooms[]`, `extras` | ✅ | |

---

## Riepilogo Gap e Discrepanze

### ❌ Non implementati

| Gap | Impatto | File da modificare |
|-----|---------|-------------------|
| Filtro colleghi per area organizzativa | Medio — tutti i ruoli vedono tutti i colleghi | `user.model.ts` (aggiungere campo `area`), `working-status.service.ts:getColleaguePresences()` |
| Validazione server-side tipo stanza al booking | Medio — sicurezza | `working-status.service.ts:upsertStatus()`, `presence.routes.ts` (handler checkin) |

### ⚠️ Discrepanze con le spec

| Gap | Impatto | File da correggere |
|-----|---------|-------------------|
| JWT in `sessionStorage` invece di cookie httpOnly | Basso — scelta consapevole (CORS cross-domain su Railway impedisce cookie cross-origin). sessionStorage si svuota alla chiusura del tab. | `frontend/src/context/AuthContext.tsx`, `frontend/src/services/api.ts` |
| `getAnnualStats()` — filtro mesi completati da verificare | Basso | `backend/src/services/stats.service.ts` |
| `DELETE /rooms/:id` — check prenotazioni future da verificare | Basso | `backend/src/routes/rooms.routes.ts` |

### ➕ Extra implementati (non nelle spec originali)

| Feature extra | Note |
|---------------|------|
| `POST /admin/seed` + seed service con 80+ colleghi generati deterministicamente | Utile per test/demo |
| `GET /admin/stats/:userId/monthly` | Usato da `Organisation.tsx` |
| `GET /presence/:date/colleagues` | Usato da `DailyDetail.tsx` |
| `Organisation.tsx` — vista director con drill-down per collega e trend 12 mesi | Supera le spec di UI-4 |
| `AdminBar.tsx` — trigger seed da UI | |
| 4 tipi notifica extra nel modello User (statusReminder, projectTeammateBooking, monthlyOverview, newActivity) | Stub senza email corrispondenti |
| 2 preferenze accessibilità extra (screenReader, highContrast) | Implementate in frontend |

---

## Priorità di Intervento

| Priorità | Azione | File |
|----------|--------|------|
| 🔴 Alta | Validazione server-side tipo stanza nel booking | `working-status.service.ts:upsertStatus()`, `presence.routes.ts` (handler checkin) |
| 🟡 Media | Aggiungere campo `area` al User model e filtrare `getColleaguePresences()` | `user.model.ts`, `working-status.service.ts` |
| 🟢 Bassa | Verificare filtro mesi completati in `getAnnualStats()` | `stats.service.ts` |
| 🟢 Bassa | Verificare check prenotazioni future in `DELETE /rooms/:id` | `rooms.routes.ts` |
| ℹ️ Nota | JWT in sessionStorage (non cookie) è scelta architetturale per CORS cross-domain Railway — non da correggere | — |
