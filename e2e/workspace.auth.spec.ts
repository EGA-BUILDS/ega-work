import { expect, test } from './fixtures';
import { escapeRegExp, loadAccountEnv, loadCanaryEnv } from './account';

test.describe('Authenticated read-only (disposable E2E account)', () => {
   test('A01: workspace dashboard and projects render', async ({ page }) => {
      const { email, workspaceId } = loadAccountEnv();

      await page.goto(`/w/${workspaceId}`);
      await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}(/|$|\\?)`));
      // The workspace name is unknown; assert structure, not fixture content.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(
         page.getByText(new RegExp(`Private saved work for ${escapeRegExp(email)}`))
      ).toBeVisible();

      await page.goto(`/w/${workspaceId}/projects`);
      await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
      await expect(page.getByText('Saved projects', { exact: true })).toBeVisible();
   });

   test('A02: My issues shows assigned issues or the empty state', async ({ page }) => {
      const { workspaceId } = loadAccountEnv();

      await page.goto(`/w/${workspaceId}/my-issues`);
      await expect(page.getByRole('heading', { level: 1, name: 'My issues' })).toBeVisible();

      const emptyState = page.getByText('No assigned issues yet', { exact: true });
      const openSection = page.getByRole('heading', { name: /^Open \(\d+\)$/ });
      await expect(emptyState.or(openSection)).toBeVisible();

      if (await emptyState.isVisible()) {
         await expect(page.getByText('Go to projects', { exact: true })).toBeVisible();
      } else {
         await expect(page.getByRole('heading', { name: /^Completed \(\d+\)$/ })).toBeVisible();
      }
   });

   test('A03: Settings renders the signed-in identity', async ({ page }) => {
      const { email, workspaceId } = loadAccountEnv();

      await page.goto(`/w/${workspaceId}/settings`);
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
      await expect(page.getByText('Signed in as', { exact: true })).toBeVisible();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
      await expect(page.getByText(workspaceId, { exact: true })).toBeVisible();
   });

   test('A04: workspace navigation works and the session persists across reload', async ({
      page,
   }) => {
      const { workspaceId } = loadAccountEnv();

      await page.goto(`/w/${workspaceId}`);
      await page.getByRole('link', { name: 'Projects' }).click();
      await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/projects(/|$|\\?)`));
      await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();

      await page.getByRole('link', { name: 'My issues' }).click();
      await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/my-issues(/|$|\\?)`));
      await expect(page.getByRole('heading', { level: 1, name: 'My issues' })).toBeVisible();

      await page.getByRole('link', { name: 'Settings' }).click();
      await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/settings(/|$|\\?)`));
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

      await page.reload();
      await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/settings(/|$|\\?)`));
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
      await expect(page.getByText('Signed in as', { exact: true })).toBeVisible();
   });

   test('A05: the seeded canary project and issue are readable after reload', async ({ page }) => {
      const { workspaceId } = loadAccountEnv();
      const canary = loadCanaryEnv();

      await page.goto(`/w/${workspaceId}/projects/${canary.projectId}`);
      await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/projects/${canary.projectId}`));
      const projectNameField = page.getByLabel('Name', { exact: true });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(projectNameField).toHaveValue(/.+/);
      if (canary.projectName) {
         await expect(projectNameField).toHaveValue(canary.projectName);
      }
      await page.reload();
      await expect(projectNameField).toHaveValue(/.+/);

      await page.goto(`/w/${workspaceId}/issues/${canary.issueId}`);
      await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/issues/${canary.issueId}`));
      const issueTitleField = page.getByLabel('Title', { exact: true });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(issueTitleField).toHaveValue(/.+/);
      if (canary.issueTitle) {
         await expect(issueTitleField).toHaveValue(canary.issueTitle);
      }
      await page.reload();
      await expect(issueTitleField).toHaveValue(/.+/);
   });
});
