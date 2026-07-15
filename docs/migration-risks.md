# Migration Risks & Critical Points — Presence App → Deep Blue Infrastructure

> Companion to `docs/migration-plan.md`. Read before estimating or committing to a schedule — several items here change phase order or effort in the plan.
> Grounded in this repository's actual code and history (`CLAUDE_MEMORY.md`), not only in the two client documents, since several risks only become visible by reading the current implementation.

---

## 1. A prior recommendation in this repo is now superseded

`docs/valutazione-adattamento-template.md` concluded that adopting the template's dblue-office integration would be premature and regressive, because dblue-office did not exist yet and its proxy routes only returned mock data.

**This is no longer the situation.** The new client documents describe real staging (`staging-tools.dblue.it`) and production (`tools.dblue.it`) dblue-office instances, a provisioned Google Client ID, and a dedicated `OFFICE_API.md`. Anyone referencing the older document's "not yet" conclusion should be pointed to this note — the premise it was built on has changed.

---

## 2. High-risk items

### 2.1 Real-time: copying the template's socket.io files verbatim would regress a shipped fix
`MIGRATION.md` Phase 7 says to replace `websocket.service.ts` with the template's `config/socketHandler.ts` + `services/changeStream.service.ts`. But the current `websocket.service.ts` is not generic — it implements a **per-connection, role-aware capacity breakdown** (`resolveRole()`, `getVisibleRooms()`), the direct result of a real bug fix shipped in this codebase (a role-visibility issue where a director's booking in a role-restricted room wasn't correctly reflected for other roles). If the template's socket.io handler broadcasts one shared, role-blind payload per date, a verbatim copy silently reintroduces that bug.
**Mitigation:** treat Phase 8 as "port the existing role-aware logic onto socket.io's transport", not "swap files". Verification must explicitly test two sessions with *different* roles receiving *different* breakdowns for the same date.

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

### 2.4 `OFFICE_API.md` is referenced but not in hand
Both client documents point to `OFFICE_API.md` for the four proxy routes' request/response shapes. It is **not** among the files vendored into `docs/boooking-app-template-main/` in this repo (only `AGENTS.md` is present). Phases 5 and 6 of the plan cannot be implemented correctly without it — guessing the shape risks a rework once the real document arrives.
**Mitigation:** treat this as a Phase 0 blocker, not a "nice to have before Phase 5" — see `docs/migration-plan.md` §5.

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
| RBAC granularity (5 roles today) | Medium | Confirm dblue-office's role/`tool_access` model can actually express all 5 current roles (`employee`, `lab_responsible`, `admin_member`, `director`, `owner`) before assuming a 1:1 mapping exists |

---

## 5. How to use this document

Each item above that says "Mitigation" is either an action to take before/during the relevant phase, or a question to resolve with the client before that phase starts. Cross-reference `docs/migration-plan.md` §6 (open decisions) and §5 (access needed) — several of these risks are only resolved once those items are answered.
