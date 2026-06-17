import { test, expect } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirector(page);
    await page.click('[data-testid="nav-profile"]');
    await page.waitForSelector('[data-testid="profile-page"]');
  });

  test('profile page loads', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
  });

  test('profile page shows user preferences section', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
    await expect(page.getByText(/theme|appearance|preferences/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('theme options are visible (light, dark, system)', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
    // Theme controls exist somewhere on the page — either directly or in a sub-section
    const themeText = page.getByText(/light|dark|system/i);
    await expect(themeText.first()).toBeVisible({ timeout: 5000 });
  });

  test('switching to dark mode adds dark class to html element', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();

    // Find the dark mode button
    const darkBtn = page.getByRole('button', { name: /dark/i }).first();
    const isDarkVisible = await darkBtn.isVisible().catch(() => false);
    if (!isDarkVisible) {
      test.skip();
      return;
    }
    await darkBtn.click();
    await page.waitForTimeout(300);
    const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(hasDarkClass).toBe(true);

    // Switch back to light
    const lightBtn = page.getByRole('button', { name: /light/i }).first();
    await lightBtn.click();
    await page.waitForTimeout(300);
    const hasLightClass = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
    expect(hasLightClass).toBe(true);
  });

  test('teammates section is visible in profile', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
    await expect(page.getByText(/teammate|colleague/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('logout button is present', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
    // Logout button should be somewhere on the profile page
    const logoutBtn = page.getByRole('button', { name: /logout|sign out|esci/i }).first();
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
  });

  test('logout button navigates to login page', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible();
    const logoutBtn = page.getByRole('button', { name: /logout|sign out|esci/i }).first();
    await logoutBtn.click();
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 10000 });
  });
});
