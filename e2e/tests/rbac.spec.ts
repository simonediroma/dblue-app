import { test, expect } from '@playwright/test';
import { loginAsDirector, loginAsEmployee } from '../fixtures/auth';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const API_BASE = process.env.API_BASE_URL ?? BASE_URL.replace(':5173', ':4000');

test.describe('Role-based access control', () => {
  test('director sees Organisation tab in nav', async ({ page }) => {
    await loginAsDirector(page);
    await expect(page.locator('[data-testid="nav-organisation"]')).toBeVisible({ timeout: 5000 });
  });

  test('director can access Organisation tab content', async ({ page }) => {
    await loginAsDirector(page);
    await page.click('[data-testid="nav-organisation"]');
    await expect(page.getByText(/organisation|org/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('employee does NOT see Organisation tab', async ({ page }) => {
    // This test requires a second dev user with employee role configured in .env
    const employeeUser = process.env.DEV_LOGIN_EMPLOYEE_USER;
    if (!employeeUser) {
      test.skip();
      return;
    }
    await loginAsEmployee(page);
    // Organisation nav tab should not exist for employees
    await expect(page.locator('[data-testid="nav-organisation"]')).not.toBeVisible({ timeout: 3000 });
  });

  test('director can access /stats/area API endpoint', async ({ page }) => {
    await loginAsDirector(page);
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const response = await page.request.get(`${API_BASE}/stats/area?month=${month}`);
    expect(response.status()).toBe(200);
  });

  test('employee gets 403 on /stats/area API endpoint', async ({ page }) => {
    const employeeUser = process.env.DEV_LOGIN_EMPLOYEE_USER;
    if (!employeeUser) {
      test.skip();
      return;
    }
    await loginAsEmployee(page);
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const response = await page.request.get(`${API_BASE}/stats/area?month=${month}`);
    expect(response.status()).toBe(403);
  });

  test('director can see all users via /admin/users API', async ({ page }) => {
    await loginAsDirector(page);
    const response = await page.request.get(`${API_BASE}/admin/users`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('employee gets 403 on /admin/users API', async ({ page }) => {
    const employeeUser = process.env.DEV_LOGIN_EMPLOYEE_USER;
    if (!employeeUser) {
      test.skip();
      return;
    }
    await loginAsEmployee(page);
    const response = await page.request.get(`${API_BASE}/admin/users`);
    expect(response.status()).toBe(403);
  });
});
