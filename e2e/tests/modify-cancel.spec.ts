import { test, expect } from '@playwright/test';
import { loginAsOwner, loginAsEmployee, getAuthHeaders } from '../fixtures/auth';
import { futureTestDate, todayStr } from '../fixtures/dates';
import { resetStatus } from '../fixtures/testAdmin';
import {
  openDayCard,
  goToPlanningStep,
  selectStatus,
  confirmRoom,
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
async function confirmAppLevelWarningIfPresent(page: import('@playwright/test').Page) {
  const appWarning = page.locator('[data-testid="last-minute-warning"]');
  if (await appWarning.isVisible({ timeout: 2000 }).catch(() => false)) {
    await appWarning.getByRole('button', { name: /yes, change it/i }).click();
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
    await page.getByRole('button', { name: /close|×|cancel/i }).first().click();

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'MISSION');

    await openDayCard(page, date);
    detail = page.locator('[data-testid="daily-detail"]');
    await expect(detail.getByText(/mission/i).first()).toBeVisible();
  });

  test('[H-27] cancelling an in-office booking <24h shows the last-minute alert', async ({ page }) => {
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
    await warning.getByRole('button', { name: /confirm.*proceed/i }).click();
    await confirmAppLevelWarningIfPresent(page);

    await openDayCard(page, today);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/remote/i).first()).toBeVisible();
  });

  test('[H-28] last-minute unbooking is saved correctly in the stats', async ({ page }) => {
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
    await warning.getByRole('button', { name: /confirm.*proceed/i }).click();
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
    await warning.getByRole('button', { name: /confirm.*proceed/i }).click();
    await confirmAppLevelWarningIfPresent(page);

    // Regression: this specific flow was reported broken only on the Mario Rossi
    // (employee) account — the status must genuinely end up as Remote, not stuck.
    await openDayCard(page, today);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/remote/i).first()).toBeVisible({ timeout: 5000 });
  });
});
