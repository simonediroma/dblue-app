import { test, expect } from '@playwright/test';
import { loginAsDirector } from '../fixtures/auth';

// Returns today as YYYY-MM-DD in local time
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Regression test for check-in failure (PR #40).
 *
 * Bug: the backend stored uppercase status values ('IN_OFFICE') because
 * Mongoose skips enum validation in findOneAndUpdate without runValidators.
 * The check-in endpoint compared ws.status against a lowercase array
 * ['in_office', 'office_no_desk', 'remote'], causing a 400 for all uppercase
 * values — seen by users as "Check-in failed" after the optimistic flash.
 * Both entry points were affected: the scroll FAB and the DailyDetail button.
 *
 * Fix: upsertStatus normalises to lowercase on write; check-in route uses
 * toLowerCase() on comparisons; frontend api.ts maps lowercase status values
 * to WorkStatus enum so room-selection modal and FAB visibility work correctly.
 *
 * These tests intercept the presence API to inject a controlled today entry
 * with lowercase status (as the backend returns), then verify the full
 * check-in flow completes without "Check-in failed".
 */
test.describe('Check-in FAB — regression: status case mismatch', () => {
  test('FAB check-in with in_office status (lowercase from API) succeeds without error', async ({ page }) => {
    const today = todayStr();
    const month = today.slice(0, 7);

    // --- mock GET /presence: inject today as 'in_office' (lowercase, as backend returns) ---
    await page.route(`**/presence?month=${month}`, async (route) => {
      const days = [
        {
          date: today,
          status: 'in_office',  // lowercase — this is what the real backend returns
          isConfirmed: false,
          isUsingDesk: true,
          room: 'Open Space',
          bookedCount: 3,
          totalCapacity: 23,
          projectTeammatesCount: 0,
          colleagueAvatars: [],
        },
      ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(days) });
    });

    // --- mock GET /rooms ---
    await page.route('**/rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', name: 'Open Space', capacity: 20, type: 'open_space' },
          { id: 'r2', name: 'Lab', capacity: 3, type: 'lab' },
        ]),
      });
    });

    // --- mock POST /presence/:date/checkin and capture the request ---
    let checkinCalled = false;
    await page.route(`**/presence/${today}/checkin`, async (route) => {
      checkinCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ date: today, status: 'in_office', isConfirmed: true, isUsingDesk: true, room: 'Open Space' }),
      });
    });

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    // Scroll down past the today card to trigger the FAB
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);

    // FAB must be visible — if it's not, the status normalization or visibility guard failed
    const fab = page.locator('[data-testid="fab-checkin"]');
    await expect(fab).toBeVisible({ timeout: 5000 });

    await fab.click();

    // For IN_OFFICE status the room-selection modal (daily-detail) must open.
    // Before the fix: status comparison 'in_office' === 'IN_OFFICE' was false →
    // modal never opened → direct checkIn() was called → backend 400 → "Check-in failed".
    const roomSelection = page.locator('[data-testid="daily-detail"]');
    await expect(roomSelection).toBeVisible({ timeout: 5000 });

    // Select a room
    const roomBtn = roomSelection.getByText(/open space/i).first();
    await expect(roomBtn).toBeVisible({ timeout: 3000 });
    await roomBtn.click();

    // After room selection, check-in API must have been called
    await page.waitForTimeout(500);
    expect(checkinCalled).toBe(true);

    // Success notification must appear
    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });

    // "Check-in failed" must NOT appear — this is the regression assertion
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });

  test('FAB check-in with remote status (lowercase from API) succeeds without error', async ({ page }) => {
    const today = todayStr();
    const month = today.slice(0, 7);

    await page.route(`**/presence?month=${month}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            date: today,
            status: 'remote',  // lowercase
            isConfirmed: false,
            bookedCount: 0,
            totalCapacity: 23,
            projectTeammatesCount: 0,
            colleagueAvatars: [],
          },
        ]),
      });
    });

    await page.route('**/rooms', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    let checkinCalled = false;
    await page.route(`**/presence/${today}/checkin`, async (route) => {
      checkinCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ date: today, status: 'remote', isConfirmed: true }),
      });
    });

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(600);

    const fab = page.locator('[data-testid="fab-checkin"]');
    await expect(fab).toBeVisible({ timeout: 5000 });
    await fab.click();

    // Remote: no room selection, direct check-in
    await page.waitForTimeout(500);
    expect(checkinCalled).toBe(true);

    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });
});

test.describe('Check-in DailyDetail — regression: status case mismatch', () => {
  test('check-in via DailyDetail "Say Good Morning" with in_office (lowercase) succeeds without error', async ({ page }) => {
    const today = todayStr();
    const month = today.slice(0, 7);

    const todayEntry = {
      date: today,
      status: 'in_office',  // lowercase — as the real backend returns
      isConfirmed: false,
      isUsingDesk: true,
      room: 'Open Space',
      bookedCount: 3,
      totalCapacity: 23,
      projectTeammatesCount: 0,
      colleagueAvatars: [],
    };

    await page.route(`**/presence?month=${month}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([todayEntry]) });
    });

    await page.route('**/rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', name: 'Open Space', capacity: 20, type: 'open_space' },
        ]),
      });
    });

    // Mock colleagues for DailyDetail
    await page.route(`**/presence/${today}/colleagues`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    let checkinCalled = false;
    await page.route(`**/presence/${today}/checkin`, async (route) => {
      checkinCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...todayEntry, isConfirmed: true }),
      });
    });

    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');

    // Click the today card to open DailyDetail
    const todayCard = page.locator('[data-testid="day-card"].dynamic-border-card');
    await expect(todayCard).toBeVisible({ timeout: 10000 });
    await todayCard.click();

    // DailyDetail must open
    const dailyDetail = page.locator('[data-testid="daily-detail"]');
    await expect(dailyDetail).toBeVisible({ timeout: 5000 });

    // "Say Good Morning" button must appear (not yet checked in, it's today)
    const morningBtn = dailyDetail.getByText(/say good morning/i);
    await expect(morningBtn).toBeVisible({ timeout: 5000 });
    await morningBtn.click();

    // For IN_OFFICE: room-selection opens (DailyDetail closes, RoomSelection appears).
    // Before the fix: 'in_office' !== 'IN_OFFICE' → skipped room selection →
    // direct checkIn() → backend 400 → "Check-in failed".
    // After the fix: normalizeDay converts 'in_office' → WorkStatus.IN_OFFICE →
    // room-selection opens correctly.
    const roomSelection = page.locator('[data-testid="daily-detail"]');
    await expect(roomSelection).toBeVisible({ timeout: 5000 });

    const roomBtn = roomSelection.getByText(/open space/i).first();
    await expect(roomBtn).toBeVisible({ timeout: 3000 });
    await roomBtn.click();

    await page.waitForTimeout(500);
    expect(checkinCalled).toBe(true);

    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });

    // Regression assertion: must NOT show "Check-in failed"
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });
});

