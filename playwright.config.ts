import { defineConfig, devices } from '@playwright/test';

// Discovery placeholder only. scripts/e2e-preflight.mjs is authoritative and
// must validate the real target before any test runs. Keep the baseURL
// normalization in sync with scripts/e2e-target.mjs.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
   testDir: './e2e',
   fullyParallel: false,
   workers: 1,
   retries: 0,
   timeout: 30_000,
   reporter: [['list']],
   use: {
      baseURL,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
   },
   projects: [
      {
         name: 'public',
         testMatch: /public\.public\.spec\.ts$/,
         use: { ...devices['Desktop Chrome'] },
      },
   ],
});
