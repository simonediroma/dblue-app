import { test, expect, Browser, Page } from '@playwright/test';
import { loginAsOwner, loginAs, DevRole } from '../fixtures/auth';
import { futureTestDate } from '../fixtures/dates';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom, StatusKey } from '../fixtures/dailyDetail';

/**
 * CSV coverage — Colleague Visibility (H-41 -> H-42)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 */

async function setColleagueStatus(browser: Browser, role: DevRole, date: string, status: StatusKey) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, role);
  await openDayCard(page, date);
  await goToPlanningStep(page);
  await selectStatus(page, status);
  if (status === 'IN_OFFICE') await confirmRoom(page, /./);
  await context.close();
}

async function openProfileTeammatesEditor(page: Page) {
  await page.click('[data-testid="nav-profile"]');
  await page.waitForSelector('[data-testid="profile-page"]');
  await page.click('[data-testid="profile-manage-teammates"]');
  await expect(page.getByPlaceholder('Search by name...')).toBeVisible({ timeout: 5000 });
}

async function clearSelectedTeammates(page: Page) {
  const active = () => page.locator('[data-testid="teammate-option"]').filter({ has: page.locator('svg.lucide-check') });
  let guard = 0;
  while ((await active().count()) > 0 && guard < 10) {
    await active().first().click();
    guard++;
  }
}

async function setTeammates(page: Page, names: string[]) {
  await openProfileTeammatesEditor(page);
  await clearSelectedTeammates(page);
  for (const name of names) {
    await page.getByPlaceholder('Search by name...').fill(name.split(' ')[0]);
    await page.locator('[data-testid="teammate-option"]').first().click();
  }
  await page.click('[data-testid="teammate-save"]');
  await page.waitForSelector('[data-testid="profile-page"]');
}

test.describe('CSV coverage — Colleague Visibility', () => {
  test('[H-41] teammates are prioritised at the top of the Daily View', async ({ page, browser }) => {
    const date = futureTestDate('H-41');
    await setColleagueStatus(browser, 'lab_responsible', date, 'REMOTE'); // Sara Ferrari
    await setColleagueStatus(browser, 'admin_member', date, 'LEAVE'); // Luca Esposito

    await loginAsOwner(page);
    await setTeammates(page, ['Sara Ferrari', 'Luca Esposito']);

    await openDayCard(page, date);
    const detail = page.locator('[data-testid="daily-detail"]');

    const projectHeading = detail.getByText('Project Teammates');
    await expect(projectHeading).toBeVisible();
    const inOfficeOrOtherHeading = detail.getByText(/^in the office$|^other colleagues/i).first();
    const hasOtherSection = await inOfficeOrOtherHeading.isVisible().catch(() => false);

    if (hasOtherSection) {
      const projectBox = await projectHeading.boundingBox();
      const otherBox = await inOfficeOrOtherHeading.boundingBox();
      expect(projectBox && otherBox && projectBox.y).toBeLessThan(otherBox?.y ?? Infinity);
    }

    // Both teammates must be listed in the Project Teammates section regardless of status.
    const projectSection = detail.locator('[data-testid="colleague-item"]');
    await expect(projectSection.filter({ hasText: 'Sara' })).toBeVisible();
    await expect(projectSection.filter({ hasText: 'Luca' })).toBeVisible();
  });

  test('[H-42] colleagues are correctly split by status, not lumped into "in office"', async ({ page, browser }) => {
    const date = futureTestDate('H-42');
    await setColleagueStatus(browser, 'employee', date, 'REMOTE'); // Mario Rossi
    await setColleagueStatus(browser, 'lab_responsible', date, 'LEAVE'); // Sara Ferrari
    await setColleagueStatus(browser, 'admin_member', date, 'MISSION'); // Luca Esposito
    await setColleagueStatus(browser, 'director', date, 'PARENTAL_LEAVE'); // Giulia Bianchi

    await loginAsOwner(page);
    await openDayCard(page, date);
    const detail = page.locator('[data-testid="daily-detail"]');

    // None of these 4 should render inside the "In the office" section.
    const inOfficeSection = detail.locator('text=In the office').locator('xpath=following-sibling::*[1]');
    for (const name of ['Mario', 'Sara', 'Luca', 'Giulia']) {
      await expect(inOfficeSection.locator('[data-testid="colleague-item"]').filter({ hasText: name })).toHaveCount(0);
    }

    // Each must show its own correct status label somewhere in the colleague list.
    await expect(detail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Mario' }).filter({ hasText: /remote/i })).toBeVisible();
    await expect(detail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Sara' }).filter({ hasText: /leave/i })).toBeVisible();
    await expect(detail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Luca' }).filter({ hasText: /mission/i })).toBeVisible();
    await expect(detail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Giulia' }).filter({ hasText: /parental/i })).toBeVisible();
  });
});
