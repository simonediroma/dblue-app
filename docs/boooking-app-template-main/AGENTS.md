# AI Starter Prompt — Deep Blue Booking App

## Infrastructure context — read this first

This application is part of **Deep Blue's internal tool infrastructure**. It operates under the `*.dblue.it` subdomain and integrates with a shared backend service called `dblue-office` (running at `tools.dblue.it`).

**Unlike the standard Deep Blue template, this application has its own login screen.** Users do not go to dblue-office to log in. Instead:

1. **@dblue.it users** sign in via **Google Identity Services (GIS)** directly on this app's landing page (`/`).
2. **External users** (non-@dblue.it) sign in via **email + password**. Their accounts are created by an admin in dblue-office with `login_method: "email"`, and they receive a password reset email to set their password.

**What the backend does during login:**
- For Google: the frontend sends a GIS ID token → backend verifies it with `google-auth-library` (checks `hd === "dblue.it"`) → proxies to `dblue-office POST /auth/google/signin` with the verified email → receives the full user profile → signs a **booking-app JWT** via `signBookingToken` (embeds profile fields, stamps `profileSyncedAt`) → sets it as an `httpOnly` cookie.
- For email/password: backend proxies directly to `dblue-office POST /auth/email/signin` → receives full profile → same `signBookingToken` flow.
- The cookie contains the **booking-app's own JWT**, signed with `JWT_SECRET` (must match dblue-office's `JWT_SECRET` for server-to-server `check-app-access` verification). The `isLoggedIn` middleware decodes all embedded profile fields into `req.user`.
- `space_access` is intentionally **not** embedded in the JWT — it is fetched live via `GET /api/v1/office/users/space-access/:uid`.
- On `GET /api/v1/auth/me`: always calls dblue-office `check-app-access` (catches deactivation immediately); re-fetches full profile once per 24 hours and re-issues the cookie; all other calls return profile from the JWT with no extra network call.

**dblue-office** is still the source of truth for **user data, rooms, office closures**. This application does not manage users — it reads them via proxy routes.

**No file storage (MinIO) is used in this application.**

In development, the auth layer is bypassed via `IS_AUTHENTICATED=true` in `.env.development`. This injects a fake user (`DEV_USER_ID` / `DEV_USER_EMAIL`) and returns mocked data from `backend/data/`.

---

## Project overview

Monorepo with two parts:

- `backend/` — Express 5 + TypeScript + MongoDB (Mongoose), port **3001** in development
- `frontend/` — React 19 + Vite + TypeScript + SCSS modules, port **5174** in development

Run everything from root:
```
npm run dev
```

Vite proxies all `/api` requests from port 5174 → backend 3001.

---

## First steps — what you must change

### 1. Application name
In root `package.json`, the name is already set to `booking-app`.

### 2. Database
Set `DB_URL` in `.env.development`:
```
DB_URL=mongodb://localhost:27017/bookingappdb
```

### 3. Google Client ID
Set in both `.env.development` and `frontend/.env.development`:
```
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
```
The same Client ID must be configured in Google Cloud Console with the correct authorized origins.

### 4. JWT Secret
Must match dblue-office's `JWT_SECRET` so this app can verify dblue-office JWTs:
```
JWT_SECRET=<same value as dblue-office>
```

### 5. dblue-office API URL
```
DBLUE_OFFICE_API_URL=http://localhost:3000/api/v1   # development
DBLUE_OFFICE_API_URL=https://tools.dblue.it/api/v1  # staging/production
```

### 6. Brand colors, typography, and responsive layout
`frontend/src/styles/global.scss` defines CSS variables for the entire application's color palette (backgrounds, text, borders, brand accents, status colors) and SCSS breakpoint mixins. **This file is an example — you are expected to replace the color values, typography settings, and responsive breakpoints with your own application's design.** The variable names and structure should stay the same (they are referenced by SCSS modules throughout the app), but all visual values are yours to define freely.

Responsive design targets are **laptop (min-width: 1024px) and tablet (min-width: 768px)**. Adjust the breakpoint mixins in `global.scss` to match the application's intended viewport range. The application's maximum content width and layout behaviour at each breakpoint should reflect the specific app's design, not the template defaults.

---

## Files you must NOT modify

| File | Why |
|---|---|
| `backend/middlewares/user.ts` | JWT validation + dev bypass |
| `backend/controllers/authController.ts` | Login proxy + session endpoints |
| `backend/routes/auth.ts` | Auth route mounting |
| `backend/controllers/officeController.ts` | Proxy to dblue-office data |
| `backend/routes/office.ts` | Office data routes |
| `frontend/src/contexts/authContext.tsx` | Session management |
| `frontend/src/main.tsx` | GoogleOAuthProvider setup |

