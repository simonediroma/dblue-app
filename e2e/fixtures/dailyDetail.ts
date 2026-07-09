import { Page, expect, test } from '@playwright/test';

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
//
// `date` is optional and only used for the IN_OFFICE mocked-data fallback below — pass
// it whenever the test's intent is "book a normal In Office day" (not itself testing
// full-office/waiting-list behavior, e.g. capacity.spec.ts's H-40, which must keep the
// plain skip so it can exercise the real full-office path).
export async function selectStatus(page: Page, status: StatusKey, date?: string) {
  const detail = page.locator('[data-testid="daily-detail"]');
  if (status === 'IN_OFFICE') {
    const plainInOffice = detail.getByText(STATUS_LABELS.IN_OFFICE);
    if (!(await plainInOffice.isVisible().catch(() => false))) {
      // Office is already at capacity for this date (real bookings from other
      // accounts on this shared dev environment) — the app correctly swaps the plain
      // "In Office" option for "Waiting List" / "In Office / Not using a desk"
      // instead, so there's nothing matching STATUS_LABELS.IN_OFFICE to click.
      if (!date) {
        test.skip();
        return;
      }
      await installOfficeCapacityFallbackAndRetry(page, date, plainInOffice);
      return;
    }
    await plainInOffice.click();
    return;
  }
  await detail.getByText(STATUS_LABELS[status]).click();
}

// Mocked-data fallback: instead of skipping when the real office is full for `date`,
// patch just that one day's bookedCount to 0 in the /presence response (every other
// day's real data is untouched), reload so usePresence's one-shot fetch picks it up,
// and retry entering PLANNING + selecting IN_OFFICE. Clearly flagged via a test
// annotation so the CSV summary report and HTML report both surface that this specific
// run used mocked data rather than a real booking.
//
// `plainInOffice` is a live Locator (not a DOM snapshot), so it stays valid to
// re-evaluate against the page after the reload below — no need to re-create it.
async function installOfficeCapacityFallbackAndRetry(
  page: Page,
  date: string,
  plainInOffice: ReturnType<Page['locator']>,
) {
  const month = date.slice(0, 7);
  await page.route(`**/presence?month=${month}`, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const day = Array.isArray(json) ? json.find((d: { date: string }) => d.date === date) : undefined;
    if (day) day.bookedCount = 0;
    await route.fulfill({ response, json });
  }, { times: 1 });

  test.info().annotations.push({
    type: 'mocked-fallback',
    description: `Office was at capacity for ${date} on the shared dev environment — bookedCount was patched via page.route() (only for this date; every other day's real data is untouched) so the IN_OFFICE flow could still be exercised instead of skipping.`,
  });

  await page.reload();
  await waitForSplashGone(page);
  await openDayCard(page, date);
  await goToPlanningStep(page);

  await expect(plainInOffice).toBeVisible({ timeout: 5000 });
  await plainInOffice.click();
}

export async function confirmRoom(page: Page, roomName: string | RegExp) {
  const rooms = page.locator('[data-testid="room-option"]');
  await rooms.filter({ hasText: roomName }).first().click();
}

export async function confirmRetrofit(page: Page) {
  await expect(page.getByText(/are you sure you want to retrofit/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /^confirm$/i }).click();
}
