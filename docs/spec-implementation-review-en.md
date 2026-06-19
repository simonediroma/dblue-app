# Spec-to-Implementation Review — Presence App
> Full mapping of every requirement from the original spec prompts (M0–M6, UI-1–UI-4) to the actual implementation.  
> Review date: 2026-06-19

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented as specified |
| ⚠️ | Implemented with a known deviation from the spec (explained below) |
| ❌ | Not implemented — detail and remediation provided |
| ➕ | Implemented beyond the spec — rationale provided |

---

## M0 — Monorepo Scaffold

**Spec goal:** create the full monorepo skeleton with all tooling configured before any feature work begins.

| Requirement | Status | Detail |
|-------------|--------|--------|
| `frontend/`, `backend/`, `docs/` folders | ✅ | Present with all sub-folders (`routes/`, `models/`, `services/`, `config/`, `middleware/`, `types/` on the backend; `components/`, `pages/`, `hooks/`, `services/`, `types/`, `utils/`, `context/` on the frontend) |
| `.gitignore` and `.env.example` | ✅ | Both present; `.env.example` lists all required environment variables for backend and frontend |
| Backend stack: Express + TypeScript + Mongoose + Passport + JWT + WebSockets + Nodemailer | ✅ | All installed and configured |
| Frontend stack: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 | ✅ | All installed; Tailwind v4 via `@tailwindcss/vite` plugin |
| Multi-stage Dockerfiles (backend + frontend) | ✅ | Backend: Node 20 build + runtime stage; Frontend: Node build + nginx runtime |
| `railway.toml` per service | ✅ | One file per service, pointing to the correct Dockerfile and health-check path |
| MongoDB replica set in docker-compose (required for Change Streams) | ✅ | `docker-compose.yml` runs MongoDB with `--replSet rs0`; a one-shot `mongo-init` container calls `rs.initiate()` after startup |
| nginx on dynamic `${PORT}` (Railway assigns port at runtime) | ✅ | nginx template in `/etc/nginx/templates/` uses `envsubst` so `${PORT}` is replaced at container start |

---

## M1 — Authentication & Core Models

### Authentication

**Spec goal:** Google OAuth 2.0 restricted to `@dblue.it`, JWT in an httpOnly cookie, dev-login fallback.

| Requirement | Status | Detail |
|-------------|--------|--------|
| Google OAuth 2.0 via Passport.js | ✅ | `backend/src/config/passport.ts` — GoogleStrategy with profile + email scopes |
| Domain restriction: `@dblue.it` only | ✅ | Passport callback rejects emails not ending in `@dblue.it` and redirects to `${APP_URL}/login?error=unauthorized` |
| JWT signed with 7-day expiry | ✅ | `backend/src/config/jwt.ts` — `signToken(userId)` produces a 7-day token; `verifyToken(token)` returns payload or null |
| JWT delivered via httpOnly cookie (`sameSite: lax`, `secure` in prod) | ⚠️ | **Backend behaviour is correct** — the cookie is set on the OAuth callback and the dev-login response with `httpOnly: true`, `secure: production`, `sameSite: 'none'` in prod / `'lax'` in dev. **Frontend deviation:** Railway deploys frontend and backend on different subdomains; browsers block cross-origin `SameSite=lax` cookies. To work around this, the frontend extracts the token from the URL query param (`?token=…`) after the OAuth redirect, stores it in `sessionStorage`, and sends it in every request as `Authorization: Bearer <token>`. `sessionStorage` is cleared when the tab closes (safer than `localStorage`). This is a deliberate architectural decision, not a bug. The backend `requireAuth` middleware accepts both the cookie and the Bearer header. |
| `GET /auth/google` | ✅ | Initiates the OAuth flow (redirect to Google) |
| `GET /auth/google/callback` | ✅ | Receives the OAuth code, creates/updates the user, generates JWT, sets the cookie, redirects to the frontend root (token also appended in query string for the sessionStorage fallback) |
| `POST /auth/dev-login` | ✅ | Only enabled when `ENABLE_DEV_LOGIN=true`. Accepts `{ username, password }`, validates against `DEV_LOGIN_USER` / `DEV_LOGIN_PASS` env vars, creates a user with `googleId: 'dev-login'` if not found, returns `{ ok: true, token }` and sets the same cookie. Returns 404 in production. |
| `GET /auth/me` | ✅ | Returns `{ id, email, name, avatar, role, teammates, contract, preferences, onboardingCompleted }` for the authenticated user |
| `POST /auth/logout` | ✅ | Clears the auth cookie; returns `{ message: 'Logout effettuato' }` |

### User Model (`backend/src/models/user.model.ts`)

