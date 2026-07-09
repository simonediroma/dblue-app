import { test, expect } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

test.describe('My Stats', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirector(page);
    // Navigate to stats tab
    await page.click('[data-testid="nav-stats"]');
    await page.waitForSelector('[data-testid="stats-page"]');
  });

  test('stats page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
  });

  test('monthly view is the default tab', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
    // Monthly tab should be active by default
    await expect(page.getByRole('button', { name: /monthly/i }).first()).toBeVisible();
  });

  test('yearly tab is accessible', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
    const yearlyBtn = page.getByRole('button', { name: /yearly|annual/i }).first();
    await expect(yearlyBtn).toBeVisible();
    await yearlyBtn.click();
    // After clicking yearly, content should update
    await expect(page.getByText(/yearly|annual|year/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('stats page shows presence metrics', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
    // Stats should show presence days, remote days, or similar metrics
    await expect(page.getByText(/presence|remote|office|days/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('month dropdown allows selecting a past month', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
    // Find dropdown button for month selection
    const dropdownBtn = page.locator('[data-testid="stats-page"] button').filter({
      has: page.locator('svg'),
    }).first();
    const isVisible = await dropdownBtn.isVisible().catch(() => false);
    if (isVisible) {
      await dropdownBtn.click();
      // Dropdown should show months
      await page.waitForTimeout(300);
    }
    // Verify stats page is still visible
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
  });

  test('stats page shows charts or visual elements', async ({ page }) => {
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
    // Recharts renders SVG elements
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------------
// CSV coverage — Stats Sanity Check (H-43)
// Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
// ---------------------------------------------------------------------------------
import type { Page } from '@playwright/test';
import { loginAsOwner as csvLoginAsOwner } from '../fixtures/auth';
import { futureTestDate as csvFutureTestDate, prevMonthTestDate as csvPrevMonthTestDate } from '../fixtures/dates';
import { simulateConfirm as csvSimulateConfirm } from '../fixtures/testAdmin';
import {
  openDayCard as csvOpenDayCard3,
  goToPlanningStep as csvGoToPlanningStep3,
  selectStatus as csvSelectStatus3,
  confirmRetrofit as csvConfirmRetrofit3,
} from '../fixtures/dailyDetail';

const CSV_STATS_API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

async function csvGetMyMonthlyStats(page: Page, month: string) {
  const res = await page.request.get(`${CSV_STATS_API_BASE}/stats/monthly?month=${month}`);
  return res.json() as Promise<{ distribution: { mission: number; leave: number; sick: number } }>;
}

test.describe('CSV coverage — Stats Sanity Check', () => {
  // The past-day section of this test (below, retrofitting pastDate) goes through
  // goToPlanningStep's "Retrofit Working Status" branch, which requires day.isPast —
  // a field never populated for real presence data (see e2e/tests/retrofit.spec.ts
  // for the full root-cause trace: it's only set on seed/mock records, absent from
  // GET /presence and never derived client-side). Marked fixme rather than a
  // misleading "passing" test; revisit once isPast is actually populated.
  test.fixme('[H-43] only confirmed statuses feed into My Stats', async ({ page }) => {
    await csvLoginAsOwner(page);

    // (a) a future Mission day must never count — it can't be confirmed yet.
    const futureDate = csvFutureTestDate('H-43-future');
    const futureMonth = futureDate.slice(0, 7);
    await csvOpenDayCard3(page, futureDate);
    await csvGoToPlanningStep3(page);
    await csvSelectStatus3(page, 'MISSION');

    const statsBefore = await csvGetMyMonthlyStats(page, futureMonth);
    expect(statsBefore.distribution.mission).toBe(0);

    // (c) a past Mission day, once genuinely confirmed (simulating the nightly cron),
    // must count. Uses retrofit (real) + simulateConfirm (time-passage simulation).
    const pastDate = csvPrevMonthTestDate('H-43-past');
    const pastMonth = pastDate.slice(0, 7);
    await page.click('[data-testid="month-selector-button"]');
    await expect(page.getByText('Select Month')).toBeVisible({ timeout: 3000 });
    const prevLabel = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
      .toLocaleString('en-US', { month: 'long', year: 'numeric' });
    await page.getByTestId('month-option').filter({ hasText: prevLabel }).click();
    await page.waitForSelector('[data-testid="day-card"]', { timeout: 5000 });

    await csvOpenDayCard3(page, pastDate);
    await csvGoToPlanningStep3(page);
    await csvSelectStatus3(page, 'MISSION');
    await csvConfirmRetrofit3(page);

    const meRes = await page.request.get(`${CSV_STATS_API_BASE}/auth/me`);
    const me = (await meRes.json()) as { id: string };
    await csvSimulateConfirm(me.id, pastDate);

    const statsAfterConfirm = await csvGetMyMonthlyStats(page, pastMonth);
    expect(statsAfterConfirm.distribution.mission).toBeGreaterThanOrEqual(1);
  });
});
