import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { prepareWrite } from './identity';
import { formatUnknown, loadWriteGate, type WriteGateEnv } from './write-gate';

test.describe('Canary writes (owner-only, reversible)', () => {
   test.describe.configure({ timeout: 60_000 });

   const descriptionForm = (page: Page, saveButtonName: 'Save project' | 'Save issue') =>
      page.locator('form', {
         has: page.getByRole('button', { name: saveButtonName }),
      });

   async function saveDescription({
      page,
      kind,
      apiPath,
      value,
   }: {
      page: Page;
      kind: 'project' | 'issue';
      apiPath: string;
      value: string;
   }): Promise<void> {
      const saveButtonName = kind === 'project' ? 'Save project' : 'Save issue';
      const form = descriptionForm(page, saveButtonName);
      const field = form.getByLabel('Description', { exact: true });
      await field.fill(value);
      // Register the response listener before triggering the PATCH.
      const [response] = await Promise.all([
         page.waitForResponse(
            (res) => res.request().method() === 'PATCH' && res.url().includes(apiPath),
            { timeout: 30_000 }
         ),
         form.getByRole('button', { name: saveButtonName }).click(),
      ]);
      expect(response.status(), `PATCH ${apiPath}`).toBe(200);
      const body = (await response.json().catch(() => null)) as Record<
         string,
         { description?: string | null }
      > | null;
      const echo = kind === 'project' ? body?.project?.description : body?.issue?.description;
      // Compare only the echo; empty-string and null descriptions are treated as equal. Version counters may advance.
      expect(echo ?? '', 'server echo of the saved description').toBe(value);
   }

   async function descriptionCycle({
      page,
      baseURL,
      kind,
      testMarker,
   }: {
      page: Page;
      baseURL: string | undefined;
      kind: 'project' | 'issue';
      testMarker: string;
   }): Promise<void> {
      const gate = loadWriteGate(baseURL);
      // Verify the signed-in identity and canary fixture access BEFORE any mutation.
      await prepareWrite(page, gate);
      const targetId = kind === 'project' ? gate.canaryProjectId : gate.canaryIssueId;
      const apiPath = `/api/workspaces/${gate.workspaceId}/${kind === 'project' ? 'projects' : 'issues'}/${targetId}`;
      const pagePath = `/w/${gate.workspaceId}/${kind === 'project' ? 'projects' : 'issues'}/${targetId}`;

      await page.goto(pagePath);
      const saveButtonName = kind === 'project' ? 'Save project' : 'Save issue';
      const form = descriptionForm(page, saveButtonName);
      const field = form.getByLabel('Description', { exact: true });
      const original = await field.inputValue();
      const updated = testMarker;

      let failure: unknown = null;
      try {
         await saveDescription({ page, kind, apiPath, value: updated });
         await page.reload();
         await expect(field).toHaveValue(updated);
         if (gate.injectFailureAfterWrite) {
            throw new Error('[E2E_INJECT_FAILURE] injected failure after the write was verified');
         }
      } catch (error) {
         failure = error;
      } finally {
         try {
            await page.goto(pagePath);
            await saveDescription({ page, kind, apiPath, value: original });
            await page.reload();
            await expect(field).toHaveValue(original);
         } catch (restoreError) {
            throw new Error(
               [
                  'Canary write did not finish cleanly and the original value could NOT be restored.',
                  `Original failure: ${failure === null ? 'none' : formatUnknown(failure)}`,
                  `Restoration failure: ${formatUnknown(restoreError)}`,
                  'Residual state: the canary record may still hold the test value.',
                  'Inspect and restore it manually before any further run.',
               ].join('\n'),
               { cause: restoreError }
            );
         }
      }
      if (failure !== null) {
         throw failure;
      }
   }

   test('W01: canary project description is modified, persisted, and restored', async ({
      page,
      baseURL,
   }) => {
      await descriptionCycle({
         page,
         baseURL,
         kind: 'project',
         testMarker: 'e2e-canary-w01 (automated write check)',
      });
   });

   test('W02: canary issue description is modified, persisted, and restored', async ({
      page,
      baseURL,
   }) => {
      await descriptionCycle({
         page,
         baseURL,
         kind: 'issue',
         testMarker: 'e2e-canary-w02 (automated write check)',
      });
   });

   test('W03: canary issue completion toggles, persists, and is restored', async ({
      page,
      baseURL,
   }) => {
      const gate: WriteGateEnv = loadWriteGate(baseURL);
      // Verify the signed-in identity and canary fixture access BEFORE any mutation.
      await prepareWrite(page, gate);
      const apiPath = `/api/workspaces/${gate.workspaceId}/issues/${gate.canaryIssueId}`;
      const pagePath = `/w/${gate.workspaceId}/issues/${gate.canaryIssueId}`;

      await page.goto(pagePath);
      const toggle = page.getByRole('button', { name: /^(Complete issue|Reopen issue)$/ });
      const initialLabel = (await toggle.innerText()).trim();
      const wasOpen = initialLabel === 'Complete issue';
      const toggledName = wasOpen ? 'Reopen issue' : 'Complete issue';
      const restoredName = wasOpen ? 'Complete issue' : 'Reopen issue';

      let failure: unknown = null;
      try {
         // Register the response listener before triggering the PATCH.
         const [response] = await Promise.all([
            page.waitForResponse(
               (res) => res.request().method() === 'PATCH' && res.url().includes(apiPath),
               { timeout: 30_000 }
            ),
            toggle.click(),
         ]);
         expect(response.status(), `PATCH ${apiPath}`).toBe(200);
         await expect(page.getByRole('button', { name: toggledName })).toBeVisible();
         await page.reload();
         await expect(page.getByRole('button', { name: toggledName })).toBeVisible();
         if (gate.injectFailureAfterWrite) {
            throw new Error('[E2E_INJECT_FAILURE] injected failure after the write was verified');
         }
      } catch (error) {
         failure = error;
      } finally {
         try {
            await page.goto(pagePath);
            const current = page.getByRole('button', { name: /^(Complete issue|Reopen issue)$/ });
            const currentLabel = (await current.innerText()).trim();
            if (currentLabel !== restoredName) {
               const [response] = await Promise.all([
                  page.waitForResponse(
                     (res) => res.request().method() === 'PATCH' && res.url().includes(apiPath),
                     { timeout: 30_000 }
                  ),
                  current.click(),
               ]);
               expect(response.status(), `PATCH ${apiPath} (restore)`).toBe(200);
               await page.reload();
            }
            await expect(page.getByRole('button', { name: restoredName })).toBeVisible();
         } catch (restoreError) {
            throw new Error(
               [
                  'Canary toggle did not finish cleanly and the original status could NOT be restored.',
                  `Original failure: ${failure === null ? 'none' : formatUnknown(failure)}`,
                  `Restoration failure: ${formatUnknown(restoreError)}`,
                  'Residual state: the canary issue status may not match its original value.',
                  'Inspect the issue and restore it manually before any further run.',
               ].join('\n'),
               { cause: restoreError }
            );
         }
      }
      if (failure !== null) {
         throw failure;
      }
   });
});