| Field | Status | Detail |
|-------|--------|--------|
| `googleId` (unique) | ✅ | |
| `email` (unique, lowercase) | ✅ | |
| `name`, `avatar` | ✅ | |
| `role` — 5 values: employee / lab_responsible / admin_member / director / owner | ✅ | Default: `employee` |
| `teammates` — array of ObjectId refs, max 5 | ✅ | Custom Mongoose validation enforces max 5 |
| `contract.presenceDaysTarget` | ✅ | Default: 10 days/month |
| `preferences.theme` (light / dark / system) | ✅ | Default: `system` |
| `preferences.notifications.waitingListPromotion` | ✅ | Default: `true` |
| `preferences.notifications.sickLeaveReminder` | ✅ | Default: `true` |
| `preferences.accessibility.reducedMotion` | ✅ | Default: `false` |
| `preferences.accessibility.textSize` (default / large) | ✅ | Default: `default` |
| `onboardingCompleted` | ✅ | Default: `false` |
| `preferences.notifications.statusReminder11` | ➕ | Not in the original spec. Added as a future-proof extension (notification at 11:00 if no status set). No backend email implementation yet — field is a stub. |
| `preferences.notifications.statusReminder18` | ➕ | Same as above (notification at 18:00). Stub only. |
| `preferences.notifications.projectTeammateBooking` | ➕ | Not in the spec. Would notify when a project teammate books the office. Stub only. |
| `preferences.notifications.monthlyOverview` | ➕ | Not in the spec. Would send a monthly presence summary. Stub only. |
| `preferences.notifications.newActivity` | ➕ | Not in the spec. General activity feed notification. Stub only. |
| `preferences.accessibility.screenReader` | ➕ | Not in the original spec. Adds a screen reader optimisation mode. Implemented in the frontend UI. |
| `preferences.accessibility.highContrast` | ➕ | Not in the original spec. High-contrast visual mode. Implemented in the frontend UI. |

> **Note on extra notification/accessibility fields:** these were added during frontend development to support a richer Profile UI. The fields exist in the model and preferences update endpoint, but no backend email or push-notification logic is wired to `statusReminder11/18`, `projectTeammateBooking`, `monthlyOverview`, or `newActivity`. To fully implement them, email templates and trigger points must be added to the email service.

### Room Model (`backend/src/models/room.model.ts`)

| Requirement | Status | Detail |
|-------------|--------|--------|
| Fields: `name`, `capacity`, `type`, `isActive`, `createdBy` | ✅ | |
| Types: open_space / lab / admin / management | ✅ | |
| Default rooms seeded on first owner login | ✅ | `seedDefaultRooms(userId)`: Red, Green, Blue (open_space, 20 each), DBLue Innovation Lab (lab, 15), Admin Room (admin, 8), Management Room (management, 6) — total 89 desks |
| `GET /rooms` filters by role | ✅ | employee → open_space only; lab_responsible → open_space + lab; admin_member → open_space + admin; director → open_space + management; owner → all |
| `POST /rooms` (owner only) | ✅ | Creates room with `createdBy = req.user._id`; returns 201 with the created room |
| `PATCH /rooms/:id` (owner only) — block deactivation if future bookings exist | ✅ | When `isActive` is set to `false`, the handler counts WorkingStatus records with `date > today` and `status IN [in_office, waiting_list, office_no_desk]` for that room; returns 409 `{ error, count }` if any found |
| `DELETE /rooms/:id` (owner only) — soft delete | ✅ | Checks for future active bookings (same logic as PATCH); sets `isActive: false` |
| Server-side room-type validation at booking time | ❌ | **Missing.** `GET /rooms` correctly restricts which rooms a role can see, but `POST /presence` (upsertStatus) and `POST /presence/:date/checkin` do not re-validate that the user's role is allowed for the chosen room. A malicious or misconfigured client can currently book a lab room as an `employee`. **Fix:** add a role-to-room-type check inside `upsertStatus` and the check-in handler, returning 403 if the room type is not in the user's allowed set. |

### User Routes (`backend/src/routes/users.routes.ts`)

| Requirement | Status | What it does |
|-------------|--------|-------------|
| `GET /users` | ✅ | Returns `{ id, name, email, avatar, role }` for all users. Optional `?search=` query param filters on name or email (case-insensitive regex). |
| `PATCH /users/me/teammates` | ✅ | Accepts `{ teammates: string[] }` (max 5 IDs). Validates that all IDs exist in the DB. Updates `req.user.teammates`. Returns the updated user. |
| `PATCH /users/me/preferences` | ✅ | Accepts a deep-partial preferences object. Uses dot-notation flattening to perform a `$set` on only the provided keys, preserving unspecified preferences. Returns the updated preferences. |
| `PATCH /users/me/onboarding` | ✅ | Sets `onboardingCompleted: true`. Returns `{ onboardingCompleted: true }`. |

---

## M2 — Working Status CRUD + State Machine

### WorkingStatus Model (`backend/src/models/working-status.model.ts`)

