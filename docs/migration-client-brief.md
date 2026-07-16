# Migration to Deep Blue Infrastructure — Client Brief

> Purpose of this document: give a clear, complete picture of **timeline** and **risk** for this migration, and specifically enough information to decide **whether the Node 22 / Vite 8 version bumps should be mandatory for this project or not**. It summarizes `docs/migration-plan.md` (full phase-by-phase plan) and `docs/migration-risks.md` (full risk register) — read those for implementation detail; this document is for the decision, not the how.

---

## Bottom line

- The migration itself (auth rewrite, dblue-office integration, real-time, tooling) is well-specified and, with one exception, low-surprise: we've cross-checked the client-provided documents (`MIGRATION.md`, `AGENTS.md`, `OFFICE_API.md`) against the actual application code and confirmed they're implementable as described, with a handful of corrections noted below.
- **Estimated timeline: 5–7 calendar weeks** for one developer, for everything required to deploy to production — not counting the optional Tailwind→SCSS conversion, which is a separate, deferrable body of work.
- **The Node 22 bump is low-cost and low-risk.** We recommend doing it regardless of what's decided below.
- **The Vite 8 bump is the one item in this migration with a real, confirmed technical blocker** (detailed in §3) and comes from a document (`AGENTS.md`) that describes Deep Blue's *general* tooling template, not a requirement specific to this application. That makes it a genuine decision point, not just an engineering task — this document lays out the options so you can make that call with full visibility.

---

## 1. Timeline

| Phase | What it covers | Estimate |
|---|---|---|
| Preconditions | Confirm repo/decisions/access | 0.5–1 day (+ wait time) |
| App structure clean-up | Split the 1,419-line `App.tsx` | 1–2 days |
| Deployment scaffold | Monorepo structure for Coolify | 1 day |
| User model migration | Link to dblue-office user IDs | 2–3 days |
| **Authentication rewrite** | Cookie-based auth, Google Identity Services, email/password | 4–5 days |
| dblue-office data integration | Users, rooms, closures via proxy routes | 3.5–5 days |
| Fix 3 hardcoded values | Real capacity, real presence targets, dynamic "today" | 1 day |
| Express 5 / axios / **Node 22 & Vite 8** | Dependency and tooling updates | 1.5–3 days |
| Real-time (socket.io) | Replace the current WebSocket implementation | 2–3 days |
| Cron as separate process | Operational resilience | 0.5–1 day |
| **Automated test suite rewrite** | 113 existing end-to-end tests, all need rebuilding against the new auth model | 5–8 days |
| Accessibility fixes | Keyboard navigation, screen reader support | 2–3 days |

**Total: ~24–35 working days ≈ 5–7 calendar weeks**, for one developer, assuming no long waits on access/decisions from your side and no surprises beyond the one gap already flagged in `OFFICE_API.md`'s example response (§4 of `migration-risks.md`).

