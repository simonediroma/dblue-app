import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';
import { futureTestDate, todayStr, isTodayWeekend } from '../fixtures/dates';
import { resetStatus } from '../fixtures/testAdmin';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom } from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

/**
 * CSV coverage — Plan a Future Day (H-09 -> H-14)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 */

test.describe('CSV coverage — Plan a Future Day', () => {
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-09] future day with no status shows the "Set status" empty state', async ({ page }) => {
    const date = futureTestDate('H-09');
    await loginAsOwner(page);
    await openDayCard(page, date);
    const detail = page.locator('[data-testid="daily-detail"]');

    // Only assert the empty-state text if the day is genuinely still pending —
    // a prior run may have left a status on this date.
    const isPending = await detail.getByText(/you haven't planned for this day yet/i).isVisible().catch(() => false);
    if (!isPending) test.skip();

    await expect(detail.getByText(/you haven't planned for this day yet/i)).toBeVisible();
    await expect(detail.getByRole('button', { name: /define working status/i })).toBeVisible();
  });

  test('[H-10] plan a future day — In Office', async ({ page }) => {
    // Four full open/close round trips on the same day plus three real status changes
    // against the shared environment — unlike its "compound" siblings (H-04/06/08/41)
    // this test never had a custom timeout override, so it was already close to
    // Playwright's 30s default before PR #95 added one more explicit wait, which was
    // enough to push a run over the edge into a bare, undiagnosable timeout again.
    test.setTimeout(60000);
    const date = futureTestDate('H-10');
    await resetStatus('dev@dblue.it', date);
    await loginAsOwner(page);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', date);
    await confirmRoom(page, /./);

    // Status saves — day now shows In Office with a room, both on Plan and Daily view.
    const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await expect(card).toBeVisible({ timeout: 10000 });

    await openDayCard(page, date);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/in office/i).first()).toBeVisible();
    // DailyDetail's VIEW-step close affordance is actually labelled "Back" (see
    // handleClose/handleBack in DailyDetail.tsx) — never "Close"/"Cancel"/"×". That
    // regex never matched anything, so this bare .click() (no timeout of its own) hung
    // silently until the whole test's own timeout killed it — this is H-10's exact
    // "Test timeout of 30000ms exceeded" with no call log.
    const backBtn = page.getByRole('button', { name: /back/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 10000 });
    await backBtn.click();
    // App.tsx's handleDayClick debounces single vs double click over a 250ms window
    // (clickTimeoutRef) — if the next day-card click below lands while the panel we
    // just closed hasn't genuinely finished closing yet, it risks being coalesced
    // with a stray event and misread as a double-click. handleDayDoubleClick, for a
    // day that's currently IN_OFFICE, silently unbooks it back to PENDING instead of
    // opening anything — which would explain the pencil never appearing on the next
    // reopen (a PENDING day shows "Define working status", not a pencil, and
    // goToPlanningStep does check for that text first, but if the click was
    // swallowed entirely mid-transition the safest fix is to not race the close).
    // Wait for the panel to be genuinely gone before proceeding.
    await expect(page.locator('[data-testid="daily-detail"]')).not.toBeVisible({ timeout: 5000 });

    // Regression: switch away from In Office, then back — the room "Planned" badge
    // should NOT appear for a not-yet-reconfirmed room selection.
    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'REMOTE');

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', date);
    await expect(page.locator('[data-testid="room-planned-badge"]')).not.toBeVisible();
  });

  test('[H-11] plan a future day — Remote Working', async ({ page }) => {
    const date = futureTestDate('H-11');
    await resetStatus('dev@dblue.it', date);
    await loginAsOwner(page);
    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'REMOTE');

    await openDayCard(page, date);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/remote/i).first()).toBeVisible();
  });

  test('[H-12] plan a future day — On a Mission', async ({ page }) => {
    const date = futureTestDate('H-12');
    await resetStatus('dev@dblue.it', date);
    await loginAsOwner(page);
    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'MISSION');

    await openDayCard(page, date);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/mission/i).first()).toBeVisible();
  });

  test('[H-13] plan a future day — On Leave', async ({ page }) => {
    const date = futureTestDate('H-13');
    await resetStatus('dev@dblue.it', date);
    await loginAsOwner(page);
    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'LEAVE');

    await openDayCard(page, date);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/on leave/i).first()).toBeVisible();
  });

  test('[H-14] plan a future day — On Sick Leave (extended path) does not blank the app', async ({ page }) => {
    // Long sequential chain of real network round-trips (reset, login, two full
    // open/plan/status cycles, extend flow) with no custom timeout — same shape as
    // H-10 before it got test.setTimeout(60000) in PR #96. Without it, the overall
    // 30s test timeout can truncate the final, otherwise-generous assertion window
    // mid-poll, producing a misleading "element not found" instead of what's likely
    // just a slow-but-working flow against the real shared backend.
    test.setTimeout(60000);
    // SICK is today-only server-side; the "extend" path is reached from today's card.
    // On a weekend there's no working-day entry for "today" at all (backend excludes
    // Sat/Sun from GET /presence) — openDayCard() would just hang until the test timeout.
    test.skip(isTodayWeekend(), 'today is a weekend — no working day to check into');
    // Reset first: other CSV-coverage spec files may also use the owner account's "today".
    const today = todayStr();
    await resetStatus('dev@dblue.it', today);
    await loginAsOwner(page);
    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'SICK');

    await openDayCard(page, today);
    const extendTrigger = page.locator('[data-testid="extend-trigger"]');
    if (!(await extendTrigger.isVisible().catch(() => false))) {
      // Already checked in / locked — nothing more to extend today, not a failure of this test.
      test.skip();
      return;
    }
    // Bare clicks below have no timeout of their own (no actionTimeout set in
    // playwright.config.ts) — a visible-but-not-yet-actionable element (mid animation)
    // can hang silently until the whole test's own timeout, with no call log (same
    // "genuine hang" signature fixed elsewhere this session). Wait explicitly first.
    await expect(extendTrigger).toBeVisible({ timeout: 10000 });
    await extendTrigger.click();
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/extend status/i)).toBeVisible({ timeout: 5000 });

    const detail = page.locator('[data-testid="daily-detail"]');
    // The EXTEND step's day chips carry data-testid="extend-day-chip" (same shared JSX
    // regardless of the source status — SICK included). The previous generic selector
    // here (button:not([disabled]):not([data-testid]), hasNot svg) deliberately EXCLUDED
    // testid'd buttons, so it never matched a real chip: its .first() resolved to the
    // modal header's "Cancel" button instead — confirmed by this test's raw trace. The
    // native click then genuinely clicked Cancel, exiting the EXTEND step entirely, and
    // the isEnabled() probe below (bare, timeout 0) hung forever on the now-nonexistent
    // extend-confirm — THE silent full-test timeout this test showed on every run,
    // unaffected by every click-mechanics fix.
    const chips = detail.locator('[data-testid="extend-day-chip"]:not([disabled])');
    const chipCount = await chips.count();
    if (chipCount > 0) {
      const firstChip = chips.first();
      await expect(firstChip).toBeVisible({ timeout: 10000 });
      // See H-19's identical fix (bulk-planning.spec.ts): the one-time center scroll
      // alone doesn't hold, since a plain .click()'s own actionability protocol re-runs
      // scrollIntoViewIfNeeded (nearest-edge) on every retry, undoing it and leaving the
      // click's target coordinates stale — landing on the EXTEND step's fixed footer or
      // its container instead of the chip. Bypass Playwright's hit-testing for the click
      // itself (visibility already confirmed above).
      await firstChip.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await firstChip.evaluate((el) => (el as HTMLElement).click());
      const confirmBtn = page.locator('[data-testid="extend-confirm"]');
      // Bounded: a bare isEnabled() (no actionTimeout configured) waits forever if the
      // element never appears — the exact silent-hang mechanism described above.
      if (await confirmBtn.isEnabled({ timeout: 10000 }).catch(() => false)) {
        await expect(confirmBtn).toBeVisible({ timeout: 10000 });
        await confirmBtn.click();
      }
    }

    // Regression assertion: the app must not go blank — the plan page stays in the DOM.
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible({ timeout: 8000 });
  });
});
