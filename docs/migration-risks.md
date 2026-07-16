# Migration Risks & Critical Points — Presence App → Deep Blue Infrastructure

> Companion to `docs/migration-plan.md`. Read before estimating or committing to a schedule — several items here change phase order or effort in the plan.
> Grounded in this repository's actual code and history (`CLAUDE_MEMORY.md`), not only in the client documents, since several risks only become visible by reading the current implementation.
> Updated after receiving `AGENTS.md` and `OFFICE_API.md` (now vendored in `docs/boooking-app-template-main/`) — several items below are new or corrected as a result; the previous revision's `OFFICE_API.md` availability risk (§2.4) is resolved and replaced.

---

## 1. A prior recommendation in this repo is now superseded

`docs/valutazione-adattamento-template.md` concluded that adopting the template's dblue-office integration would be premature and regressive, because dblue-office did not exist yet and its proxy routes only returned mock data.

**This is no longer the situation.** The new client documents describe real staging (`staging-tools.dblue.it`) and production (`tools.dblue.it`) dblue-office instances, a provisioned Google Client ID, and a dedicated `OFFICE_API.md`. Anyone referencing the older document's "not yet" conclusion should be pointed to this note — the premise it was built on has changed.

---

## 2. High-risk items

### 2.1 Real-time: copying the template's socket.io files verbatim would regress a shipped fix
`MIGRATION.md` Phase 7 says to replace `websocket.service.ts` with the template's `config/socketHandler.ts` + `services/changeStream.service.ts`. But the current `websocket.service.ts` is not generic — it implements a **per-connection, role-aware capacity breakdown** (`resolveRole()`, `getVisibleRooms()`), the direct result of a real bug fix shipped in this codebase (a role-visibility issue where a director's booking in a role-restricted room wasn't correctly reflected for other roles). If the template's socket.io handler broadcasts one shared, role-blind payload per date, a verbatim copy silently reintroduces that bug.
**Mitigation:** treat Phase 8 as "port the existing role-aware logic onto socket.io's transport", not "swap files". Verification must explicitly test two sessions with *different* roles receiving *different* breakdowns for the same date.

**Additional detail from `AGENTS.md`:** the template's `changeStream.service.ts`/`watchCollection()` helper does support scoping a broadcast to a channel derived from a field on the changed document (e.g. group by room or date) — but the current role-aware logic needs a projection that varies **per viewer**, not per document field, since the same date's capacity legitimately looks different to a director than to an employee. The channel mechanism doesn't solve that by itself; the role-aware computation still needs to happen at emit time (or be recomputed client-side from a role-blind broadcast). Also note the server boot sequence itself changes: `AGENTS.md` states the app "already runs as a socket server" (`server.listen` on an explicit `http.Server`, not `app.listen` directly) — a change to `index.ts`, not only to the websocket service file.

### 2.2 The user model migration lands exactly on three already-documented app bugs
Phase 3 (`teammates: ObjectId[] → String[]`, `dblueOfficeId`, removing `googleId`) touches the same code paths as:
- `colleagueAvatars` sending `User.avatar` (a Google-OAuth-only field, always empty for dev accounts) instead of `{initials, color}` — teammate avatars never render.
- `room` not cleared when status changes away from `in_office` — stale "Planned" badge shown after switching status.
- `isPast` never populated for real data — the retrofit flow is unreachable for any real day.

None of these are in either client document; they were found through this project's own QA history. **If Phase 3 is implemented as a pure mechanical field rename, all three bugs migrate intact into the new repo.** Since the correct shape (deriving avatar info from name/id, clearing `room` on non-office status, computing `isPast`) has to be designed once regardless, this is the cheapest point to fix them — designing the new model twice (once "as-is", once "correctly" later) costs more than doing it once.
**Mitigation:** explicit decision recorded in the plan (§6, item 3) — recommend folding these into Phase 3/6 rather than deferring.

### 2.3 `capacity.service.ts` changes what "room capacity" means
Today, capacity lives on the local `Room` model and several capacity/waiting-list behaviours have been debugged extensively in this codebase (per-room vs. aggregate capacity caps, synthetic seed data overshooting real capacity, waiting-list promotion races). Phase 5 moves capacity to `GET /api/v1/office/users/space-access/:uid`'s `roomlist`. If the semantics differ even slightly (e.g. whether a room's capacity includes reserved/blocked seats, whether inactive rooms are excluded, how role-restricted rooms are represented), the waiting-list and capacity-gate logic — already fragile enough to have needed multiple fix rounds — can silently misbehave again.
**Mitigation:** do not assume `roomlist.capacity` means the same thing as the current `Room.capacity` — verify against `OFFICE_API.md` and a real staging response before wiring `isCapacityAvailable()`/`upsertStatus()` to it. Add a focused test for the exact scenario that caused the original per-room capacity bug (aggregate total capacity looking fine while a single room is oversubscribed).

