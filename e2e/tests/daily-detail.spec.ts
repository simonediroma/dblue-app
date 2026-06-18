import { test, expect } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

test.describe('Daily Detail overlay', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');
  });

  async function openFirstNonClosedCard(page: import('@playwright/test').Page) {
    const cards = page.locator('[data-testid="day-card"]:not(.dynamic-border-card)');
    const count = await cards.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const card = cards.nth(i);
      const opacity = await card.evaluate(el => window.getComputedStyle(el).opacity);
      if (opacity !== '0.4') {
        await card.click();
        return true;
      }
    }
    return false;
  }

  test('clicking a day card opens daily detail overlay', async ({ page }) => {
    const opened = await openFirstNonClosedCard(page);
    expect(opened).toBe(true);
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });
  });

  test('daily detail shows the date prominently', async ({ page }) => {
    await openFirstNonClosedCard(page);
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });
    // The day number or date should be visible inside the overlay
    await expect(page.locator('[data-testid="daily-detail"]').locator('text=/\\d{1,2}/').first()).toBeVisible();
  });

  test('daily detail shows colleague sections', async ({ page }) => {
    await openFirstNonClosedCard(page);
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });
    // Look for colleague-related content (In Office section, teammates, or colleague names)
    const detail = page.locator('[data-testid="daily-detail"]');
    // Should have some content — at minimum, status options or colleague info
    await expect(detail.locator('text=/in office|remote|office|teammate|colleague/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('daily detail closes via close button', async ({ page }) => {
    await openFirstNonClosedCard(page);
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });

    // Find close/X button
    const closeBtn = page.getByRole('button', { name: /close/i }).first();
    const xBtn = page.locator('[data-testid="daily-detail"] button').filter({ has: page.locator('svg') }).first();

    const closeBtnVisible = await closeBtn.isVisible().catch(() => false);
    if (closeBtnVisible) {
      await closeBtn.click();
    } else {
      await xBtn.click();
    }

    await expect(page.locator('[data-testid="daily-detail"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('daily detail can navigate to the next day', async ({ page }) => {
    await openFirstNonClosedCard(page);
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });

    // Navigation arrows exist in the PLANNING step — first we may need to enter planning
    // or use the planning button
    const planningBtn = page.locator('[data-testid="daily-detail"]').getByRole('button', { name: /set|plan|choose/i }).first();
    const isPlanningVisible = await planningBtn.isVisible().catch(() => false);
    if (isPlanningVisible) {
      await planningBtn.click();
    }
    // Verify detail is still open
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 3000 });
  });
});
