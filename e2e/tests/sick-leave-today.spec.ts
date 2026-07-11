import { test, expect } from '@playwright/test';
import { loginAsOwner, getAuthHeaders } from '../fixtures/auth';
import { todayStr, isTodayWeekend } from '../fixtures/dates';
import { resetStatus } from '../fixtures/testAdmin';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom } from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

/**
 * CSV coverage — Sick Leave (Current Day) (H-30)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

test.describe('CSV coverage — Sick Leave (Current Day)', () => {
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-30] declaring sick leave today auto-confirms and locks the day', async ({ page }) => {
    // On a weekend there's no working-day entry for "today" at all (backend excludes
    // Sat/Sun from GET /presence) — openDayCard() would just hang until the test timeout.
    test.skip(isTodayWeekend(), 'today is a weekend — no working day to check into');
    const today = todayStr();
    await resetStatus('dev@dblue.it', today);
    await loginAsOwner(page);

    // Start from In Office so switching to Sick is a genuine "away from office" change —
    // this is also the sub-case the CSV flags as missing an alert.
    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', today);
    await confirmRoom(page, /./);

    const start = Date.now();
    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'SICK');

    const warning = page.locator('[data-testid="daily-detail-unbooking-warning"]');
    await expect(warning).toBeVisible({ timeout: 5000 });
    await warning.getByRole('button', { name: /confirm.*proceed/i }).click();
    const appWarning = page.locator('[data-testid="last-minute-warning"]');
    if (await appWarning.isVisible({ timeout: 2000 }).catch(() => false)) {
      await appWarning.getByRole('button', { name: /yes, change it/i }).click();
    }
    const elapsedMs = Date.now() - start;

    // (c) the fire-and-forget medical-certificate email must not block the response.
    expect(elapsedMs).toBeLessThan(8000);

    // (a) no manual check-in affordance anywhere for Sick.
    const card = page.locator(`[data-testid="day-card"][data-date="${today}"]`);
    await expect(card.getByText(/say good morning/i)).not.toBeVisible();

    await openDayCard(page, today);
    const detail = page.locator('[data-testid="daily-detail"]');
    await expect(detail.getByText(/say good morning/i)).not.toBeVisible();

    // (b) the day should lock from further edits — no edit affordance...
    await expect(detail.locator('button:has(svg.lucide-pen)')).not.toBeVisible();

    // ...and the backend should reject a further status change (409).
    const res = await page.request.post(`${API_BASE}/presence`, {
      data: { date: today, status: 'remote' },
      headers: await getAuthHeaders(page),
    });
    expect(res.status()).toBe(409);
  });
});
