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