### 2.4 `roomlist`'s documented example is missing the one field it tells you to use
`OFFICE_API.md` instructs: *"sum the `capacity` of all rooms in `roomlist`"* to derive total office capacity — but the example JSON response for `/users/space-access/:uid` shows `roomlist` entries as `{id, name, space, color}`, with no `capacity` key. The sibling `/rooms/list` endpoint's example *does* include `capacity` (and `features`, `status`) for what looks like the same kind of room object. Most likely the `space-access` example is simply incomplete and the real response includes `capacity` too — but Phase 6 (capacity fallback fix) must not be built on that assumption without checking one real response first.
**Mitigation:** request one real (or realistic staging) response for `/users/space-access/:uid` before writing the capacity-summing code in Phase 6.

### 2.4b `/users/list`'s documented response doesn't include `space_access`, despite `AGENTS.md`'s mock field list mentioning it
`AGENTS.md` lists `space_access` among "mockedUsers fields", but `OFFICE_API.md`'s actual `/users/list` response sample does not include it (only `_id, name, email, role, employment_type, job_title, image_url, login_method, status`). Room/space access for a given user is obtained separately via `/users/space-access/:uid`. If the teammate picker or any per-teammate presence UI is written assuming `space_access` arrives inline with the employee list, it will silently be `undefined`.
**Mitigation:** always fetch room access per-user via the dedicated endpoint; do not assume it rides along with `/users/list`.

### 2.4c Room references change from name-keyed to ID-keyed — a wider ripple than a data-source swap
`OFFICE_API.md` is explicit that bookings should record the dblue-office room **ID** from `roomlist`, not a name. Today `WorkingStatus.room` is a bare string storing the room **name** (`"Blue Room"`, etc.), and this repository's own bug history shows several places compare by that name directly: `DailyDetail.tsx`'s `isSelectedRoom` (`room.name === day.room`) and `isRoomFull`, and the RBAC server-side room-visibility check. Every one of these needs to move from string-equality-on-name to equality-on-dblue-office-ID — not just "fetch rooms from a new source," a change in what value is stored and compared throughout the codebase. If only some sites are updated, rooms will appear to book correctly in one view and show as unselected/mismatched in another.
**Mitigation:** grep for every place `.room`/`room.name`/`day.room` is compared, not just the four documented hardcoded values, when implementing Phase 5. Treat it as a rename-with-semantic-change, not a rename.

### 2.4d The auth JWT is booking-app-signed, embedding profile data — not a forwarded dblue-office token
`AGENTS.md` clarifies a detail neither the client discussion document nor `MIGRATION.md` states explicitly: on login, the backend calls `signBookingToken` to sign its **own** JWT (embedding the profile fields dblue-office returned, plus `profileSyncedAt`), rather than simply relaying dblue-office's token. This still requires the shared `JWT_SECRET` (for dblue-office's `check-app-access` server-to-server check to work), but if an implementation instead tries to literally store/forward dblue-office's JWT unmodified, the profile-embedding and 24-hour re-sync behaviour (`GET /api/v1/auth/me`) won't work as documented, and any field the app itself relies on (e.g. `mandatory_presence_days`) may go stale between logins instead of refreshing on the documented cadence.
**Mitigation:** implement Phase 4 exactly per `AGENTS.md`'s `signBookingToken`/`profileSyncedAt`/24h-resync description, not per a literal reading of the sequence diagram's "httpOnly JWT cookie" label alone.

### 2.4e Node 22 and Vite 8 are stated as fixed constraints, not just "recommended updates"
Neither the client discussion document nor `MIGRATION.md` mentions runtime/build-tool versions — but `AGENTS.md`'s technology-constraints table pins **Node 22** (current `backend/Dockerfile` uses `node:20-alpine`) and **Vite 8** (current `frontend/package.json` pins `^6.2.0`, a two-major-version jump). These are easy to miss because they don't appear in the two documents this plan was originally built from. Verified against the actual dependency trees and current release notes (as of July 2026) rather than assumed generically:

**Node 20 → 22 — low risk, confirmed by code inspection.** The real breaking changes in this range are: removal of `crypto.createCipher`/`createDecipher`, deprecation of `new crypto.Hash()`, removal of `util.is*()` helpers, blocked direct `.bat`/`.cmd` spawning on Windows, and a native-addon ABI bump (`NODE_MODULE_VERSION` 127 — any binary addon needs rebuilding against Node 22). A grep of `backend/src` for all of these turns up **zero usages**, and there are no native binary dependencies in `backend/package.json` (no `bcrypt`, `sharp`, or similar) — the ABI bump doesn't apply. `@types/node` is already pinned to `^22.14.0`, ahead of the actual runtime; only the Dockerfile (`node:20-alpine`) and both CI workflows (`node-version: '20'` in `basic-app-test.yml` and `no-regression-app-test.yml`) need bumping alongside it, or CI will keep testing against a different Node version than production runs.

