import { Page } from '@playwright/test';

const DEV_LOGIN_USER = process.env.DEV_LOGIN_USER ?? 'dev@dblue.it';
const DEV_LOGIN_PASS = process.env.DEV_LOGIN_PASS ?? 'changeme';
const DEV_LOGIN_EMPLOYEE_USER = process.env.DEV_LOGIN_EMPLOYEE_USER ?? 'employee@dblue.it';
const DEV_LOGIN_EMPLOYEE_PASS = process.env.DEV_LOGIN_EMPLOYEE_PASS ?? 'changeme';

export async function loginAsDirector(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
  await page.fill('input[type="email"]', DEV_LOGIN_USER);
  await page.fill('input[type="password"]', DEV_LOGIN_PASS);
  await page.click('button[type="submit"]');
  // Wait for redirect to plan page (splash screen may show first)
  await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 });
}

export async function loginAsEmployee(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
  await page.fill('input[type="email"]', DEV_LOGIN_EMPLOYEE_USER);
  await page.fill('input[type="password"]', DEV_LOGIN_EMPLOYEE_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 });
}

export async function logout(page: Page) {
  // Navigate to profile and click logout
  await page.click('[data-testid="nav-profile"]');
  await page.waitForSelector('[data-testid="profile-page"]');
  await page.getByRole('button', { name: /logout|sign out/i }).first().click();
  await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
}
