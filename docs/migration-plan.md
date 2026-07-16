# Migration Plan — Presence App → Deep Blue Infrastructure

> Status: draft, for discussion with the client.
> Source documents: `presence-app-discussion.html` (Deep Blue technical review, July 2026), `MIGRATION.md` (AI-assisted migration guide), `AGENTS.md` and `OFFICE_API.md` (both vendored in `docs/boooking-app-template-main/`, provided by the client and now confirmed to match the production/staging URLs referenced elsewhere).
> Companion document: `docs/migration-risks.md` — read before committing to the timeline below.

**Update:** this revision incorporates `AGENTS.md` and `OFFICE_API.md`, which were missing when the first draft was written. Both are now available and vendored in this repo — the "materials gap" flagged in the previous revision (§5) is resolved, but reading them surfaced a few technical corrections and new items, called out inline below.

---

## 0. Note on a prior analysis in this repo

`docs/valutazione-adattamento-template.md` (an earlier internal analysis) recommended **against** adopting the template's dblue-office integration, on the grounds that dblue-office did not exist yet and adopting it would mean replacing real, working data with mocks — a regression, not a migration.

**That premise no longer holds.** The new client documents describe dblue-office as a live service with real staging (`staging-tools.dblue.it`) and production (`tools.dblue.it`) endpoints, a provisioned Google Client ID, and a documented proxy API (`OFFICE_API.md`). The earlier document's conclusion is superseded — this plan assumes dblue-office is real and integration is in scope now.

---

## 1. Working model

Per `MIGRATION.md`, this is **not** an in-place refactor:

- **`<SOURCE>`** — the current `dblue-app` repository. Read-only reference throughout.
- **`<TEMPLATE>`** — `booking-app-template`. Read-only reference throughout.
- **`<TARGET>`** — a new, empty repository under the Deep Blue GitHub organisation. All changes happen here.

All effort estimates below assume this model: the migration is built fresh in `<TARGET>`, so `dblue-app` keeps running unmodified until cutover. See `docs/migration-risks.md` §7 for the risk this creates if `dblue-app` keeps receiving bug fixes in parallel.

---

## 2. Scope summary

| # | Area | Priority | Depends on |
|---|---|---|---|
| 1 | Deployment structure (monorepo/Coolify vs. separate services) | **TBD — decision blocks Phase 2** | — |
| 2 | Multi-environment config (.env.development/staging/production) | Required | Phase 1 |
| 3 | Auth rewrite: httpOnly cookie, Google Identity Services, email/password, `LandingProtection`+`Layout` | **Required — blocks production deploy** | Phase 3 (user model) |
| 4 | API route prefix `/api/v1/` | Recommended | — |
| 5 | dblue-office integration: users, rooms/space-access, closures | **Required** | Phase 4 (auth), needs `OFFICE_API.md` |
| 6 | Express 5, axios | Recommended | — |
| 7 | Fix 3 hardcoded values in `App.tsx` (capacity, presence counter, "Back to today") | **Required** | Phase 5 (capacity/closures data) |
| 8 | Tailwind → SCSS modules | **Optional** — client decision needed | — |
| 9 | Split `App.tsx` (1,419 lines) into `pages/home/` | Recommended | — |
| 10 | Accessibility (interactive elements, focus, aria-label, reduced motion) | Recommended | — |
| 11 | Cron job as separate process | Recommended | — |
| 12 | e2e suite (113 Playwright tests) rewrite | **Required** (not called out as its own phase in the source docs, but mandatory given the auth/route changes) | Phases 3–8 |

---

## 3. Phased plan

### Phase 0 — Preconditions
Confirm `<SOURCE>` / `<TEMPLATE>` / `<TARGET>` paths. Resolve the TBD items in §6 below (deployment structure, SCSS decision, staging test accounts). Receive the access and materials listed in §7. **Do not start Phase 1 until this phase's blocking items are closed** — starting the auth/data-layer work without `OFFICE_API.md` and staging credentials means redoing it against assumptions.

