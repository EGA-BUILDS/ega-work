import type { Locator, Page } from '@playwright/test';

import { expect } from './fixtures';

import type { WriteGateEnv } from './write-gate';

/**
 * Authenticated-identity verification for the canary write gates (issue #31).
 *
 * `E2E_ACCOUNT_USER_ID` being a valid UUID proves nothing about who is signed
 * in right now. Before any W01–W03 mutation we therefore verify, through the
 * server-rendered Settings page (it renders ids from a
 * Supabase `getUser()`-verified session context), that:
 *
 *   1. the rendered Workspace ID row contains the approved workspace UUID;
 *   2. the rendered Account ID row contains the approved account UUID;
 *   3. the canary project and canary issue both open through the
 *      authorized application UI — anything else yields the app's 404 page
 *      or a load error instead of the editing surfaces.
 *
 * There is no new endpoint, no service-role access, and no owner credential:
 * everything goes through the exact journey a browser performs anyway.
 * No id values, cookies, or page HTML are logged on failure.
 */

function blocked(context: string): Error {
   return new Error(`BLOCKED: ${context}`);
}

/** Reads the `label` row's container text and compares it to `expected`. */
async function rowContainsUuid(page: Page, label: string, expected: string): Promise<boolean> {
   // The label is a <span>; its parent (xpath=..) is the grid cell wrapping the value.
   const row = page.getByText(label, { exact: true }).locator('xpath=..');
   const text = await row.textContent();
   // Compare against rendered text instead of interpolating the expected
   // value into a locator, so error output carries no id material.
   return typeof text === 'string' && text.includes(expected);
}

/** Asserts locator visibility, translating any failure into a named BLOCKED error. */
async function expectOrBlocked(locator: Locator, context: string): Promise<void> {
   try {
      await expect(locator).toBeVisible();
   } catch {
      throw blocked(context);
   }
}

export type IdentityCheck = {
   page: Page;
   gate: WriteGateEnv;
};

/** Verifies the signed-in session matches the approved account and workspace. */
export async function verifyAuthenticatedIdentity({ page, gate }: IdentityCheck): Promise<void> {
   await page.goto(`/w/${gate.workspaceId}/settings`);
   await expectOrBlocked(
      page.getByRole('heading', { level: 1, name: 'Settings' }),
      'could not open workspace settings (session invalid, wrong target, or no access). Refusing to write.'
   );

   const workspaceOk = await rowContainsUuid(page, 'Workspace ID', gate.workspaceId);
   if (!workspaceOk) {
      throw blocked(
         'the signed-in browser session does not belong to the approved workspace. Refusing to write.'
      );
   }

   const accountOk = await rowContainsUuid(page, 'Account ID', gate.accountUserId);
   if (!accountOk) {
      throw blocked(
         'the signed-in browser session does not belong to the approved E2E account. Refusing to write.'
      );
   }
}

/**
 * Also proves the two canary records are reachable through the authorized UI
 * under this session. This is what ties the configured canary UUIDs to the
 * workspace that RLS/server authorization actually exposes: records owned by
 * anyone else or in any other workspace 404, and nothing renders the forms.
 */
export async function verifyCanaryFixtures({ page, gate }: IdentityCheck): Promise<void> {
   await page.goto(`/w/${gate.workspaceId}/projects/${gate.canaryProjectId}`);
   await expectOrBlocked(
      page.getByRole('button', { name: 'Save project' }),
      'canary project did not open in the approved workspace. Refusing to write.'
   );

   await page.goto(`/w/${gate.workspaceId}/issues/${gate.canaryIssueId}`);
   await expectOrBlocked(
      page.getByRole('button', { name: /^(Complete issue|Reopen issue)$/ }),
      'canary issue did not open in the approved workspace. Refusing to write.'
   );
}

export async function prepareWrite(page: Page, gate: WriteGateEnv): Promise<void> {
   await verifyAuthenticatedIdentity({ page, gate });
   await verifyCanaryFixtures({ page, gate });
}