| Requirement | Status | Detail |
|-------------|--------|--------|
| `userId`, `date` (YYYY-MM-DD string), `status` | ✅ | Date stored as a string, not a Date object — avoids timezone drift |
| `isConfirmed`, `confirmedAt` | ✅ | |
| `room`, `isUsingDesk` | ✅ | |
| `offTime` — type (morning / afternoon / custom) + optional `hours` | ✅ | |
| `isRetrofit`, `isLastMinuteUnbooking` | ✅ | |
| 9 status values | ✅ | in_office, remote, mission, leave, sick, parental_leave, waiting_list, office_no_desk, pending |
| Unique index `(userId, date)` | ✅ | Ensures one record per user per day |
| Index `(date, status)` | ✅ | Enables fast per-date availability queries |

### Working Status Service (`backend/src/services/working-status.service.ts`)

#### `getStatusForUser(userId, month)`
**Spec:** return the full working-day calendar for a month, enriching each day with colleague data and capacity.  
**Implementation:** ✅

- Fetches all the user's WorkingStatus records for the month.
- Generates all Mon–Fri dates in the month (no Italian holiday exclusion — weekends only).
- For each working day missing a DB record → returns a virtual `{ date, status: 'pending', isConfirmed: false }`.
- Enriches each day with:
  - `bookedCount`: total users with `in_office` or `office_no_desk` on that date.
  - `totalCapacity`: sum of all active room capacities (from capacity service).
  - `colleagueAvatars`: up to 10 avatar URLs of colleagues with `in_office`/`office_no_desk` on that date.
  - `projectTeammatesCount`: how many of the user's teammates are in office that day.

#### `upsertStatus(userId, date, payload)`
**Spec:** create/update a status with full business rules.  
**Implementation:** ✅

Business rules applied in order:
1. If existing record has `isConfirmed: true` → 409 "Status già confermato, non modificabile" (cannot change a confirmed day).
2. If `status === 'sick'` and `date !== today` → 400 "Malattia dichiarabile solo per il giorno corrente" (sick only for today, unless retrofit).
3. If incoming status is `in_office` → calls `isCapacityAvailable(date)`. If the office is full → auto-downgrades to `waiting_list`.
4. If existing status was `in_office`/`office_no_desk` and new status removes the booking (remote, pending, leave, sick, mission) → calls `promoteFromWaitingList(date)` as fire-and-forget.
5. If `status === 'sick'` and `date === today` → sends `sendSickLeaveConfirmation` email as fire-and-forget.
6. Sets `isLastMinuteUnbooking: true` if the previous status was `in_office`/`waiting_list` and the cancellation date is today or tomorrow (`isLastMinute(date)`).
7. Performs `findOneAndUpdate` with `upsert: true` on `{ userId, date }`.

#### `bulkUpsertStatus(userId, updates)`
**Spec:** batch update with partial failure handling.  
**Implementation:** ✅

Iterates through updates, calls `upsertStatus` for each. Collects successes in `succeeded[]` and failures in `failed[]` (with `{ date, error }`). Does not stop on individual errors. Returns `{ succeeded, failed }`.

#### `updateOffTime(userId, date, offTime)`
**Spec:** update only the offTime field without touching status or isConfirmed.  
**Implementation:** ✅ — upserts `offTime` field only.

#### `retrofitStatus(userId, date, payload)`
**Spec:** allow modification of previous-month records, marking them with `isRetrofit: true`.  
**Implementation:** ✅

- Rejects dates in the current month or future.
- Rejects if the record is already `isConfirmed`.
- Sets `isRetrofit: true`.

#### `getColleaguePresences(date, requestingUserId)`
**Spec:** not explicitly specified in M2 (added to support M3 check-in UI).  
**Implementation:** ➕ Returns all users' presence for a date (excluding the requester). Returns `{ userId, name, status, room, isConfirmed }` per user, defaulting unset users to `status: 'pending'`.

### Presence Routes (`backend/src/routes/presence.routes.ts`)

| Endpoint | Status | What it does / returns |
|----------|--------|------------------------|
| `GET /presence?month=YYYY-MM` | ✅ | Calls `getStatusForUser`. Returns an array of working-day objects, each with `date`, `status`, `isConfirmed`, `bookedCount`, `totalCapacity`, `colleagueAvatars`, `projectTeammatesCount`. |
| `POST /presence` | ✅ | Body: `{ date, status, isUsingDesk?, room? }`. Calls `upsertStatus`. Returns the updated WorkingStatus document. The returned `status` may differ from what was requested (e.g., `in_office` → `waiting_list`). |
| `POST /presence/bulk` | ✅ | Body: `{ updates: [...] }`. Returns `{ succeeded: WorkingStatus[], failed: [{ date, error }] }`. |
| `GET /presence/:date/offtime` | ✅ | Returns `{ date, offTime }` where `offTime` is null or `{ type, hours? }`. 404 if no record. |
| `PATCH /presence/:date/offtime` | ✅ | Body: `{ offTime: { type, hours? } \| null }`. Returns updated WorkingStatus. |
| `DELETE /presence/:date/offtime` | ✅ | Calls `updateOffTime(…, null)`. Returns updated WorkingStatus with `offTime` cleared. |
| `POST /presence/:date/retrofit` | ✅ | Body: `{ status, offTime? }`. Calls `retrofitStatus`. Returns updated WorkingStatus with `isRetrofit: true`. |
| `GET /presence/:date/colleagues` | ➕ | Not in the original spec. Calls `getColleaguePresences`. Returns all colleagues' statuses for a date. Added because `DailyDetail.tsx` needed to render "who's in the office today" without re-fetching the full month. |