### Phase 1 — `App.tsx` decomposition
Move the current `App.tsx` (1,419 lines: routing, all state, data fetching, event handlers, and JSX for the home view) into `pages/home/Home.tsx` and child components. Pure refactor, no behavioural change. Doing this first reduces merge friction in every subsequent phase, since almost every later change otherwise touches the same file.
**Verification:** app builds and behaves identically; existing e2e suite (still pointed at old auth/routes at this stage, run against `<SOURCE>` if needed for a baseline) shows no new failures attributable to this phase.

### Phase 2 — Monorepo scaffold
Root `package.json` (`dev`/`build`/`start`/`cron` scripts), `concurrently`, port reassignment (backend 3001, frontend 5174), Vite proxy for `/api`. Existing `backend/Dockerfile` / `backend/railway.toml` / root `docker-compose.yml` are left in place (ignored by Coolify/Nixpacks, still usable for local Docker workflows) unless the client selects the "separate services" alternative in §6.1.
**Verification:** `npm run dev` from root starts both services on the new ports.

### Phase 3 — User model migration
Add `dblueOfficeId` (indexed, unique). Remove `googleId` and `contract.presenceDaysTarget`. Change `teammates` from `Types.ObjectId[]` to `String[]` (dblue-office user IDs). Keep `role`, `preferences`, `onboardingCompleted`.

This phase necessarily touches the exact area of several bugs already found and documented against the current codebase (`CLAUDE_MEMORY.md`): `colleagueAvatars` sending `User.avatar` instead of `{initials, color}`, `room` not cleared on status change, `isPast` never populated for real data. **Decide explicitly whether to carry these fixes forward into the new model now** (recommended — the correct shape has to be designed once anyway) or port them separately after cutover. See `docs/migration-risks.md` §2 for detail.

**Verification:** local record creation on first login produces a valid minimal user; `WorkingStatus.userId` still resolves correctly; a one-off script or manual mapping populates `dblueOfficeId` for any pre-existing dev/staging records that must be kept (see §7 — this requires client-provided data).

### Phase 4 — Authentication rewrite
Backend: delete `passport.ts` and the current `auth.routes.ts`; copy `middlewares/user.ts`, `authController.ts`, `routes/auth.ts`, `types/express.d.ts` from the template verbatim (per `MIGRATION.md`/`AGENTS.md`, these are "do not modify" contract files).

**Corrected detail from `AGENTS.md` (not visible in the other two documents):** the cookie does **not** hold dblue-office's own JWT forwarded as-is. The backend signs its **own** booking-app JWT (`signBookingToken`) that embeds the profile fields dblue-office returned, plus a `profileSyncedAt` timestamp — signed with the `JWT_SECRET` shared with dblue-office so it can be verified server-to-server via `check-app-access`. `space_access` is deliberately **not** embedded in the JWT (it's fetched live via the space-access proxy, see Phase 5). `GET /api/v1/auth/me` always calls `check-app-access` first (so a deactivation in dblue-office is caught immediately), re-fetches the full profile and re-issues the cookie once per 24h, and otherwise decodes the JWT with no extra network call. This distinction matters for implementation — a naive "just relay dblue-office's JWT" reading of the client discussion document would be wrong.

Also copy the password-reset flow, now fully specified in `AGENTS.md`: `POST /api/v1/auth/forgot-password` and `PUT /api/v1/auth/reset-password` (both public, proxied to dblue-office, which sends the 6-digit code via SendGrid), plus the `ForgetPassword`/`ResetPassword` pages under `pages/landing/`.

Frontend: delete `AuthContext.tsx`, `services/api.ts`, `pages/Login.tsx`; copy `contexts/authContext.tsx`, `main.tsx`, `pages/landing/` from the template; add `@react-oauth/google`; replace the current per-route `ProtectedRoute` with the `LandingProtection` + `Layout` group pattern. `useAuth()` exposes `session.{id,email,name,role,employment_type,job_title,mandatory_presence_days,tool_access,image_url,login_method}` directly from the decoded cookie — no separate profile fetch needed for these fields.