---

## Frontend routing pattern

This app uses the **LandingProtection + Layout** pattern from dblue-office (not the ProtectedRoute component from the base template). Routes are defined in `frontend/src/App.tsx`:

```tsx
// Public — show landing/reset pages; redirect to /home if already authenticated
<Route element={<LandingProtection />}>
  <Route path="/" element={<Landing />} />
  <Route path="/forget/password" element={<ForgetPassword />} />
  <Route path="/reset/password" element={<ResetPassword />} />
</Route>

// Protected — require a valid session; redirect to / if not
<Route element={<Layout />}>
  <Route path="/home" element={<Home />} />
  {/* Add new routes here */}
</Route>
```

**Adding a new protected route:**
1. Create `frontend/src/pages/<name>/<Name>.tsx`
2. Import it in `App.tsx`
3. Add `<Route path="/your-path" element={<YourPage />} />` inside the `<Layout>` block

---

## Backend — adding new features

### Controller pattern
```typescript
import { Response } from "express";
import { AuthenticatedRequest } from "../types/express.d";

export const myHandler = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  return res.json({ success: true, data: {} });
};
```

### Route pattern
```typescript
import express from "express";
import { myHandler } from "../controllers/myController";
import { isLoggedIn } from "../middlewares/user";

const router = express.Router();
router.get("/items", isLoggedIn, myHandler);
export default router;
```

### Mounting in app.ts
```typescript
import myRoutes from "./routes/myRoutes";
app.use("/api/v1/my-feature", myRoutes);
```

---

## Frontend — accessing auth session

```typescript
import { useAuth } from "../../contexts/authContext";

const { session } = useAuth();
// session.id                    — dblue-office user ID
// session.email                 — user email
// session.name                  — user display name
// session.role                  — role string from dblue-office
// session.employment_type       — e.g. "full_time"
// session.job_title             — job title from dblue-office
// session.mandatory_presence_days — required in-office days per month (null if not set)
// session.tool_access           — string[] of tools this user can access
// session.image_url             — avatar URL (nullable)
// session.login_method          — "google" | "email"
```

## Frontend — making API calls

```typescript
import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL;

const res = await axios.get(`${API_URL}/my-feature/items`, { withCredentials: true });
```

---

## Available office proxy routes

| Route | Returns | Mock data source |
|---|---|---|
| `GET /api/v1/office/users/list` | All employees | `backend/data/mockedUsers.ts` |
| `GET /api/v1/office/users/space-access/:uid` | Room categories + rooms for a user | `mockedUsers.ts` + `mockedRooms.ts` + `mockedRoomCategories.ts` |
| `GET /api/v1/office/rooms/list` | All rooms | `backend/data/mockedRooms.ts` |
| `GET /api/v1/office/closures/list` | Office closures | `backend/data/mockedClosures.ts` |

With `IS_AUTHENTICATED=true`, these routes return the mocked data automatically. See `OFFICE_API.md` for full request/response documentation and usage notes for each route.

**mockedUsers fields:** `_id, name, email, role, employment_type, job_title, space_access, image_url, status, login_method`

**mockedRooms fields:** `_id, name, category, capacity, features, status, color`

**mockedRoomCategories fields:** `_id, category` (maps room category IDs to display labels)

**mockedClosures fields:** `_id, motivation, start, end, range` (start/end are `YYYY-MM-DD` strings; range is the full array of dates in between)

---

## Real-time features (socket.io + MongoDB change streams)

Socket.io and MongoDB change streams are **active by default** in this application. The server already runs as a socket server (`server.listen` instead of `app.listen`). Do not poll for data — always use socket events for live updates.

### How it works

`backend/services/changeStream.service.ts` contains a `watchCollection()` helper. `startChangeStreams(io)` is called once after DB connect in `app.ts`. Register one `watchCollection()` call per model inside `startChangeStreams`.

### Registering a model to watch

Open `backend/services/changeStream.service.ts` and add inside `startChangeStreams`:

```typescript
import MyModel from "../models/myModel";

// Option A — broadcast to ALL connected clients:
streams.push(watchCollection(MyModel, io, "mymodel"));

// Option B — emit only to clients in a specific channel.
// The channel ID is derived from a field on the document (e.g. roomId):
streams.push(
  watchCollection(MyModel, io, "mymodel", (doc) => (doc as any).roomId?.toString())
);
```

### Frontend — joining a channel and listening for events