**Vite 6 → Vite 8 — medium/high risk, with one confirmed hard blocker.** This is two major version jumps stacked, not one:
- **Vite 7** requires Node 20.19+/22.12+ (compatible with the planned bump), drops the legacy Sass API, changes CJS default-import interop, and switches the default CSS minifier from esbuild to **Lightning CSS**.
- **Vite 8** replaces the entire bundling pipeline with **Rolldown** (Rust-based, replacing esbuild+Rollup) — an architectural change, not just a version bump. `build.rollupOptions` is renamed `build.rolldownOptions`.

**Confirmed blocker:** `frontend/package.json` pins `@tailwindcss/vite` at `^4.1.14`, whose `peerDependencies` declare `"vite": "^5.2.0 || ^6"` — **incompatible with Vite 7/8 as currently pinned**. This isn't theoretical: `npm install` (or a strict peer-dep resolver) would fail, or the plugin would silently misbehave, until `@tailwindcss/vite` is bumped to at least `4.2.2` (which added Vite 8 support, released March 2026 — the same month Vite 8 itself shipped). `@vitejs/plugin-react` (currently `^5.0.4`) does not need a forced bump — v5 is confirmed to work with Vite 8.
- Other frontend dependencies (`react`, `react-router-dom`, `recharts`, `motion`, `lucide-react`) are plain React libraries with no Vite-plugin surface — low risk, but worth a smoke pass for the CJS interop change above.
- If Phase 12 (SCSS) is also adopted, note the Sass **legacy API removal** in Vite 7 interacts with that decision: the template's `sass` (`^1.93.2`, per its `frontend/package.json`) already targets the modern Dart Sass API, so this is fine as long as the modern compiler API is used, not `render()`/`renderSync()`.
- **Timing note:** Vite 8 shipped ~4 months before this plan was written, and its Tailwind plugin support landed the same month — this is a "just barely supported" target, not a settled one, which carries more day-2-bug risk than staying one version behind.

**Mitigation:** bump `@tailwindcss/vite` to `>=4.2.2` in the same change as the Vite bump — treating this as a version-number edit on `vite` alone will break the build. Follow the official incremental path for non-trivial projects (6→7, verify dev/build, then 7→8) rather than jumping straight to 8, given `@tailwindcss/vite`'s history of lagging behind Vite majors. Confirm the deployment container actually runs Node 22 at runtime (Dockerfile + both CI workflows, not just `package.json`/`@types/node`).

### 2.5 Auth cutover invalidates all existing sessions and, if data isn't mapped, all existing local records
Moving from a locally-issued JWT (keyed on the local MongoDB `_id`) to a dblue-office-issued JWT tied to `dblueOfficeId` means no existing token or local user record carries over automatically. Anyone testing against a staging environment that already has dev/seed data will see everyone "logged out" and, on next login, get **new** local records unless `dblueOfficeId` is explicitly backfilled for existing users.
**Mitigation:** decide up front (plan §6, item 4) whether existing dev/staging data needs to survive. If yes, this requires a client-provided mapping (dblue-office user ID per existing employee) — there is no way to derive this mapping from data already in the app, since the local model has no dblue-office identifier today.

### 2.6 Cookie domain / cross-subdomain auth is easy to misconfigure silently
The template's env example uses `COOKIE_DOMAIN=.dblue.it` for staging/production. If this app's actual domain doesn't share that parent domain, or if `SameSite`/`Secure` cookie attributes aren't set consistently with how the frontend and backend origins relate (same-origin in the monorepo/Coolify model vs. cross-origin in the "separate services" alternative from §6.1 of the plan), the cookie can silently fail to be sent — manifesting as "login succeeds, but every subsequent request looks unauthenticated," which is much harder to debug than an explicit error.
**Mitigation:** confirm the actual staging/production domain(s) before Phase 4, and test the cookie round-trip against real staging dblue-office early, not just against a local mock.

### 2.7 Google OAuth authorized origins gate every environment independently
The Client ID is currently authorized only for `http://localhost:5174`. Each new environment (staging, production, and any preview/PR environment) needs its origin registered in Google Cloud Console **before** Google sign-in will work there — otherwise it fails with an opaque origin-mismatch error that looks like a code bug.
**Mitigation:** confirm who has edit access to that Google Cloud project; register staging/production origins as soon as domains are final, not at deploy time.

