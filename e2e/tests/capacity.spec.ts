import { test, expect } from '@playwright/test';
import { loginAsOwner, loginAsEmployee, getAuthHeaders } from '../fixtures/auth';
import { futureTestDate } from '../fixtures/dates';
import { fillCapacity, clearCapacity, resetStatus } from '../fixtures/testAdmin';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom } from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

/**
 * CSV coverage — Capacity & Waiting List (H-40, H-40a, H-40b)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 *
 * The CSV assumes 23 real office seats; the actual seeded total is different and must
 * never be hardcoded — read it from GET /rooms.
 *
 * GET /rooms already returns exactly the rooms visible to the calling account's role
 * (every open_space room, plus any other room whose visibleRoles includes that role —
 * owner sees every room). So the total capacity for "whoever is logged into `page`"
 * is simply the sum of what that call returns, not just the open_space subset.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

async function getRealOfficeCapacity(page: import('@playwright/test').Page): Promise<number> {
  const res = await page.request.get(`${API_BASE}/rooms`, { headers: await getAuthHeaders(page) });
  const rooms = (await res.json()) as Array<{ capacity: number }>;
  return rooms.reduce((sum, r) => sum + r.capacity, 0);
}

test.describe('CSV coverage — Capacity & Waiting List', () => {
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-40a] occupancy shows the real seat total, never total registered headcount', async ({ page }) => {
    await loginAsOwner(page);
    const realCapacity = await getRealOfficeCapacity(page);

    const usersRes = await page.request.get(`${API_BASE}/admin/users`, { headers: await getAuthHeaders(page) });
    const users = (await usersRes.json()) as unknown[];
    expect(realCapacity).toBeLessThan(users.length);

    const date = futureTestDate('H-40a');
    const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.locator('[data-testid="daycard-occupancy"]')).toHaveText(
      new RegExp(`^\\d+/${realCapacity}$`),
      { timeout: 5000 }
    );
  });

  test('[H-40b] occupancy increments by 1 immediately after booking, no reload needed', async ({ page }) => {
    await loginAsOwner(page);
    const date = futureTestDate('H-40b');
    const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await card.scrollIntoViewIfNeeded();

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', date);
    // Captured here, not before selectStatus: if the office was full for this date, its
    // mocked-fallback path (dailyDetail.ts) genuinely wipes every real in_office booking
    // via /admin/test/free-office-capacity before retrying — a "before" snapshot taken
    // earlier would reflect a baseline that no longer exists, making the after === before
    // + 1 comparison below meaningless. This read is always the true state immediately
    // preceding the real increment, whether or not the fallback engaged.
    await card.scrollIntoViewIfNeeded();
    const before = await card.locator('[data-testid="daycard-occupancy"]').textContent();
    const bookedBefore = Number((before ?? '0/0').split('/')[0]);
    await confirmRoom(page, /./);

    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('[data-testid="daycard-occupancy"]')).toHaveText(/^\d+\/\d+$/, { timeout: 5000 });
    const after = await card.locator('[data-testid="daycard-occupancy"]').textContent();
    const bookedAfter = Number((after ?? '0/0').split('/')[0]);
    expect(bookedAfter).toBe(bookedBefore + 1);

    // Reload: must still show the correct, incremented count (not "__/__").
    await page.reload();
    await page.waitForSelector('[data-testid="day-card"]');
    await card.scrollIntoViewIfNeeded();
    const afterReload = await card.locator('[data-testid="daycard-occupancy"]').textContent();
    expect(Number((afterReload ?? '0/0').split('/')[0])).toBe(bookedBefore + 1);
  });

  test('[H-40] hitting a full office puts the next booking on the waiting list', async ({ page, browser }) => {
    await loginAsOwner(page);
    const realCapacity = await getRealOfficeCapacity(page);
    const date = futureTestDate('H-40');

    await fillCapacity(date, realCapacity - 1);
    try {
      // The owner books the last real seat — should succeed as In Office.
      await openDayCard(page, date);
      await goToPlanningStep(page);
      await selectStatus(page, 'IN_OFFICE');
      await confirmRoom(page, /./);

      const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('[data-testid="daycard-occupancy"]')).toHaveText(
        new RegExp(`^${realCapacity}/${realCapacity}$`),
        { timeout: 5000 }
      );

      // A second, distinct account tries to book the same (now full) day — real waiting list.
      const employeeContext = await browser.newContext();
      const employeePage = await employeeContext.newPage();
      await loginAsEmployee(employeePage);
      await openDayCard(employeePage, date);
      await goToPlanningStep(employeePage);
      await selectStatus(employeePage, 'IN_OFFICE');
      await confirmRoom(employeePage, /./);

      const employeeAuthHeaders = await getAuthHeaders(employeePage);
      const meRes = await employeePage.request.get(`${API_BASE}/auth/me`, { headers: employeeAuthHeaders });
      const me = (await meRes.json()) as { id: string };
      const month = date.slice(0, 7);
      const presenceRes = await employeePage.request.get(`${API_BASE}/presence?month=${month}`, { headers: employeeAuthHeaders });
      const days = (await presenceRes.json()) as Array<{ date: string; status: string }>;
      void me;
      const entry = days.find((d) => d.date === date);
      expect(entry?.status?.toLowerCase()).toBe('waiting_list');

      await employeeContext.close();
    } finally {
      // Teardown: free the seats this test filled (and the two real bookings it made)
      // so the shared dev environment isn't left full for manual testers.
      await clearCapacity(date);
      await resetStatus('dev@dblue.it', date);
      await resetStatus('mario.rossi@dblue.it', date);
    }
  });
});
