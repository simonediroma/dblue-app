import { test, expect } from '@playwright/test';
import { loginAsOwner, loginAsEmployee, getAuthHeaders } from '../fixtures/auth';
import { futureTestDate, todayStr, isTodayWeekend } from '../fixtures/dates';
import { resetStatus } from '../fixtures/testAdmin';
import {
  openDayCard,
  goToPlanningStep,
  selectStatus,
  confirmRoom,
  clickAndWaitGone,
} from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

/**
 * CSV coverage — Modify/Cancel (H-26 -> H-29, H-26b)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 *
 * H-27/H-28/H-26b need "today" (the DailyDetail last-minute warning only gates on the
 * exact current day, not "last minute" generally) — each resets its own account's
 * "today" WorkingStatus first via the test-only admin endpoint, so it's safe regardless
 * of what other spec files already did to that account's "today" earlier in the run.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

// Confirming DailyDetail's own last-minute warning can trigger a second, separate
// App-level last-minute dialog (data-testid="last-minute-warning", "Yes, change it").
// For a same-day IN_OFFICE->REMOTE switch (App.tsx's handleUpdateStatus) this second
// dialog is actually deterministic, not merely possible — but its enter animation can
// take longer than a couple hundred ms, so a too-tight check here can miss it (H-28's
// failure: "remote" never applied because this returned false too early, leaving the
// real update stuck pending). Widened from 2000ms; still a soft check via .catch, since
// some callers (e.g. H-30's SICK switch) legitimately never trigger it at all.
async function confirmAppLevelWarningIfPresent(page: import('@playwright/test').Page) {
  const appWarning = page.locator('[data-testid="last-minute-warning"]');
  if (await appWarning.isVisible({ timeout: 8000 }).catch(() => false)) {
    const yesBtn = appWarning.getByRole('button', { name: /yes, change it/i });
    await expect(yesBtn).toBeVisible({ timeout: 5000 });
    await yesBtn.click();
  }
}

test.describe('CSV coverage — Modify/Cancel', () => {
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-26] edit any future day across status combinations', async ({ page }) => {
    const date = futureTestDate('H-26');
    await resetStatus('dev@dblue.it', date);
    await loginAsOwner(page);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', date);
    await confirmRoom(page, /./);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'REMOTE');

    await openDayCard(page, date);
    let detail = page.locator('[data-testid="daily-detail"]');
    await expect(detail.getByText(/remote/i).first()).toBeVisible();
    await expect(detail.getByText(/^in office$/i)).not.toBeVisible();
    // DailyDetail's VIEW-step close affordance is actually labelled "Back" (see
    // handleClose/handleBack in DailyDetail.tsx) — never "Close"/"Cancel"/"×". That
    // regex never matched anything, so this bare .click() (no timeout of its own) hung
    // silently until the whole test's own timeout killed it — this test's exact
    // "Test timeout of 30000ms exceeded" with no call log.
    const backBtn = page.getByRole('button', { name: /back/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 10000 });
    await backBtn.click();

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'MISSION');

    await openDayCard(page, date);
    detail = page.locator('[data-testid="daily-detail"]');
    await expect(detail.getByText(/mission/i).first()).toBeVisible();
  });

  test('[H-27] cancelling an in-office booking <24h shows the last-minute alert', async ({ page }) => {
    // Same reasoning as H-10/H-14: a long chain of real network round-trips (reset,
    // login, two open/plan/status cycles — the first of which can trigger the
    // office-capacity mocked-fallback's own reload+reopen cycle if "today" is full)
    // with no custom timeout can push right up against Playwright's 30s default,
    // truncating the final assertion's own generous wait mid-poll.
    test.setTimeout(60000);
    // On a weekend there's no working-day entry for "today" at all (backend excludes
    // Sat/Sun from GET /presence) — openDayCard() would just hang until the test timeout.
    test.skip(isTodayWeekend(), 'today is a weekend — no working day to check into');
    const today = todayStr();
    await resetStatus('dev@dblue.it', today);
    await loginAsOwner(page);

    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', today);
    await confirmRoom(page, /./);

    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'REMOTE');

    const warning = page.locator('[data-testid="daily-detail-unbooking-warning"]');
    await expect(warning).toBeVisible({ timeout: 5000 });
    await expect(warning.getByText(/last-minute change/i)).toBeVisible();
    // Bare .click() on a just-mounted modal's button has no timeout of its own (no
    // actionTimeout set in playwright.config.ts) — if the enter animation/actionability
    // isn't settled yet, it can hang silently until the whole test's own timeout, with
    // no call log (the same "genuine hang" signature fixed elsewhere in this session,
    // e.g. H-26's Back button). Give it an explicit, bounded wait first.
    const confirmProceedBtn = warning.getByRole('button', { name: /confirm.*proceed/i });
    await expect(confirmProceedBtn).toBeVisible({ timeout: 10000 });
    // No deterministic app-side cause found for the occasional "not stable" -> "detached
    // from the DOM" retry loop on this exact button (checked DailyDetail.tsx: no stray
    // key prop remounting the panel, no effect resetting local state, mutually exclusive
    // step branches) — same class of transient click issue as openDayCard's retry
    // (PR #97), recovered from the same way.
    await clickAndWaitGone(confirmProceedBtn);
    await confirmAppLevelWarningIfPresent(page);

    await openDayCard(page, today);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/remote/i).first()).toBeVisible();
  });

  test('[H-28] last-minute unbooking is saved correctly in the stats', async ({ page }) => {
    // See H-27's comment: same long chain of real network round-trips, no custom
    // timeout, can push right up against Playwright's 30s default.
    test.setTimeout(60000);
    // On a weekend there's no working-day entry for "today" at all (backend excludes
    // Sat/Sun from GET /presence) — openDayCard() would just hang until the test timeout.
    test.skip(isTodayWeekend(), 'today is a weekend — no working day to check into');
    const today = todayStr();
    await resetStatus('dev@dblue.it', today);
    await loginAsOwner(page);

    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', today);
    await confirmRoom(page, /./);

    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'REMOTE');
    const warning = page.locator('[data-testid="daily-detail-unbooking-warning"]');
    await expect(warning).toBeVisible({ timeout: 5000 });
    // See H-27's comment: bare .click() on this modal's button can hang silently.
    const confirmProceedBtn = warning.getByRole('button', { name: /confirm.*proceed/i });
    await expect(confirmProceedBtn).toBeVisible({ timeout: 10000 });
    // No deterministic app-side cause found for the occasional "not stable" -> "detached
    // from the DOM" retry loop on this exact button (checked DailyDetail.tsx: no stray
    // key prop remounting the panel, no effect resetting local state, mutually exclusive
    // step branches) — same class of transient click issue as openDayCard's retry
    // (PR #97), recovered from the same way.
    await clickAndWaitGone(confirmProceedBtn);
    await confirmAppLevelWarningIfPresent(page);

    await openDayCard(page, today);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/remote/i).first()).toBeVisible({ timeout: 5000 });

    const modifyCancelAuthHeaders = await getAuthHeaders(page);
    const meRes = await page.request.get(`${API_BASE}/auth/me`, { headers: modifyCancelAuthHeaders });
    const me = (await meRes.json()) as { id: string };
    const month = today.slice(0, 7);
    const statsRes = await page.request.get(`${API_BASE}/admin/stats/${me.id}/monthly?month=${month}`, { headers: modifyCancelAuthHeaders });
    expect(statsRes.status()).toBe(200);
    const stats = (await statsRes.json()) as { unbooking: { lastMinute: number } };
    expect(stats.unbooking.lastMinute).toBeGreaterThanOrEqual(1);
  });

  test('[H-29] cancelling an office day frees the desk', async ({ page }) => {
    const date = futureTestDate('H-29');
    await resetStatus('mario.rossi@dblue.it', date);
    await loginAsEmployee(page);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', date);
    await confirmRoom(page, /./);

    const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await card.scrollIntoViewIfNeeded();
    const occupancyBefore = await card.locator('[data-testid="daycard-occupancy"]').textContent();
    const bookedBefore = Number((occupancyBefore ?? '0/0').split('/')[0]);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'REMOTE');

    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('[data-testid="daycard-occupancy"]')).toHaveText(/^\d+\/\d+$/, { timeout: 5000 });
    const occupancyAfter = await card.locator('[data-testid="daycard-occupancy"]').textContent();
    const bookedAfter = Number((occupancyAfter ?? '0/0').split('/')[0]);
    expect(bookedAfter).toBe(bookedBefore - 1);
  });

  test('[H-26b] cancelling a last-minute in-office booking works on the employee account', async ({ page }) => {
    // See H-27's comment: same long chain of real network round-trips, no custom
    // timeout, can push right up against Playwright's 30s default. Confirmed via a
    // live trace: the outer unbooking-warning modal was found visible, but the
    // "Confirm & Proceed" button inside it wasn't within its own 10s window — the
    // report's own "mocked-fallback" annotation for this exact test (office was full
    // for "today") means the earlier IN_OFFICE step likely already ran a full
    // reload+reopen cycle, eating into the remaining budget before this final wait.
    test.setTimeout(60000);
    // On a weekend there's no working-day entry for "today" at all (backend excludes
    // Sat/Sun from GET /presence) — openDayCard() would just hang until the test timeout.
    test.skip(isTodayWeekend(), 'today is a weekend — no working day to check into');
    const today = todayStr();
    await resetStatus('mario.rossi@dblue.it', today);
    await loginAsEmployee(page);

    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', today);
    await confirmRoom(page, /./);

    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'REMOTE');
    const warning = page.locator('[data-testid="daily-detail-unbooking-warning"]');
    await expect(warning).toBeVisible({ timeout: 5000 });
    // See H-27's comment: bare .click() on this modal's button can hang silently.
    const confirmProceedBtn = warning.getByRole('button', { name: /confirm.*proceed/i });
    await expect(confirmProceedBtn).toBeVisible({ timeout: 10000 });
    // No deterministic app-side cause found for the occasional "not stable" -> "detached
    // from the DOM" retry loop on this exact button (checked DailyDetail.tsx: no stray
    // key prop remounting the panel, no effect resetting local state, mutually exclusive
    // step branches) — same class of transient click issue as openDayCard's retry
    // (PR #97), recovered from the same way.
    await clickAndWaitGone(confirmProceedBtn);
    await confirmAppLevelWarningIfPresent(page);

    // Regression: this specific flow was reported broken only on the Mario Rossi
    // (employee) account — the status must genuinely end up as Remote, not stuck.
    await openDayCard(page, today);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/remote/i).first()).toBeVisible({ timeout: 5000 });
  });
});
