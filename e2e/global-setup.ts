import type { FullConfig } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';

// Verifies the target environment (BASE_URL/API_BASE_URL — normally the shared
// Railway dev environment) is reachable and already seeded, before the suite
// runs. Deliberately does NOT reseed itself: reseeding is destructive and would
// fight with tests running against a DB other people are also using manually.
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const apiBaseURL = process.env.API_BASE_URL ?? 'http://localhost:4000';
  const devLoginUser = process.env.DEV_LOGIN_USER ?? 'dev@dblue.it';
  const devLoginPass = process.env.DEV_LOGIN_PASS ?? 'changeme';

  const context = await playwrightRequest.newContext({ baseURL: apiBaseURL });
  try {
    const loginRes = await context.post('/auth/dev-login', {
      data: { username: devLoginUser, password: devLoginPass },
    });
    if (!loginRes.ok()) {
      throw new Error(
        `global-setup: backend not reachable or dev-login rejected at ${apiBaseURL} (${loginRes.status()}). ` +
          'Check BASE_URL/API_BASE_URL/DEV_LOGIN_PASS in e2e/.env and that ENABLE_DEV_LOGIN=true on the backend.'
      );
    }
    const { token } = (await loginRes.json()) as { token: string };

    const usersRes = await context.get('/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!usersRes.ok()) {
      throw new Error(`global-setup: GET /admin/users failed (${usersRes.status()}).`);
    }
    const users = (await usersRes.json()) as unknown[];
    if (users.length < 50) {
      throw new Error(
        `global-setup: only ${users.length} users found at ${apiBaseURL} — the target environment ` +
          'does not look seeded. Run "npm run seed:fresh" in backend/ against it before running this suite.'
      );
    }
  } finally {
    await context.dispose();
  }
}