### Scheduler (`backend/src/services/scheduler.ts`)

| Requirement | Status | Detail |
|-------------|--------|--------|
| Cron at 23:59 — auto-confirm mission / leave / sick / parental_leave | ✅ | `startScheduler()` runs `autoConfirmStatuses()` via cron `'59 23 * * *'`. Finds all WorkingStatus for today with status in `[mission, leave, sick, parental_leave]` and `isConfirmed: false`, then sets `isConfirmed: true` and `confirmedAt: now()`. |

---

## M3 — Desk Booking + FIFO Waiting List

### Capacity Service (`backend/src/services/capacity.service.ts`)

| Function | Status | What it does |
|----------|--------|-------------|
| `getTotalCapacity(date)` | ✅ | Sums `capacity` of all Rooms where `type === 'open_space'` and `isActive: true`. Result is cached in memory for 60 seconds. |
| `getBookedCount(date)` | ✅ | Counts WorkingStatus records for `date` with `status IN [in_office, office_no_desk]`. `waiting_list` is excluded (not yet confirmed). |
| `isCapacityAvailable(date)` | ✅ | Returns `getBookedCount(date) < getTotalCapacity(date)`. |
| `getWaitingList(date)` | ✅ | Returns WorkingStatus records with `status === 'waiting_list'` for the date, sorted by `createdAt` ASC (strict FIFO). |
| `promoteFromWaitingList(date)` | ✅ | If `isCapacityAvailable`: takes the first entry from `getWaitingList`, sets its `status` to `in_office`, and calls `sendWaitingListPromotion(user.email, date)` as fire-and-forget. |
| `getPresenceBreakdown(date)` | ✅ | Returns `{ date, rooms: [{ name, booked, capacity }], extras, totalBooked, totalCapacity }`. `extras` = bookings with no room assigned. Used by the WebSocket change-stream broadcast. |

### Check-in Endpoint (`POST /presence/:date/checkin`)

**Spec:** confirm presence for the current day only.  
**Implementation:** ✅

- Returns 400 if `date !== today`.
- Returns 404 if no WorkingStatus record exists for the user on that date.
- Returns 400 if `status === 'waiting_list'` (cannot check in from the waiting list).
- Accepts statuses `in_office`, `office_no_desk`, `remote`.
- Sets `isConfirmed: true`, `confirmedAt: now()`.
- Optionally updates `room` and `isUsingDesk` from body.
- Returns the updated WorkingStatus.

### Room Soft-Delete Booking Check

**Spec:** prevent deactivating a room if future bookings exist.  
**Implementation:** ✅ — both `PATCH /rooms/:id` (when `isActive → false`) and `DELETE /rooms/:id` query for future WorkingStatus records referencing the room before proceeding.

---

## M4 — WebSocket + MongoDB Change Streams

### WebSocket Service (`backend/src/services/websocket.service.ts`)

| Requirement | Status | Detail |
|-------------|--------|--------|
| WS server at `/ws` on the same Express process | ✅ | `initWebSocket(server)` attaches a `ws.WebSocketServer` to the HTTP server on path `/ws` |
| Date-based subscription: `{ type: "subscribe", date: "YYYY-MM-DD" }` | ✅ | Client sends this JSON message; the server adds the socket to a `Map<date, Set<WebSocket>>` |
| Heartbeat every 30 s | ✅ | `setInterval` pings all clients; if a client's `isAlive` flag is still false from the previous cycle, the connection is terminated |
| `broadcastToDate(date, payload)` | ✅ | Sends JSON to all sockets subscribed to that date |
| Client auto-reconnect with exponential backoff | ✅ | `useWebSocket.ts` retries with delay doubling up to ~8 s |

### Change Stream Service (`backend/src/services/change-stream.service.ts`)

| Requirement | Status | Detail |
|-------------|--------|--------|
| Watch WorkingStatus for insert / update / replace / delete | ✅ | Opens a MongoDB change stream with `fullDocument: 'updateLookup'` |
| On change: recalculate breakdown and broadcast | ✅ | Extracts `date` from `fullDocument`, calls `getPresenceBreakdown(date)`, then `broadcastToDate(date, breakdown)` |
| MongoDB replica set (required for Change Streams) | ✅ | docker-compose + Railway both configured with `--replSet rs0` |

**WebSocket payload shape:**
```json
{
  "type": "presence_update",
  "data": {
    "date": "2026-06-19",
    "rooms": [{ "name": "Red", "booked": 12, "capacity": 20 }],
    "extras": 2,
    "totalBooked": 14,
    "totalCapacity": 60
  }
}
```

