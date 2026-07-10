import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Thin client for the test-only backend endpoints (backend/src/routes/admin-test.routes.ts),
// used only to set up state the real UI/API can't reach on demand (full office capacity,
// a "fresh" onboarding account, the nightly auto-confirm cron). Assertions in the tests
// themselves always go through the real UI/API — this file is setup-only.
//
// Uses its own APIRequestContext (owner-authenticated via Bearer token), independent of
// whatever role a test's `page` is currently logged in as.

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const DEV_LOGIN_USER = process.env.DEV_LOGIN_USER ?? 'dev@dblue.it';
const DEV_LOGIN_PASS = process.env.DEV_LOGIN_PASS ?? 'changeme';

let ownerContext: APIRequestContext | null = null;
let ownerToken: string | null = null;

async function getOwnerContext(): Promise<{ context: APIRequestContext; token: string }> {
  if (ownerContext && ownerToken) return { context: ownerContext, token: ownerToken };

  const context = await playwrightRequest.newContext({ baseURL: API_BASE_URL });
  const res = await context.post('/auth/dev-login', {
    data: { username: DEV_LOGIN_USER, password: DEV_LOGIN_PASS },
  });
  if (!res.ok()) {
    throw new Error(`testAdmin: owner dev-login failed (${res.status()}): ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };

  ownerContext = context;
  ownerToken = body.token;
  return { context, token: ownerToken };
}

async function testAdminPost<T>(path: string, data: Record<string, unknown>): Promise<T> {
  const { context, token } = await getOwnerContext();
  const res = await context.post(`/admin/test${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`testAdmin ${path} failed (${res.status()}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function fillCapacity(date: string, seatsToFill: number) {
  return testAdminPost<{ ok: true; date: string; userIds: string[] }>('/fill-capacity', {
    date,
    seatsToFill,
  });
}

export function clearCapacity(date: string) {
  return testAdminPost<{ ok: true; modifiedCount: number }>('/clear-capacity', { date });
}

export type OfficeCapacityRecord = Record<string, unknown> & { userId: string; date: string };

// Genuinely frees real office capacity for a date (unlike clearCapacity, which only touches
// fillCapacity's synthetic bookings) — deletes every in_office/office_no_desk WorkingStatus
// for that date, so the backend's own capacity gate (upsertStatus) finds real room and doesn't
// silently downgrade a booking to waiting_list. Dev-only environment. Returns a snapshot of
// what was deleted — pass it to restoreOfficeCapacity() to put the dev environment back.
export function freeOfficeCapacity(date: string) {
  return testAdminPost<{ ok: true; deletedCount: number; snapshot: OfficeCapacityRecord[] }>(
    '/free-office-capacity',
    { date }
  );
}

// Restores real bookings previously removed by freeOfficeCapacity — see
// e2e/global-teardown.ts, which queues and flushes these at the end of the whole run
// (not per-test: the office needs to stay free for the rest of that same test's flow).
export function restoreOfficeCapacity(snapshot: OfficeCapacityRecord[]) {
  return testAdminPost<{ ok: true; restoredCount: number }>('/restore-office-capacity', { snapshot });
}

export function resetOnboarding(email: string) {
  return testAdminPost<{ ok: true; email: string; onboardingCompleted: boolean }>(
    '/reset-onboarding',
    { email }
  );
}

// Deletes a dev-login account's WorkingStatus for a given date, so tests across
// different spec files can reuse the same 6 dev accounts for "today" without
// colliding with whatever an earlier file's test already set/confirmed.
export function resetStatus(email: string, date: string) {
  return testAdminPost<{ ok: true; deletedCount: number }>('/reset-status', { email, date });
}

export function simulateConfirm(userId: string, date: string) {
  return testAdminPost<{ ok: true; status: string; isConfirmed: boolean }>('/simulate-confirm', {
    userId,
    date,
  });
}
