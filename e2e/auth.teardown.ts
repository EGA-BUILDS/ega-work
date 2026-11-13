import { rm } from 'node:fs/promises';

import { test } from '@playwright/test';

import { AUTH_STATE_PATH } from './account';

/**
 * Deletes the stored browser state after all dependent projects finish.
 * The file is sensitive (it can impersonate the disposable account), so it
 * is removed even when tests fail.
 */
test('delete the stored authenticated browser state', async () => {
   await rm(AUTH_STATE_PATH, { force: true });
});
