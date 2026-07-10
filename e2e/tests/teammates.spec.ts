import { test, expect, Page, APIRequestContext, Browser } from '@playwright/test';
import { loginAsOwner, loginAsDirectorRole, ROLE_EMAILS } from '../fixtures/auth';
import { resetOnboarding, resetStatus } from '../fixtures/testAdmin';
import { futureTestDate } from '../fixtures/dates';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom } from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

/**
 * CSV coverage — Teammates (H-01 -> H-08)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 *
 * The acting user for onboarding tests (H-01, H-02) is the employee dev account
 * (mario.rossi@dblue.it), whose onboardingCompleted flag is reset via the test-only
 * admin endpoint before each test. The acting user for Profile-based tests (H-03..H-08)
 * is the owner dev account (dev@dblue.it). "Giulia Bianchi" (director dev account) is
 * used as the one teammate whose real office presence we can control via her own login,
 * to verify avatar/section surfacing.
 */

const EMPLOYEE_EMAIL = 'mario.rossi@dblue.it';
const KNOWN_TEAMMATES = ['Mario Rossi', 'Sara Ferrari', 'Luca Esposito', 'Giulia Bianchi', 'Marco Conti'];

// `adminToken` resolves teammate IDs to names via GET /admin/users, which is
// director/owner-only (backend/src/routes/admin.routes.ts) — it defaults to `token`
// for the common case where the acting user already has that role (H-03 etc., all
// owner-acting), but callers logged in as a lower-privileged role (H-01's employee
// onboarding flow) must pass a separately-fetched owner token here.
async function getMyTeammateNames(request: APIRequestContext, token: string, adminToken: string = token): Promise<string[]> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';
  const meRes = await request.get(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const me = (await meRes.json()) as { teammates: string[] };
  if (me.teammates.length === 0) return [];
  const usersRes = await request.get(`${apiBase}/admin/users`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const users = (await usersRes.json()) as Array<{ id: string; name: string }>;
  const byId = new Map(users.map((u) => [u.id, u.name]));
  return me.teammates.map((id) => byId.get(id) ?? id);
}

async function loginAndGetToken(request: APIRequestContext, email: string): Promise<string> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';
  const res = await request.post(`${apiBase}/auth/dev-login`, {
    data: { username: email, password: process.env.DEV_LOGIN_PASS ?? 'changeme' },
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

// --- Onboarding helpers ---

async function selectOnboardingTeammates(page: Page, names: string[]) {
  await page.locator('[data-testid="onboarding"]').getByRole('button', { name: /choose my project teammates/i }).click();
  const searchBox = page.locator('input[placeholder="Search by name..."]');
  for (const name of names) {
    await searchBox.fill(name.split(' ')[0]);
    // Filter by the sought name instead of blindly clicking .first(): selecting a
    // colleague clears the search box as a side effect (see Profile.tsx toggleTeammate),
    // and .first() on the bare locator can resolve against the list before this fill's
    // filter has rendered, clicking whoever's alphabetically first instead.
    await page.locator('[data-testid="onboarding-colleague-option"]').filter({ hasText: name }).first().click();
    // Wait for that same clear-on-select side effect to actually land before the next
    // loop iteration fills a new name — otherwise a fast back-to-back fill() can race
    // the app's own setSearchQuery('') and get silently overwritten, dropping a pick.
    await expect(searchBox).toHaveValue('', { timeout: 3000 });
  }
}

// --- Profile teammates editor helpers ---

async function openProfileTeammatesEditor(page: Page) {
  // Playwright's default desktop viewport (1280x720) is above Tailwind's `md`
  // breakpoint, so the mobile-only bottom nav (data-testid="nav-profile") is
  // display:none — the desktop nav (nav-profile-desktop) is what's actually visible.
  await page.click('[data-testid="nav-profile-desktop"]');
  await page.waitForSelector('[data-testid="profile-page"]');
  await page.click('[data-testid="profile-manage-teammates"]');
  await expect(page.getByPlaceholder('Search by name...')).toBeVisible({ timeout: 5000 });
  // The search box renders immediately (outside the loading conditional in
  // Profile.tsx), but the colleague list itself (GET /admin/users, kicked off only
  // once this view mounts) hasn't necessarily resolved yet — clearSelectedTeammates()
  // and selectTeammatesByName() would silently no-op against zero rendered options if
  // they ran during that window. Wait for at least one real option before proceeding.
  await expect(page.locator('[data-testid="teammate-option"]').first()).toBeVisible({ timeout: 10000 });
}

async function clearSelectedTeammates(page: Page) {
  const active = () => page.locator('[data-testid="teammate-option"]').filter({ has: page.locator('svg.lucide-check') });
  let guard = 0;
  while ((await active().count()) > 0 && guard < 10) {
    await active().first().click();
    guard++;
  }
}

async function selectTeammatesByName(page: Page, names: string[]) {
  const searchBox = page.getByPlaceholder('Search by name...');
  for (const name of names) {
    await searchBox.fill(name.split(' ')[0]);
    // Filter by the sought name instead of blindly clicking .first(): selecting a
    // colleague clears the search box as a side effect (see Profile.tsx toggleTeammate),
    // and .first() on the bare locator can resolve against the list before this fill's
    // filter has rendered, clicking whoever's alphabetically first instead.
    await page.locator('[data-testid="teammate-option"]').filter({ hasText: name }).first().click();
    // Wait for that same clear-on-select side effect to actually land before the next
    // loop iteration fills a new name — otherwise a fast back-to-back fill() can race
    // the app's own setSearchQuery('') and get silently overwritten, dropping a pick.
    await expect(searchBox).toHaveValue('', { timeout: 3000 });
  }
}

async function selectFillerTeammates(page: Page, count: number, excludeNames: string[]) {
  // The teammate list is search-filtered, and this always runs right after
  // selectTeammatesByName()/a manual .fill() left a name in the search box — clear it
  // first so the full list (not just matches for whatever was last searched) is visible.
  await page.getByPlaceholder('Search by name...').fill('');
  const pattern = new RegExp(excludeNames.join('|'));
  const candidates = page.locator('[data-testid="teammate-option"]').filter({ hasNotText: pattern });
  for (let i = 0; i < count; i++) {
    await candidates.nth(i).click();
  }
}

async function saveTeammates(page: Page) {
  // [data-testid="profile-page"] is a static wrapper in App.tsx around the whole
  // Profile component (see App.tsx ~L1229) — it never disappears when Profile's
  // internal activeView switches away from 'teammates', so waiting for it here is a
  // no-op that doesn't confirm the editor has actually closed. The editor itself sits
  // inside an AnimatePresence(mode="wait"), so its exit animation can keep the old
  // [data-testid="teammate-option"] instance mounted (and clickable-looking) for a
  // moment after Save — reopening the editor immediately risks a stray click landing
  // on that stale, about-to-be-discarded instance instead of the fresh one. Wait for
  // the save button itself (unique to the editor) to be gone before proceeding.
  await page.click('[data-testid="teammate-save"]');
  await expect(page.locator('[data-testid="teammate-save"]')).not.toBeVisible({ timeout: 5000 });
}

// Sets Giulia Bianchi's own real status for a date, so surfacing can be checked from
// another account's Plan view / DailyDetail. Uses its own browser context so it never
// collides with whatever account the test's main `page` is (or will be) logged in as.
async function setGiuliaStatus(browser: Browser, date: string, status: 'IN_OFFICE' | 'REMOTE') {
  await resetStatus(ROLE_EMAILS.director, date);
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsDirectorRole(page);
  await openDayCard(page, date);
  await goToPlanningStep(page);
  await selectStatus(page, status, date);
  if (status === 'IN_OFFICE') {
    await confirmRoom(page, /./);
  }
  await context.close();
}

test.describe('CSV coverage — Teammates', () => {
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-01] add 5 real teammates from scratch from the Onboarding', async ({ page, request }) => {
    await resetOnboarding(EMPLOYEE_EMAIL);

    await page.goto('/?dev=true');
    await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMPLOYEE_EMAIL);
    await page.fill('input[type="password"]', process.env.DEV_LOGIN_PASS ?? 'changeme');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="onboarding"]')).toBeVisible({ timeout: 15000 });
    await selectOnboardingTeammates(page, KNOWN_TEAMMATES);
    await page.locator('[data-testid="onboarding-start-planning"]').click();
    await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 });

    const token = await loginAndGetToken(request, EMPLOYEE_EMAIL);
    const ownerToken = await loginAndGetToken(request, 'dev@dblue.it');
    const names = await getMyTeammateNames(request, token, ownerToken);
    expect(names.length).toBe(5);
    for (const n of KNOWN_TEAMMATES) expect(names).toContain(n);
  });

  test('[H-02] 5 teammates added via onboarding are correctly surfaced', async ({ page, browser }) => {
    // Two full setGiuliaStatus() round trips (each its own login + day-planning flow
    // in a separate browser context) plus the onboarding flow below routinely push
    // this past Playwright's 30s default test timeout — not a functional failure, just
    // not enough budget for a genuinely multi-step test on a real, network-latency-bound
    // shared environment.
    test.setTimeout(60000);
    const officeDate = futureTestDate('H-02-office');
    const remoteDate = futureTestDate('H-02-remote');
    await setGiuliaStatus(browser, officeDate, 'IN_OFFICE');
    await setGiuliaStatus(browser, remoteDate, 'REMOTE');

    await resetOnboarding(EMPLOYEE_EMAIL);
    await page.goto('/?dev=true');
    await page.waitForSelector('[data-testid="login-page"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMPLOYEE_EMAIL);
    await page.fill('input[type="password"]', process.env.DEV_LOGIN_PASS ?? 'changeme');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="onboarding"]')).toBeVisible({ timeout: 15000 });
    await selectOnboardingTeammates(page, KNOWN_TEAMMATES);
    await page.locator('[data-testid="onboarding-start-planning"]').click();
    await page.waitForSelector('[data-testid="plan-page"]', { timeout: 15000 });

    // Plan view: avatar should surface only on the day Giulia is actually in the office.
    const officeCard = page.locator(`[data-testid="day-card"][data-date="${officeDate}"]`);
    await officeCard.scrollIntoViewIfNeeded();
    await expect(officeCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(1, { timeout: 10000 });

    const remoteCard = page.locator(`[data-testid="day-card"][data-date="${remoteDate}"]`);
    await remoteCard.scrollIntoViewIfNeeded();
    await expect(remoteCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(0);

    // Daily view: "Project Teammates" section shows Giulia regardless of her status that day.
    await openDayCard(page, remoteDate);
    await expect(page.getByText('Project Teammates')).toBeVisible();
    await expect(page.locator('[data-testid="colleague-item"]').filter({ hasText: 'Giulia' })).toBeVisible();
  });

  test('[H-03] add 5 real teammates from scratch from the "Profile" section', async ({ page, request }) => {
    await loginAsOwner(page);
    await openProfileTeammatesEditor(page);
    await clearSelectedTeammates(page);
    await selectTeammatesByName(page, KNOWN_TEAMMATES);
    await saveTeammates(page);

    const token = await loginAndGetToken(request, 'dev@dblue.it');
    const names = await getMyTeammateNames(request, token);
    expect(names.length).toBe(5);
    for (const n of KNOWN_TEAMMATES) expect(names).toContain(n);
  });

  test('[H-04] 5 teammates added via "Profile" are correctly surfaced', async ({ page, browser }) => {
    // See H-02: two setGiuliaStatus() round trips plus the Profile editor flow below
    // routinely exceed Playwright's 30s default test timeout on the real environment.
    test.setTimeout(60000);
    const officeDate = futureTestDate('H-04-office');
    const remoteDate = futureTestDate('H-04-remote');
    await setGiuliaStatus(browser, officeDate, 'IN_OFFICE');
    await setGiuliaStatus(browser, remoteDate, 'REMOTE');

    await loginAsOwner(page);
    await openProfileTeammatesEditor(page);
    await clearSelectedTeammates(page);
    await selectTeammatesByName(page, KNOWN_TEAMMATES);
    await saveTeammates(page);

    const officeCard = page.locator(`[data-testid="day-card"][data-date="${officeDate}"]`);
    await officeCard.scrollIntoViewIfNeeded();
    await expect(officeCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(1, { timeout: 10000 });

    const remoteCard = page.locator(`[data-testid="day-card"][data-date="${remoteDate}"]`);
    await remoteCard.scrollIntoViewIfNeeded();
    await expect(remoteCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(0);
  });

  test('[H-05] edit teammates — replace all 5', async ({ page, request }) => {
    await loginAsOwner(page);
    await openProfileTeammatesEditor(page);
    await clearSelectedTeammates(page);
    await selectTeammatesByName(page, ['Mario Rossi', 'Sara Ferrari', 'Luca Esposito', 'Marco Conti']);
    await selectFillerTeammates(page, 1, KNOWN_TEAMMATES);
    await saveTeammates(page);

    // Now fully replace with a different set (still includes Giulia so surfacing stays testable).
    await openProfileTeammatesEditor(page);
    await clearSelectedTeammates(page);
    await selectTeammatesByName(page, ['Giulia Bianchi']);
    await selectFillerTeammates(page, 4, KNOWN_TEAMMATES);
    await saveTeammates(page);

    const token = await loginAndGetToken(request, 'dev@dblue.it');
    const names = await getMyTeammateNames(request, token);
    expect(names.length).toBe(5);
    expect(names).toContain('Giulia Bianchi');
    expect(names).not.toContain('Mario Rossi');
    expect(names).not.toContain('Sara Ferrari');
    expect(names).not.toContain('Luca Esposito');
    expect(names).not.toContain('Marco Conti');
  });

  test('[H-06] edit teammates — replaced all 5 surfacing to the app', async ({ page, browser }) => {
    // See H-02: two setGiuliaStatus() round trips plus the Profile editor flow below
    // routinely exceed Playwright's 30s default test timeout on the real environment.
    test.setTimeout(60000);
    const officeDate = futureTestDate('H-06-office');
    const remoteDate = futureTestDate('H-06-remote');
    await setGiuliaStatus(browser, officeDate, 'IN_OFFICE');
    await setGiuliaStatus(browser, remoteDate, 'REMOTE');

    await loginAsOwner(page);
    await openProfileTeammatesEditor(page);
    await clearSelectedTeammates(page);
    await selectTeammatesByName(page, ['Giulia Bianchi']);
    await selectFillerTeammates(page, 4, KNOWN_TEAMMATES);
    await saveTeammates(page);

    const officeCard = page.locator(`[data-testid="day-card"][data-date="${officeDate}"]`);
    await officeCard.scrollIntoViewIfNeeded();
    await expect(officeCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(1, { timeout: 10000 });

    const remoteCard = page.locator(`[data-testid="day-card"][data-date="${remoteDate}"]`);
    await remoteCard.scrollIntoViewIfNeeded();
    await expect(remoteCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(0);
  });

  test('[H-07] edit teammates — replace a couple of people', async ({ page, request }) => {
    await loginAsOwner(page);
    await openProfileTeammatesEditor(page);
    await clearSelectedTeammates(page);
    await selectTeammatesByName(page, KNOWN_TEAMMATES);
    await saveTeammates(page);

    // Deselect exactly 2 (Mario, Sara) and add 2 fillers instead.
    await openProfileTeammatesEditor(page);
    await page.getByPlaceholder('Search by name...').fill('Mario');
    await page.locator('[data-testid="teammate-option"]').filter({ hasText: 'Mario' }).first().click();
    await page.getByPlaceholder('Search by name...').fill('Sara');
    await page.locator('[data-testid="teammate-option"]').filter({ hasText: 'Sara' }).first().click();
    await selectFillerTeammates(page, 2, KNOWN_TEAMMATES);
    await saveTeammates(page);

    const token = await loginAndGetToken(request, 'dev@dblue.it');
    const names = await getMyTeammateNames(request, token);
    expect(names.length).toBe(5);
    expect(names).not.toContain('Mario Rossi');
    expect(names).not.toContain('Sara Ferrari');
    expect(names).toContain('Luca Esposito');
    expect(names).toContain('Giulia Bianchi');
    expect(names).toContain('Marco Conti');
  });

  test('[H-08] edit teammates — replaced subset surface correctly', async ({ page, browser }) => {
    // See H-02: two setGiuliaStatus() round trips plus TWO Profile editor round trips
    // below routinely exceed Playwright's 30s default test timeout on the real
    // environment — the most compound of these four, so given the most headroom.
    test.setTimeout(75000);
    const officeDate = futureTestDate('H-08-office');
    const remoteDate = futureTestDate('H-08-remote');
    await setGiuliaStatus(browser, officeDate, 'IN_OFFICE');
    await setGiuliaStatus(browser, remoteDate, 'REMOTE');

    await loginAsOwner(page);
    await openProfileTeammatesEditor(page);
    await clearSelectedTeammates(page);
    await selectTeammatesByName(page, KNOWN_TEAMMATES);
    await saveTeammates(page);

    await openProfileTeammatesEditor(page);
    await page.getByPlaceholder('Search by name...').fill('Mario');
    await page.locator('[data-testid="teammate-option"]').filter({ hasText: 'Mario' }).first().click();
    await selectFillerTeammates(page, 1, KNOWN_TEAMMATES);
    await saveTeammates(page);

    // Giulia was untouched by the substitution — she should still surface correctly.
    const officeCard = page.locator(`[data-testid="day-card"][data-date="${officeDate}"]`);
    await officeCard.scrollIntoViewIfNeeded();
    await expect(officeCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(1, { timeout: 10000 });

    const remoteCard = page.locator(`[data-testid="day-card"][data-date="${remoteDate}"]`);
    await remoteCard.scrollIntoViewIfNeeded();
    await expect(remoteCard.locator('[data-testid="daycard-teammate-avatar"]')).toHaveCount(0);
  });
});