Install `socket.io-client` if not already installed:
```
npm install socket.io-client --prefix frontend
```

Connect and listen:
```typescript
import { io } from "socket.io-client";

const socket = io({ path: "/api/v1/socket.io", withCredentials: true });

// Join a channel (Option B above):
socket.emit("join_channel", roomId);

// Listen for updates:
socket.on("mymodel_update", (doc) => { /* insert or update — update local state */ });
socket.on("mymodel_delete", ({ _id }) => { /* remove from local state */ });
```

Add custom socket event handlers (e.g. `join_channel`) in `backend/config/socketHandler.ts`:
```typescript
socket.on("join_channel", (channelId: string) => {
  socket.join(channelId);
});
```

**Important:** MongoDB change streams require a replica set. Atlas clusters support this by default. A local standalone `mongod` does not — run a single-node replica set locally if you need change streams in development.

---

## Password reset flow (for email users)

External (email/password) users can reset their password:

1. User visits `/forget/password`, enters email → `POST /api/v1/auth/forgot-password` → proxied to dblue-office → 6-digit code sent via SendGrid
2. User visits `/reset/password`, enters email + code + new password → `PUT /api/v1/auth/reset-password` → proxied to dblue-office

Both endpoints are public (no auth required). Accounts must already exist in dblue-office.

---

## Technology constraints

| Layer | Stack |
|---|---|
| Backend runtime | Node 22, TypeScript, ts-node |
| Backend framework | Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT via dblue-office proxy (do not change) |
| HTTP client (backend) | Node 22 native `fetch` |
| Google auth (backend) | `google-auth-library` |
| Frontend framework | React 19 |
| Frontend build | Vite 8 |
| Frontend HTTP | axios |
| Frontend routing | react-router-dom v7 |
| Google sign-in (frontend) | `@react-oauth/google` |
| Styling | SCSS modules + CSS variables |
| Real-time | socket.io + MongoDB change streams (active) |
| File storage | None |

---

## Project structure

```
booking-app/
├── backend/
│   ├── app.ts                          ← entry point, route mounting
│   ├── cron-jobs.ts                    ← standalone cron runner (separate process)
│   ├── config/coreDb.ts               ← MongoDB connection
│   ├── config/socketHandler.ts        ← socket.io server
│   ├── services/changeStream.service.ts ← MongoDB change streams
│   ├── controllers/
│   │   ├── authController.ts          ← DO NOT MODIFY — login proxy + session
│   │   └── officeController.ts        ← DO NOT MODIFY — users/rooms/closures proxy
│   ├── middlewares/user.ts            ← DO NOT MODIFY — JWT + dev bypass
│   ├── data/
│   │   ├── mockedUsers.ts             ← dev mock data for users
│   │   ├── mockedRooms.ts             ← dev mock data for rooms
│   │   ├── mockedRoomCategories.ts    ← dev mock data for room categories
│   │   └── mockedClosures.ts          ← dev mock data for closures
│   ├── routes/
│   │   ├── auth.ts                    ← login, logout, me, forgot/reset password
│   │   └── office.ts                  ← users/list, space-access, rooms/list, closures/list
│   └── types/express.d.ts             ← AuthenticatedRequest type
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    ← routing (LandingProtection + Layout pattern)
│   │   ├── main.tsx                   ← GoogleOAuthProvider setup — DO NOT MODIFY
│   │   ├── contexts/authContext.tsx   ← DO NOT MODIFY
│   │   ├── pages/
│   │   │   ├── landing/               ← Landing, ForgetPassword, ResetPassword
│   │   │   └── home/                  ← main app page — extend this
│   │   └── styles/
│   │       ├── global.scss            ← CSS variables + breakpoints (customize for your app)
│   │       └── style.scss             ← base resets and typography
│   └── .env.development
├── .env.development                   ← backend dev config (GOOGLE_CLIENT_ID, JWT_SECRET, etc.)
├── AGENTS.md                          ← this file
├── MIGRATION.md                       ← step-by-step guide for migrating an existing app to this infrastructure
├── OFFICE_API.md                      ← dblue-office proxy route reference
└── package.json
```

---

## Migrating an existing application

If you are migrating an existing Deep Blue internal app (e.g. dblue-app) to this infrastructure, read **`MIGRATION.md`** before making any changes. It contains phase-by-phase instructions covering: project structure, authentication rewrite, user model changes, route prefix, office data integration, WebSocket → socket.io, cron job separation, and frontend updates.

Reference **`OFFICE_API.md`** for the full request/response specification of all four dblue-office proxy routes.