---

## M5 — Stats API + RBAC

### Stats Service (`backend/src/services/stats.service.ts`)

#### `getMonthlyStats(userId, month)` → `MonthlyStats`
**Spec:** monthly confirmed days vs. target, status distribution, unbooking counts.  

| Field | Status | Detail |
|-------|--------|--------|
| `presenceDaysConfirmed` | ✅ | Count of records with `status === 'in_office'` AND `isConfirmed: true` |
| `presenceDaysTarget` | ✅ | From `user.contract.presenceDaysTarget` (default 10) |
| `distribution.inOffice` | ✅ | Count of `status === 'in_office'` records |
| `distribution.remote` | ✅ | Count of `status === 'remote'` |
| `distribution.mission` | ✅ | Count of `status === 'mission'` |
| `distribution.leave` | ✅ | Count of `leave` + `parental_leave` combined |
| `distribution.sick` | ✅ | Count of `status === 'sick'` |
| `unbooking.lastMinute` | ✅ | Count of records with `isLastMinuteUnbooking: true` |
| `unbooking.standard` | ❌ | **Hardcoded to 0.** The spec defines standard unbooking as "in_office/waiting_list cancelled before the last-minute window". To track this, the system would need either a `wasUnbooked: boolean` flag set on every cancellation (regardless of timing), or a status-change event log. Currently `isLastMinuteUnbooking` is only set when the cancellation IS last-minute; there is no flag for "cancelled with advance notice". **Fix:** add `wasUnbooked: boolean` to the WorkingStatus model, set it to `true` in `upsertStatus` whenever a booking is removed (regardless of date), and compute `standard = wasUnbooked AND NOT isLastMinuteUnbooking`. |

#### `getAnnualStats(userId, year)` → `AnnualStats`
**Spec:** year-to-date breakdown with monthly granularity, only completed months.

| Field | Status | Detail |
|-------|--------|--------|
| `monthlyBreakdown` | ✅ | Calls `getMonthlyStats` for each month |
| Only completed months (< current month) | ✅ | Logic correctly determines the last completed month: if `year === currentYear`, it stops at `currentMonth - 1`; for past years it includes all 12 months |
| `totalUnbooking` | ✅ | Summed across all included months |
| `averageMonthlyPresenceDays` | ✅ | Mean of `presenceDaysConfirmed` across all included months |

#### `getAreaStats(month, requestingUser)` → `AreaStats`
**Spec:** org-wide aggregation for director/owner.

| Field | Status | Detail |
|-------|--------|--------|
| Role guard (director/owner only) | ✅ | Enforced inside the service; returns 403 if called by other roles |
| `totalUsers` | ✅ | |
| `avgPresenceDaysConfirmed` | ✅ | |
| `usersAboveTarget` / `usersBelowTarget` | ✅ | Compared against each user's `contract.presenceDaysTarget` |
| `totalUnbooking` | ✅ | Summed across all users (standard is 0 — same gap as above) |

### Stats Routes (`backend/src/routes/stats.routes.ts`)

| Endpoint | Status | What it does / returns |
|----------|--------|------------------------|
| `GET /stats/monthly?month=YYYY-MM` | ✅ | Calls `getMonthlyStats`. Returns `MonthlyStats`. 400 if month format invalid. |
| `GET /stats/annual?year=YYYY` | ✅ | Calls `getAnnualStats`. Returns `AnnualStats`. |
| `GET /stats/area?month=YYYY-MM` | ✅ | Requires director/owner. Calls `getAreaStats`. Returns `AreaStats`. |
| `GET /admin/stats/:userId/monthly` | ➕ | Not in the original spec. Lets a director/owner fetch another user's `MonthlyStats`. Added because `Organisation.tsx` needs per-colleague stats for the drill-down view. |

### RBAC (`backend/src/middleware/rbac.middleware.ts`)

| Requirement | Status | Detail |
|-------------|--------|--------|
| `requireRole(...roles)` centralised factory | ✅ | Returns a middleware that checks `req.user.role` against the allowed list; returns 403 `{ error: 'Permesso negato' }` if rejected |
| Room create/edit/delete → owner only | ✅ | |
| Area stats → director/owner | ✅ | |
| Colleague visibility: director/owner sees all | ✅ | |
| Colleague visibility: other roles see only their area + teammates | ❌ | **Not implemented.** The spec says employees/lab_responsible/admin_member should only see colleagues within their organisational area. The User model has no `area` or `department` field. `getColleaguePresences()` returns all users without area filtering. A comment in the service marks this as TODO. **Fix:** add an `area: string` (or enum) field to the User model, populate it during onboarding or via admin, and filter `getColleaguePresences()` to return only users with the same area value, plus always include the requester's `teammates`. |

---

## M6 — Email Notifications + Retrofit + Off-Time

### Email Service (`backend/src/services/email.service.ts`)