**Not included above — optional, decide separately:** converting the current Tailwind CSS styling to SCSS modules (Deep Blue's internal convention). This is explicitly the most time-consuming item in the source documents themselves, scales with UI surface rather than a fixed contract, and doesn't block anything else. Estimated **5–10+ working days** depending on how incrementally it's done. We recommend deciding this independently of the rest of the timeline, and treating it as the first thing to cut if the schedule needs to shrink.

---

## 2. Risk landscape

Full detail in `docs/migration-risks.md`. The short version, organized by what it means for you:

**Things that will just work, low risk:**
Express 5, axios, the route prefix rename, the password-reset flow (fully specified, straightforward copy from the template). Confirmed the app's 5-role permission system stays under your control, not handed to dblue-office, per your own discussion document — no loss of granularity there.

**Things that need care during implementation, but are well understood — no decision needed from you:**
- Copying the template's real-time (socket.io) code verbatim would silently undo a role-visibility bug fix already shipped in the current app. We know this going in and will port the existing logic rather than discard it.
- Booked rooms currently are recorded by name; the new integration requires recording them by dblue-office's room ID instead. This touches more of the codebase than it first appears (several screens compare rooms by name today) — scoped into the relevant phase, not a surprise later.
- A handful of already-known app bugs (teammate avatars not displaying correctly, a stale room label after changing status) sit exactly where the user model changes anyway — cheapest to fix once, now, rather than twice.

**Things that need a decision or input from you before we can proceed (full list in `migration-plan.md` §5):**
- Whether to preserve existing dev/staging data through the migration (requires a user-ID mapping from dblue-office).
- Deployment structure preference (monorepo, as you've indicated, vs. separate services).
- Access: the new repository, Google Cloud Console origin registration for each environment, the shared JWT secret per environment, staging/production domain confirmation.

**Process risk worth naming explicitly:** this migration is built in a fresh repository, not in place. If bug-fixing work continues on the current app in parallel, fixes made there won't automatically appear in the new codebase. We recommend agreeing on a cutoff point once migration work starts.

---

## 3. The decision: should Node 22 / Vite 8 be mandatory?

### Where this requirement comes from

Neither your original technical review document nor the phase-by-phase `MIGRATION.md` guide mentions specific Node.js or Vite versions. The requirement comes from a third document, `AGENTS.md` — which describes the **general-purpose template** all of Deep Blue's internal tools are built from, not something specific to the presence app. Its technology table states Node 22 and Vite 8 as fixed constraints. That's a reasonable default for a template meant to serve many tools consistently — but it's worth treating as an open decision for this specific project rather than an automatic requirement, since it's not something your own review of this app asked for.

### Node.js 20 → 22

We checked the actual backend code against every behavior that changes between these versions (removed/changed cryptography functions, native-module compatibility, deprecated utility functions). **None of it is used anywhere in this codebase**, and the backend has no native (compiled) dependencies that the version bump would affect. This is close to a non-decision: low cost, no meaningful risk, no reason to defer it.

**Recommendation: do this regardless of the Vite decision below.**

### Vite 6 → Vite 8

This is a bigger jump — two major versions, and the newer one (Vite 8, released ~4 months ago) replaced its entire internal build engine with a new Rust-based one (Rolldown). We found one concrete, confirmed problem: the plugin this app uses to run Tailwind CSS through Vite is currently pinned to a version that **explicitly refuses to work with Vite 7 or 8** — it would need to be upgraded in the same change, and that newer version has itself only supported Vite 8 for about four months. In short: this specific combination is functional today, but it's a recent, still-settling combination, not a mature, long-tested one.

This doesn't mean it's unsafe — it means it carries more "day-two surprise" risk than a target that's been stable for a year, and the cost of getting there (a compatibility pass, an incremental upgrade path rather than a direct jump, and a full visual/functional check afterward) is real, not just a version number in a config file.

### Your options

| Option | What it means | Timeline impact | Risk |
|---|---|---|---|
| **A — Full compliance now** (Node 22 + Vite 8) | Match the template's stated constraints exactly | As estimated above (~1.5–3 days for this phase) | Medium — the Tailwind-plugin blocker is real but resolvable; some chance of needing a follow-up fix shortly after launch as the Vite 8/Tailwind combination matures |
| **B — Node 22 now, Vite 7 as an interim step** | Modernize the runtime fully; take the frontend one major version forward, hold off on the Rolldown-based Vite 8 | Similar or slightly less than Option A | Lower — avoids the newest, least-proven combination while still moving off the current version; would need a second, smaller bump later to reach full compliance |
| **C — Node 22 now, keep Vite 6 for this migration** | Defer the frontend build-tool change entirely; revisit as a separate, later piece of work | Saves roughly the Vite-specific portion of Phase 7 (partial day) | Lowest for this migration, but leaves the app furthest from the stated template standard, and the eventual bump still has to happen at some point |

**Our recommendation, for what it's worth:** Option B. It gets the meaningful, low-risk win (Node 22) done immediately, moves the frontend build tooling forward rather than freezing it, and avoids committing this migration's timeline to the least mature part of the stack (the Rolldown-based Vite 8 + its still-fresh Tailwind plugin support) — while keeping full Vite 8 compliance realistically one small follow-up away rather than a large future migration.

This is a recommendation, not a decision made on your behalf — the trade-off is genuinely between "match the template exactly, accept slightly more day-two risk" and "modernize almost all the way, defer the newest and least-proven piece." We're happy to go with whichever the team prefers once you've seen the trade-off.

---

## 4. What we need from you to move forward

1. **The Node/Vite decision above** (Option A, B, or C).
2. Confirmation of deployment structure (monorepo vs. separate services).
3. Whether the Tailwind→SCSS conversion is in scope for this engagement, or deferred.
4. Whether existing dev/staging data needs to be preserved through the migration.
5. Repository, access, and credential items listed in full in `docs/migration-plan.md` §5 (Google Cloud Console access for origin registration, shared JWT secret per environment, staging/production domain confirmation, MongoDB URIs, Coolify access).

Once these are confirmed, we can lock the timeline in §1 and start Phase 0.
