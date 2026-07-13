import { Page, expect, test } from '@playwright/test';
import { freeOfficeCapacity } from './testAdmin';
import { queuePendingRestore } from './officeCapacityQueue';

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
  const detail = page.locator('[data-testid="daily-detail"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click();
  try {
    await expect(detail).toBeVisible({ timeout: 5000 });
  } catch {
    // App.tsx's handleDayClick debounces single vs double click over a 250ms window
    // (clickTimeoutRef) — a click landing too soon after a panel we just closed risks
    // being coalesced with a stray event and misread as a double-click, which silently
    // toggles the day's status instead of opening the panel. Confirmed by H-10's report:
    // this exact expect() failed with a clean call log (element(s) not found) rather
    // than the test's own timeout, on a reopen following an earlier close. Retry once.
    await card.click();
    await expect(detail).toBeVisible({ timeout: 10000 });
  }
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

  const editIcon = detail.locator('button:has(svg.lucide-pen)').first();
  // Plain .click() with no wait has no timeout of its own (no actionTimeout is set in
  // playwright.config.ts) — if this locator never resolves, the whole test hangs
  // silently until ITS OWN timeout kills it, with no call log to explain why (the
  // signature behind several still-unexplained "genuine hangs" in this session, e.g.
  // H-04/H-06/H-08/H-41). Give it its own descriptive, bounded wait so a future
  // failure here is diagnosable from the report alone.
  await expect(editIcon).toBeVisible({ timeout: 15000 });
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
    await expect(plainInOffice).toBeVisible({ timeout: 10000 });
    await plainInOffice.click();
    return;
  }
  // Bare .click() has no timeout of its own (no actionTimeout in playwright.config.ts)
  // — if this option is ever visible-but-not-yet-actionable (mid PLANNING-step render/
  // animation), it can hang silently until the whole test's own timeout, with no call
  // log. This is the single locus shared by every non-IN_OFFICE selectStatus() call,
  // which matches the "genuine hang" tests still affected after hardening other, more
  // specific bare clicks (H-14, H-19, H-25b, H-26b, H-27, H-30).
  const option = detail.getByText(STATUS_LABELS[status]);
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}

// Fallback for when the real office is full for `date`, instead of skipping the test.
//
// Two independent problems have to be solved, not one:
// 1. The backend enforces capacity itself, server-side, on the booking POST
//    (working-status.service.ts upsertStatus: if the office is genuinely full it silently
//    downgrades an in_office request to waiting_list — correct, intended behavior, and NOT
//    something a browser-side page.route() mock can influence, since it runs entirely in
//    the backend process against the real database). So step one is to genuinely free real
//    capacity first, via the dev-only /admin/test/free-office-capacity endpoint — after
//    this, the eventual booking is a REAL in_office booking, not a fake-looking one. What
//    got removed is queued (officeCapacityQueue.ts) and restored by that test's own
//    test.afterEach(flushOfficeCapacityQueue) — not right after this function returns,
//    since the office needs to stay free for the rest of THIS test's own interactions with
//    the date (the real booking POST happens later, in confirmRoom(), called by the test
//    after selectStatus() returns).
// 2. Even with real capacity freed, the UI's own "should I show plain In Office" check can
//    still say "full": App.tsx's `processedDays` recomputes bookedCount client-side as
//    `Math.max(day.bookedCount, finalAvatars.length)`, padding finalAvatars to at least 5
//    synthetic "in office" colleagues for every future day (a demo/visual affordance, see
//    App.tsx ~L872-888 — a real app bug, documented there, not fixed here). On this
//    environment real room capacity is smaller than that synthetic floor, so the button
//    would still read "full" even with zero real bookings. Patching totalCapacity in the
//    /presence response (large enough to clear the synthetic floor) sidesteps just that
//    UI quirk — it doesn't change what actually gets persisted, since (1) already
//    guarantees that's real.
//
// Clearly flagged via a test annotation so the CSV summary report and HTML report both
// surface that this run needed the real-capacity + UI fallback instead of finding room
// on its own.
//
// `plainInOffice` is a live Locator (not a DOM snapshot), so it stays valid to
// re-evaluate against the page after the reload below — no need to re-create it.
async function installOfficeCapacityFallbackAndRetry(
  page: Page,
  date: string,
  plainInOffice: ReturnType<Page['locator']>,
) {
  const { snapshot } = await freeOfficeCapacity(date);
  queuePendingRestore(snapshot);

  const month = date.slice(0, 7);
  const presencePattern = `**/presence?month=${month}`;
  await page.route(presencePattern, async (route) => {
    // The app sends Authorization: Bearer + credentials: 'include' cross-origin, which
    // triggers a CORS preflight (OPTIONS) request to this exact same URL before the real
    // GET. page.route() matches by URL regardless of method, so an unfiltered handler (or
    // one limited to `{ times: 1 }`) can end up patching the preflight's empty body instead
    // of the real response — letting the actual (still-full) GET through unmocked. Only
    // touch GET; let everything else (OPTIONS, and any other method) pass through as-is.
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const json = await response.json();
    const day = Array.isArray(json) ? json.find((d: { date: string }) => d.date === date) : undefined;
    if (day) {
      day.bookedCount = 0;
      day.totalCapacity = 9999;
    }
    await route.fulfill({ response, json });
  });

  test.info().annotations.push({
    type: 'mocked-fallback',
    description: `Office was at capacity for ${date} on the shared dev environment — real bookings were cleared via /admin/test/free-office-capacity (a genuine, persisted booking, not a fake one) and totalCapacity was additionally patched in the UI's /presence response to work around App.tsx's synthetic-avatar-count bug so the IN_OFFICE button was actually clickable.`,
  });

  await page.reload();
  await waitForSplashGone(page);
  await openDayCard(page, date);
  await goToPlanningStep(page);

  await expect(plainInOffice).toBeVisible({ timeout: 5000 });
  await plainInOffice.click();

  // The route handler's only job was getting past the "office full" display for this
  // one click — page.route() handlers otherwise persist across page.reload() (they're
  // bound to the Page, not a navigation), so leaving it registered would keep forcing
  // bookedCount to 0 on every later /presence fetch for this date, including a
  // deliberate post-booking reload a test might do to verify the REAL persisted state
  // (e.g. H-40b) — silently masking the very thing being checked.
  await page.unroute(presencePattern);
}

export async function confirmRoom(page: Page, roomName: string | RegExp) {
  const rooms = page.locator('[data-testid="room-option"]');
  const target = rooms.filter({ hasText: roomName }).first();
  // Same reasoning as goToPlanningStep's editIcon wait above — a bare .click() here
  // has no timeout of its own, so if the room list is ever empty/slow to load this
  // hangs silently until the whole test's own timeout kills it with no call log.
  await expect(target).toBeVisible({ timeout: 15000 });
  await target.click();
  // Selecting a room auto-closes DailyDetail (handleRoomSelect's onClose()) — wait for
  // that close to fully settle before the caller reopens the panel, otherwise a
  // still-exiting old instance's backdrop can intercept the next click (H-28: "<html>
  // intercepts pointer events" then "element was detached from the DOM", right after
  // confirmRoom() followed by an immediate openDayCard() for a second status change).
  await page.locator('[data-testid="daily-detail"]').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
}

export async function confirmRetrofit(page: Page) {
  await expect(page.getByText(/are you sure you want to retrofit/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /^confirm$/i }).click();
}
