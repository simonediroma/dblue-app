# Presence App — Technical Guide

> Version: 2026-06-18 | Stack: Node 20 · React 19 · MongoDB 7 · Railway → GCP

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Backend — API & Services](#3-backend--api--services)
   - [Routes & Endpoints](#31-routes--endpoints)
   - [Data Models](#32-data-models)
   - [Services](#33-services)
   - [Middleware](#34-middleware)
   - [Configuration](#35-configuration)
4. [Frontend — UI & Functionality](#4-frontend--ui--functionality)
   - [Application Tabs](#41-application-tabs)
   - [Components](#42-components)
   - [Hooks](#43-hooks)
   - [API Client](#44-api-client)
   - [Types & Enums](#45-types--enums)
5. [Infrastructure](#5-infrastructure)
   - [Local Development](#51-local-development)
   - [Current Production — Railway](#52-current-production--railway)
   - [CI/CD Pipeline](#53-cicd-pipeline)
   - [Environment Variables Reference](#54-environment-variables-reference)
6. [Migration to GCP](#6-migration-to-gcp)
   - [Architecture Overview](#61-architecture-overview)
   - [Step 1 — GCP Project & IAM](#62-step-1--gcp-project--iam)
   - [Step 2 — MongoDB Atlas (unchanged)](#63-step-2--mongodb-atlas-unchanged)
   - [Step 3 — Artifact Registry & Cloud Build](#64-step-3--artifact-registry--cloud-build)
   - [Step 4 — Deploy Backend to Cloud Run](#65-step-4--deploy-backend-to-cloud-run)
   - [Step 5 — Deploy Frontend to Cloud Run](#66-step-5--deploy-frontend-to-cloud-run)
   - [Step 6 — Secrets Manager](#67-step-6--secrets-manager)
   - [Step 7 — Cloud Load Balancer & Custom Domain](#68-step-7--cloud-load-balancer--custom-domain)
   - [Step 8 — Cloud Build CI/CD](#69-step-8--cloud-build-cicd)
   - [Step 9 — Monitoring & Logging](#610-step-9--monitoring--logging)
   - [Step 10 — Cost Estimate](#611-step-10--cost-estimate)
   - [Rollback Plan](#612-rollback-plan)

---

## 1. Application Overview

**Presence** is an office planner web application for the DBLue company. It allows employees to declare their daily working status (in office, remote, mission, leave, sick), book a desk in a specific room, track colleagues' presence, and view personal and team statistics.

**Core capabilities:**

| Feature | Description |
|---------|-------------|
| Daily status declaration | Choose from 9 working statuses per day |
| Desk booking | Reserve a seat in a specific room; capacity enforced per room |
| Waiting list | Automatic FIFO promotion when a slot frees up |
| Check-in | Confirm physical presence on the day (room + desk selection) |
| Real-time updates | WebSocket pushes presence changes instantly to all connected clients |
| Statistics | Personal monthly/annual breakdown + team area stats (directors only) |
| Retrofit | Directors/owners can correct past status entries |
| Email notifications | Waiting-list promotion and sick-leave confirmation emails |
| Role-based access | 5 roles gate admin features and stats visibility |
| Preferences | Per-user theme, accessibility settings, and teammate list |

---

## 2. Monorepo Structure

```
dblue-app/
├── backend/                     # Node 20 + Express REST API + WebSocket server
│   ├── src/
│   │   ├── app.ts               # Express factory: CORS, routes, error handler
│   │   ├── index.ts             # Server startup: DB connect, WS init, cron
│   │   ├── models/              # Mongoose schemas (User, Room, WorkingStatus)
│   │   ├── routes/              # auth, users, rooms, presence, stats, admin
│   │   ├── services/            # Business logic (working-status, capacity, email, stats, ws, change-stream)
│   │   ├── middleware/          # auth.middleware.ts, rbac.middleware.ts
│   │   ├── config/              # jwt.ts, passport.ts
│   │   └── __tests__/           # Jest unit tests (6 suites)
│   ├── Dockerfile               # Multi-stage Node 20 Alpine build
│   ├── railway.toml             # Railway deploy config (healthcheck /health)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                    # React 19 + TypeScript + Vite 6 SPA
│   ├── src/
│   │   ├── App.tsx              # Root component (~1400 lines): state, tabs, modals
│   │   ├── main.tsx             # React entry point, AuthProvider wrapper
│   │   ├── components/          # Layout, DayCard, DailyDetail, RoomSelection, Onboarding, Stats, Profile, etc.
│   │   ├── hooks/               # useAuth, usePresence, useWebSocket, useColleagues
│   │   ├── services/api.ts      # Centralized API client (all fetch calls)
│   │   ├── context/             # AuthContext (user state, logout, refreshUser)
│   │   ├── pages/               # Login page
│   │   └── types/               # API interfaces, WorkStatus enum, DayPresence, etc.
│   ├── nginx/default.conf       # SPA routing (try_files → index.html), gzip
│   ├── Dockerfile               # Multi-stage: Vite build → nginx Alpine
│   ├── railway.toml             # Railway deploy config (healthcheck /)
│   ├── vite.config.ts           # Vite 6 + Tailwind v4 plugin
│   ├── package.json
│   └── tsconfig.json
│
├── e2e/                         # Playwright end-to-end tests
│   ├── tests/                   # 9 spec files (auth, plan, checkin, stats, rbac, …)
│   ├── fixtures/                # Auth fixture (dev-login helper)
│   ├── playwright.config.ts
│   └── package.json
│
├── presence---office-planner/   # READ-ONLY — AI Studio UI prototype (reference only)
│
├── docs/                        # Technical documentation
│   ├── architecture.md          # Stack, infra, env vars, endpoint list
│   ├── lessons.md               # Patterns, anti-patterns, past decisions
│   └── technical-guide.md       # ← this file
│
├── prompts/                     # Claude Code prompt templates per macro (M1–M6, UI-1–UI-4)
├── docker-compose.yml           # Local: MongoDB 7 replica set (rs0)
├── .env.example                 # All environment variables with comments
├── .github/workflows/e2e.yml    # GitHub Actions CI: Playwright on main
├── CLAUDE.md                    # Dev guidelines (Karpathy rules + session protocol)
└── CLAUDE_MEMORY.md             # Session state — gitignored, updated by Claude each session
```

---

## 3. Backend — API & Services

**Runtime:** Node.js 20, TypeScript (strict), compiled to CommonJS (`dist/`).  
**Framework:** Express 4, Mongoose 8.9, Passport.js (Google OAuth 2.0), `ws` (WebSocket).

### 3.1 Routes & Endpoints

#### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Liveness probe — returns `{ status: "ok" }` |

#### Authentication — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/google` | None | Redirect to Google OAuth consent screen |
| GET | `/auth/google/callback` | None | OAuth callback; validates `@dblue.it` domain; issues JWT cookie |
| POST | `/auth/dev-login` | None | Dev fallback (requires `ENABLE_DEV_LOGIN=true`); accepts email + password from env |
| GET | `/auth/me` | JWT | Returns current user profile |
| POST | `/auth/logout` | JWT | Clears JWT cookie |

#### Users — `/users`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/users` | JWT | all | List/search users (`?search=` optional) |
| PATCH | `/users/me/teammates` | JWT | all | Set up to 5 teammate user IDs |
| PATCH | `/users/me/preferences` | JWT | all | Save theme, notifications, accessibility flags |
| PATCH | `/users/me/onboarding` | JWT | all | Mark onboarding as completed |

#### Rooms — `/rooms`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/rooms` | JWT | all | List rooms (filtered by user role) |
| POST | `/rooms` | JWT | owner | Create a new room |
| PATCH | `/rooms/:id` | JWT | owner | Update room (blocked if active bookings exist) |
| DELETE | `/rooms/:id` | JWT | owner | Deactivate room |

Default rooms seeded at startup:

| Room | Type | Capacity |
|------|------|----------|
| Red | open_space | 20 |
| Green | open_space | 20 |
| Blue | open_space | 20 |
| DBLue Innovation Lab | lab | 15 |
| Admin | admin | 8 |
| Management | management | 6 |

#### Presence — `/presence`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/presence` | JWT | all | User's statuses for a month (`?month=YYYY-MM`) |
| POST | `/presence` | JWT | all | Upsert a status for a date; auto-assigns WAITING_LIST if room is full |
| POST | `/presence/bulk` | JWT | all | Batch upsert statuses for multiple dates |
| GET | `/presence/:date/offtime` | JWT | all | Get off-time configuration for a date |
| PATCH | `/presence/:date/offtime` | JWT | all | Set off-time (morning / afternoon / custom hours) |
| DELETE | `/presence/:date/offtime` | JWT | all | Remove off-time entry |
| POST | `/presence/:date/checkin` | JWT | all | Confirm physical presence; optionally set room + desk |
| GET | `/presence/:date/colleagues` | JWT | all | List colleagues provisionally in office on a date |
| POST | `/presence/:date/retrofit` | JWT | all | Retroactively correct own past status |

#### Statistics — `/stats`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/stats/monthly` | JWT | all | Personal monthly stats (`?month=YYYY-MM`) |
| GET | `/stats/annual` | JWT | all | Personal annual stats (`?year=YYYY`) |
| GET | `/stats/area` | JWT | director, owner | Team area aggregate stats (`?month=YYYY-MM`) |

#### Admin — `/admin`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/admin/retrofit/:userId/:date` | JWT | director, owner | Retrofit another user's status |
| GET | `/admin/users` | JWT | director, owner | List all users with roles |
| PATCH | `/admin/users/:userId/role` | JWT | owner | Change a user's role |
| GET | `/admin/stats/:userId/monthly` | JWT | director, owner | Monthly stats for specific user |
| POST | `/admin/seed` | JWT | owner | Seed DB with test data (`?fresh=true` wipes first) |

---

### 3.2 Data Models

#### User

```typescript
{
  googleId: string           // Google OAuth subject identifier
  email: string              // Must be @dblue.it
  name: string
  avatar?: string            // Google profile picture URL
  role: 'employee' | 'lab_responsible' | 'admin_member' | 'director' | 'owner'
  teammates: ObjectId[]      // Max 5 — used in Plan view for quick visibility
  contract: {
    presenceDaysTarget: number  // Required days in office per month
  }
  preferences: {
    theme: 'light' | 'dark' | 'system'
    notifications: {
      waitingListPromotion: boolean
      statusReminder: boolean
      weeklyDigest: boolean
      checkinReminder: boolean
      teamChanges: boolean
      adminAlerts: boolean
      emailSummary: boolean
    }
    accessibility: {
      reducedMotion: boolean
      largeText: boolean
      screenReader: boolean
      highContrast: boolean
    }
  }
  onboardingCompleted: boolean
  timestamps: true
}
```

Index: `{ email: 1 }` unique.

#### Room

```typescript
{
  name: string
  capacity: number
  type: 'open_space' | 'lab' | 'admin' | 'management'
  isActive: boolean
  createdBy: ObjectId
  timestamps: true
}
```

Index: `{ type: 1, isActive: 1 }`.

#### WorkingStatus

```typescript
{
  userId: ObjectId
  date: string               // YYYY-MM-DD (stored as string for query simplicity)
  status: WorkStatusEnum
  isConfirmed: boolean       // true after check-in
  confirmedAt?: Date
  room?: string              // Room name at time of booking
  isUsingDesk: boolean       // false → OFFICE_NO_DESK (doesn't count against capacity)
  offTime?: {
    type: 'morning' | 'afternoon' | 'custom'
    hours?: number           // Only for 'custom'
  }
  isRetrofit: boolean        // Edited after the day passed
  isLastMinuteUnbooking: boolean  // Cancelled today or tomorrow
  timestamps: true
}
```

Status values:

| Value | Meaning |
|-------|---------|
| `in_office` | Present at office with desk |
| `remote` | Working from home |
| `mission` | External business trip |
| `leave` | Vacation / paid leave |
| `sick` | Sick leave |
| `parental_leave` | Parental leave |
| `waiting_list` | Room full — queued for promotion |
| `office_no_desk` | In office but no desk booked |
| `pending` | No declaration yet |

Indexes: `{ userId: 1, date: 1 }` unique · `{ date: 1, status: 1 }`.

---

### 3.3 Services

#### working-status.service.ts

Core business logic for all presence operations.

- **`upsertStatus(userId, date, { status, isUsingDesk, room })`** — Creates or updates a status. If `isUsingDesk=true` and the room is at capacity, automatically sets `status=waiting_list`. Triggers Change Stream broadcast via MongoDB.
- **`bulkUpsertStatus(userId, updates[])`** — Sequential upserts for multiple dates (no transactions; idempotent by design).
- **`updateOffTime(userId, date, offTime | null)`** — Sets or clears the off-time block for a date.
- **`retrofitStatus(userId, date, { status, offTime })`** — Modifies a past date; marks `isRetrofit=true`.
- **`getColleaguePresences(date, userId)`** — Returns colleagues with `in_office`, `waiting_list`, or `office_no_desk` status on the given date, filtered by RBAC.
- **`isLastMinute(date)`** — Returns `true` if the date is today or tomorrow.

#### capacity.service.ts

Tracks desk capacity per room per date.

- **`isCapacityAvailable(date, roomName)`** — Counts `WorkingStatus` docs with `{ date, room: roomName, status: in_office, isUsingDesk: true }`. Returns `true` if count < room.capacity.
- **`promoteFromWaitingList(date, room)`** — Finds the oldest `waiting_list` entry for the date+room, promotes it to `in_office`, saves, and calls `emailService.sendWaitingListPromotion()`.

#### email.service.ts

Transactional email with graceful dev fallback.

- **Pattern:** `emailEnabled = !!process.env.SMTP_HOST`. If SMTP is not configured, every send function logs to console instead of throwing.
- **`sendWaitingListPromotion(to, date)`** — HTML email notifying the user they've been promoted from the waiting list.
- **`sendSickLeaveConfirmation(to, date)`** — Confirmation email for sick leave registration.
- Fire-and-forget: callers do not `await` email sends.

#### stats.service.ts

- **`getMonthlyStats(userId, month)`** — Returns: `presenceDaysConfirmed`, `presenceDaysTarget`, `distribution { inOffice, remote, mission, leave, sick }`, `unbooking { standard, lastMinute }`.
- **`getAnnualStats(userId, year)`** — Returns: `monthlyBreakdown[]`, `totalUnbooking`, `averageMonthlyPresenceDays`.
- **`getAreaStats(month, user)`** — Team aggregate (director/owner only): team presence rate, per-member breakdown.

#### websocket.service.ts

Real-time presence broadcasting.

- **Pattern:** `WebSocketServer` attached to the Express HTTP server at path `/ws`. Room key = date string (YYYY-MM-DD). Per-room `Set<WebSocket>` tracks subscribers.
- **`broadcastToDate(date, payload)`** — Serializes and sends to all sockets subscribed to that date room.
- **Heartbeat:** `ping()` every 30 seconds; sockets that don't respond with `pong` within 30 s are terminated and removed.
- **Payload schema:**
  ```json
  {
    "type": "presence_update",
    "data": {
      "date": "2026-06-18",
      "rooms": [
        { "name": "Red", "booked": 12, "capacity": 20 },
        { "name": "Green", "booked": 8, "capacity": 20 }
      ],
      "extras": 2,
      "totalBooked": 22,
      "totalCapacity": 65
    }
  }
  ```

#### change-stream.service.ts

Bridges MongoDB to WebSocket.

- Attaches a Change Stream to the `WorkingStatus` collection.
- On `insert`, `update`, or `replace`: recalculates capacity for the affected date and calls `broadcastToDate`.
- **Requirement:** MongoDB must run as a replica set (local `rs0` via docker-compose, or Atlas M10+).

---

### 3.4 Middleware

#### auth.middleware.ts — `requireAuth`

Extracts JWT from:
1. `Authorization: Bearer <token>` header
2. `token` httpOnly cookie

Verifies signature with `JWT_SECRET`, loads `User` from DB, attaches to `req.user`. Returns 401 if missing or invalid.

#### rbac.middleware.ts — `requireRole(...roles)`

Checks `req.user.role` against the allowed role list. Returns 403 with `{ error: "Forbidden" }` if the user's role is not in the list. Used as a composable Express middleware factory:

```typescript
router.get('/stats/area', requireAuth, requireRole('director', 'owner'), handler)
```

---

### 3.5 Configuration

#### config/jwt.ts

- `signToken(userId)` — Signs a JWT with `JWT_SECRET`, 7-day expiry, subject = userId.
- `verifyToken(token)` — Verifies and decodes; throws `JsonWebTokenError` on invalid.

#### config/passport.ts

- Google OAuth 2.0 strategy.
- **Domain validation:** callback rejects any email not ending in `@dblue.it` — explicit guard, not relying on Google's hosted domain filter.
- On first login: creates `User` document. On subsequent logins: updates `name` and `avatar`.
- After validation: calls `done(null, user)` to attach user to request.

---

## 4. Frontend — UI & Functionality

**Runtime:** React 19, TypeScript (strict), Vite 6, Tailwind CSS v4.  
**Served by:** nginx (production) / Vite dev server (development).

The SPA is a single-page application. Routing is minimal: `/login` for unauthenticated users, `/` for the main app (protected). All main navigation is tab-based inside `App.tsx`.

---

### 4.1 Application Tabs

#### Plan Tab (`tab = 'plan'`)

The primary view. Displays a calendar of the current and next month.

**Layout:**
- Two-column grid of day cards, one row per week.
- Today's card is full-width and highlighted.
- Past dates are grayed out (reduced opacity) but still interactive for retrofit.

**Day Card information:**
- Weekday name and day number.
- Status icon + status label (color-coded).
- Booked count vs. total capacity (e.g., "12 / 65").
- Up to 3 colleague avatar initials (teammates or all colleagues in office).
- "Waiting list" badge if the user is queued.
- "Checked in" badge if `isConfirmed=true`.

**Interactions:**
- **Single click** → opens `DailyDetail` modal for that day.
- **Double click** → quick toggle: books IN_OFFICE (or cancels if already booked).

**Real-time:** WebSocket messages update `bookedCount` and room availability without page refresh.

**FAB buttons:**
- **"Say Good Morning"** — visible only on weekdays where the user has an `in_office` status but hasn't checked in yet. Triggers the check-in flow.
- **"Back to today"** — appears when the user has scrolled away from today; scrolls back.

---

#### DailyDetail Modal

Opened by clicking any day card. A full-screen modal with two internal tabs:

**VIEW tab — Status declaration:**

- Status picker: 9 buttons (IN_OFFICE, REMOTE, MISSION, LEAVE, SICK, PARENTAL_LEAVE, OFFICE_NO_DESK, WAITING_LIST auto-assigned, PENDING).
- Off-time section: toggle morning / afternoon / custom hours off.
- Bulk-extend pattern: "Apply to next N days" button repeats the same status across multiple weekdays.
- Readonly display: `bookedCount / totalCapacity`, colleague names in office.

**WORKSPACE tab — Desk & room:**

- Shows only when status is `in_office` or `office_no_desk`.
- Room selection grid (card per room with capacity bar).
- "Use a desk" toggle — if off, sets `isUsingDesk=false` (OFFICE_NO_DESK, doesn't consume capacity).
- Desk number field (optional free text — for future assigned-desk feature).

**Save behavior:**
- Calls `upsertStatus` via `usePresence`.
- Optimistic update: state changes immediately, reverts on API error with toast notification.

---

#### Stats Tab (`tab = 'stats'`)

Personal productivity dashboard.

**Monthly view:**
- Recharts bar chart: IN_OFFICE / REMOTE / MISSION / LEAVE / SICK distribution.
- Presence days counter: confirmed days vs. monthly target (from `contract.presenceDaysTarget`).
- Last-minute unbooking count (penalizable metric).

**Annual view:**
- Monthly breakdown table.
- Total unbookings for the year.
- Average monthly presence days.

**Area stats (directors/owners only):**
- Aggregated team view: presence rate per area, member-by-member breakdown.
- Accessible only when `user.role` is `director` or `owner`.

---

#### Profile Tab (`tab = 'profile'`)

Personal settings, persisted to the backend.

**Theme:**
- Light / Dark / System (follows OS preference).
- Applied via `dark` class on `<html>` root.

**Accessibility:**
- Reduced motion (disables CSS transitions and animations).
- Large text (increases base font size).
- Screen reader mode (adds extra ARIA labels).
- High contrast (alternate color palette with stronger contrast ratios).

**Teammates:**
- Button opens a modal listing all users.
- Select up to 5 teammates; their avatars appear on day cards for quick visibility.
- Saved via `PATCH /users/me/teammates`.

**Logout:**
- Calls `POST /auth/logout`, clears local JWT, redirects to `/login`.

---

#### Organisation Tab (`tab = 'organisation'`)

Team and floor plan visualization.

- Colleague cards grid: shows all users with their role and today's status.
- Project team section: highlights the user's 5 selected teammates.
- Floor plan placeholder: room layout visual (static mock in current version).

---

#### Onboarding Flow

Shown once on first login (`user.onboardingCompleted = false`).

1. Welcome screen explaining the app.
2. Teammate picker (same modal as Profile > Teammates).
3. Completion → calls `PATCH /users/me/onboarding`; sets `onboardingCompleted=true`; dismisses flow.

---

#### Check-in Flow

Triggered from the FAB "Say Good Morning" or from the DailyDetail WORKSPACE tab.

1. `RoomSelection` component shows available rooms with current occupancy.
2. User selects a room (and optionally a desk toggle).
3. Calls `POST /presence/:date/checkin`.
4. On success: `isConfirmed=true` in state; badge appears on day card.

---

### 4.2 Components

| Component | File | Description |
|-----------|------|-------------|
| `Layout` | `components/Layout.tsx` | Tab bar, top header, content wrapper |
| `DayCard` | `components/DayCard.tsx` | Single calendar cell: status, count, avatars |
| `DailyDetail` | `components/DailyDetail.tsx` | Full modal: VIEW + WORKSPACE tabs, status picker, off-time, bulk extend |
| `RoomSelection` | `components/RoomSelection.tsx` | Room picker grid for check-in |
| `Onboarding` | `components/Onboarding.tsx` | First-time user wizard |
| `Stats` | `components/Stats.tsx` | Charts, monthly/annual/area stats |
| `Profile` | `components/Profile.tsx` | Theme, accessibility, teammates, logout |
| `Organisation` | `components/Organisation.tsx` | Colleague cards, team view |
| `AdminBar` | `components/AdminBar.tsx` | Admin panel / dev tools (owner role) |
| `Alert` | `components/Alert.tsx` | Toast notification (success / error / info) |
| `SplashScreen` | `components/SplashScreen.tsx` | Loading state while auth resolves |
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | Auth guard: redirects to `/login` if no user |

---

### 4.3 Hooks

#### `useAuth()` — `context/AuthContext.tsx`

Provides authentication state globally.

- On mount: checks URL for `?token=` param (post-OAuth redirect), stores in `localStorage`, then fetches `GET /auth/me`.
- Returns `{ user, loading, logout(), refreshUser() }`.
- Returns `null` user on 401 → `ProtectedRoute` redirects to `/login`.

#### `usePresence(months[])` — `hooks/usePresence.ts`

Manages presence data for the given months.

- Fetches `GET /presence?month=` for each month on mount and when months change.
- **Optimistic updates:** `updateStatus(date, params)` updates local state immediately, then calls `POST /presence`. On error: reverts state + shows toast.
- **`bulkUpdateStatus(dates[], params)`** — Same pattern for bulk extend.
- **`updateOffTime(date, offTime)`** — Patches off-time, optimistic.
- Returns `{ days[], loading, error, setDays, updateStatus, bulkUpdateStatus, updateOffTime }`.

#### `useWebSocket(onPresenceUpdate)` — `hooks/useWebSocket.ts`

Manages the WebSocket connection.

- Connects to `${VITE_API_URL.replace('http','ws')}/ws` on mount.
- Sends `{ type: "subscribe", date: "YYYY-MM-DD" }` for today's date after connection.
- On `presence_update` message: calls `onPresenceUpdate(data)` to refresh capacity on day cards.
- **Reconnection:** exponential backoff — 1 s → 2 s → 4 s → 8 s (cap). Resets on successful connect.
- Auto-cleanup (`ws.close()`) on component unmount.

#### `useColleagues()` — `hooks/useColleagues.ts`

Loads the full user list for avatar display.

- Fetches `GET /users` once on mount.
- Maps to `Colleague[]` with: name, surname, initials, deterministic color (hash of user ID → HSL).
- On fetch failure: returns empty array (never throws); error is logged to console.

---

### 4.4 API Client

**`services/api.ts`** — All HTTP calls centralized. Base URL from `import.meta.env.VITE_API_URL` (fallback: `http://localhost:4000`).

Every call sends:
```
Authorization: Bearer <token>   (from localStorage)
credentials: 'include'          (sends httpOnly cookie as fallback)
Content-Type: application/json
```

**Methods:**

```typescript
getMe()                                     // GET /auth/me
logout()                                    // POST /auth/logout
getUsers(search?)                           // GET /users[?search=]
updateTeammates(ids: string[])              // PATCH /users/me/teammates
updatePreferences(prefs)                    // PATCH /users/me/preferences
completeOnboarding()                        // PATCH /users/me/onboarding
getPresence(month: string)                  // GET /presence?month=YYYY-MM
upsertStatus(date, { status, isUsingDesk?, room? })  // POST /presence
bulkUpsertStatus(updates[])                 // POST /presence/bulk
checkIn(date, room?, isUsingDesk?)          // POST /presence/:date/checkin
updateOffTime(date, offTime | null)         // PATCH /presence/:date/offtime
getRooms()                                  // GET /rooms
getStatsMonthly(month)                      // GET /stats/monthly?month=YYYY-MM
getStatsAnnual(year)                        // GET /stats/annual?year=YYYY
getColleaguePresence(date)                  // GET /presence/:date/colleagues
triggerSeed(fresh?)                         // POST /admin/seed[?fresh=true]
```

---

### 4.5 Types & Enums

**`types/api.ts`** — Mirror of backend User interface (for TypeScript safety across the boundary).

**`types.ts`** — Frontend-specific:

```typescript
enum WorkStatus {
  IN_OFFICE = 'in_office',
  REMOTE = 'remote',
  MISSION = 'mission',
  LEAVE = 'leave',
  SICK = 'sick',
  PARENTAL_LEAVE = 'parental_leave',
  PENDING = 'pending',
  WAITING_LIST = 'waiting_list',
  OFFICE_NO_DESK = 'office_no_desk',
}

enum UserRole { DIRECTOR = 'director', EMPLOYEE = 'employee', ... }

enum OffTimeType { MORNING = 'morning', AFTERNOON = 'afternoon', CUSTOM = 'custom' }

interface DayPresence {
  date: string              // YYYY-MM-DD
  dayName: string           // 'Monday', etc.
  status: WorkStatus
  bookedCount: number       // Desks used in the room
  totalCapacity: number
  colleagueAvatars: ColleagueAvatar[]
  isCheckedIn: boolean      // isConfirmed from DB
  room?: string
  isPast: boolean
  isToday: boolean
  offTime?: OffTime
  isRetrofit: boolean
  isLastMinuteUnbooking: boolean
}

interface PresenceUpdate {  // WebSocket payload data field
  date: string
  rooms: { name: string; booked: number; capacity: number }[]
  extras: number
  totalBooked: number
  totalCapacity: number
}
```

---

## 5. Infrastructure

### 5.1 Local Development

**Requirements:** Docker Desktop, Node 20, npm 10+.

**Start MongoDB replica set:**
```bash
docker compose up -d
# Wait ~10 s for mongo-init to complete replica set initialization
```

`docker-compose.yml` defines:
- `mongo` service: MongoDB 7, port 27017, replica set `rs0`, named volume `mongo_data`.
- `mongo-init` service: one-shot container that runs `rs.initiate()` after the mongo health check passes.

**Start backend:**
```bash
cd backend
cp ../.env.example .env   # Fill in MONGODB_URI, JWT_SECRET, etc.
npm install
npm run dev               # tsx watch on src/
```

**Start frontend:**
```bash
cd frontend
echo "VITE_API_URL=http://localhost:4000" > .env.local
npm install
npm run dev               # Vite on http://localhost:3000
```

**Backend npm scripts:**

| Script | Command |
|--------|---------|
| `dev` | `tsx watch src/index.ts` |
| `build` | `tsc` |
| `start` | `node dist/index.ts` |
| `lint` | `eslint src/` |
| `test` | `jest --forceExit` |

**Frontend npm scripts:**

| Script | Command |
|--------|---------|
| `dev` | `vite` |
| `build` | `tsc --noEmit && vite build` |
| `lint` | `eslint src/` |
| `preview` | `vite preview` |

---

### 5.2 Current Production — Railway

Both services are deployed as Docker containers on [Railway](https://railway.app).

```
Railway Project
├── backend service
│   ├── Source: Dockerfile (backend/)
│   ├── Health check: GET /health (30 s timeout, 3 retries)
│   ├── Restart policy: on-failure, max 3×
│   └── Env vars: MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
│                 APP_URL, BACKEND_URL, NODE_ENV=production, (SMTP_* optional)
│
└── frontend service
    ├── Source: Dockerfile (frontend/)
    ├── Build arg: VITE_API_URL = public backend URL
    ├── Health check: GET / (30 s timeout)
    └── Served by nginx on $PORT (Railway injects)
```

MongoDB is **not** hosted on Railway. The project uses **MongoDB Atlas** (M10+ cluster required for Change Streams support). The `MONGODB_URI` env var in the Railway backend service points to the Atlas connection string.

**Deploy flow:**
```
git push origin main  →  Railway detects push  →  Docker build  →  Container swap
```

No downtime strategy: Railway performs rolling restarts (one new container starts, health-checks pass, old container stops).

---

### 5.3 CI/CD Pipeline

**File:** `.github/workflows/e2e.yml`

**Triggers:** push to `main`, manual dispatch.

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup Node 20
      - npm install (e2e/)
      - npx playwright install --with-deps chromium
      - npx playwright test
    env:
      BASE_URL:        ${{ secrets.BASE_URL }}         # Railway frontend URL
      API_BASE_URL:    ${{ secrets.API_BASE_URL }}     # Railway backend URL
      DEV_LOGIN_USER:  ${{ secrets.DEV_LOGIN_USER }}
      DEV_LOGIN_PASS:  ${{ secrets.DEV_LOGIN_PASS }}
```

Artifacts: Playwright HTML report (7-day retention).

**E2E test suites:**

| File | Coverage |
|------|----------|
| `auth.spec.ts` | Dev-login flow, session persistence, 401 redirect |
| `plan.spec.ts` | Day card interactions, month navigation |
| `daily-detail.spec.ts` | Modal open/close, status change, bulk extend |
| `checkin.spec.ts` | Room selection, check-in confirmation |
| `onboarding.spec.ts` | Teammate picker, onboarding completion |
| `working-status.spec.ts` | Status change lifecycle, off-time |
| `stats.spec.ts` | Stats page render, chart presence |
| `profile.spec.ts` | Theme toggle, accessibility, logout |
| `rbac.spec.ts` | Director vs. employee role gating |

---

### 5.4 Environment Variables Reference

#### Backend

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/presence` | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | `openssl rand -base64 32` output | Token signing key (32+ chars) |
| `GOOGLE_CLIENT_ID` | Yes* | `123456.apps.googleusercontent.com` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes* | `GOCSPX-…` | Google OAuth client secret |
| `APP_URL` | Yes | `https://presence.dblue.it` | Frontend public URL (CORS origin) |
| `BACKEND_URL` | Yes | `https://api.presence.dblue.it` | Backend public URL (OAuth callback) |
| `PORT` | No | `4000` | Express listen port (injected by Railway/Cloud Run) |
| `NODE_ENV` | No | `production` | Disables dev-login when set to `production` |
| `ENABLE_DEV_LOGIN` | No | `true` | Allow dev-login route (staging only) |
| `DEV_LOGIN_USER` | No | `dev@dblue.it` | Dev-login email |
| `DEV_LOGIN_PASS` | No | `changeme` | Dev-login password |
| `DEV_LOGIN_ROLE` | No | `director` | Dev-login default role |
| `SMTP_HOST` | No | `smtp.sendgrid.net` | Email server host (emails simulated if absent) |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | `apikey` | SMTP username |
| `SMTP_PASS` | No | `SG.xxx` | SMTP password / API key |
| `SMTP_FROM` | No | `noreply@dblue.it` | Sender address |

*Required for Google OAuth. Omit only if using dev-login exclusively (staging).

#### Frontend (build-time)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | `https://api.presence.dblue.it` | Backend public URL (embedded in JS bundle at build time) |
| `VITE_DEV_LOGIN_ENABLED` | No | `false` | Show dev-login form on login page |

> **Important:** `VITE_*` variables are baked into the static JS bundle at `vite build` time. Changing them requires a rebuild and redeploy of the frontend.

---

## 6. Migration to GCP

This section describes a complete migration from Railway to Google Cloud Platform (GCP), targeting a production-ready setup with Cloud Run, Artifact Registry, Cloud Build, Secret Manager, and a Cloud Load Balancer with a custom domain.

### 6.1 Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │                Google Cloud                  │
                    │                                             │
  User → HTTPS → Cloud Load Balancer (SSL cert, custom domain)  │
                    │           │                │                │
                    │    Cloud Run           Cloud Run            │
                    │   (frontend)          (backend)             │
                    │   nginx:$PORT        node:$PORT             │
                    │                           │                 │
                    │                    Secret Manager           │
                    │                    (all env vars)           │
                    │                           │                 │
                    │                    Artifact Registry        │
                    │                    (Docker images)          │
                    │                           │                 │
                    │                    Cloud Build CI/CD        │
                    └─────────────────────────────────────────────┘
                                               │
                                         MongoDB Atlas
                                       (external, unchanged)
```

**Why Cloud Run:**
- Serverless containers: no VM management, auto-scaling to zero, pay-per-request.
- Native Docker support: existing Dockerfiles work unchanged.
- WebSocket support: Cloud Run supports HTTP/2 and WebSocket on the same port.
- Concurrency model: up to 1000 concurrent requests per instance.

---

### 6.2 Step 1 — GCP Project & IAM

```bash
# Create the project
gcloud projects create presence-dblue --name="Presence DBLue"
gcloud config set project presence-dblue

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  certificatemanager.googleapis.com

# Create a service account for Cloud Build
gcloud iam service-accounts create cloud-build-sa \
  --display-name="Cloud Build SA"

# Grant required roles
gcloud projects add-iam-policy-binding presence-dblue \
  --member="serviceAccount:cloud-build-sa@presence-dblue.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding presence-dblue \
  --member="serviceAccount:cloud-build-sa@presence-dblue.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding presence-dblue \
  --member="serviceAccount:cloud-build-sa@presence-dblue.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding presence-dblue \
  --member="serviceAccount:cloud-build-sa@presence-dblue.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

---

### 6.3 Step 2 — MongoDB Atlas (unchanged)

MongoDB Atlas does not move to GCP. The existing Atlas cluster remains the database.

**Action required:** In Atlas, add the Cloud Run outbound IPs (or the NAT gateway IP if you set up Cloud NAT) to the Atlas IP Allowlist. Alternatively, set the allowlist to `0.0.0.0/0` for simplicity (not recommended for sensitive data).

**Recommended:** Set up VPC Peering between GCP VPC and Atlas if you want private connectivity.

---

### 6.4 Step 3 — Artifact Registry & Cloud Build

```bash
# Create Docker repository in Artifact Registry
gcloud artifacts repositories create presence \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Presence app images"

# Authenticate Docker to Artifact Registry
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

Images will be pushed as:
```
europe-west1-docker.pkg.dev/presence-dblue/presence/backend:latest
europe-west1-docker.pkg.dev/presence-dblue/presence/frontend:latest
```

---

### 6.5 Step 4 — Deploy Backend to Cloud Run

**Manual first deploy (to create the service):**

```bash
# Build and push backend image
docker build -t europe-west1-docker.pkg.dev/presence-dblue/presence/backend:latest ./backend
docker push europe-west1-docker.pkg.dev/presence-dblue/presence/backend:latest

# Deploy to Cloud Run
gcloud run deploy presence-backend \
  --image=europe-west1-docker.pkg.dev/presence-dblue/presence/backend:latest \
  --region=europe-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=4000 \
  --min-instances=1 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --set-secrets=\
MONGODB_URI=MONGODB_URI:latest,\
JWT_SECRET=JWT_SECRET:latest,\
GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,\
GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,\
SMTP_HOST=SMTP_HOST:latest,\
SMTP_USER=SMTP_USER:latest,\
SMTP_PASS=SMTP_PASS:latest \
  --set-env-vars=\
NODE_ENV=production,\
PORT=4000,\
APP_URL=https://presence.dblue.it,\
BACKEND_URL=https://api.presence.dblue.it
```

**Important — WebSocket on Cloud Run:**

Cloud Run natively supports WebSocket connections. The existing `ws` server attached to the Express HTTP server on the same port works without changes. Set `--timeout=3600` if you want long-lived WebSocket connections (default 300 s closes idle sockets).

```bash
gcloud run services update presence-backend \
  --region=europe-west1 \
  --timeout=3600
```

**Important — `min-instances=1`:**

Setting `min-instances=1` prevents cold starts for the backend. This is important for MongoDB Change Streams: the change stream listener runs in the Node.js process. If the instance scales to zero, the listener stops. With `min-instances=1` one instance is always warm.

---

### 6.6 Step 5 — Deploy Frontend to Cloud Run

The frontend Dockerfile requires `VITE_API_URL` as a Docker build argument (baked into the JS bundle at build time).

```bash
# Build frontend with the GCP backend URL as build arg
docker build \
  --build-arg VITE_API_URL=https://api.presence.dblue.it \
  -t europe-west1-docker.pkg.dev/presence-dblue/presence/frontend:latest \
  ./frontend

docker push europe-west1-docker.pkg.dev/presence-dblue/presence/frontend:latest

# Deploy frontend
gcloud run deploy presence-frontend \
  --image=europe-west1-docker.pkg.dev/presence-dblue/presence/frontend:latest \
  --region=europe-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=80 \
  --min-instances=0 \
  --max-instances=5 \
  --memory=256Mi \
  --cpu=1
```

The nginx container serves static files — it can scale to zero without issue (no persistent state, no WebSocket).

---

### 6.7 Step 6 — Secrets Manager

Store all sensitive backend environment variables in Secret Manager. Never pass secrets as plain `--set-env-vars`.

```bash
# Create secrets (run once; update with new versions afterward)
echo -n "mongodb+srv://..." | gcloud secrets create MONGODB_URI --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "your-google-client-id" | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
echo -n "smtp.sendgrid.net" | gcloud secrets create SMTP_HOST --data-file=-
echo -n "apikey" | gcloud secrets create SMTP_USER --data-file=-
echo -n "SG.xxx" | gcloud secrets create SMTP_PASS --data-file=-

# Grant Cloud Run service account access to secrets
gcloud projects add-iam-policy-binding presence-dblue \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Secrets are mounted as environment variables in the Cloud Run service via `--set-secrets=VAR=SECRET_NAME:latest` (already shown in Step 4).

**To rotate a secret:**
```bash
echo -n "new-value" | gcloud secrets versions add JWT_SECRET --data-file=-
# Cloud Run automatically picks up the new version on next container start
# (or immediately if you redeploy)
```

---

### 6.8 Step 7 — Cloud Load Balancer & Custom Domain

To serve both frontend and backend under a single custom domain (e.g., `presence.dblue.it` for UI and `api.presence.dblue.it` for API), set up a Cloud Load Balancer with serverless NEGs (Network Endpoint Groups).

```bash
# Reserve a static external IP
gcloud compute addresses create presence-ip \
  --global \
  --ip-version=IPV4

# Get the IP address
gcloud compute addresses describe presence-ip --global --format="value(address)"
# → point DNS A records for presence.dblue.it and api.presence.dblue.it to this IP

# Create serverless NEGs for each Cloud Run service
gcloud compute network-endpoint-groups create neg-frontend \
  --region=europe-west1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=presence-frontend

gcloud compute network-endpoint-groups create neg-backend \
  --region=europe-west1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=presence-backend

# Create backend services
gcloud compute backend-services create bs-frontend --global
gcloud compute backend-services create bs-backend --global

gcloud compute backend-services add-backend bs-frontend \
  --global \
  --network-endpoint-group=neg-frontend \
  --network-endpoint-group-region=europe-west1

gcloud compute backend-services add-backend bs-backend \
  --global \
  --network-endpoint-group=neg-backend \
  --network-endpoint-group-region=europe-west1

# Create URL map (route by hostname)
gcloud compute url-maps create presence-urlmap \
  --default-service=bs-frontend

# Add host rules
gcloud compute url-maps import presence-urlmap --global << 'EOF'
defaultService: bs-frontend
hostRules:
  - hosts: ["presence.dblue.it"]
    pathMatcher: frontend-matcher
  - hosts: ["api.presence.dblue.it"]
    pathMatcher: backend-matcher
pathMatchers:
  - name: frontend-matcher
    defaultService: bs-frontend
  - name: backend-matcher
    defaultService: bs-backend
EOF

# Create managed SSL certificate
gcloud compute ssl-certificates create presence-cert \
  --domains=presence.dblue.it,api.presence.dblue.it \
  --global

# Create HTTPS proxy
gcloud compute target-https-proxies create presence-https-proxy \
  --url-map=presence-urlmap \
  --ssl-certificates=presence-cert

# Create forwarding rule (binds IP to proxy)
gcloud compute forwarding-rules create presence-https-rule \
  --global \
  --target-https-proxy=presence-https-proxy \
  --address=presence-ip \
  --ports=443

# HTTP → HTTPS redirect
gcloud compute url-maps create presence-http-redirect \
  --default-redirect-response-code=301 \
  --default-redirect-https-redirect

gcloud compute target-http-proxies create presence-http-proxy \
  --url-map=presence-http-redirect

gcloud compute forwarding-rules create presence-http-rule \
  --global \
  --target-http-proxy=presence-http-proxy \
  --address=presence-ip \
  --ports=80
```

> SSL certificate provisioning takes 10–60 minutes after DNS propagation.

---

### 6.9 Step 8 — Cloud Build CI/CD

Replace GitHub Actions + Railway auto-deploy with Cloud Build triggers.

**Create `cloudbuild.yaml` at the repo root:**

```yaml
# cloudbuild.yaml
substitutions:
  _REGION: europe-west1
  _PROJECT: presence-dblue
  _BACKEND_URL: https://api.presence.dblue.it
  _APP_URL: https://presence.dblue.it

steps:
  # ── Build backend ──────────────────────────────────────────────
  - name: gcr.io/cloud-builders/docker
    id: build-backend
    args:
      - build
      - -t
      - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/backend:$COMMIT_SHA
      - -t
      - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/backend:latest
      - ./backend

  - name: gcr.io/cloud-builders/docker
    id: push-backend
    waitFor: [build-backend]
    args:
      - push
      - --all-tags
      - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/backend

  # ── Build frontend ─────────────────────────────────────────────
  - name: gcr.io/cloud-builders/docker
    id: build-frontend
    args:
      - build
      - --build-arg
      - VITE_API_URL=${_BACKEND_URL}
      - -t
      - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/frontend:$COMMIT_SHA
      - -t
      - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/frontend:latest
      - ./frontend

  - name: gcr.io/cloud-builders/docker
    id: push-frontend
    waitFor: [build-frontend]
    args:
      - push
      - --all-tags
      - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/frontend

  # ── Deploy backend ─────────────────────────────────────────────
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    id: deploy-backend
    waitFor: [push-backend]
    entrypoint: gcloud
    args:
      - run
      - deploy
      - presence-backend
      - --image=${_REGION}-docker.pkg.dev/${_PROJECT}/presence/backend:$COMMIT_SHA
      - --region=${_REGION}
      - --platform=managed

  # ── Deploy frontend ────────────────────────────────────────────
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    id: deploy-frontend
    waitFor: [push-frontend]
    entrypoint: gcloud
    args:
      - run
      - deploy
      - presence-frontend
      - --image=${_REGION}-docker.pkg.dev/${_PROJECT}/presence/frontend:$COMMIT_SHA
      - --region=${_REGION}
      - --platform=managed

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: E2_HIGHCPU_8

images:
  - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/backend:$COMMIT_SHA
  - ${_REGION}-docker.pkg.dev/${_PROJECT}/presence/frontend:$COMMIT_SHA
```

**Connect the GitHub repository and create a trigger:**

```bash
# Connect repo via Cloud Console UI (required for first-time GitHub connection):
# Console → Cloud Build → Repositories → Connect Repository → GitHub → select simonediroma/dblue-app

# Create trigger for pushes to main
gcloud builds triggers create github \
  --name=deploy-on-main \
  --repo-name=dblue-app \
  --repo-owner=simonediroma \
  --branch-pattern=^main$ \
  --build-config=cloudbuild.yaml \
  --service-account=cloud-build-sa@presence-dblue.iam.gserviceaccount.com
```

Parallel build+push of backend and frontend, then parallel deploy: total pipeline time ≈ 3–5 minutes.

---

### 6.10 Step 9 — Monitoring & Logging

**Cloud Logging** is automatic for Cloud Run. All `console.log` / `console.error` output from the Node.js process appears in Cloud Logging under the `presence-backend` service.

**Set up log-based alerting for errors:**

```bash
# Create a log metric for backend errors
gcloud logging metrics create backend-errors \
  --description="Backend 5xx errors" \
  --log-filter='resource.type="cloud_run_revision" resource.labels.service_name="presence-backend" httpRequest.status>=500'

# Create an alert policy (Cloud Monitoring)
gcloud alpha monitoring policies create \
  --policy-from-file=alerting-policy.json
```

**Recommended alerts:**

| Alert | Condition | Notification |
|-------|-----------|--------------|
| Backend 5xx rate | > 1% of requests | Email / Slack |
| Backend p99 latency | > 2000 ms | Email |
| Cloud Run instance count | > 8 (near max) | Slack |
| Secret access denied | Any `403` from Secret Manager | Email |

**Cloud Run built-in metrics (visible in Cloud Console):**
- Request count, latency (p50/p95/p99), error rate.
- Container instance count, CPU utilization, memory utilization.

**Uptime checks:**

```bash
gcloud monitoring uptime create \
  --display-name="Backend health" \
  --resource-type=uptime-url \
  --hostname=api.presence.dblue.it \
  --path=/health \
  --check-interval=60
```

---

### 6.11 Step 10 — Cost Estimate

Estimates for a team of ~50 users, low-to-medium traffic, `europe-west1` region.

| Service | Config | Est. Monthly Cost |
|---------|--------|-------------------|
| Cloud Run — Backend | 1 min instance, 512 Mi, 1 vCPU | ~$15–25 |
| Cloud Run — Frontend | Scale-to-zero, 256 Mi | ~$0–5 |
| Artifact Registry | ~2 GB Docker images | ~$0.20 |
| Cloud Load Balancer | 1 rule + SSL cert | ~$18 |
| Cloud Build | ~30 builds/month × 5 min | ~$3 |
| Secret Manager | 7 secrets, ~100 accesses/month | ~$0.10 |
| Cloud Logging | Default free tier (first 50 GB/month) | $0 |
| MongoDB Atlas | M10 cluster (external) | ~$57 |
| **Total** | | **~$95–110/month** |

Compare to Railway: ~$20–40/month for both services + Pro plan. GCP costs more but provides enterprise-grade SLAs, granular IAM, and better observability.

**Cost optimization levers:**
- Set `--min-instances=0` on frontend (already done); only backend needs always-on.
- Use `--cpu-throttling` (default on Cloud Run) — CPU throttled when not processing a request.
- Set `--max-instances=3` on backend if traffic is predictable.

---

### 6.12 Rollback Plan

Cloud Run keeps previous revisions. Rolling back takes under 30 seconds.

```bash
# List revisions
gcloud run revisions list --service=presence-backend --region=europe-west1

# Route 100% traffic to a previous revision
gcloud run services update-traffic presence-backend \
  --region=europe-west1 \
  --to-revisions=presence-backend-00042-xyz=100

# Same for frontend
gcloud run services update-traffic presence-frontend \
  --region=europe-west1 \
  --to-revisions=presence-frontend-00038-abc=100
```

**Canary deploy pattern (optional):**

```bash
# Send 10% traffic to new revision, 90% to previous
gcloud run services update-traffic presence-backend \
  --region=europe-west1 \
  --to-revisions=LATEST=10,presence-backend-00042-xyz=90
```

Once validated, route 100% to LATEST:
```bash
gcloud run services update-traffic presence-backend \
  --region=europe-west1 \
  --to-revisions=LATEST=100
```

---

*End of Technical Guide — Presence App*
