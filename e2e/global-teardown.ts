import type { FullConfig } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';
import { readQueue, clearQueue } from './fixtures/officeCapacityQueue';

// Safety net, not the primary restore path: each CSV spec file that can trigger the
// IN_OFFICE fallback restores its own removed bookings per-test, via
// test.afterEach(flushOfficeCapacityQueue) (officeCapacityQueue.ts). That only falls
// through to the durable, file-backed queue this reads when an immediate restore itself
// fails (e.g. a transient network error) — this runs once, at the very end of the whole
// run, as its own process/invocation with no access to the test worker's in-memory state,
// to retry whatever didn't make it back the first time.
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
