import { test, expect } from '@playwright/test';
import { loginAsAdminMember, loginAsDirectorRole, loginAsEmployee, loginAsLabResponsible, ROLE_EMAILS } from '../fixtures/auth';
import { futureTestDate } from '../fixtures/dates';
import { resetStatus } from '../fixtures/testAdmin';
import { openDayCard, goToPlanningStep, selectStatus } from '../fixtures/dailyDetail';

/**
 * CSV coverage — Role-Specific Booking (H-44 -> H-46)
 * Hits the real backend/DB (Railway dev environment) — no API mocking. See e2e/README.md.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

test.describe('CSV coverage — Role-Specific Booking', () => {
  // [H-44] Lab Responsible booking protection: the "Book Lab" Activities feature
  // (App.tsx handleUpdateLabBooking / DailyDetail.tsx ~1588-1627) has NO backend
  // persistence — it's a client-only mock with a hardcoded booker name ('Roberto')
  // and a hardcoded "other people in the lab" list, regardless of who is logged in.
  // The CSV's actual concern (an employee silently overriding and deleting the Lab
  // Responsible's real booking, with no notification) cannot be validated against
  // real multi-user backend behavior because there is no such behavior to validate —
  // there is no `/lab-bookings` (or similar) endpoint. Marked fixme rather than
  // written as a misleading "passing" test; revisit once real persistence exists.
  test.fixme(
    '[H-44] employee cannot override the Lab Responsible\'s lab booking',
    async () => {}
  );

  test('[H-45] Admin Member books the Admin Room', async ({ page }) => {
    const date = futureTestDate('H-45');
    await resetStatus(ROLE_EMAILS.admin_member, date);
    await loginAsAdminMember(page);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', date);

    const detail = page.locator('[data-testid="daily-detail"]');
    const adminRoomOption = detail.locator('[data-testid="room-option"]').filter({ hasText: /admin room/i });
    await expect(adminRoomOption).toBeVisible({ timeout: 5000 });
    await adminRoomOption.click();

    const res = await page.request.get(`${API_BASE}/presence?month=${date.slice(0, 7)}`);
    const days = (await res.json()) as Array<{ date: string; room?: string }>;
    expect(days.find((d) => d.date === date)?.room).toBe('Admin Room');
  });

  test('[H-45b] a plain employee cannot book the Admin Room via a direct API call', async ({ page }) => {
    await loginAsEmployee(page);
    const date = futureTestDate('H-45b');
    const res = await page.request.post(`${API_BASE}/presence`, {
      data: { date, status: 'in_office', room: 'Admin Room' },
    });
    // Bonus backend-level check (see F6 in the plan): upsertStatus does not currently
    // cross-check `room` against the caller's role-permitted room types, so this is
    // expected to currently fail (200 instead of 403) — a real, documented gap.
    expect(res.status()).toBe(403);
  });

  test('[H-46] Director books the Management Room', async ({ page }) => {
    const date = futureTestDate('H-46');
    await resetStatus(ROLE_EMAILS.director, date);
    await loginAsDirectorRole(page);

    await openDayCard(page, date);
    await goToPlanningStep(page);
    await selectStatus(page, 'IN_OFFICE', date);

    const detail = page.locator('[data-testid="daily-detail"]');
    const managementRoomOption = detail.locator('[data-testid="room-option"]').filter({ hasText: /management room/i });
    await expect(managementRoomOption).toBeVisible({ timeout: 5000 });
    await managementRoomOption.click();

    const res = await page.request.get(`${API_BASE}/presence?month=${date.slice(0, 7)}`);
    const days = (await res.json()) as Array<{ date: string; room?: string }>;
    expect(days.find((d) => d.date === date)?.room).toBe('Management Room');
  });

  test('[H-46b] Management Room is never offered to non-Director/Owner roles', async ({ browser }) => {
    for (const login of [loginAsEmployee, loginAsAdminMember, loginAsLabResponsible]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page);
      const res = await page.request.get(`${API_BASE}/rooms`);
      const rooms = (await res.json()) as Array<{ name: string; type: string }>;
      expect(rooms.some((r) => r.type === 'management')).toBe(false);
      await context.close();
    }
  });
});
