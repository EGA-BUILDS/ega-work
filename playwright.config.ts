import { defineConfig, devices } from '@playwright/test';

import { AUTH_STATE_PATH } from './e2e/account';

// Discovery placeholder only. scripts/e2e-preflight.mjs is authoritative and
// must validate the real target before any test runs. Keep the baseURL
// normalization in sync with scripts/e2e-target.mjs.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Only the public project runs by default. Authenticated, canary-write and
// GitHub-fixture projects must be selected explicitly with --project=…
// (Playwright still honors setup/teardown dependency links regardless of
// `default`). Public tests never see authenticated storage state or write
// gates; the canary path re-validates the target allowlist at runtime.
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
         // G1b (issue #28) owner-only protected Preview path: same public
         // spec, but with the owner's bypass bootstrap fixture enabled and
         // NO artifacts (a failure trace could carry the bypass cookie).
         // Requires E2E_G1B_PREVIEW_BYPASS=I_ACCEPT_PREVIEW_BYPASS,
         // E2E_G1B_PREVIEW_ORIGIN, and E2E_VERCEL_PROTECTION_BYPASS in the
         // owner's isolated environment. No storageState; nothing persists.
         name: 'preview',
         testMatch: /public\.public\.spec\.ts$/,
         default: false,
         use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off' },
      },
      {
         // Fresh password login for the dedicated disposable E2E account.
         // No env is read at config load; validation happens at test runtime.
         name: 'setup',
         testMatch: /auth\.setup\.ts$/,
         default: false,
         teardown: 'authenticated-teardown',
         use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off' },
      },
      {
         // Deletes playwright/.auth/user.json after the dependent projects finish.
         name: 'authenticated-teardown',
         testMatch: /auth\.teardown\.ts$/,
         default: false,
         use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off' },
      },
      {
         name: 'github-read',
         testMatch: /github\.read\.spec\.ts$/,
         default: false,
         dependencies: ['setup'],
         use: {
            ...devices['Desktop Chrome'],
            storageState: AUTH_STATE_PATH,
            trace: 'off',
            screenshot: 'off',
         },
      },
      {
         name: 'canary-write',
         testMatch: /canary\.write\.spec\.ts$/,
         default: false,
         dependencies: ['setup'],
         use: {
            ...devices['Desktop Chrome'],
            storageState: AUTH_STATE_PATH,
            trace: 'off',
            screenshot: 'off',
         },
      },
      {
         name: 'authenticated',
         testMatch: /workspace\.auth\.spec\.ts$/,
         default: false,
         dependencies: ['setup'],
         use: {
            ...devices['Desktop Chrome'],
            storageState: AUTH_STATE_PATH,
            trace: 'off',
            screenshot: 'off',
         },
      },
   ],
});