| Requirement | Status | Detail |
|-------------|--------|--------|
| Nodemailer with SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) | ✅ | |
| Console fallback when SMTP not configured (dev) | ✅ | If `SMTP_HOST` is unset, `sendMail` logs the email content to the console instead of sending |
| `sendWaitingListPromotion(to, date)` | ✅ | Subject: "✅ Posto confermato in ufficio — {date}". HTML body notifies the user of promotion and reminds them to check in by 10:00. Called from `promoteFromWaitingList`. |
| `sendSickLeaveConfirmation(to, date)` | ✅ | Subject: "Malattia registrata — {date}". HTML body confirms the sick leave. Called from `upsertStatus` when `status === 'sick'` for today. |
| Fire-and-forget pattern (does not block the response) | ✅ | Both email functions are called without `await` and errors are caught with `.catch(console.error)` |

### Admin Routes (`backend/src/routes/admin.routes.ts`)

| Endpoint | Status | What it does / returns |
|----------|--------|------------------------|
| `POST /admin/retrofit/:userId/:date` | ✅ | Director/owner only. Body: `{ status, offTime? }`. Validates date is in the previous calendar month. Loads the target user (404 if missing). Calls `retrofitStatus(userId, date, payload)`. Returns the updated WorkingStatus plus `retrofittedBy: req.user.id`. |
| `GET /admin/users` | ✅ | Director/owner only. Returns all users: `{ id, name, email, role, avatar, onboardingCompleted, contract }`. |
| `PATCH /admin/users/:userId/role` | ✅ | Owner only. Body: `{ role }`. Validates role against whitelist. Prevents self-demotion. Returns `{ name, email, role }`. |
| `POST /admin/seed` | ➕ | Not in the original spec. Owner only. Body: `{ fresh?: boolean }` (if true, wipes the DB first). Runs the full seed service, generating 80+ realistic users with statuses spanning 13 months. Returns `{ ok: true, summary }`. **Reason:** manual seeding was impractical during development and testing; this endpoint enables a one-click demo environment. |

### Off-Time Routes (`backend/src/routes/presence.routes.ts`)

| Endpoint | Status | What it does / returns |
|----------|--------|------------------------|
| `GET /presence/:date/offtime` | ✅ | Returns `{ date, offTime }`. `offTime` is null if not set. 404 if no WorkingStatus found for that date. |
| `PATCH /presence/:date/offtime` | ✅ | Body: `{ offTime: { type: 'morning'\|'afternoon'\|'custom', hours?: number } }`. Updates `offTime` without touching `status` or `isConfirmed`. Returns updated WorkingStatus. |
| `DELETE /presence/:date/offtime` | ✅ | Calls `updateOffTime(…, null)`. Returns updated WorkingStatus with `offTime` cleared. |

---

## UI-1 — Frontend Setup + Auth

| Requirement | Status | Detail |
|-------------|--------|--------|
| Prototype copied to `frontend/src/` | ✅ | All components, hooks, types, utils from `presence---office-planner/` |
| Hardcoded date `'2026-10-09'` replaced with dynamic `new Date()` | ✅ | `dateUtils.ts` and `App.tsx` both use `new Date()` |
| API client with `credentials: 'include'` | ⚠️ | `api.ts` uses `credentials: 'include'` in the base `request()` wrapper (so cookies are included when present), **but** authentication is actually performed via `Authorization: Bearer` header from sessionStorage due to the cross-domain CORS constraint explained in M1. Both mechanisms coexist safely. |
| `getMe()`, `logout()`, `getUsers()`, `updateTeammates()`, `updatePreferences()`, `completeOnboarding()` | ✅ | All implemented in `frontend/src/services/api.ts` |
| 401 → auto-redirect to `/login` | ✅ | Inside `request()`, a 401 response calls `window.location.href = '/login'` |
| `AuthContext` with `useAuth()` hook | ✅ | `frontend/src/context/AuthContext.tsx` — provides `{ user, loading, logout, refreshUser }` |
| Loading state while `getMe()` is in flight | ✅ | `loading: true` until the first `getMe()` resolves |
| `logout()` → clear user + redirect `/login` | ✅ | |
| Login page: Google OAuth button | ✅ | Button → `${BASE_URL}/auth/google` |
| Dev login form (visible only if `VITE_DEV_LOGIN_ENABLED=true`) | ✅ | Email + password form below the Google button |
| Error display on `?error=unauthorized` | ✅ | Shown when Google rejects a non-@dblue.it account |
| `/login` public, `/*` → `ProtectedRoute` | ✅ | `main.tsx` + `ProtectedRoute.tsx` |
| `ProtectedRoute` redirects unauthenticated users | ✅ | |
| `userName` / `userRole` from the authenticated user (not hardcoded) | ✅ | `App.tsx` maps `user.role` to the internal `UserRole` enum |
| Onboarding shown only when `!user.onboardingCompleted` | ✅ | |
| `onLogout` callback passed to `Profile` | ✅ | |

---

## UI-2 — Working Status from API

