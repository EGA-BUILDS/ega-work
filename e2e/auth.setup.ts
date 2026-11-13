import { mkdir, chmod, rm } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from './fixtures';

import { AUTH_STATE_PATH, UUID_PATTERN, loadAccountEnv } from './account';

/**
 * Fresh password login for the dedicated, disposable E2E account.
 * Runs as the `setup` project before every dependent authenticated run.
 * Writes browser state to playwright/.auth/user.json (gitignored, mode 0600),
 * which the `authenticated` project consumes once; the
 * `authenticated-teardown` project then deletes it.
 */
test('authenticate as the dedicated disposable E2E user', async ({ page }) => {
   // The public G1b bypass bootstrap would plant the bypass cookie in this
   // context, and storageState() would persist it into user.json. Fail
   // closed instead: authenticated gates never run with the bypass active.
   if (process.env.E2E_G1B_PREVIEW_BYPASS === 'I_ACCEPT_PREVIEW_BYPASS') {
      throw new Error(
         'BLOCKED: the G1b preview bypass is enabled. Authenticated acceptance must not run with the public bypass bootstrap active (the stored session state would capture the bypass cookie). Unset E2E_G1B_PREVIEW_BYPASS for authenticated runs.'
      );
   }

   const account = loadAccountEnv();

   // Never authenticate against a stale stored session: remove any orphaned
   // state from a previous (possibly crashed) run before logging in fresh.
   await rm(AUTH_STATE_PATH, { force: true });

   await page.goto('/login');

   const passwordForm = page.locator('form', {
      has: page.getByRole('button', { name: 'Sign in with password' }),
   });
   const emailField = passwordForm.getByLabel('Email address');
   const passwordField = passwordForm.getByLabel('Password');

   await emailField.fill(account.email);
   if ((await emailField.inputValue()) !== account.email) {
      // Do not include the value in the error: it may be personal.
      throw new Error('Sign-in form did not accept the email input (hydration mismatch).');
   }
   await passwordField.fill(account.password);
   if ((await passwordField.inputValue()).length === 0) {
      throw new Error('Sign-in form did not accept the password input (hydration mismatch).');
   }

   await passwordForm.getByRole('button', { name: 'Sign in with password' }).click();

   // Password login redirects to /me, which opens the one private workspace.
   await page.waitForURL((url) => UUID_PATTERN.test(url.pathname.split('/')[2] ?? ''), {
      timeout: 30_000,
   });
   const landed = new URL(page.url());
   const workspaceSegment = landed.pathname.split('/')[2]?.toLowerCase();
   if (workspaceSegment !== account.workspaceId) {
      throw new Error(
         'BLOCKED: after sign-in the browser landed on a workspace that does not match E2E_WORKSPACE_ID. Refusing to store this session.'
      );
   }
   await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

   await mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true, mode: 0o700 });
   await page.context().storageState({ path: AUTH_STATE_PATH });
   await chmod(AUTH_STATE_PATH, 0o600);
});
