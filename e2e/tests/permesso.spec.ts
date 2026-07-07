import { test, expect, Page } from '@playwright/test';
import { loginAsOwner } from '../fixtures/auth';
import { futureTestDate } from '../fixtures/dates';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom } from '../fixtures/dailyDetail';

/**
 * CSV coverage — Permesso / leave hours (H-31 -> H-33)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 *
 * Root cause already traced in frontend/src/services/api.ts: updateOffTime() is the only
 * mutating presence call that does NOT pipe its response through normalizeDay(), and
 * usePresence.ts's handler applies enrichDay() (adds dayName only) instead — so the raw
 * lowercase backend status ('in_office') never gets mapped to the WorkStatus enum,
 * which is exactly the CSV's "adding Permesso resets the working status to '?'" bug.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

async function openHoursOffStep(page: Page) {
  const detail = page.locator('[data-testid="daily-detail"]');
  await detail.getByRole('button', { name: /take hours off/i }).click();
  await expect(detail.getByText(/select how much time/i)).toBeVisible({ timeout: 5000 });
}

async function getPresenceEntry(page: Page, date: string) {
  const month = date.slice(0, 7);
  const res = await page.request.get(`${API_BASE}/presence?month=${month}`);
  const days = (await res.json()) as Array<{ date: string; status: string; offTime?: { type: string; hours?: number } }>;
  return days.find((d) => d.date === date);
}

test.describe('CSV coverage — Permesso', () => {
  test('[H-31] request leave hours alongside a normal day (custom amount)', async ({ page }) => {
    await loginAsOwner(page);
    const date = futureTestDate('H-31');

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE');
    await confirmRoom(page, /./);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await openHoursOffStep(page);
    await page.locator('[data-testid="offtime-custom-select"]').selectOption('4');
    await page.waitForTimeout(500);

    // Regression: the underlying working status must still be In Office, not reset.
    const entry = await getPresenceEntry(page, date);
    expect(entry?.status).toBe('in_office');
    expect(entry?.offTime?.type).toBe('custom');
    expect(entry?.offTime?.hours).toBe(4);

    // And the day card must still show the In Office icon, not the "unknown status" (?) fallback.
    const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText('❓')).not.toBeVisible();
  });

  test('[H-32] request leave hours for half a day in the morning', async ({ page }) => {
    await loginAsOwner(page);
    const date = futureTestDate('H-32');

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE');
    await confirmRoom(page, /./);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await openHoursOffStep(page);
    await page.locator('[data-testid="offtime-morning"]').click();
    await page.waitForTimeout(500);

    const entry = await getPresenceEntry(page, date);
    expect(entry?.status).toBe('in_office');
    expect(entry?.offTime?.type).toBe('morning');

    const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText('❓')).not.toBeVisible();
  });

  test('[H-33] request leave hours for half a day in the afternoon', async ({ page }) => {
    await loginAsOwner(page);
    const date = futureTestDate('H-33');

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE');
    await confirmRoom(page, /./);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await openHoursOffStep(page);
    await page.locator('[data-testid="offtime-afternoon"]').click();
    await page.waitForTimeout(500);

    const entry = await getPresenceEntry(page, date);
    expect(entry?.status).toBe('in_office');
    expect(entry?.offTime?.type).toBe('afternoon');

    const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByText('❓')).not.toBeVisible();
  });
});
