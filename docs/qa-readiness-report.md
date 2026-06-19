# QA Readiness Report — Presence App
> Prepared for the testing team as a companion to the requirements Excel.  
> Last updated: 2026-06-19

---

## TL;DR — What Is Ready to Test

All major modules are implemented and deployed. You can start testing immediately across the full application. The table below gives a quick readiness signal per module, followed by a list of **known gaps** that are intentional or already tracked — please do not log these as bugs.

---

## Module Readiness Overview

| Module | Feature area | Ready to test | Notes |
|--------|-------------|:-------------:|-------|
| **Auth** | Google OAuth login (`@dblue.it` only) | ⚠️ | **Requires GCP setup before it can be tested** — OAuth consent screen and credentials must be configured on Google Cloud Platform first (see "Out of Scope" section). Use dev login in the meantime. |
| **Auth** | Dev login (email + password) | ✅ | Only available in staging; hidden in production |
| **Auth** | Logout | ✅ | |
| **Auth** | Protected routes (redirect to `/login`) | ✅ | |
| **Users** | Search colleagues by name / email | ✅ | `GET /users?search=` |
| **Users** | Update project teammates (max 5) | ✅ | |
| **Users** | Update preferences (theme, notifications, accessibility) | ✅ | |
| **Onboarding** | First-time flow: select up to 5 project teammates | ✅ | Shown once on first login |
| **Rooms** | Room list filtered by role | ✅ | See role matrix below |
| **Rooms** | Create / edit / deactivate room (owner only) | ✅ | |
| **Rooms** | Block deactivation if future bookings exist | ✅ | Should return a conflict error |
| **Working Status** | Set daily status (in office / remote / mission / leave / sick / parental leave) | ✅ | |
| **Working Status** | Bulk-set status across multiple days | ✅ | |
| **Working Status** | Sick leave restricted to current day only | ✅ | Future dates should be rejected |
| **Working Status** | Sick leave confirmation email | ⚠️ | **Cannot be tested** — SMTP not configured on Railway. The sick status itself can be tested; email delivery cannot. |
| **Working Status** | Off-time (morning / afternoon / custom hours) | ✅ | |
| **Working Status** | Block modification of a confirmed day | ✅ | |
| **Working Status** | Retrofit (correct previous month's status) | ✅ | Own retrofit: any role; admin retrofit for other users: director/owner only |
| **Desk Booking** | Auto-downgrade to waiting list when office is full | ✅ | Booking `in_office` when capacity is reached should return `waiting_list` |
| **Desk Booking** | FIFO waiting list promotion when a desk frees up | ✅ | Cancel an in-office booking → first person in waiting list gets promoted |
| **Desk Booking** | Waiting list promotion email | ⚠️ | **Cannot be tested** — SMTP not configured on Railway. The promotion logic itself (status change) can be verified, but the email delivery cannot. |
| **Check-in** | "Say Good Morning" — confirm today's presence | ✅ | Only available for the current day |
| **Check-in** | Room + desk selection at check-in | ✅ | |
| **Check-in** | Block check-in if on waiting list | ✅ | |
| **Check-in** | Remote check-in (no room required) | ✅ | |
| **Stats — Personal** | Monthly confirmed days vs. target | ✅ | |
| **Stats — Personal** | Status distribution (in office / remote / mission / leave / sick) | ✅ | |
| **Stats — Personal** | Annual breakdown (month-by-month bar chart) | ✅ | Only shows completed months |
| **Stats — Personal** | Last-minute unbooking count | ✅ | |
| **Stats — Org** | Organisation-wide stats (director/owner only) | ✅ | Average confirmed days, users above/below target |
| **Stats — Org** | Per-colleague drill-down (director/owner only) | ✅ | |
| **Profile** | Theme preference (light / dark / system) | ✅ | Persisted to backend |
| **Profile** | Accessibility preferences (reduced motion, text size, screen reader, high contrast) | ✅ | |
| **Profile** | Notification preferences toggles | ⚠️ | Toggle UI and persistence can be tested. **Email delivery cannot be tested** — SMTP not configured on Railway. Additionally, 4 of 6 notification types (`Status reminder 11:00`, `Status reminder 18:00`, `Project teammate booking`, `Monthly overview`) have no email implementation yet (see Known Gaps #4). |
| **Profile** | Manage project teammates (add / remove) | ✅ | |
| **Real-time** | Live desk count update without page refresh | ✅ | WebSocket broadcast on any booking change |
| **Auto-confirm** | Mission / leave / sick / parental leave auto-confirmed at 23:59 | ✅ | Scheduled job — difficult to test manually without mocking time |

---

## Role × Room Access Matrix

| Role | open_space | lab | admin | management |
|------|:----------:|:---:|:-----:|:----------:|
| employee | ✅ | ❌ | ❌ | ❌ |
| lab_responsible | ✅ | ✅ | ❌ | ❌ |
| admin_member | ✅ | ✅ | ✅ | ❌ |
| director | ✅ | ❌ | ❌ | ✅ |
| owner | ✅ | ✅ | ✅ | ✅ |

> ⚠️ **Known gap:** the frontend correctly hides rooms the user cannot access, but the backend does not yet re-validate the room type at booking time. A room-type bypass via a direct API call is currently possible. This is tracked and will be fixed — **do not log as a new bug**.

---

## Known Gaps — Do Not Log as Bugs

These items are already tracked on the development side. Filing them again as bugs would create noise. If you observe a behaviour that is not in this list and looks wrong, please do log it.

| # | What | Observed behaviour | Expected per spec | Status |
|---|------|--------------------|-------------------|--------|
| 1 | Room-type validation at booking | A user with `employee` role can book a lab room via direct API call | Backend should reject with 403 | In backlog |
| 2 | Colleague visibility by area | All roles see all colleagues' presence (not filtered by organisational area) | Employees should only see colleagues from their own area + project teammates | In backlog — User model currently has no `area` field |
| 3 | Standard unbooking count | `unbooking.standard` always shows 0 in Stats | Should count bookings cancelled with sufficient advance notice | In backlog — requires a new model field (`wasUnbooked`) |
| 4 | Notification emails for some preference toggles | Toggling `Status reminder at 11:00`, `Status reminder at 18:00`, `Project teammate booking`, `Monthly overview` saves the preference but sends no email | These toggles should trigger actual notifications | Stubs — email templates not yet implemented |
| 5 | JWT in session vs. cookie | Auth token is stored in `sessionStorage` instead of an `httpOnly` cookie | Original spec called for a cookie | Deliberate decision due to cross-domain CORS on Railway; not a bug |

---

## Suggested Testing Priority

Given the team bandwidth, I suggest tackling modules in the following order — starting from the user-facing flows most likely to have edge cases, then moving to admin/role-restricted features.

1. **Auth flow** — Google login, rejection of non-`@dblue.it`, logout, protected route redirect.
2. **Onboarding** — First-login flow, teammate selection, skip path.
3. **Working Status** — All 9 status types, date validation (sick on future date), confirmed-day block, bulk update.
4. **Desk Booking + Waiting List** — Capacity limit triggers `waiting_list`, FIFO promotion, last-minute unbooking flag.
5. **Check-in** — All three paths (in_office with room, office_no_desk, remote), wrong-day attempt, waiting-list block.
6. **Off-time** — Set / update / delete morning, afternoon, custom hours.
7. **Retrofit** — Own previous-month correction, director correcting another user, block on current month.
8. **Stats** — Monthly and annual personal stats, organisation view (requires director/owner account).
9. **Profile** — Theme, accessibility, notification toggles, teammate management.
10. **Real-time** — Book/cancel a desk on device A, observe live count update on device B.
11. **Room management** — Create, edit, deactivate; block deactivation with active bookings (owner account required).
12. **RBAC** — Confirm that each role sees only the rooms and data they are allowed to access.

---

## Test Account Setup

To cover all role scenarios, you will need at least the following accounts in the staging environment:

| Role | Purpose |
|------|---------|
| `employee` | Basic presence flow |
| `lab_responsible` | Lab room access |
| `admin_member` | Admin room access |
| `director` | Organisation stats, per-user retrofit |
| `owner` | Room management, role changes, seed endpoint |

If the seed endpoint (`POST /admin/seed`, owner only) has been triggered, 80+ test users are already available in the DB covering all roles.

---

## Out of Scope (not yet implemented at all)

| Feature | Note |
|---------|------|
| ⚠️ **Google OAuth — action required** | OAuth credentials have not yet been configured on Google Cloud Platform. Before Google login can work in any environment, the following steps must be completed manually: (1) create a project on GCP, (2) enable the Google OAuth 2.0 API, (3) configure the **OAuth consent screen** (app name, support email, authorised domain `dblue.it`), (4) create OAuth 2.0 credentials (Web application type), (5) add the Railway backend callback URL as an authorised redirect URI (`https://<backend-url>/auth/google/callback`), (6) copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into the Railway backend environment variables. Until this is done, **dev login is the only available auth method** in staging. |
| ⚠️ **SMTP email delivery — action required** | SMTP credentials are not configured on Railway. All email notifications (waiting list promotion, sick leave confirmation) are silently logged to the backend console instead of being sent. To enable: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in the Railway backend environment variables. Until then, **any feature involving email delivery cannot be fully tested** (marked ⚠️ in the table above). |
| E2E tests (Playwright) | Test files exist in `e2e/` but cannot run in CI until Google OAuth is configured |
