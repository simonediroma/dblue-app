import { Page } from '@playwright/test';
import { waitForSplashGone } from './dailyDetail';

const DEV_LOGIN_USER = process.env.DEV_LOGIN_USER ?? 'dev@dblue.it';
const DEV_LOGIN_PASS = process.env.DEV_LOGIN_PASS ?? 'changeme';
const DEV_LOGIN_EMPLOYEE_USER = process.env.DEV_LOGIN_EMPLOYEE_USER ?? 'employee@dblue.it';
const DEV_LOGIN_EMPLOYEE_PASS = process.env.DEV_LOGIN_EMPLOYEE_PASS ?? 'changeme';

export async function loginAsDirector(page: Page) {
  // ?dev=true forces the dev-login form to render even if the deployed frontend
  // wasn't built with VITE_DEV_LOGIN_ENABLED=true — see frontend/src/pages/Login.tsx.
  await page.goto('/?dev=true');
  await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
  await page.fill('input[type="email"]', DEV_LOGIN_USER);
  await page.fill('input[type="password"]', DEV_LOGIN_PASS);
  await page.click('button[type="submit"]');
  // Wait for redirect to plan page (splash screen may show first)
  await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 });
  await waitForSplashGone(page);
}

export async function loginAsEmployee(page: Page) {
  // ?dev=true forces the dev-login form to render even if the deployed frontend
  // wasn't built with VITE_DEV_LOGIN_ENABLED=true — see frontend/src/pages/Login.tsx.
  await page.goto('/?dev=true');
  await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
  await page.fill('input[type="email"]', DEV_LOGIN_EMPLOYEE_USER);
  await page.fill('input[type="password"]', DEV_LOGIN_EMPLOYEE_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 });
  await waitForSplashGone(page);
}

export async function logout(page: Page) {
  // Navigate to profile and click logout
  await page.click('[data-testid="nav-profile"]');
  await page.waitForSelector('[data-testid="profile-page"]');
  await page.getByRole('button', { name: /logout|sign out/i }).first().click();
  await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
}

// --- Additive: full DEV_ACCOUNTS role coverage for the CSV-coverage spec files ---
// (backend/src/routes/auth.routes.ts DEV_ACCOUNTS — same fixed 6 accounts, one shared password)

export type DevRole = 'owner' | 'employee' | 'lab_responsible' | 'admin_member' | 'director';

export const ROLE_EMAILS: Record<DevRole, string> = {
  owner: DEV_LOGIN_USER,
  employee: 'mario.rossi@dblue.it',
  lab_responsible: 'sara.ferrari@dblue.it',
  admin_member: 'luca.esposito@dblue.it',
  director: 'giulia.bianchi@dblue.it',
};

export async function loginAs(page: Page, role: DevRole) {
  // ?dev=true forces the dev-login form to render even if the deployed frontend
  // wasn't built with VITE_DEV_LOGIN_ENABLED=true — see frontend/src/pages/Login.tsx.
  await page.goto('/?dev=true');
  await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
  await page.fill('input[type="email"]', ROLE_EMAILS[role]);
  await page.fill('input[type="password"]', DEV_LOGIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 });
  await waitForSplashGone(page);
}

export const loginAsOwner = (page: Page) => loginAs(page, 'owner');
export const loginAsLabResponsible = (page: Page) => loginAs(page, 'lab_responsible');
export const loginAsAdminMember = (page: Page) => loginAs(page, 'admin_member');
// NOTE: loginAsDirector (above) actually logs in dev@dblue.it, whose real backend
// role is 'owner' — a pre-existing naming quirk, left untouched. This helper logs
// in the *real* director-role account (giulia.bianchi@dblue.it) for tests that need
// actual director-role RBAC (e.g. H-39, H-46).
export const loginAsDirectorRole = (page: Page) => loginAs(page, 'director');