### 2.8 Cron-as-a-separate-process only helps if something actually restarts it independently
Phase 9's benefit (HTTP crash doesn't stop the nightly auto-confirm job) only holds if the deployment platform actually runs and restarts the cron process independently — the plan's own text notes this requires a process manager (PM2) or Coolify's scheduler. If the cron script is deployed but nothing supervises it separately, a crash in that process now fails silently (no HTTP server crash to notice), which is arguably worse than the current single-process setup where a cron crash would at least share visible logs/restarts with the HTTP server.
**Mitigation:** confirm Coolify's scheduled-job feature (or an equivalent process supervisor) is actually configured for the `cron` script before considering Phase 9 done — "the code change is small" (per the plan) is true but insufficient on its own.

### 2.9 The 113-test e2e suite is a full rewrite, not a path update, and creates a coverage gap
The suite depends on `?dev=true` + reading the JWT from `localStorage` (impossible once the token is in an `httpOnly` cookie), bare route paths, and `page.route()`-based capacity mocking tied to the current data model. Every fixture (`auth.ts`, `dailyDetail.ts`, `testAdmin.ts`) needs to be rebuilt against cookie-based auth and `/api/v1/` routes. Until Phase 10 lands, **the migrated app has materially less regression coverage than `dblue-app` does today** — a real risk given how much of this suite's value came from catching genuine, previously-undiagnosable bugs (documented at length in `CLAUDE_MEMORY.md`).
**Mitigation:** do not treat Phases 1–9 as "done" on manual verification alone; prioritize getting a minimal smoke subset of the e2e suite running early (login + one booking flow) rather than deferring all e2e work to the very end.

---

## 3. Organizational / process risk specific to this project

### 3.1 Parallel work on `dblue-app` during the migration window
Per this repository's own session history, `dblue-app` has been under active, continuous bug-fixing (dozens of PRs across many sessions — colleague avatars, capacity races, retrofit flow, accessibility gaps, etc.), some of it very recent and some still pending merge or product decisions (e.g. the sick-leave overnight-confirmation behaviour). Because the migration happens in a **separate, empty `<TARGET>` repository** rather than in-place, any fix landed in `dblue-app` after the migration's starting snapshot does **not** automatically appear in `<TARGET>`.

Two failure modes to avoid:
- Silent divergence: a bug already fixed in `dblue-app` reappears in `<TARGET>` because the migration was based on an older snapshot, and gets "rediscovered" and fixed twice.
- Wasted fixing effort: continued bug-fixing work on `dblue-app` after the migration is underway, for a codebase that will be superseded, without a clear plan for porting those fixes forward.

**Mitigation:** agree explicitly with the client on a cutoff point — either freeze `dblue-app` bug-fixing once migration starts (recommended, given the scale of the auth/data-layer changes), or designate someone responsible for periodically diffing merged `dblue-app` fixes against `<TARGET>` and porting the relevant ones.

### 3.2 SCSS conversion scope is genuinely open-ended
Phase 12 is explicitly optional and the client document itself calls it "the most time-consuming change." Unlike the other phases, its effort scales with UI surface area rather than with a fixed integration contract, and doing it thoroughly touches nearly every component. If the client wants ecosystem-wide visual consistency, this is legitimate work — but it should be scoped and estimated separately from the rest of the migration, and should not block the Required items above it.
**Mitigation:** keep Phase 12 fully decoupled from Phases 0–11 in scheduling; do not let its timeline uncertainty pressure the auth/data-integration work, which is the part that actually blocks production deployment.

---

## 4. Medium/low risk items

| Item | Risk | Note |
|---|---|---|
| Express 4 → 5 | Low | Template already runs it; mechanical for a project this size |
| `fetch` → axios | Low | Isolated to `services/api.ts` and call sites |
| Route prefix rename | Low, but easy to miss a spot | Purely mechanical; verify with a full grep pass, not sampling |
| Accessibility: `<div>` → `<button>` | Medium | Changes DOM structure that current e2e selectors and CSS may target directly; batch with Phase 10 (e2e rewrite) rather than doing it independently, to avoid touching test selectors twice |
| RBAC granularity (5 roles today) | **Resolved, keep in mind** | Confirmed by the client discussion document (§5d): the 5-role RBAC stays app-managed, read from the local User record, not from dblue-office's `session.role`/`tool_access`. `AGENTS.md`'s generic template convention (role/tool_access sourced from dblue-office) does **not** apply here unless the client explicitly changes that instruction — don't let the generic template docs override the app-specific one on this point. |
| Password reset flow (email/password users) | Low, now fully specified | `AGENTS.md` gives exact routes (`POST /forgot-password`, `PUT /reset-password`) and pages — straightforward copy from the template, no design work needed |

---

## 5. How to use this document

Each item above that says "Mitigation" is either an action to take before/during the relevant phase, or a question to resolve with the client before that phase starts. Cross-reference `docs/migration-plan.md` §6 (open decisions) and §5 (access needed) — several of these risks are only resolved once those items are answered.
