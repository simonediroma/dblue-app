import type { FullConfig } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';
import { readQueue, clearQueue } from './fixtures/officeCapacityQueue';

// Restores real bookings that installOfficeCapacityFallbackAndRetry() (dailyDetail.ts)
// removed via /admin/test/free-office-capacity during the run, putting the dev environment
// back to how it was before this suite ran. Runs once at the very end (not per-test —
// see officeCapacityQueue.ts for why), as its own process/invocation, so it can't rely on
// any in-memory state from the test worker — the queue is a file on disk for that reason.
export default async function globalTeardown(_config: FullConfig): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  const apiBaseURL = process.env.API_BASE_URL ?? 'http://localhost:4000';
  const devLoginUser = process.env.DEV_LOGIN_USER ?? 'dev@dblue.it';
  const devLoginPass = process.env.DEV_LOGIN_PASS ?? 'changeme';

  const context = await playwrightRequest.newContext({ baseURL: apiBaseURL });
  try {
    const loginRes = await context.post('/auth/dev-login', {
      data: { username: devLoginUser, password: devLoginPass },
    });
    if (!loginRes.ok()) {
      console.error(
        `global-teardown: could not log in to restore ${queue.length} office-capacity record(s) ` +
          `(${loginRes.status()}) — leaving e2e/.office-capacity-restore-queue.json in place to retry next run.`
      );
      return;
    }
    const { token } = (await loginRes.json()) as { token: string };

    const restoreRes = await context.post('/admin/test/restore-office-capacity', {
      data: { snapshot: queue },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!restoreRes.ok()) {
      console.error(
        `global-teardown: /admin/test/restore-office-capacity failed (${restoreRes.status()}) — ` +
          'leaving the queue file in place to retry next run.'
      );
      return;
    }
    const { restoredCount } = (await restoreRes.json()) as { restoredCount: number };
    console.log(`global-teardown: restored ${restoredCount} office booking(s) removed during this run.`);
    clearQueue();
  } finally {
    await context.dispose();
  }
}
