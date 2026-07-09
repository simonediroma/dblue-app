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

// ---------------------------------------------------------------------------------
// CSV coverage — Retrofitting (H-34 -> H-39)
// Hits the real backend/DB (Railway dev environment) — no page.route() mocking like the
// blocks above. See e2e/README.md.
// ---------------------------------------------------------------------------------
import type { Page } from '@playwright/test';
import {
  loginAsOwner as csvLoginAsOwner,
  loginAsEmployee as csvLoginAsEmployee,
  loginAsDirectorRole as csvLoginAsDirectorRole,
} from '../fixtures/auth';
import { prevMonthTestDate } from '../fixtures/dates';
import { simulateConfirm } from '../fixtures/testAdmin';
import {
  openDayCard as csvOpenDayCard,
  goToPlanningStep as csvGoToPlanningStep,
  selectStatus as csvSelectStatus,
  confirmRetrofit as csvConfirmRetrofit,
  StatusKey,
} from '../fixtures/dailyDetail';

const CSV_API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

function csvPrevMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

async function csvNavigateToPrevMonth(page: Page) {
  await page.click('[data-testid="month-selector-button"]');
  await expect(page.getByText('Select Month')).toBeVisible({ timeout: 3000 });
  await page.getByTestId('month-option').filter({ hasText: csvPrevMonthLabel() }).click();
  await page.waitForSelector('[data-testid="day-card"]', { timeout: 5000 });
}

async function csvRetrofitStatus(page: Page, date: string, status: StatusKey) {
  await csvNavigateToPrevMonth(page);
  await csvOpenDayCard(page, date);
  await csvGoToPlanningStep(page);
  await csvSelectStatus(page, status);
  await csvConfirmRetrofit(page);
}

