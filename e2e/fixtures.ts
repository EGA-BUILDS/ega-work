import { expect, test as base } from '@playwright/test';

import { bootstrapPreviewBypass } from './preview-bypass';

/**
 * Shared E2E fixtures.
 *
 * The `monitor` fixture is automatic: every test fails when the page records a
 * `pageerror` or the first-party origin returns an HTTP 5xx response. It never
 * swallows failures itself; it reports them after the test body has finished.
 *
 * The `vercelBypass` fixture is automatic but inert unless the owner's
 * isolated environment opts in with E2E_G1B_PREVIEW_BYPASS (and supplies the
 * preview origin + bypass secret). See e2e/preview-bypass.ts and
 * docs/testing/E2E-CONTEXT.md (G1b). The public path is unchanged otherwise.
 */

type MonitorFailure = {
   type: 'pageerror' | 'http_5xx';
   detail: string;
};

function responseTarget(url: string): string {
   try {
      const parsed = new URL(url);
      // Strip query and fragment so logs never carry parameter values.
      return `${parsed.origin}${parsed.pathname}`;
   } catch {
      return '<unparseable-url>';
   }
}

export const test = base.extend<{ monitor: void; vercelBypass: void }>({
   vercelBypass: [
      async ({ context }, use) => {
         if (process.env.E2E_G1B_PREVIEW_BYPASS === 'I_ACCEPT_PREVIEW_BYPASS') {
            await bootstrapPreviewBypass(context);
         }
         await use();
      },
      { auto: true },
   ],
   monitor: [
      async ({ page, baseURL }, use) => {
         const failures: MonitorFailure[] = [];
         const firstPartyOrigin = baseURL ? new URL(baseURL).origin : null;

         page.on('pageerror', (error) => {
            failures.push({ type: 'pageerror', detail: error?.message ?? String(error) });
         });

         page.on('response', (response) => {
            if (response.status() < 500) {
               return;
            }
            let responseOrigin: string | null = null;
            try {
               responseOrigin = new URL(response.url()).origin;
            } catch {
               return;
            }
            if (firstPartyOrigin && responseOrigin === firstPartyOrigin) {
               failures.push({
                  type: 'http_5xx',
                  detail: `HTTP ${response.status()} ${responseTarget(response.url())}`,
               });
            }
         });

         await use();

         if (failures.length > 0) {
            const summary = failures.map((failure) => `  - [${failure.type}] ${failure.detail}`);
            throw new Error(
               `Page errors or first-party 5xx responses detected:\n${summary.join('\n')}`
            );
         }
      },
      { auto: true },
   ],
});

export { expect };
