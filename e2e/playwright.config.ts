import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  globalSetup: './global-setup.ts',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    // Primary target is the shared Railway dev environment (set BASE_URL/API_BASE_URL
    // in e2e/.env). This fallback assumes a local frontend (vite --port=3000), not 5173.
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
