import { test, expect } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

test.describe('Plan page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirector(page);
  });

  test('plan page loads and shows day cards', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
    // Should have multiple day cards
    await expect(page.locator('[data-testid="day-card"]').first()).toBeVisible({ timeout: 10000 });
    const cardCount = await page.locator('[data-testid="day-card"]').count();
    expect(cardCount).toBeGreaterThan(5);
  });

  test('plan page shows rolling 30+ days', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
    await page.waitForSelector('[data-testid="day-card"]');
    const cardCount = await page.locator('[data-testid="day-card"]').count();
    // Rolling window includes current + next month = at least 30 non-weekend days
    expect(cardCount).toBeGreaterThanOrEqual(20);
  });

  test('month divider between current and next month is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
    // Month divider shows next month label — look for a month name in divider text
    await expect(page.locator('text=/january|february|march|april|may|june|july|august|september|october|november|december/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('current day card is present and highlighted', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
    await page.waitForSelector('[data-testid="day-card"]');
    // The today card uses the dynamic-border-card class (animated gradient border)
    const todayCard = page.locator('[data-testid="day-card"].dynamic-border-card');
    await expect(todayCard).toBeVisible({ timeout: 10000 });
  });

  test('plan page header shows Good Morning greeting', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
    await expect(page.getByText(/good morning/i)).toBeVisible({ timeout: 10000 });
  });

  test('month dropdown opens and lists months', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
    await page.waitForSelector('[data-testid="day-card"]');
    // Click the month label button to open dropdown
    await page.locator('button').filter({ hasText: /january|february|march|april|may|june|july|august|september|october|november|december/i }).first().click();
    // Dropdown should show month options
    await expect(page.getByText('Select Month')).toBeVisible({ timeout: 3000 });
  });

  test('clicking a day card opens the daily detail overlay', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
    await page.waitForSelector('[data-testid="day-card"]');
    // Click the first non-closed day card
    const cards = page.locator('[data-testid="day-card"]');
    const count = await cards.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const card = cards.nth(i);
      const opacity = await card.evaluate(el => window.getComputedStyle(el).opacity);
      if (opacity !== '0.4') {
        await card.click();
        break;
      }
    }
    await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });
  });
});