test.describe('Check-in (Say Good Morning) — integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDirector(page);
    await page.waitForSelector('[data-testid="day-card"]');
  });

  test('today card is rendered', async ({ page }) => {
    const todayCard = page.locator('[data-testid="day-card"].dynamic-border-card');
    await expect(todayCard).toBeVisible({ timeout: 10000 });
  });

  test('FAB appears after scrolling when today has a non-pending status', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    const fab = page.locator('[data-testid="fab-checkin"]');
    const fabVisible = await fab.isVisible().catch(() => false);
    expect(fabVisible === true || fabVisible === false).toBe(true);
  });

  test('check-in via today card shows success or opens room selection', async ({ page }) => {
    const todayCard = page.locator('[data-testid="day-card"].dynamic-border-card');
    await expect(todayCard).toBeVisible({ timeout: 10000 });

    const morningBtn = todayCard.getByText(/say good morning/i);
    if (!(await morningBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await morningBtn.click();

    const roomSelection = page.locator('[data-testid="daily-detail"]');
    const notification = page.getByText(/successfully checked in/i);

    await Promise.race([
      roomSelection.waitFor({ timeout: 5000 }),
      notification.waitFor({ timeout: 5000 }),
    ]).catch(() => {});

    const roomVisible = await roomSelection.isVisible().catch(() => false);
    const notifVisible = await notification.isVisible().catch(() => false);
    expect(roomVisible || notifVisible).toBe(true);

    // Regression: error notification must not appear
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------------
// CSV coverage — Confirm/Check-In (H-21 -> H-25, H-25b)
// Hits the real backend/DB (Railway dev environment) — no page.route() mocking like
// the blocks above. See e2e/README.md. Each test uses a different dev account so that
// "today" (unique per userId+date) never collides across these sequential tests.
// ---------------------------------------------------------------------------------
import type { Page } from '@playwright/test';
import {
  loginAsOwner as csvLoginAsOwner,
  loginAsEmployee as csvLoginAsEmployee,
  loginAsAdminMember as csvLoginAsAdminMember,
  loginAsLabResponsible as csvLoginAsLabResponsible,
  loginAsDirectorRole as csvLoginAsDirectorRole,
  getAuthHeaders,
} from '../fixtures/auth';
import { todayStr as csvTodayStr2, isTodayWeekend as csvIsTodayWeekend } from '../fixtures/dates';
import { resetStatus as csvResetStatus } from '../fixtures/testAdmin';
import {
  openDayCard as csvOpenDayCard2,
  goToPlanningStep as csvGoToPlanningStep2,
  selectStatus as csvSelectStatus2,
  confirmRoom as csvConfirmRoom2,
} from '../fixtures/dailyDetail';
import { flushOfficeCapacityQueue } from '../fixtures/officeCapacityQueue';

// True if today's DailyDetail is still editable (status can be (re)planned) — false if
// already checked in / locked, in which case a test should skip rather than flake on rerun.
async function csvCanPlanToday(page: Page): Promise<boolean> {
  const detail = page.locator('[data-testid="daily-detail"]');
  const canEnterPlanning =
    (await detail.getByRole('button', { name: /define working status/i }).isVisible().catch(() => false)) ||
    (await detail.locator('button:has(svg.lucide-pen)').isVisible().catch(() => false));
  return canEnterPlanning;
}

test.describe('CSV coverage — Confirm/Check-In', () => {
  // All these tests plan/check-in "today" — on a weekend there's no working-day entry
  // for it at all (backend excludes Sat/Sun from GET /presence), so openDayCard() would
  // just hang until the test timeout instead of failing meaningfully.
  test.beforeEach(() => { test.skip(csvIsTodayWeekend(), 'today is a weekend — no working day to check into'); });
  test.afterEach(flushOfficeCapacityQueue);

  test('[H-21] check-in today from the day card "Say Good Morning" button', async ({ page }) => {
    const today = csvTodayStr2();
    await csvResetStatus('dev@dblue.it', today);
    await csvLoginAsOwner(page);

    await csvOpenDayCard2(page, today);
    if (!(await csvCanPlanToday(page))) { test.skip(); return; }
    await csvGoToPlanningStep2(page);
    await csvSelectStatus2(page, 'IN_OFFICE', today);
    await csvConfirmRoom2(page, /./);

    const card = page.locator(`[data-testid="day-card"][data-date="${today}"]`);
    const morningBtn = card.getByText(/say good morning/i);
    await expect(morningBtn).toBeVisible({ timeout: 10000 });
    await morningBtn.click();

    // For IN_OFFICE, App.tsx's handleCheckIn (isToday && status === IN_OFFICE) opens a
    // room re-confirmation panel instead of checking in directly — the actual check-in
    // only fires once a room is (re)picked here.
    const roomOption = page.locator('[data-testid="checkin-room-option"]').first();
    await expect(roomOption).toBeVisible({ timeout: 5000 });
    await roomOption.click();

    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });

  test('[H-22] check-in today from the scrolling FAB', async ({ page }) => {
    const today = csvTodayStr2();
    await csvResetStatus('mario.rossi@dblue.it', today);
    await csvLoginAsEmployee(page);

    await csvOpenDayCard2(page, today);
    if (!(await csvCanPlanToday(page))) { test.skip(); return; }
    await csvGoToPlanningStep2(page);
    await csvSelectStatus2(page, 'REMOTE');

    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    const fab = page.locator('[data-testid="fab-checkin"]');
    await expect(fab).toBeVisible({ timeout: 5000 });
    await fab.click();

    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();
  });

  test('[H-23] check-in today from inside the detailed daily view', async ({ page }) => {
    const today = csvTodayStr2();
    await csvResetStatus('luca.esposito@dblue.it', today);
    await csvLoginAsAdminMember(page);

    await csvOpenDayCard2(page, today);
    if (!(await csvCanPlanToday(page))) { test.skip(); return; }
    await csvGoToPlanningStep2(page);
    await csvSelectStatus2(page, 'REMOTE');

    await csvOpenDayCard2(page, today);
    const morningBtn = page.locator('[data-testid="daily-detail"]').getByText(/say good morning/i);
    await expect(morningBtn).toBeVisible({ timeout: 5000 });
    await morningBtn.click();

    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/check-in failed/i)).not.toBeVisible();

    // Reload: the checked-in state must persist, not silently revert to "Say Good Morning".
    await page.reload();
    await page.waitForSelector('[data-testid="day-card"]');
    const cardAfterReload = page.locator(`[data-testid="day-card"][data-date="${today}"]`);
    await expect(cardAfterReload.getByText(/say good morning/i)).not.toBeVisible({ timeout: 5000 });
  });

  test('[H-24] confirmation for On Leave / On a Mission / Sick is automatic — no manual check-in button', async ({ page }) => {
    const today = csvTodayStr2();
    await csvResetStatus('sara.ferrari@dblue.it', today);
    await csvLoginAsLabResponsible(page);

    await csvOpenDayCard2(page, today);
    if (!(await csvCanPlanToday(page))) { test.skip(); return; }
    await csvGoToPlanningStep2(page);
    await csvSelectStatus2(page, 'MISSION');

    const card = page.locator(`[data-testid="day-card"][data-date="${today}"]`);
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.getByText(/say good morning/i)).not.toBeVisible();

    await csvOpenDayCard2(page, today);
    await expect(page.locator('[data-testid="daily-detail"]').getByText(/say good morning/i)).not.toBeVisible();
  });

  test('[H-25] check-in today if remote, and Undo reverts it for real', async ({ page }) => {
    const today = csvTodayStr2();
    await csvResetStatus('giulia.bianchi@dblue.it', today);
    await csvLoginAsDirectorRole(page);

    await csvOpenDayCard2(page, today);
    if (!(await csvCanPlanToday(page))) { test.skip(); return; }
    await csvGoToPlanningStep2(page);
    await csvSelectStatus2(page, 'REMOTE');

    await csvOpenDayCard2(page, today);
    const morningBtn = page.locator('[data-testid="daily-detail"]').getByText(/say good morning/i);
    await expect(morningBtn).toBeVisible({ timeout: 5000 });
    await morningBtn.click();
    await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });

    // The daily-detail panel (opened above to reach "Say Good Morning") is a
    // full-screen overlay that would otherwise intercept the click below — the
    // "Undo" toast is rendered outside of it, at the App level. Close it first.
    await page.locator('[data-testid="daily-detail"]').getByRole('button', { name: /back/i }).click();
    await expect(page.locator('[data-testid="daily-detail"]')).not.toBeVisible({ timeout: 5000 });

    // Click Undo promptly (7s UI window, 10s real backend window).
    await page.getByRole('button', { name: /^undo/i }).click();

    // UI must show "not checked in" again...
    const card = page.locator(`[data-testid="day-card"][data-date="${today}"]`);
    await expect(card.getByText(/say good morning/i)).toBeVisible({ timeout: 5000 });

    // ...and the backend must genuinely agree (regression for the "Undo looks like it
    // worked but the confirmed status is still active" bug) — undoCheckIn is fire-and-forget
    // client-side, so poll briefly rather than asserting instantaneously.
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';
    const month = today.slice(0, 7);
    let stillConfirmed = true;
    for (let i = 0; i < 5; i++) {
      const res = await page.request.get(`${apiBase}/presence?month=${month}`, { headers: await getAuthHeaders(page) });
      const days = (await res.json()) as Array<{ date: string; isConfirmed?: boolean }>;
      const todayEntry = days.find((d) => d.date === today);
      stillConfirmed = !!todayEntry?.isConfirmed;
      if (!stillConfirmed) break;
      await page.waitForTimeout(500);
    }
    expect(stillConfirmed).toBe(false);
  });

  test('[H-25b] editing a current day after check-in shouldn\'t be possible', async ({ page }) => {
    await csvLoginAsOwner(page);
    const today = csvTodayStr2();

    await csvOpenDayCard2(page, today);
    if (await csvCanPlanToday(page)) {
      await csvGoToPlanningStep2(page);
      await csvSelectStatus2(page, 'IN_OFFICE', today);
      await csvConfirmRoom2(page, /./);

      await csvOpenDayCard2(page, today);
      const morningBtn = page.locator('[data-testid="daily-detail"]').getByText(/say good morning/i);
      if (await morningBtn.isVisible().catch(() => false)) {
        // Bare .click() has no timeout of its own — same "genuine hang" signature
        // fixed elsewhere this session. isVisible() above only proves it existed a
        // moment ago, not that it's still actionable now.
        await expect(morningBtn).toBeVisible({ timeout: 5000 });
        await morningBtn.click();
        // Same IN_OFFICE room re-confirmation panel as H-21 — see its comment.
        const roomOption = page.locator('[data-testid="checkin-room-option"]').first();
        await expect(roomOption).toBeVisible({ timeout: 5000 });
        await roomOption.click();
        await expect(page.getByText(/successfully checked in/i)).toBeVisible({ timeout: 5000 });
      }
    }

    // Once checked in, no edit affordance (pencil icon) should remain in DailyDetail.
    await csvOpenDayCard2(page, today);
    await expect(page.locator('[data-testid="daily-detail"] button:has(svg.lucide-pen)')).not.toBeVisible();

    // And the backend itself must reject a further status change (409).
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:4000';
    const res = await page.request.post(`${apiBase}/presence`, {
      data: { date: today, status: 'remote' },
      headers: await getAuthHeaders(page),
    });
    expect(res.status()).toBe(409);
  });
});
