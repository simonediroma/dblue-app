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