test.describe('CSV coverage — Retrofitting', () => {
  test.beforeEach(async ({ page }) => {
    await csvLoginAsOwner(page);
  });

  // [H-34]->[H-39] Retrofit entry point is unreachable for any real (non-seed) day:
  // DailyDetail.tsx's "Retrofit Working Status" button only renders when `day.isPast`
  // is true, but that field is never populated for real data — it's absent from the
  // GET /presence response (backend/src/routes/presence.routes.ts,
  // backend/src/services/working-status.service.ts), never derived client-side
  // (frontend/src/services/api.ts, frontend/src/hooks/usePresence.ts), and only ever
  // set on seed/mock records (backend/src/services/seed.service.ts, App.tsx's
  // hardcoded INITIAL_DAYS) — frontend/src/types.ts even declares it optional. So for
  // a real past day, `goToPlanningStep` finds neither the retrofit button nor the
  // pencil-edit fallback (which requires !day.isPast to render in the first place)
  // and times out. Marked fixme rather than a misleading "passing" test; revisit once
  // isPast is actually populated for real presence data.
  test.fixme('[H-34] retrofit a past day — On a Mission', async ({ page }) => {
    const date = prevMonthTestDate('H-34');
    await csvRetrofitStatus(page, date, 'MISSION');

    const res = await page.request.get(`${CSV_API_BASE}/presence?month=${date.slice(0, 7)}`);
    const days = (await res.json()) as Array<{ date: string; status: string; isRetrofit: boolean }>;
    const entry = days.find((d) => d.date === date);
    expect(entry?.status).toBe('mission');
    expect(entry?.isRetrofit).toBe(true);
  });

  test.fixme('[H-35] retrofit a past day — On Leave', async ({ page }) => {
    const date = prevMonthTestDate('H-35');
    await csvRetrofitStatus(page, date, 'LEAVE');

    const res = await page.request.get(`${CSV_API_BASE}/presence?month=${date.slice(0, 7)}`);
    const days = (await res.json()) as Array<{ date: string; status: string; isRetrofit: boolean }>;
    const entry = days.find((d) => d.date === date);
    expect(entry?.status).toBe('leave');
    expect(entry?.isRetrofit).toBe(true);
  });

  test.fixme('[H-36] retrofit a past day — On Sick Leave', async ({ page }) => {
    const date = prevMonthTestDate('H-36');
    await csvRetrofitStatus(page, date, 'SICK');

    const res = await page.request.get(`${CSV_API_BASE}/presence?month=${date.slice(0, 7)}`);
    const days = (await res.json()) as Array<{ date: string; status: string; isRetrofit: boolean }>;
    const entry = days.find((d) => d.date === date);
    expect(entry?.status).toBe('sick');
    expect(entry?.isRetrofit).toBe(true);
  });

  test.fixme('[H-37] retrofit — add Permesso hours to a past day', async ({ page }) => {
    const date = prevMonthTestDate('H-37');
    await csvNavigateToPrevMonth(page);
    await csvOpenDayCard(page, date);
    await csvGoToPlanningStep(page);
    await page.locator('[data-testid="daily-detail"]').getByRole('button', { name: /retrofit hours off/i }).click();
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/select how much time/i)).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="offtime-morning"]').click();
    await page.waitForTimeout(500);

    const res = await page.request.get(`${CSV_API_BASE}/presence?month=${date.slice(0, 7)}`);
    const days = (await res.json()) as Array<{ date: string; offTime?: { type: string } }>;
    const entry = days.find((d) => d.date === date);
    expect(entry?.offTime?.type).toBe('morning');
  });

  test.fixme('[H-38] retrofit — non-payroll statuses (In Office / Remote) are blocked', async ({ page }) => {
    const date = prevMonthTestDate('H-38');
    await csvNavigateToPrevMonth(page);
    await csvOpenDayCard(page, date);
    await csvGoToPlanningStep(page);

    // UI: neither option should be offered for a past day.
    const detail = page.locator('[data-testid="daily-detail"]');
    await expect(detail.getByText(/^in office$/i)).not.toBeVisible();
    await expect(detail.getByText(/^remote working$/i)).not.toBeVisible();

    // Backend: a direct retrofit call for a non-payroll status must be rejected.
    const res = await page.request.post(`${CSV_API_BASE}/presence/${date}/retrofit`, {
      data: { status: 'in_office' },
    });
    expect(res.status()).toBe(400);
  });

  test.fixme('[H-39] retrofit — visible to other users (colleague and Director/Owner)', async ({ page, browser }) => {
    const date = prevMonthTestDate('H-39');

    const employeeContext = await browser.newContext();
    const employeePage = await employeeContext.newPage();
    await csvLoginAsEmployee(employeePage);
    await csvRetrofitStatus(employeePage, date, 'MISSION');
    const meRes = await employeePage.request.get(`${CSV_API_BASE}/auth/me`);
    const me = (await meRes.json()) as { id: string };
    await employeeContext.close();

    // Retrofit doesn't itself mark the record confirmed — simulate the eventual cron
    // confirmation so the propagation check isn't confounded by that separate gap.
    await simulateConfirm(me.id, date);

    await csvLoginAsDirectorRole(page);
    const month = date.slice(0, 7);
    const statsRes = await page.request.get(`${CSV_API_BASE}/admin/stats/${me.id}/monthly?month=${month}`);
    expect(statsRes.status()).toBe(200);
    const stats = (await statsRes.json()) as { distribution: { mission: number } };
    expect(stats.distribution.mission).toBeGreaterThanOrEqual(1);

    // Light UI check: the Director can reach the same employee's data via Organisation.
    // Playwright's default desktop viewport is above Tailwind's `md` breakpoint, so
    // the mobile-only bottom nav is display:none — nav-organisation-desktop is visible.
    await page.click('[data-testid="nav-organisation-desktop"]');
    await page.click('[data-testid="org-view-individual"]');
    await page.click('[data-testid="org-colleague-select"]');
    await page.getByPlaceholder(/search/i).fill('Mario');
    await page.getByText('Mario Rossi').first().click();
    await expect(page.getByText('Mario Rossi').first()).toBeVisible();
  });
});
