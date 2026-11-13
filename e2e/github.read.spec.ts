import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * G4 — GitHub PR display, read-only, provisional (issue #32).
 *
 * These cases require an owner-provided disposable fixture: a disposable
 * GitHub App installation and repository, and one issue with a previously
 * linked pull request. No automation installs the App, links, refreshes, or
 * unlinks anything here.
 *
 * Without the fixture variables the cases fail with a named BLOCKED error.
 * That is intentional: BLOCKED is never reported as PASS.
 */

const CONFIRMED = 'I_CONFIRM_SAFE_GITHUB_FIXTURE';

const EXPECTED_STATES = {
   connected: 'Connected',
   reauthorization_required: 'Reconnect needed',
   unconfigured: 'Not configured',
   unavailable: 'Unavailable',
   disconnected: 'Not connected',
} as const;

type ExpectedState = keyof typeof EXPECTED_STATES;

function githubFixtureGate(): {
   expectedState: ExpectedState;
   expectedBadge: string;
} {
   const missing: string[] = [];
   const confirmed = process.env.E2E_GITHUB_FIXTURE_CONFIRMED;
   const expected = (process.env.E2E_GITHUB_EXPECTED_STATE ?? '').trim() as ExpectedState;
   if (typeof confirmed !== 'string' || confirmed.trim() !== CONFIRMED) {
      missing.push('E2E_GITHUB_FIXTURE_CONFIRMED');
   }
   if (!Object.hasOwn(EXPECTED_STATES, expected)) {
      missing.push('E2E_GITHUB_EXPECTED_STATE');
   }
   if (missing.length > 0) {
      throw new Error(
         `BLOCKED: GitHub fixture is not configured. Missing or unsupported variable(s): ${missing.join(', ')}.\n` +
            `Set E2E_GITHUB_FIXTURE_CONFIRMED=${CONFIRMED} and E2E_GITHUB_EXPECTED_STATE to one of: ${Object.keys(
               EXPECTED_STATES
            ).join(', ')}.\n` +
            'No GitHub App installation, OAuth flow, or repository write is performed by these cases.'
      );
   }
   return { expectedState: expected, expectedBadge: EXPECTED_STATES[expected] };
}

function requireUuidEnv(name: string): string {
   const value = process.env[name]?.trim();
   if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error(`BLOCKED: ${name} must be a UUID of the disposable fixture workspace.`);
   }
   return value.toLowerCase();
}

async function openSettings(page: Page, workspaceId: string) {
   await page.goto(`/w/${workspaceId}/settings`);
   await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
}

test.describe('GitHub PR display (read-only, provisional)', () => {
   test('I01: the workspace settings page displays the expected read-only GitHub connection state', async ({
      page,
   }) => {
      const { expectedState, expectedBadge } = githubFixtureGate();
      const workspaceId = requireUuidEnv('E2E_WORKSPACE_ID');

      await openSettings(page, workspaceId);
      // Each of the five connection states renders exactly one badge on this page.
      await expect(page.getByText(expectedBadge, { exact: true })).toBeVisible();
      if (expectedState === 'unconfigured') {
         await expect(
            page.getByText('GitHub is not configured in this environment', { exact: false })
         ).toBeVisible();
      }
   });

   test('I02: a previously linked pull request is displayed read-only', async ({ page }) => {
      const { expectedState } = githubFixtureGate();
      const workspaceId = requireUuidEnv('E2E_WORKSPACE_ID');
      const issueId = requireUuidEnv('E2E_CANARY_ISSUE_ID');
      if (expectedState !== 'connected') {
         throw new Error(
            'BLOCKED: I02 requires the fixture workspace to be GitHub-connected (E2E_GITHUB_EXPECTED_STATE=connected).'
         );
      }
      const prUrl = (process.env.E2E_GITHUB_PR_URL ?? '').trim();
      const prTitle = (process.env.E2E_GITHUB_PR_TITLE ?? '').trim();
      if (!prUrl || !prTitle) {
         throw new Error(
            'BLOCKED: I02 requires E2E_GITHUB_PR_URL and E2E_GITHUB_PR_TITLE of the previously linked fixture pull request.'
         );
      }
      let parsed: URL;
      try {
         parsed = new URL(prUrl);
      } catch {
         throw new Error('BLOCKED: E2E_GITHUB_PR_URL is not a valid URL.');
      }
      if (parsed.origin !== 'https://github.com') {
         throw new Error('BLOCKED: E2E_GITHUB_PR_URL must be a github.com https URL.');
      }

      await page.goto(`/w/${workspaceId}/issues/${issueId}`);
      await expect(page.getByText('Pull request', { exact: true })).toBeVisible();
      const link = page.getByRole('link', { name: prTitle });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', prUrl);
      const repoRef = (process.env.E2E_GITHUB_REPO_REF ?? '').trim();
      if (repoRef) {
         await expect(page.getByText(repoRef, { exact: true })).toBeVisible();
      }
      // Read-only: the refresh/unlink controls exist but are never clicked here.
   });
});
