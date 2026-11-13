import { rm } from 'node:fs/promises';

import { test } from '@playwright/test';

import { AUTH_STATE_PATH } from './account';

/**
 * Deletes the stored browser state after all dependent projects finish.
 * The file is sensitive (it can impersonate the disposable account).
 * `force: true` makes this idempotent — the file may already be absent when
 * the setup failed before writing it — while genuine `rm` errors (e.g.
 * permissions) still reject and fail this test, so cleanup failures are
 * surfaced by the runner. Playwright schedules this project after the
 * setup project and its dependents even when they fail; a hard kill of
 * the runner can still orphan the file — see docs/testing/playwright-g2.md
 * for the recovery procedure.
 */
test('delete the stored authenticated browser state', async () => {
   await rm(AUTH_STATE_PATH, { force: true });
});
