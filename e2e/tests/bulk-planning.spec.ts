import { test, expect, Page } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

/**
 * Navigate a future day card to the EXTEND step.
 * Skips weekend cards and the current day (which may already be checked in).
 * `skip` controls how many future non-weekend cards to skip before choosing one.
 */
async function openExtendStep(page: Page, skip = 0): Promise<void> {
  await page.waitForSelector('[data-testid="day-card"]', { timeout: 10000 });

  const cards = page.locator('[data-testid="day-card"]');
  const count = await cards.count();

  let chosen = -1;
  let skipped = 0;
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    // Closed / past cards are visually dimmed (opacity-40 class applied)
    const cls = await card.getAttribute('class') ?? '';
    if (cls.includes('opacity-40') || cls.includes('opacity-[0.4]')) continue;
    // Skip today — it might be checked in which hides the extend trigger
    const isToday = cls.includes('dynamic-border-card');
    if (isToday) continue;
    if (skipped < skip) { skipped++; continue; }
    chosen = i;
    break;
  }

  if (chosen === -1) throw new Error('No suitable future day card found');

  await cards.nth(chosen).click();
  await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });

  // If in VIEW step: click the edit button to go to PLANNING
  const editBtn = page.locator('[data-testid="daily-detail"]').locator('button').filter({ hasText: 'Define working status' });
  const editIcon = page.locator('[data-testid="daily-detail"] button').filter({ has: page.locator('svg') }).last();

  const hasDefineBtn = await editBtn.isVisible().catch(() => false);
  if (hasDefineBtn) {
    await editBtn.click();
  } else {
    // Already in PLANNING (status is set), look for the pencil/edit icon
    const planningEditBtn = page.locator('[data-testid="daily-detail"] button svg.lucide-edit-2').locator('..');
    const hasPlanningEdit = await planningEditBtn.isVisible().catch(() => false);
    if (hasPlanningEdit) await planningEditBtn.click();
  }

  // Now click extend trigger
  await expect(page.locator('[data-testid="extend-trigger"]')).toBeVisible({ timeout: 5000 });
  await page.locator('[data-testid="extend-trigger"]').click();

  // Wait for EXTEND step header
  await expect(page.locator('[data-testid="daily-detail"]').getByText('Extend status')).toBeVisible({ timeout: 5000 });
}