| Requirement | Status | Detail |
|-------------|--------|--------|
| `getPresence(month)` | ✅ | `GET /presence?month=YYYY-MM` — returns `DayPresence[]` |
| `upsertStatus(date, payload)` | ✅ | `POST /presence` |
| `bulkUpsertStatus(updates)` | ✅ | `POST /presence/bulk` |
| `updateOffTime(date, offTime)` | ✅ | `PATCH /presence/:date/offtime` |
| `usePresence` hook — optimistic updates + rollback | ✅ | `frontend/src/hooks/usePresence.ts` — saves previous state before any update and restores it if the API call throws |
| Remove `INITIAL_DAYS` from `App.tsx` | ✅ | Data is loaded from the API on mount |
| Load current + next month on mount | ✅ | `Promise.all([getPresence(currentMonth), getPresence(nextMonth)])` |
| Skeleton/loading state while fetching | ✅ | |
| Historical month loading (month navigation) | ✅ | On month-change, calls `getPresence(selectedMonth)` and merges into the days state |
| `useColleagues` with deterministic colour hash | ✅ | `frontend/src/hooks/useColleagues.ts` — maps User IDs to one of 12 Tailwind colours via a hash function |
| Remove hardcoded `COLLEAGUES` import | ✅ | |
| Colleagues used in `DailyDetail` and `Onboarding` from the API | ✅ | |

---

## UI-3 — Check-in, Room Selection, Onboarding, Teammates

| Requirement | Status | Detail |
|-------------|--------|--------|
| `checkIn(date, room?, isUsingDesk?)` | ✅ | `POST /presence/:date/checkin` |
| `getRooms()` | ✅ | `GET /rooms` — returns `Room[]` filtered by the user's role |
| `handleCheckIn` for Remote status | ✅ | Calls `checkIn(date)` without a room after the optimistic UI update |
| Rollback + toast on API error | ✅ | |
| `RoomSelection` populated from `getRooms()` | ✅ | `frontend/src/components/RoomSelection.tsx` |
| Rooms loaded at app mount and passed to components | ✅ | `App.tsx` fetches rooms on mount via `useEffect` |
| Waiting list: no local capacity check — backend decides | ✅ | `App.tsx` sends `IN_OFFICE` and trusts the returned status from the API |
| Onboarding → `updateTeammates()` → `completeOnboarding()` | ✅ | `Onboarding.tsx` calls both in sequence; if either fails, onboarding is not closed |
| Teammates in Profile: add/remove with API persistence | ✅ | `Profile.tsx` + `App.tsx handleUpdateProjectTeammates` |
| Teammates loaded on startup when `onboardingCompleted` | ✅ | `App.tsx` `useEffect` on `user` change |

---

## UI-4 — Stats, Preferences, WebSocket

| Requirement | Status | Detail |
|-------------|--------|--------|
| `getStatsMonthly(month)` | ✅ | `GET /stats/monthly?month=YYYY-MM` |
| `getStatsAnnual(year)` | ✅ | `GET /stats/annual?year=YYYY` |
| `MonthlyStats` and `AnnualStats` interfaces in `api.ts` | ✅ | |
| `Stats` component wired to real API data | ✅ | Monthly target progress bar, status distribution, annual bar chart |
| Bar chart from `monthlyBreakdown` | ✅ | Built with Recharts |
| Director/owner area stats | ✅ | Full `Organisation.tsx` with per-user drill-down and 12-month trend (see extras section) |
| `handleSetThemeMode` → `updatePreferences({ theme })` | ✅ | |
| Notification / accessibility toggles → `updatePreferences(...)` | ✅ | |
| `useWebSocket(onPresenceUpdate)` hook | ✅ | `frontend/src/hooks/useWebSocket.ts` |
| Subscribe to today's date on connect | ✅ | Sends `{ type: 'subscribe', date: today }` on open |
| Auto-reconnect with exponential backoff | ✅ | Delays double on each failure, capped at ~8 s |
| `days` state updated on `presence_update` message | ✅ | `App.tsx` merges updated `bookedCount`, `totalCapacity`, `rooms`, `extras` for the matching date |
| `Day` / `DayPresence` type extended with `rooms[]` and `extras` | ✅ | `types.ts` |

---

## Summary: Gaps (❌ and ⚠️)

### Missing features (❌)

#### 1. Server-side room-type validation at booking
- **Spec reference:** M1 Room Routes — "lab (lab_responsible only), admin (admin_member only), management (director/owner only)"
- **Current state:** `GET /rooms` filters rooms by role correctly. `POST /presence` and `POST /presence/:date/checkin` do not re-validate the room type against the user's role.
- **Risk:** A user with `employee` role can submit a booking for the lab or admin room if they bypass the frontend.
- **To fix:** In `upsertStatus` and the checkin handler, after resolving the target room, check that `user.role` is in the allowed set for that `room.type`. Return 403 if not.

