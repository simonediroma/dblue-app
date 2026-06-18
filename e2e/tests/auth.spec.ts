import { test, expect } from '@playwright/test';
import { loginAsDirector, logout } from '../fixtures/auth';

const DEV_LOGIN_USER = process.env.DEV_LOGIN_USER ?? 'dev@dblue.it';
const DEV_LOGIN_PASS = process.env.DEV_LOGIN_PASS ?? 'changeme';

test.describe('Authentication', () => {
  test('login page is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Presence App')).toBeVisible();
  });

  test('dev-login form is shown when VITE_DEV_LOGIN_ENABLED=true', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="login-page"]');
    // The form should be visible (requires VITE_DEV_LOGIN_ENABLED=true on the frontend build)
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('successful login redirects to plan page', async ({ page }) => {
    await loginAsDirector(page);
    await expect(page.locator('[data-testid="plan-page"]')).toBeVisible();
  });

  test('wrong credentials show an error', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="login-page"]');
    await page.fill('input[type="email"]', DEV_LOGIN_USER);
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button[type="submit"]');
    // Error message should appear
    await expect(page.locator('text=/credenziali|non valide|invalid|error/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('logout redirects back to login page', async ({ page }) => {
    await loginAsDirector(page);
    await logout(page);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
  });

  test('accessing root without auth shows login page', async ({ page }) => {
    // Clear cookies to simulate unauthenticated state
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 10000 });
  });
});
