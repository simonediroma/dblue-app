import { Page, expect } from '@playwright/test';

// Shared DailyDetail navigation helpers for the new CSV-coverage spec files.
// Existing spec files keep their own local navigation logic — not touched here.

// The app shows a full-page splash overlay (fixed inset-0 z-[9999]) for a fixed
// 2s (longer if the user fetch is still loading) on every App mount, including
// after a page.reload(). It sits on top of the already-mounted plan page, so it
// silently intercepts clicks aimed at day cards — either exhausting Playwright's
// click retries (test timeout) or letting two retries land close enough together
// that the app's own click/double-click debounce (App.tsx handleDayClick) treats
// them as a double-click and cancels the single-click open. Waiting for it to be
// gone before interacting with day cards avoids both failure modes.
export async function waitForSplashGone(page: Page) {
  await page.locator('[data-testid="splash-screen"]').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
}

export async function openDayCard(page: Page, date: string) {
  await waitForSplashGone(page);
  const card = page.locator(`[data-testid="day-card"][data-date="${date}"]`);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click();
  await expect(page.locator('[data-testid="daily-detail"]')).toBeVisible({ timeout: 5000 });
}

// From the DailyDetail VIEW step, enters PLANNING (works for pending days, already-set
// future days via the pencil icon, and past days via "Retrofit Working Status").
export async function goToPlanningStep(page: Page) {
  const detail = page.locator('[data-testid="daily-detail"]');

  const defineBtn = detail.getByRole('button', { name: /define working status|retrofit status/i });
  if (await defineBtn.isVisible().catch(() => false)) {
    await defineBtn.click();
    return;
  }

  const retrofitBtn = detail.getByRole('button', { name: /retrofit working status/i });
  if (await retrofitBtn.isVisible().catch(() => false)) {
    await retrofitBtn.click();
    return;
  }

  const editIcon = detail.locator('button:has(svg.lucide-edit-2)').first();
  await editIcon.click();
}

export const STATUS_LABELS = {
  IN_OFFICE: /^in office$/i,
  REMOTE: /^remote working$/i,
  MISSION: /^on a mission$/i,
  LEAVE: /^on leave \(vacation\)$/i,
  SICK: /^on a sick leave$/i,
  PARENTAL_LEAVE: /^parental leave$/i,
} as const;

export type StatusKey = keyof typeof STATUS_LABELS;

// Click a status option in the PLANNING step. For IN_OFFICE this opens the WORKSPACE
// (room selection) step; for a past day this opens the retrofit confirmation dialog
// instead of applying immediately — use confirmRetrofit() afterward.
export async function selectStatus(page: Page, status: StatusKey) {
  const detail = page.locator('[data-testid="daily-detail"]');
  await detail.getByText(STATUS_LABELS[status]).click();
}

export async function confirmRoom(page: Page, roomName: string | RegExp) {
  const rooms = page.locator('[data-testid="room-option"]');
  await rooms.filter({ hasText: roomName }).first().click();
}

export async function confirmRetrofit(page: Page) {
  await expect(page.getByText(/are you sure you want to retrofit/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /^confirm$/i }).click();
}