#### 2. Colleague area visibility filtering
- **Spec reference:** M5 RBAC — "employee / lab_responsible / admin_member: see colleagues in own area + own project teammates"
- **Current state:** `getColleaguePresences()` returns all users. No `area` field exists on the User model.
- **Risk:** All roles can see all colleagues' presence, breaking the intended privacy model.
- **To fix:**
  1. Add `area: string` (or a controlled enum) to the User model.
  2. Populate `area` during onboarding or via an admin route.
  3. In `getColleaguePresences()`, filter to `user.area === requestingUser.area`, then always include all `requestingUser.teammates` regardless of area.

#### 3. Standard unbooking tracking
- **Spec reference:** M5 Stats — "`unbooking.standard`: in_office/waiting_list cancelled before the last-minute window"
- **Current state:** `unbooking.standard` is hardcoded to `0`. Only `isLastMinuteUnbooking` (same-day or next-day cancellation) is tracked.
- **Risk:** Stats show 0 standard unbookings even when users regularly cancel ahead of time.
- **To fix:** Add a `wasUnbooked: boolean` field to the WorkingStatus model. Set it to `true` in `upsertStatus` whenever a booking is removed (any timing). In `getMonthlyStats`, compute `standard = count where wasUnbooked AND NOT isLastMinuteUnbooking`.

### Deviations (⚠️)

#### 4. JWT in sessionStorage instead of httpOnly cookie
- **Spec reference:** M1 — "Cookie-based session (httpOnly, sameSite: lax, secure in prod)"
- **Reason:** Railway deploys frontend and backend on different subdomains. Browsers block `SameSite=lax` cookies on cross-origin requests. The workaround — storing the JWT in sessionStorage and sending it as `Authorization: Bearer` — was chosen deliberately. sessionStorage is cleared when the tab closes, limiting the XSS exposure window compared to localStorage.
- **Action needed:** None unless both services are moved to the same origin (e.g., via a reverse proxy). If that happens, remove the sessionStorage logic and rely solely on the httpOnly cookie.

---

## Summary: Extras (➕)

Everything below was implemented beyond the original spec. For each item, the reason it was added is explained.

| Extra | Where | Why |
|-------|-------|-----|
| `GET /presence/:date/colleagues` | `presence.routes.ts` | `DailyDetail.tsx` needs to show who is in the office on a specific day. The monthly `GET /presence?month=…` response includes up to 10 colleague avatars, but the detail view requires the full list with names, rooms and confirmation status. Rather than re-fetching the full month, a dedicated date-scoped endpoint was added. |
| `GET /admin/stats/:userId/monthly` | `admin.routes.ts` | `Organisation.tsx` implements a per-colleague drill-down for directors. It needs to fetch any user's monthly stats, which is not exposed by the user-scoped `GET /stats/monthly`. |
| `POST /admin/seed` | `admin.routes.ts` | Automated test data generation for demo and development. The seed service creates 80+ users with realistic presence patterns spanning 13 months. Without this, QA and demos require manual data entry. |
| Full `Organisation.tsx` component | `frontend/src/` | The original spec said to "add a placeholder note for director/owner area aggregates". The full component was built instead, including a 12-month adherence trend line and per-colleague drill-down. This goes beyond spec but was already designed in the prototype. |
| `AdminBar.tsx` | `frontend/src/` | Provides a UI button to trigger the seed endpoint. Avoids needing curl or Postman during demos. Only visible to owner/director roles. |
| 5 extra notification preference fields | `user.model.ts` | `statusReminder11`, `statusReminder18`, `projectTeammateBooking`, `monthlyOverview`, `newActivity` — added to the Profile UI to plan for future push/email notifications. The toggles are wired to `updatePreferences` and persisted, but no backend trigger exists yet. |
| 2 extra accessibility fields | `user.model.ts` | `screenReader` and `highContrast` — supported by the frontend Profile UI and CSS classes; not in the original spec but complementary to the specified `reducedMotion` and `textSize`. |
| Seed service (`backend/src/services/seed.service.ts`) | backend | A 300-line deterministic data generator using a seeded PRNG. Produces reproducible datasets for testing. Not called during normal operation — only via `POST /admin/seed`. |

---

## Action Items by Priority

| Priority | Issue | Files to change |
|----------|-------|-----------------|
| 🔴 High | Server-side room-type validation at booking | `working-status.service.ts:upsertStatus`, `presence.routes.ts` (checkin handler) |
| 🟡 Medium | Add `area` field to User model + filter `getColleaguePresences()` | `user.model.ts`, `working-status.service.ts:getColleaguePresences`, migration script |
| 🟡 Medium | Standard unbooking tracking (`wasUnbooked` flag) | `working-status.model.ts`, `working-status.service.ts:upsertStatus`, `stats.service.ts:getMonthlyStats` |
| 🟢 Low | Implement email triggers for extra notification types (statusReminder, teammate booking, monthly overview) | `email.service.ts`, `scheduler.ts`, `working-status.service.ts` |
| ℹ️ Decision | JWT in sessionStorage vs. httpOnly cookie | No action unless the services are co-located on the same origin |
