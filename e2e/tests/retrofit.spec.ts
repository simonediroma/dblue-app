import { test, expect } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

/**
 * E2E tests for the retrofit flow (PR #42).
 *
 * Retrofit allows a user to set their working status for a past day in the
 * previous calendar month. The flow is:
 *   1. Navigate to the previous month via the month-selector dropdown.
 *   2. Tap a past day card → DailyDetail opens in "retrofit" mode.
 *   3. Select a status → confirmation dialog ("Are you sure you want to retrofit").
 *   4. Confirm → POST /presence/:date/retrofit → success notification.
 *
 * All tests use page.route() to mock API calls so they run without a live backend.
 */

function prevMonthStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonthFirstWorkday(): string {
  // Returns a date string YYYY-MM-DD for the 3rd of the previous month (safe weekday proxy)
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setDate(3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-03`;
}

async function navigateToPrevMonth(page: import('@playwright/test').Page) {
  const prevLabel = prevMonthLabel();
  await page.click('[data-testid="month-selector-button"]');
  await expect(page.getByText('Select Month')).toBeVisible({ timeout: 3000 });
  await page.getByTestId('month-option').filter({ hasText: prevLabel }).click();
  // Wait for historical day cards to render
  await page.waitForSelector('[data-testid="day-card"]', { timeout: 5000 });
}

test.describe('Retrofit — historical month navigation', () => {
  test('navigating to previous month renders past day cards', async ({ page }) => {
    const prevMonth = prevMonthStr();
    const prevDate = prevMonthFirstWorkday();

    await page.route(`**/presence?month=${prevMonth}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            date: prevDate,
            dayName: 'Wednesday',
            status: 'remote',
            isPast: true,
            isRetrofit: false,
            bookedCount: 0,
            totalCapacity: 23,
            projectTeammatesCount: 0,
            colleagueAvatars: [],
          },
          {
            date: prevDate.replace('-03', '-04'),
            dayName: 'Thursday',
            status: 'pending',
            isPast: true,
            isRetrofit: false,
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

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    await navigateToPrevMonth(page);

    const cards = page.locator('[data-testid="day-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Retrofit — status update via past day card', () => {
  test('clicking a past day card opens DailyDetail in retrofit mode and can set status', async ({ page }) => {
    const prevMonth = prevMonthStr();
    const prevDate = prevMonthFirstWorkday();

    let callCount = 0;
    await page.route(`**/presence?month=${prevMonth}`, async (route) => {
      callCount++;
      const isRetrofit = callCount > 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            date: prevDate,
            dayName: 'Wednesday',
            status: isRetrofit ? 'remote' : 'pending',
            isPast: true,
            isRetrofit,
            bookedCount: 0,
            totalCapacity: 23,
            projectTeammatesCount: 0,
            colleagueAvatars: [],
          },
        ]),
      });
    });

    await page.route(`**/presence/${prevDate}/colleagues`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rooms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    let retrofitCalled = false;
    await page.route(`**/presence/${prevDate}/retrofit`, async (route) => {
      retrofitCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: prevDate,
          dayName: 'Wednesday',
          status: 'remote',
          isPast: true,
          isRetrofit: true,
          bookedCount: 0,
          totalCapacity: 23,
          projectTeammatesCount: 0,
          colleagueAvatars: [],
        }),
      });
    });

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    await navigateToPrevMonth(page);

    // Click the first past day card
    const card = page.locator('[data-testid="day-card"]').first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click();

    // DailyDetail must open
    const dailyDetail = page.locator('[data-testid="daily-detail"]');
    await expect(dailyDetail).toBeVisible({ timeout: 5000 });

    // Must show retrofit indicator (modal title says "retrofit" or alert mentions it)
    await expect(dailyDetail.getByText(/retrofit/i)).toBeVisible({ timeout: 5000 });

    // Select "Working Remotely" status
    const remoteOption = dailyDetail.getByText(/working remotely/i);
    await expect(remoteOption).toBeVisible({ timeout: 5000 });
    await remoteOption.click();

    // Confirmation dialog must appear
    await expect(page.getByText(/are you sure you want to retrofit/i)).toBeVisible({ timeout: 5000 });

    // Confirm
    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Retrofit API must have been called
    await page.waitForTimeout(500);
    expect(retrofitCalled).toBe(true);

    // Success notification
    await expect(page.getByText(/retrofit.*completed|successfully/i)).toBeVisible({ timeout: 5000 });

    // No error notification
    await expect(page.getByText(/failed|error/i)).not.toBeVisible();
  });
});

test.describe('Retrofit — badge visible on retrofitted day card', () => {
  test('a day with isRetrofit=true shows the retrofit badge icon', async ({ page }) => {
    const prevMonth = prevMonthStr();
    const prevDate = prevMonthFirstWorkday();

    await page.route(`**/presence?month=${prevMonth}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            date: prevDate,
            dayName: 'Wednesday',
            status: 'remote',
            isPast: true,
            isRetrofit: true,
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

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    await navigateToPrevMonth(page);

    // The retrofit badge renders with title="Retrofitted"
    const badge = page.locator('[title="Retrofitted"]');
    await expect(badge).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Retrofit — current month cards are NOT retrofitted', () => {
  /**
   * The frontend uses upsertStatus (not retrofitStatus) for current/future days.
   * There is no UI path to call the /retrofit endpoint for today's date.
   * This test documents and verifies that behaviour: the retrofit confirmation
   * dialog does NOT appear when editing today's status normally.
   */
  test('editing todays status via DailyDetail shows planning mode, not retrofit', async ({ page }) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const month = todayStr.slice(0, 7);

    await page.route(`**/presence?month=${month}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            date: todayStr,
            dayName: 'Wednesday',
            status: 'pending',
            isPast: false,
            isRetrofit: false,
            isHighlighted: true,
            bookedCount: 0,
            totalCapacity: 23,
            projectTeammatesCount: 0,
            colleagueAvatars: [],
          },
        ]),
      });
    });

    await page.route(`**/presence/${todayStr}/colleagues`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rooms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    // Click today's card (highlighted)
    const todayCard = page.locator('[data-testid="day-card"].dynamic-border-card');
    await expect(todayCard).toBeVisible({ timeout: 10000 });
    await todayCard.click();

    const dailyDetail = page.locator('[data-testid="daily-detail"]');
    await expect(dailyDetail).toBeVisible({ timeout: 5000 });

    // Must show "planning" (not "retrofit") for a current day
    await expect(dailyDetail.getByText(/planning/i)).toBeVisible({ timeout: 5000 });
    await expect(dailyDetail.getByText(/are you sure you want to retrofit/i)).not.toBeVisible();
  });
});
