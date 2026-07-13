import { test, expect } from '@playwright/test';
import { loginAsOwner, loginAsEmployee, getAuthHeaders } from '../fixtures/auth';
import { futureTestDate } from '../fixtures/dates';
import { fillCapacity, clearCapacity, resetStatus, freeOfficeCapacity } from '../fixtures/testAdmin';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom, waitForSplashGone } from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue, queuePendingRestore } from '../fixtures/officeCapacityQueue';

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

    // fillCapacity() upserts N seeded users to in_office without first clearing whatever's
    // already booked for that date — on this shared, heavily-used environment,
    // futureTestDate() is deterministic (same date every run today), so leftover real
    // occupancy from other tests/accounts can already exist, silently pushing total
    // occupancy above realCapacity-1 before the owner even gets to book. Guarantee a clean
    // slate first so the owner's booking is deterministically the last seat.
    const { snapshot } = await freeOfficeCapacity(date);
    queuePendingRestore(snapshot);
    await fillCapacity(date, realCapacity - 1);
    try {
      // The owner books the last real seat — should succeed as In Office.
      //
      // App.tsx's processedDays pads bookedCount to at least 5 synthetic "in office"
      // colleagues for every future day (a real, documented app bug — see
      // dailyDetail.ts's installOfficeCapacityFallbackAndRetry). On this environment
      // real room capacity is smaller than that synthetic floor, so the plain
      // "In Office" button would stay hidden even with only realCapacity-1 real
      // bookings, well below true capacity — selectStatus('IN_OFFICE') without a date
      // would just skip. Patch ONLY totalCapacity (never bookedCount, which stays real)
      // in the /presence response so the UI's own "is it full" check reflects the true
      // state fillCapacity() just set up — same technique as the generic fallback, but
      // scoped to this one click (not calling freeOfficeCapacity again, which would
      // wipe the realCapacity-1 seats above) so it doesn't mask the real occupancy
      // assertion below.
      const month = date.slice(0, 7);
      const presencePattern = `**/presence?month=${month}`;
      await page.route(presencePattern, async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue();
          return;
        }
        const response = await route.fetch();
        const json = await response.json();
        const day = Array.isArray(json) ? json.find((d: { date: string }) => d.date === date) : undefined;
        if (day) day.totalCapacity = 9999;
        await route.fulfill({ response, json });
      });
      // The month's /presence data was already fetched (and cached in app state) by the
      // login navigation above, before this route existed — registering a route alone
      // doesn't retroactively patch data already in memory. Reload so the next fetch
      // actually goes through the route, same as installOfficeCapacityFallbackAndRetry.
      await page.reload();
      await waitForSplashGone(page);

      await openDayCard(page, date);
      await goToPlanningStep(page);
      const plainInOffice = page.locator('[data-testid="daily-detail"]').getByText(/^in office$/i);
      await expect(plainInOffice).toBeVisible({ timeout: 10000 });
      await plainInOffice.click();
      await page.unroute(presencePattern);
      await confirmRoom(page, /./);

      const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('[data-testid="daycard-occupancy"]')).toHaveText(
        new RegExp(`^${realCapacity}/${realCapacity}$`),
        { timeout: 5000 }
      );

      // A second, distinct account tries to book the same (now full) day — real waiting list.
      //
      // The UI intentionally hides the plain "In Office" option once it knows capacity is
      // exhausted, swapping in "Waiting List" / "In Office / Not using a desk" instead —
      // both are user-INITIATED alternate choices, not the automatic server-side downgrade
      // this test is actually meant to verify. "Waiting List" in particular bypasses the
      // capacity check entirely (upsertStatus only re-checks capacity when payload.status
      // is 'in_office'), so clicking it would make this test pass for the wrong reason.
      // There is no UI path left to request "in_office" once the button is gone — exercise
      // the backend's own capacity gate directly instead, same approach as H-45b.
      const employeeContext = await browser.newContext();
      const employeePage = await employeeContext.newPage();
      await loginAsEmployee(employeePage);

      const employeeAuthHeaders = await getAuthHeaders(employeePage);
      const bookRes = await employeePage.request.post(`${API_BASE}/presence`, {
        data: { date, status: 'in_office' },
        headers: employeeAuthHeaders,
      });
      expect(bookRes.status()).toBe(200);
      const booked = (await bookRes.json()) as { status: string };
      expect(booked.status?.toLowerCase()).toBe('waiting_list');

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
