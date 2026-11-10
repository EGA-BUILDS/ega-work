import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import test from 'node:test';

const REAL_WORKSPACE_PATHS = ['app/w', 'app/api/workspaces', 'components/work', 'lib/work', 'app/me'];

async function sourceFiles(path) {
   const entries = await readdir(path, { withFileTypes: true });
   const files = [];
   for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
         files.push(...(await sourceFiles(child)));
      } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
         files.push(child);
      }
   }
   return files;
}

test('real workspace source never imports demo fixtures or the in-memory issue store', async () => {
   const files = (await Promise.all(REAL_WORKSPACE_PATHS.map(sourceFiles))).flat();
   assert.ok(files.length > 0, 'expected real workspace source files');

   for (const file of files) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(
         source,
         /from ['"]@\/mock-data/,
         `${file} must not import mock-data fixtures`
      );
      assert.doesNotMatch(
         source,
         /useIssuesStore|issues-store/,
         `${file} must not use the in-memory issue store`
      );
      assert.doesNotMatch(
         source,
         /href=["'`]\/(?:lndev-ui|team|reviews|inbox)/,
         `${file} must not link into demo or unimplemented Circle routes`
      );
   }
});

test('the demo remains a separate, labeled route', async () => {
   const layout = await readFile('app/[orgId]/layout.tsx', 'utf8');
   assert.match(layout, /DEFAULT_ORG_ID/, 'the demo organization must be recognized explicitly');
   assert.match(layout, /DemoBanner/, 'demo pages must carry a persistent label');
   assert.match(layout, /WorkspaceUnavailableState/, 'non-demo organization routes must not render');

   const demoPage = await readFile('app/demo/page.tsx', 'utf8');
   assert.match(demoPage, /Demo workspace/, 'the demo landing page must be labeled');
});
