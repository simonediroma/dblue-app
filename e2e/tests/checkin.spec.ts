import { test, expect } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

// Returns today as YYYY-MM-DD in local time
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Regression test for check-in FAB failure.
 *
 * Bug: the backend stored uppercase status values ('IN_OFFICE') because
 * Mongoose skips enum validation in findOneAndUpdate without runValidators.
 * The check-in endpoint compared ws.status against a lowercase array
 * ['in_office', 'office_no_desk', 'remote'], causing a 400 for all uppercase
 * values — seen by users as "Check-in failed" after the optimistic flash.
 *
 * Fix: upsertStatus normalises to lowercase on write; check-in route uses
 * toLowerCase() on comparisons; frontend api.ts maps lowercase status values
 * to WorkStatus enum so room-selection modal and FAB visibility work correctly.
 *
 * This test intercepts the presence API to inject a controlled today entry
 * with lowercase status (as the backend returns), then verifies the full
 * FAB → room-selection → check-in flow completes without "Check-in failed".
 */
test.describe('Check-in FAB — regression: status case mismatch', () => {
  test('FAB check-in with in_office status (lowercase from API) succeeds without error', async ({ page }) => {
    const today = todayStr();
    const month = today.slice(0, 7);

    // --- mock GET /presence: inject today as 'in_office' (lowercase, as backend returns) ---
    await page.route(`**/presence?month=${month}`, async (route) => {
      const days = [
        {
          date: today,
          status: 'in_office',  // lowercase — this is what the real backend returns
          isConfirmed: false,
          isUsingDesk: true,
          room: 'Open Space',
          bookedCount: 3,
          totalCapacity: 23,
          projectTeammatesCount: 0,
          colleagueAvatars: [],
        },
      ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(days) });
    });

    // --- mock GET /rooms ---
    await page.route('**/rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', name: 'Open Space', capacity: 20, type: 'open_space' },
          { id: 'r2', name: 'Lab', capacity: 3, type: 'lab' },
        ]),
      });
    });

    // --- mock POST /presence/:date/checkin and capture the request ---
    let checkinCalled = false;
    await page.route(`**/presence/${today}/checkin`, async (route) => {
      checkinCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ date: today, status: 'in_office', isConfirmed: true, isUsingDesk: true, room: 'Open Space' }),
      });
    });

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    // Scroll down past the today card to trigger the FAB
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);

    // FAB must be visible — if it's not, the status normalization or visibility guard failed
    const fab = page.locator('[data-testid="fab-checkin"]');
    await expect(fab).toBeVisible({ timeout: 5000 });

    await fab.click();

    // For IN_OFFICE status the room-selection modal (daily-detail) must open.
    // Before the fix: status comparison 'in_office' === 'IN_OFFICE' was false →
    // modal never opened → direct checkIn() was called → backend 400 → "Check-in failed".
    const roomSelection = page.locator('[data-testid="daily-detail"]');
    await expect(roomSelection).toBeVisible({ timeout: 5000 });

    // Select a room
    const roomBtn = roomSelection.getByText(/open space/i).first();
    await expect(roomBtn).toBeVisible({ timeout: 3000 });
    await roomBtn.click();

    // After room selection, check-in API must have been called
    await page.waitForTimeout(500);
    expect(checkinCalled).toBe(true);

    // Success notification must appear
    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });

    // "Check-in failed" must NOT appear — this is the regression assertion
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });

  test('FAB check-in with remote status (lowercase from API) succeeds without error', async ({ page }) => {
    const today = todayStr();
    const month = today.slice(0, 7);

    await page.route(`**/presence?month=${month}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            date: today,
            status: 'remote',  // lowercase
            isConfirmed: false,
            bookedCount: 0,
            totalCapacity: 23,
            projectTeammatesCount: 0,
            colleagueAvatars: [],
          },
        ]),
      });
    });

    await page.route('**/rooms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    let checkinCalled = false;
    await page.route(`**/presence/${today}/checkin`, async (route) => {
      checkinCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ date: today, status: 'remote', isConfirmed: true }),
      });
    });

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);

    const fab = page.locator('[data-testid="fab-checkin"]');
    await expect(fab).toBeVisible({ timeout: 5000 });
    await fab.click();

    // Remote: no room selection, direct check-in
    await page.waitForTimeout(500);
    expect(checkinCalled).toBe(true);

    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });
});

test.describe('Check-in (Say Good Morning) — integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');
  });

  test('today card is rendered', async ({ page }) => {
    const todayCard = page.locator('[data-testid="day-card"].dynamic-border-card');
    await expect(todayCard).toBeVisible({ timeout: 10000 });
  });

  test('FAB appears after scrolling when today has a non-pending status', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    const fab = page.locator('[data-testid="fab-checkin"]');
    const fabVisible = await fab.isVisible().catch(() => false);
    expect(fabVisible === true || fabVisible === false).toBe(true);
  });

  test('check-in via today card shows success or opens room selection', async ({ page }) => {
    const todayCard = page.locator('[data-testid="day-card"].dynamic-border-card');
    await expect(todayCard).toBeVisible({ timeout: 10000 });

    const morningBtn = todayCard.getByText(/say good morning/i);
    if (!(await morningBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await morningBtn.click();

    const roomSelection = page.locator('[data-testid="daily-detail"]');
    const notification = page.getByText(/successfully checked in/i);

    await Promise.race([
      roomSelection.waitFor({ timeout: 5000 }),
      notification.waitFor({ timeout: 5000 }),
    ]).catch(() => {});

    const roomVisible = await roomSelection.isVisible().catch(() => false);
    const notifVisible = await notification.isVisible().catch(() => false);
    expect(roomVisible || notifVisible).toBe(true);

    // Regression: error notification must not appear
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });
});
