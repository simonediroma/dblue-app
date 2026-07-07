import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';
import { todayStr } from '../fixtures/dates';
import { resetStatus } from '../fixtures/testAdmin';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom } from '../fixtures/dailyDetail';

/**
 * CSV coverage — Sick Leave (Current Day) (H-30)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

test.describe('CSV coverage — Sick Leave (Current Day)', () => {
  test('[H-30] declaring sick leave today auto-confirms and locks the day', async ({ page }) => {
    const today = todayStr();
    await resetStatus('dev@dblue.it', today);
    await loginAsOwner(page);

    // Start from In Office so switching to Sick is a genuine "away from office" change —
    // this is also the sub-case the CSV flags as missing an alert.
    await openDayCard(page, today);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE');
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
    await expect(detail.locator('button:has(svg.lucide-edit-2)')).not.toBeVisible();

    // ...and the backend should reject a further status change (409).
    const res = await page.request.post(`${API_BASE}/presence`, { data: { date: today, status: 'remote' } });
    expect(res.status()).toBe(409);
  });
});