**Note on `session.role`:** per the client discussion document (§5d), this app's 5-role RBAC (`employee`/`lab_responsible`/`admin_member`/`director`/`owner`) stays **app-managed**, not sourced from dblue-office. `AGENTS.md`'s generic `session.role`/`session.tool_access` fields are part of the base template convention for apps that *do* delegate roles to dblue-office — for this migration, continue reading role from the local User record (looked up by `dblueOfficeId`), not from the session object, unless the client explicitly asks to change that.

**Verification:** Google sign-in works from the registered dev origin; email/password sign-in works for a staging test account; password reset completes end to end for an email/password test account; `httpOnly` cookie appears in DevTools and is not readable via `document.cookie`; `GET /api/v1/auth/me` returns the session on refresh and reflects a deactivation within 24h (or immediately, since it's checked on every call); no JWT anywhere in `localStorage` or in any URL.

### Phase 5 — dblue-office data integration
Copy `officeController.ts` / `routes/office.ts` from the template. Mount the four proxy routes (`/api/v1/office/users/list`, `/space-access/:uid`, `/rooms/list`, `/closures/list`) — full request/response shapes are now documented in `OFFICE_API.md` (vendored in `docs/boooking-app-template-main/`). Remove: the hardcoded `IS_CLOSED_DAYS` array (`DailyDetail.tsx:316`), local room seeding, and the local-only teammate picker (now sourced from the full ~100-employee dblue-office directory via `/users/list`, with a "hasn't joined yet" placeholder for colleagues without a local record yet).

**New item surfaced by `OFFICE_API.md`, not in either prior document: rooms change from name-keyed to ID-keyed.** Today, `WorkingStatus.room` is a bare string storing the room **name** (e.g. `"Blue Room"`), and a large amount of frontend logic (`DailyDetail.tsx`'s `isSelectedRoom`, `isRoomFull`, the RBAC room-visibility check) compares by name. `OFFICE_API.md` is explicit: *"Use the room IDs from `roomlist` when recording which room a user booked for a given day."* This means every one of those name-comparison sites needs to move to comparing dblue-office room IDs instead — not just a data-source swap, a change in what value is stored and compared. See `docs/migration-risks.md` §2 for the ripple effects.

**Verification:** all four routes return real dblue-office data in a browser session; teammate picker lists the full directory, not just users who have logged in; a room capacity change in dblue-office is reflected in the app without a redeploy; booking a room and reopening the day shows the correct room selected by ID, not by matching a name string.

### Phase 6 — Fix hardcoded values
`totalCapacity: day.totalCapacity || 23` → sum of `capacity` across the user's `roomlist` from Phase 5. `'10/10'` → `mandatory_presence_days` from the dblue-office profile, adjusted proportionally for closures/absences per the formula in `OFFICE_API.md` (identical to the one in the client discussion document). `handleMonthSelect('October 2026')` → derived from the current date.

**Verify one specific gap in `OFFICE_API.md` before relying on it:** the documented example response for `/users/space-access/:uid`'s `roomlist` shows only `{id, name, space, color}` — no `capacity` field — even though the same document's notes say to "sum the `capacity` of all rooms in `roomlist`". The sibling `/rooms/list` endpoint's example *does* include `capacity`. This is very likely just an incomplete example (the two endpoints probably return the same room shape), but confirm against one real staging response before wiring the capacity sum — do not assume the example JSON is complete.

**Verification:** presence counter and capacity are correct against real data for at least one full month with a mix of absences/closures; "Back to today" resolves correctly regardless of system date.

### Phase 7 — Express 5 + axios + runtime/build tooling
Dependency bump (`express` 4→5, add `@types/express` 5, `google-auth-library`), remove `passport*`/`ws`. Replace the `fetch` + manual-header wrapper (`services/api.ts`) with a single configured axios instance (`withCredentials: true`, 401 interceptor). Low risk, isolatable from the rest.

**Two additional bumps surfaced by `AGENTS.md`'s tech-constraints table, not called out in the other two documents:** the backend targets **Node 22** (current `backend/Dockerfile` pins `node:20-alpine`, and both CI workflows pin `node-version: '20'`), and the frontend targets **Vite 8** (current `frontend/package.json` pins `^6.2.0`). Neither is optional — they're stated as fixed constraints, not recommendations.

Node 20→22 is low risk here — confirmed by grepping `backend/src` for every API Node 22 actually removes/changes (`crypto.createCipher`/`createDecipher`, `util.is*()`, native-addon ABI) and finding zero usages, and there are no native binary dependencies in the backend. Bump the Dockerfile base image and both CI workflows' `node-version` together so they don't drift from each other.

Vite 6→8 needs more care — it's two major versions, and **`@tailwindcss/vite` is currently pinned to `^4.1.14`, whose peer dependency (`vite: ^5.2.0 || ^6`) is incompatible with Vite 7/8 as-is.** This must be bumped to `>=4.2.2` in the same change, or the build breaks outright — it is not optional cleanup. Follow an incremental path (bump to Vite 7 first and verify dev/build, then to Vite 8) rather than jumping directly, since the Tailwind Vite plugin has a track record of lagging behind Vite majors. See `docs/migration-risks.md` §2.4e for the full breakdown (Rolldown bundler change, CSS minifier default switch, CJS interop change) and sourcing.

**Verification:** no manually-caught async route errors needed; no per-call auth header injection remains in the frontend; `node --version` in the deployed container and in CI both report 22.x; `vite --version` reports 8.x with a clean dev/build run and `@tailwindcss/vite` resolves without a peer-dependency conflict.

### Phase 8 — Real-time: `ws` → socket.io
Copy `config/socketHandler.ts` and `services/changeStream.service.ts` from the template as the starting point, but **port the existing role-aware capacity broadcast logic** (`websocket.service.ts`'s `resolveRole`/`getVisibleRooms`-based per-connection breakdown) into it rather than discarding it — see `docs/migration-risks.md` §2 for why a verbatim copy would regress a fix already shipped.

**Structural detail from `AGENTS.md`:** this is not only a service-file swap. The HTTP server must be created explicitly (`http.createServer(app)`) and passed to socket.io, then the process listens on that server (`server.listen`) instead of `app.listen` directly — a change to the boot sequence in `index.ts`, not just the real-time service. `changeStream.service.ts`'s `watchCollection()` helper supports per-channel broadcast (grouping by a field on the changed document, e.g. a room or date), which is useful but does not by itself reproduce the current per-*viewer-role* breakdown — the same date's capacity looks different depending on which rooms the viewing role can see, which isn't a property of the changed document. Plan to compute the role-scoped payload at emit time (e.g. one emit per role group, or compute the breakdown client-side from a role-blind broadcast plus the client's own known room access) rather than assuming the template's channel mechanism solves this out of the box.

Frontend: delete `useWebSocket.ts`, adopt `socket.io-client` with `join_channel`/`workingstatus_update`.
**Verification:** a status change made by one browser session is reflected live in another session with a **different role**, and each sees the capacity breakdown appropriate to their own visible rooms (not a shared, role-blind payload).

### Phase 9 — Cron as a separate process
Extract `startScheduler()` from `index.ts` into `cron-jobs.ts` with its own MongoDB connection. Add the `cron` script (already scaffolded in Phase 2's root `package.json`). Configure as a separate Coolify resource/process.
**Verification:** stopping the HTTP process does not stop the nightly auto-confirm job, and vice versa (test in staging, not just by code inspection).

### Phase 10 — e2e suite rewrite
The current 113 Playwright tests depend on `?dev=true` + JWT in `localStorage`, bare route paths, and direct `page.route()` capacity mocks. All of this changes in Phases 3–8. Fixtures (`auth.ts`, `dailyDetail.ts`, `testAdmin.ts`) need to be rewritten against the new cookie-based auth and `/api/v1/` routes, not just path-updated.
**Verification:** the full suite passes against the migrated app in staging; no test relies on reading `localStorage` for a token.

### Phase 11 — Accessibility
Convert `<div onClick>` day-cards, the "Book Lab" row, and teammate avatars to `<button>` (or `role="button"` + `tabIndex` + `onKeyDown`). Make focus outlines visible by default, not gated behind the screen-reader-support preference. Add `aria-label` to icon-only buttons. Respect `reducedMotion` preference and OS-level `prefers-reduced-motion` in `motion/react` animations. Manually verify colour contrast for status colours against WCAG AA.
**Verification:** full keyboard-only walkthrough of the booking flow; automated contrast check plus one manual pass in the default light theme.

### Phase 12 — SCSS modules (optional)
Only if the client confirms this is wanted (see §6.2). Component-by-component conversion, prioritised Layout/shell → auth pages → core presence UI → secondary views, each verified against a visual screenshot diff.

---

## 4. Timeline estimate

Estimates assume **one developer, AI-assisted (Claude Code), full time**, and that Phase 0's blocking items (access, `OFFICE_API.md`, decisions) are resolved before work starts. They are rough T-shirt sizing, not a committed schedule — refine once `OFFICE_API.md` is in hand and the deployment/SCSS decisions are made.

| Phase | Estimate (working days) | Notes |
|---|---|---|
| 0 — Preconditions | 0.5–1 (+ wait time for client) | Not dev effort; blocks everything else |
| 1 — App.tsx decomposition | 1–2 | |
| 2 — Monorepo scaffold | 1 | |
| 3 — User model migration | 2–3 | +0.5–1 day if known bugs are folded in |
| 4 — Auth rewrite | 4–5 | Highest complexity; needs real staging dblue-office to test against |
| 5 — dblue-office data integration | 3.5–5 | +0.5–1 day for the room name→ID migration surfaced by `OFFICE_API.md` (touches `DailyDetail.tsx`, `capacity.service.ts`, RBAC room check) |
| 6 — Hardcoded values | 1 | Depends on Phase 5; verify the `roomlist.capacity` gap against a real response first |
| 7 — Express 5 + axios + Node 22/Vite 8 | 1.5–3 | +0.5–1 day for the Node 22 and Vite 8 bumps (not called out in the original two documents, only in `AGENTS.md`) |
| 8 — socket.io | 2–3 | +1 day to port role-aware logic correctly |
| 9 — Cron separation | 0.5–1 | |
| 10 — e2e suite rewrite | 5–8 | Largest single item after auth; can only start once Phases 3–8 stabilise |
| 11 — Accessibility | 2–3 | Can run partly in parallel with Phase 10 |
| 12 — SCSS modules (optional) | 5–10+ | Excluded from the core total below; scope depends entirely on how incrementally it's done |

**Core total (Phases 0–11, excluding SCSS): ~24–35 working days ≈ 5–7 calendar weeks** for one developer, assuming no long waits on client-provided access and no surprises in a real `space-access` response beyond the `capacity` field gap already flagged. Phases 9 and 11 can overlap with Phase 10 to compress the tail end. Add the SCSS estimate on top if the client confirms Phase 12 is in scope; it is the most compressible/deferrable item if the timeline needs to shrink.

---

## 5. What we need from the client

Grouped by what blocks which phase:

**Blocks Phase 0 / everything:**
- Creation of the `<TARGET>` GitHub repository under the Deep Blue organisation, with the developer added as a collaborator.
- Decision on deployment structure: monorepo/Coolify (client's stated preference) vs. independently deployed services (§2, item 1).
- Decision on whether Phase 12 (SCSS) is in scope for this engagement.

~~`OFFICE_API.md`~~ — received and vendored in `docs/boooking-app-template-main/`, along with an updated `AGENTS.md`. No longer a blocker; see Phases 4/5/6 above for the technical corrections reading them produced (JWT signing model, password reset routes, room ID vs. name, Node/Vite version targets).

**Blocks Phase 3 (user model) / data continuity:**
- If any existing dev/staging users must be preserved rather than recreated fresh, a mapping (or an export) from dblue-office of `dblueOfficeId` per existing employee, so local records can be linked instead of duplicated.

**Blocks Phase 4 (auth):**
- Confirmation of `staging-tools.dblue.it` and `tools.dblue.it` reachability from the environment(s) this will be developed/deployed in, and any IP allowlisting needed.
- The shared `JWT_SECRET` for each environment (development can use a local placeholder, but staging and production must match dblue-office's actual secret for that environment).
- Confirmation of the Google Client ID already configured (per the client document, currently authorized only for `http://localhost:5174`) — and the production/staging domain(s) once decided, so the client can register them as authorized JavaScript origins in Google Cloud Console. We do not have edit access to that project unless granted.
- Email addresses for the developer and any test accounts needed, to be provisioned on the staging dblue-office instance with `login_method: "email"` and a password-reset link (per the client document, this is how non-Google/external users are handled, and it doubles as the dev/test login path).

**Blocks Phase 5 (data integration):**
- Confirmation of the exact `DBLUE_OFFICE_API_URL` for staging and production (`https://staging-tools.dblue.it/api/v1` / `https://tools.dblue.it/api/v1` per the client document — please confirm these are final; note `AGENTS.md` writes the production host as `tools.dblue.it`, consistent with the client document).
- One real (or realistic staging) response sample for `GET /users/space-access/:uid` — to close the `roomlist.capacity` gap noted in Phase 6 before that code is written.
- If any existing dev/staging `WorkingStatus` records must be preserved, the dblue-office room-ID mapping for the rooms currently seeded locally (Blue/Red/Green/Admin/Management/Lab) — needed to backfill `room` from name-keyed to ID-keyed values (see Phase 5).

**Blocks deployment / later phases:**
- MongoDB URIs for staging and production (or confirmation that Deep Blue provisions and shares these once the repo exists).
- Coolify project access (or confirmation that Deep Blue's infra team owns deployment configuration and we only need to hand off a working `npm run build`/`npm start`).
- Confirmation of the application's staging/production domain(s), needed for `COOKIE_DOMAIN` (`.dblue.it` per the template's env example) and for the Google origin registration above.

---

## 6. Open decisions to close before Phase 0 exits

1. Monorepo/Coolify vs. separate services (§2, item 1) — client's stated preference is monorepo; confirm.
2. Tailwind vs. SCSS modules (§2, item 8) — optional, does not block anything else; confirm only if timeline pressure makes it worth deciding now vs. later.
3. Whether to fold the already-documented app bugs (colleague avatars, stale room, unpopulated `isPast`, sick-leave confirmation timing) into Phase 3/6, or track them as separate post-migration work.
4. Whether any existing dev/staging data needs to survive the migration (affects Phase 3 scope, see §5).

---

## 7. Acceptance checklist

Reused from `MIGRATION.md`, to be run against the deployed `<TARGET>` app before considering the migration complete:

- [ ] `npm run dev` from root starts both backend and frontend
- [ ] Google sign-in works from the registered origin
- [ ] Email/password sign-in works for a `login_method: "email"` staging account
- [ ] Password reset (`/forget/password` → `/reset/password`) completes end to end for an email/password account
- [ ] `httpOnly` cookie is set after login and is not readable via `document.cookie`
- [ ] A booked room is stored and displayed by dblue-office room ID, not by name string
- [ ] `GET /api/v1/auth/me` returns the user profile on page refresh
- [ ] `GET /api/v1/office/users/list`, `/space-access/:uid`, `/closures/list` return real dblue-office data
- [ ] Logout clears the cookie and redirects to the landing page
- [ ] Real-time presence updates arrive via socket.io, correctly role-scoped, when another user changes status
- [ ] The cron job runs independently of the HTTP process
- [ ] "Back to today" navigates to the current month regardless of system date
- [ ] The presence counter and total capacity show real, non-hardcoded values
- [ ] No JWT is stored in `localStorage` or appears in any URL
- [ ] The full e2e suite passes against the migrated app
