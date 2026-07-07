# E2E test suite

Playwright suite for the Presence App frontend + backend. Two kinds of coverage live side
by side in `tests/`:

- **Regression / smoke tests** (the original 11 spec files) — mostly built with
  `page.route()` API mocking, targeted at specific historic bugs/PRs. Untouched by the
  CSV-coverage work below.
- **CSV coverage** — one `test()` per row of the manual QA spreadsheet (`Ref` column
  `H-01`…`H-46`, plus a handful of unnamed rows given synthetic IDs), tagged
  `test.describe('CSV coverage — <Area>')`. These hit the **real backend/DB** — no
  `page.route()` mocking — because the CSV exists specifically to catch real
  backend+frontend integration bugs that a mocked response would hide.

## Environment

**There is no local dev environment for this suite.** It runs against the shared
Railway dev environment — the same one manual QA testers use.

1. `cd e2e && cp .env.example .env`, then fill in:
   - `BASE_URL` / `API_BASE_URL` — the Railway dev frontend/backend URLs (ask, or reuse
     the values already configured as `RAILWAY_FRONTEND_URL` / `RAILWAY_BACKEND_URL`
     GitHub Actions secrets).
   - `DEV_LOGIN_PASS` — the shared password for all 6 dev-login accounts on that
     environment.
2. `npx playwright test`.

The backend must already have `ENABLE_DEV_LOGIN=true` and be seeded (`npm run seed:fresh`
in `backend/`) — this suite never seeds or reseeds the database itself (destructive, and
would fight with the shared environment other people are testing against).

### Test-only backend endpoints

A handful of scenarios can't be reached through the real UI/API on demand (filling the
office to capacity, resetting an account's onboarding flag, simulating the nightly
auto-confirm cron). These are served by `backend/src/routes/admin-test.routes.ts` — a
small router gated by the same `ENABLE_DEV_LOGIN` flag as `/auth/dev-login`, owner-only,
wired through `e2e/fixtures/testAdmin.ts`:

| Endpoint | Used for |
|---|---|
| `POST /admin/test/fill-capacity` | H-40 (waiting list) — books real seats with real seeded colleagues |
| `POST /admin/test/clear-capacity` | Teardown for the above |
| `POST /admin/test/reset-onboarding` | H-01 — forces a fresh onboarding screen |
| `POST /admin/test/reset-status` | Lets multiple spec files reuse the same 6 dev-login accounts for "today" without colliding with each other |
| `POST /admin/test/simulate-confirm` | H-39, H-43 — simulates what the nightly cron would have done, without waiting for it |

**This router must be deployed to Railway** before any test that uses it (H-01, H-40,
H-39, H-43) can pass. Every other test only needs the app itself.

## Running the suite

```bash
npx playwright test                                                    # everything
npx playwright test tests/teammates.spec.ts                            # one area, dedicated file
npx playwright test tests/bulk-planning.spec.ts --grep "CSV coverage"  # one area, shared file (see table below)
npx playwright test --grep "H-09"                                     # one CSV row, anywhere
npx playwright test --grep "CSV coverage"                              # all CSV coverage, every area
npm run test:csv                                                       # shortcut for the line above
npm run test:area -- "Teammates"                                       # shortcut for --grep
```

Every CSV-coverage test's title starts with its CSV `Ref` in brackets — `[H-09] ...` —
so `--grep "H-09"` always selects exactly one test.

## Area → file map

| CSV Area | Ref range | File |
|---|---|---|
| Teammates | H-01…H-08 | `tests/teammates.spec.ts` |
| Plan a Future Day | H-09…H-14 | `tests/plan-future-day.spec.ts` |
| Bulk Planning | H-15…H-20 | `tests/bulk-planning.spec.ts` (`describe('CSV coverage — Bulk Planning')`) |
| Confirm/Check-In | H-21…H-25, H-25b | `tests/checkin.spec.ts` (`describe('CSV coverage — Confirm/Check-In')`) |
| Modify/Cancel | H-26…H-29, H-26b | `tests/modify-cancel.spec.ts` |
| Sick Leave (Current Day) | H-30 | `tests/sick-leave-today.spec.ts` |
| Permesso | H-31…H-33 | `tests/permesso.spec.ts` |
| Retrofitting | H-34…H-39 | `tests/retrofit.spec.ts` (`describe('CSV coverage — Retrofitting')`) |
| Capacity & Waiting List | H-40, H-40a, H-40b | `tests/capacity.spec.ts` |
| Colleague Visibility | H-41…H-42 | `tests/colleague-visibility.spec.ts` |
| Stats Sanity Check | H-43 | `tests/stats.spec.ts` (`describe('CSV coverage — Stats Sanity Check')`) |
| Role-Specific Booking | H-44…H-46 | `tests/role-booking.spec.ts` (H-44 is `test.fixme` — see the comment in that file) |

## Shared fixtures used by CSV-coverage tests

- `fixtures/auth.ts` — `loginAsDirector`/`loginAsEmployee`/`logout` are the original,
  untouched exports (11 existing files depend on them — note `loginAsDirector` actually
  logs in the **owner**-role `dev@dblue.it` account, a pre-existing naming quirk, left
  as-is). Added additively: `loginAs(page, role)` plus `loginAsOwner` /
  `loginAsLabResponsible` / `loginAsAdminMember` / `loginAsDirectorRole` (the real
  `director`-role account, distinct from the misnamed `loginAsDirector`).
- `fixtures/dates.ts` — `futureTestDate(seedId)` / `prevMonthTestDate(seedId)` /
  `todayStr()`. Deterministic per test ID, always inside the real 30-day planning
  window / previous calendar month.
- `fixtures/dailyDetail.ts` — `openDayCard`, `goToPlanningStep`, `selectStatus`,
  `confirmRoom`, `confirmRetrofit`: the common DailyDetail navigation steps.
- `fixtures/testAdmin.ts` — thin client for the test-only endpoints above.

## Why some of these tests are expected to fail

Many CSV rows describe bugs that are still present. A CSV-coverage test asserts the
**PRD-correct** behavior (the CSV's "Expected Result" column), not "whatever the app
currently does" — so seeing red in the HTML report for e.g. H-38 (retrofit doesn't
block In Office/Remote) or H-31 (Permesso resets the working status) is the suite
working as intended, not a broken test. Treat it as a live signal of which CSV rows are
still open.