test.describe('Bulk planning — Extend to other days', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirector(page);
  });

  test('confirm button is disabled when no dates are selected', async ({ page }) => {
    await openExtendStep(page);

    const confirmBtn = page.locator('[data-testid="extend-confirm"]');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeDisabled();
    await expect(confirmBtn).toHaveText('Select dates to extend');
  });

  test('selecting one date enables confirm button with correct label', async ({ page }) => {
    await openExtendStep(page);

    const confirmBtn = page.locator('[data-testid="extend-confirm"]');
    await expect(confirmBtn).toBeDisabled();

    // Click the first selectable date chip in the grid
    const dateChip = page.locator('[data-testid="daily-detail"] button[disabled]:not([data-testid])').first();
    // Look for enabled date buttons (not disabled) in the calendar
    const enabledChip = page
      .locator('[data-testid="daily-detail"]')
      .locator('button:not([disabled]):not([data-testid="extend-confirm"]):not([data-testid="extend-sick-info"])')
      .filter({ hasNot: page.locator('svg') })
      .first();

    await enabledChip.click();

    await expect(confirmBtn).toBeEnabled();
    await expect(confirmBtn).toHaveText('Extend status to 1 other day');
  });

  test('REMOTE extension to 3 days — no blank screen, plan page survives', async ({ page }) => {
    await openExtendStep(page, 0);

    // Select first 3 available date chips
    const detail = page.locator('[data-testid="daily-detail"]');
    const chips = detail.locator('button:not([disabled]):not([data-testid])').filter({ hasNot: page.locator('svg') });

    const chipCount = await chips.count();
    const toSelect = Math.min(3, chipCount);
    for (let i = 0; i < toSelect; i++) {
      await chips.nth(i).click();
    }

    if (toSelect === 0) {
      test.skip();
      return;
    }

    const confirmBtn = page.locator('[data-testid="extend-confirm"]');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // After confirming: daily detail should close
    await expect(page.locator('[data-testid="daily-detail"]')).not.toBeVisible({ timeout: 8000 });

    // App must not blank — plan page is still in the DOM
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
  });

  test('SICK day — informational block shown instead of date picker', async ({ page }) => {
    // Find a card whose status is SICK (today's card, if seeded as SICK)
    await page.waitForSelector('[data-testid="day-card"]');

    // Look for a card with the red sick icon class (text-red-500) that is for today
    const sickCard = page.locator('[data-testid="day-card"]').filter({ has: page.locator('.text-red-500') }).first();
    const hasSickCard = await sickCard.isVisible().catch(() => false);

    if (!hasSickCard) {
      // No SICK card seeded — skip this test rather than fail
      test.skip();
      return;
    }

    await sickCard.click();
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });

    await expect(page.locator('[data-testid="extend-trigger"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="extend-trigger"]').click();

    // SICK informational message should be visible
    await expect(page.locator('[data-testid="extend-sick-info"]')).toBeVisible({ timeout: 5000 });

    // Confirm button should be disabled (no selectable dates)
    await expect(page.locator('[data-testid="extend-confirm"]')).toBeDisabled();
  });

  test('IN_OFFICE extension — extended cards show numeric occupancy counter', async ({ page }) => {
    // Set first future card to IN_OFFICE via the UI, then extend
    const cards = page.locator('[data-testid="day-card"]');
    await page.waitForSelector('[data-testid="day-card"]');

    // Click the second future card (skip index 0 which might be today)
    const count = await cards.count();
    let targetIndex = -1;
    for (let i = 0; i < count; i++) {
      const cls = await cards.nth(i).getAttribute('class') ?? '';
      if (cls.includes('opacity-40') || cls.includes('opacity-[0.4]')) continue;
      if (cls.includes('dynamic-border-card')) continue; // skip today
      targetIndex = i;
      break;
    }

    if (targetIndex === -1) { test.skip(); return; }

    await cards.nth(targetIndex).click();
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });

    // Navigate to PLANNING step
    const defineBtn = page.locator('[data-testid="daily-detail"]').getByRole('button', { name: 'Define working status' });
    const hasDef = await defineBtn.isVisible().catch(() => false);
    if (hasDef) await defineBtn.click();

    // Select IN_OFFICE status
    const inOfficeBtn = page.locator('[data-testid="daily-detail"]').getByText('In office', { exact: false }).first();
    const hasInOffice = await inOfficeBtn.isVisible().catch(() => false);
    if (!hasInOffice) { test.skip(); return; }
    await inOfficeBtn.click();

    // Confirm room selection if prompted
    const confirmRoomBtn = page.locator('[data-testid="daily-detail"]').getByRole('button', { name: /confirm|done|save/i }).first();
    const hasConfirmRoom = await confirmRoomBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasConfirmRoom) await confirmRoomBtn.click();

    // Now open extend step
    await expect(page.locator('[data-testid="extend-trigger"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="extend-trigger"]').click();

    // Select 2 date chips
    const detail = page.locator('[data-testid="daily-detail"]');
    const chips = detail.locator('button:not([disabled]):not([data-testid])').filter({ hasNot: page.locator('svg') });
    const chipCount = await chips.count();
    for (let i = 0; i < Math.min(2, chipCount); i++) {
      await chips.nth(i).click();
    }
    if (chipCount === 0) { test.skip(); return; }

    await page.locator('[data-testid="extend-confirm"]').click();

    // App must not blank
    await expect(page.locator('[data-testid="daily-detail"]')).not.toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();

    // Extended cards should show a numeric occupancy counter (e.g. "5/23")
    const occupancyText = page.locator('[data-testid="day-card"]').getByText(/^\d+\/\d+$/).first();
    await expect(occupancyText).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------------
// CSV coverage — Bulk Planning (H-15 -> H-20)
// Hits the real backend/DB (Railway dev environment) — no API mocking, no page.route()
// mocking like the block above. See e2e/README.md. Kept separate from the regression
// tests above; do not merge.
// ---------------------------------------------------------------------------------
import { loginAsOwner as csvLoginAsOwner } from '../fixtures/auth';
import { futureTestDate as csvFutureTestDate, todayStr as csvTodayStr } from '../fixtures/dates';
import { resetStatus as csvResetStatus } from '../fixtures/testAdmin';
import {
  openDayCard as csvOpenDayCard,
  goToPlanningStep as csvGoToPlanningStep,
  selectStatus as csvSelectStatus,
  confirmRoom as csvConfirmRoom,
  StatusKey,
} from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

const CSV_OWNER_EMAIL = 'dev@dblue.it';

async function csvSetStatusAndOpenExtend(page: Page, date: string, status: StatusKey) {
  await csvOpenDayCard(page, date);
  await csvGoToPlanningStep(page);
  await csvSelectStatus(page, status, date);
  if (status === 'IN_OFFICE') await csvConfirmRoom(page, /./);

  await csvOpenDayCard(page, date);
  await page.locator('[data-testid="extend-trigger"]').click();
  await expect(page.locator('[data-testid="daily-detail"]').getByText(/extend status/i)).toBeVisible({ timeout: 5000 });
}

async function csvSelectExtendChips(page: Page, count: number): Promise<number> {
  const detail = page.locator('[data-testid="daily-detail"]');
  const chips = detail.locator('button:not([disabled]):not([data-testid])').filter({ hasNot: page.locator('svg') });
  const chipCount = await chips.count();
  const toSelect = Math.min(count, chipCount);
  for (let i = 0; i < toSelect; i++) await chips.nth(i).click();
  return toSelect;
}

async function csvConfirmExtend(page: Page) {
  await page.locator('[data-testid="extend-confirm"]').click();
  await expect(page.locator('[data-testid="daily-detail"]')).not.toBeVisible({ timeout: 8000 });
  await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
}

test.describe('CSV coverage — Bulk Planning', () => {
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-15] plan a full week of office presence (bulk)', async ({ page }) => {
    const date = csvFutureTestDate('H-15');
    await csvResetStatus(CSV_OWNER_EMAIL, date);
    await csvLoginAsOwner(page);
    await csvSetStatusAndOpenExtend(page, date, 'IN_OFFICE');
    const selected = await csvSelectExtendChips(page, 4);
    if (selected === 0) { test.skip(); return; }
    await csvConfirmExtend(page);

    // Regression: source day's occupancy counter must stay a valid x/y, not "__/__", without reload.
    const sourceCard = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await sourceCard.scrollIntoViewIfNeeded();
    await expect(sourceCard.locator('[data-testid="daycard-occupancy"]')).toHaveText(/^\d+\/\d+$/, { timeout: 5000 });
  });

  test('[H-16] book a specific room for an entire week', async ({ page }) => {
    const date = csvFutureTestDate('H-16');
    await csvResetStatus(CSV_OWNER_EMAIL, date);
    await csvLoginAsOwner(page);
    await csvSetStatusAndOpenExtend(page, date, 'IN_OFFICE');

    // Assign a room per extended day via the "Room Assignment FOR NEW DAYS" section.
    const roomOptions = page.locator('[data-testid="extend-room-option"]');
    const roomCount = await roomOptions.count();
    if (roomCount === 0) { test.skip(); return; }
    for (let i = 0; i < roomCount; i++) {
      await roomOptions.nth(i).click();
    }
    await csvConfirmExtend(page);

    const sourceCard = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
    await sourceCard.scrollIntoViewIfNeeded();
    await expect(sourceCard.locator('[data-testid="daycard-occupancy"]')).toHaveText(/^\d+\/\d+$/, { timeout: 5000 });
  });

  test('[H-17] plan to be remote for two weeks consecutively', async ({ page }) => {
    const date = csvFutureTestDate('H-17');
    await csvResetStatus(CSV_OWNER_EMAIL, date);
    await csvLoginAsOwner(page);
    await csvSetStatusAndOpenExtend(page, date, 'REMOTE');
    const selected = await csvSelectExtendChips(page, 10);
    if (selected === 0) { test.skip(); return; }
    await csvConfirmExtend(page);
  });

  test('[H-18] plan a 4 days mission next week', async ({ page }) => {
    const date = csvFutureTestDate('H-18');
    await csvResetStatus(CSV_OWNER_EMAIL, date);
    await csvLoginAsOwner(page);
    await csvSetStatusAndOpenExtend(page, date, 'MISSION');
    const selected = await csvSelectExtendChips(page, 4);
    if (selected === 0) { test.skip(); return; }
    await csvConfirmExtend(page);
  });

  test('[H-19] take a parental leave (6 months)', async ({ page }) => {
    // SICK is today-only server-side; the only reachable path to the "special extended
    // leave" section on a future day is via LEAVE (Vacation) — the CSV's reported
    // confusion ("functionality is inside vacation days instead of sick leave") is a
    // real, current constraint of the code, not a misunderstanding by the tester.
    const date = csvFutureTestDate('H-19');
    await csvResetStatus(CSV_OWNER_EMAIL, date);
    await csvLoginAsOwner(page);
    await csvOpenDayCard(page, date);
    await csvGoToPlanningStep(page);
    await csvSelectStatus(page, 'LEAVE');

    await csvOpenDayCard(page, date);
    await page.locator('[data-testid="extend-trigger"]').click();
    const detail = page.locator('[data-testid="daily-detail"]');
    await expect(detail.getByText(/extend status/i)).toBeVisible({ timeout: 5000 });

    await detail.getByText(/i need a special extended leave/i).click();
    await detail.getByText(/i need more than 2 weeks/i).click();

    const chips = detail.locator('button:not([disabled]):not([data-testid])').filter({ hasNot: page.locator('svg') });
    const chipCount = await chips.count();
    if (chipCount === 0) { test.skip(); return; }
    await chips.first().click();
    await csvConfirmExtend(page);

    // Regression: a day extended via "I need more than 2 weeks" from a Vacation day
    // should be recognisable as a distinct long-term absence, not silently stay filed
    // as plain On Leave (Vacation) — per the CSV this conflation is the bug. Scan the
    // real backend data for any 'leave' entry created after the source date.
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';
    const month1 = date.slice(0, 7);
    const nextMonthDate = new Date(date);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const month2 = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const [res1, res2] = await Promise.all([
      page.request.get(`${apiBase}/presence?month=${month1}`),
      page.request.get(`${apiBase}/presence?month=${month2}`),
    ]);
    const days1 = (await res1.json()) as Array<{ date: string; status: string }>;
    const days2 = (await res2.json()) as Array<{ date: string; status: string }>;
    const leakedAsPlainLeave = [...days1, ...days2].filter((d) => d.date > date && d.status === 'leave');

    expect(leakedAsPlainLeave.length).toBe(0);
  });

  test('[H-20] cannot extend past the 30-day rolling window', async ({ page }) => {
    const date = csvFutureTestDate('H-20', 3);
    await csvResetStatus(CSV_OWNER_EMAIL, date);
    await csvLoginAsOwner(page);
    await csvOpenDayCard(page, date);
    await csvGoToPlanningStep(page);
    await csvSelectStatus(page, 'REMOTE');

    await csvOpenDayCard(page, date);
    await page.locator('[data-testid="extend-trigger"]').click();
    const detail = page.locator('[data-testid="daily-detail"]');
    await expect(detail.getByText(/extend status/i)).toBeVisible({ timeout: 5000 });

    // Expected number of selectable weekdays: (date+1 .. today+30 inclusive).
    const today = new Date(csvTodayStr());
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 30);
    const start = new Date(date);
    start.setDate(start.getDate() + 1);
    let expectedWeekdays = 0;
    for (const d = new Date(start); d <= windowEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) expectedWeekdays++;
    }

    const chips = detail.locator('button:not([disabled]):not([data-testid])').filter({ hasNot: page.locator('svg') });
    const actualCount = await chips.count();

    // The calendar must never offer a date beyond the 30-day window.
    expect(actualCount).toBeLessThanOrEqual(expectedWeekdays);
  });
});
