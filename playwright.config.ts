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
      {
         // Fresh password login for the dedicated disposable E2E account.
         // No env is read at config load; validation happens at test runtime.
         name: 'setup',
         testMatch: /auth\.setup\.ts$/,
         teardown: 'authenticated-teardown',
         use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off' },
      },
      {
         // Deletes playwright/.auth/user.json after the dependent projects finish.
         name: 'authenticated-teardown',
         testMatch: /auth\.teardown\.ts$/,
         use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off' },
      },
      {
         name: 'authenticated',
         testMatch: /workspace\.auth\.spec\.ts$/,
         dependencies: ['setup'],
         use: {
            ...devices['Desktop Chrome'],
            storageState: 'playwright/.auth/user.json',
            trace: 'off',
            screenshot: 'off',
         },
      },
   ],
});
