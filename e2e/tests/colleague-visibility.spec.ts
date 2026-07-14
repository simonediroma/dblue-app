import { test, expect, Browser, Page } from '@playwright/test';
import { loginAsOwner, loginAs, DevRole, ROLE_EMAILS } from '../fixtures/auth';
import { futureTestDate } from '../fixtures/dates';
import { resetStatus } from '../fixtures/testAdmin';
import { openDayCard, goToPlanningStep, selectStatus, confirmRoom, StatusKey } from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

/**
 * CSV coverage — Colleague Visibility (H-41 -> H-42)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 */

async function setColleagueStatus(browser: Browser, role: DevRole, date: string, status: StatusKey) {
  await resetStatus(ROLE_EMAILS[role], date);
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, role);
  await openDayCard(page, date);
  await goToPlanningStep(page);
  if (status === 'IN_OFFICE') {
    // confirmRoom() already waits for the real POST /presence response.
    await selectStatus(page, status, date);
    await confirmRoom(page, /./);
  } else {
    // selectStatus()'s generic branch clicks the status option, whose onClick
    // (DailyDetail.tsx's handleStatusSelect) fires onUpdateStatus WITHOUT awaiting it —
    // fire-and-forget, same class already fixed for confirmRoom() (PR #109). This
    // helper closes the browser context right after, which can abort the still-in-flight
    // request before it reaches the server. Safe to wait for the real response here
    // specifically (unlike inside the shared selectStatus() helper): these calls always
    // use futureTestDate(), never today/tomorrow, so isLastMinute() never gates this
    // status change behind the unbooking-confirmation modal instead of an immediate POST.
    const responsePromise = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/presence'),
      { timeout: 15000 }
    ).catch(() => null);
    await selectStatus(page, status, date);
    await responsePromise;
  }
  await context.close();
}

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
  // and setTeammates() would silently no-op against zero rendered options if they ran
  // during that window. Wait for at least one real option before proceeding.
  await expect(page.locator('[data-testid="teammate-option"]').first()).toBeVisible({ timeout: 10000 });
}

async function clearSelectedTeammates(page: Page) {
  const options = page.locator('[data-testid="teammate-option"]');
  const active = () => options.filter({ has: page.locator('svg.lucide-check') });
  let guard = 0;
  while ((await active().count()) > 0 && guard < 10) {
    const item = active().first();
    const name = await item.innerText();
    await item.click();
    // Wait for this specific click to actually land before re-querying active() by
    // checkmark presence — active() is a live query, not a snapshot, so a stale DOM
    // read here can re-resolve to the SAME still-checked item next iteration and toggle
    // it back on, burning the guard budget while other genuinely-stale selections are
    // never touched.
    await expect(options.filter({ hasText: name }).locator('svg.lucide-check')).toHaveCount(0, { timeout: 3000 });
    guard++;
  }
}

async function setTeammates(page: Page, names: string[]) {
  await openProfileTeammatesEditor(page);
  await clearSelectedTeammates(page);
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
  // [data-testid="profile-page"] is a static wrapper in App.tsx around the whole
  // Profile component — it never disappears when Profile's internal activeView
  // switches away from 'teammates', so waiting for it doesn't confirm the editor has
  // actually closed (it's inside an AnimatePresence(mode="wait") that can keep the
  // old instance mounted briefly during its exit animation). Wait for the save
  // button itself (unique to the editor) to be gone instead.
  //
  // The Save button's onClick (Profile.tsx) fires PATCH /users/me/teammates without
  // awaiting it before switching views — wait for the actual response so whatever
  // reads teammate state right after (e.g. opening a day card) doesn't race a still
  // in-flight save.
  const saved = page.waitForResponse(
    (res) => res.url().includes('/users/me/teammates') && res.request().method() === 'PATCH'
  );
  await page.click('[data-testid="teammate-save"]');
  await saved;
  await expect(page.locator('[data-testid="teammate-save"]')).not.toBeVisible({ timeout: 5000 });
}

test.describe('CSV coverage — Colleague Visibility', () => {
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-41] teammates are prioritised at the top of the Daily View', async ({ page, browser }) => {
    // Two setColleagueStatus() round trips (each a full login + day-planning flow in a
    // separate browser context) plus the teammate editor flow below routinely exceed
    // Playwright's 30s default test timeout on the real environment. 60s still wasn't
    // enough on a slower run — real network latency against the shared Railway
    // environment varies, so give more headroom.
    test.setTimeout(90000);
    const date = futureTestDate('H-41');
    await setColleagueStatus(browser, 'lab_responsible', date, 'REMOTE'); // Sara Ferrari
    await setColleagueStatus(browser, 'admin_member', date, 'LEAVE'); // Luca Esposito

    await loginAsOwner(page);
    await setTeammates(page, ['Sara Ferrari', 'Luca Esposito']);

    // Confirmed via a live trace on the identical H-04 pattern (teammates.spec.ts):
    // openProfileTeammatesEditor() navigates to the Profile tab and nothing ever
    // navigates back — the day-card openDayCard() below looks for doesn't exist
    // anywhere on the page until "Plan" is clicked again.
    await page.click('[data-testid="nav-plan-desktop"]');
    await page.waitForSelector('[data-testid="plan-page"]');

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
    // Four setColleagueStatus() round trips (each a full login + day-planning flow in a
    // separate browser context) routinely exceed Playwright's 30s default test timeout
    // on the real environment.
    test.setTimeout(90000);
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

    // The "Other colleagues" section on this screen (DailyDetail.tsx VIEW step) is
    // a compact avatar-only grid — no data-testid="colleague-item" and no text label
    // at all, by design (only "Project Teammates" and "In the office" render full
    // ColleagueItem rows inline). Each person's status label is only rendered as text
    // on the "See all" screen (ALL_COLLEAGUES step), which lists every colleague via
    // ColleagueItem — navigate there before checking status labels.
    await page.getByRole('button', { name: /see all/i }).click();
    const allColleaguesDetail = page.locator('[data-testid="daily-detail"]');
    await expect(allColleaguesDetail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Mario' }).filter({ hasText: /remote/i })).toBeVisible();
    await expect(allColleaguesDetail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Sara' }).filter({ hasText: /leave/i })).toBeVisible();
    await expect(allColleaguesDetail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Luca' }).filter({ hasText: /mission/i })).toBeVisible();
    await expect(allColleaguesDetail.locator('[data-testid="colleague-item"]').filter({ hasText: 'Giulia' }).filter({ hasText: /parental/i })).toBeVisible();
  });
});
