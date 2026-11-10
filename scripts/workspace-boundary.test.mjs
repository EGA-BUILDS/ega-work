import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import test from 'node:test';

const REAL_WORKSPACE_PATHS = [
   'app/w',
   'app/api/workspaces',
   'components/work',
   'lib/work',
   'app/me',
];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

// Any of these in real workspace source would cross the demo/private boundary.
const FIXTURE_IMPORT =
   /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"][^'"]*(?:mock-data|components\/common|components\/home|components\/layout|(?:^|\/)store\/)[^'"]*['"]/;
const FIXTURE_STORE = /useIssuesStore|issues-store/;
const UNIMPLEMENTED_PATH =
   /\/(?:lndev-ui|team|reviews|inbox|triage|initiatives|views|members|cycles)(?:\/|['"`?]|$)/;

async function sourceFiles(path) {
   const entries = await readdir(path, { withFileTypes: true });
   const files = [];
   for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
         files.push(...(await sourceFiles(child)));
      } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
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
      assert.doesNotMatch(source, /mock-data/, `${file} must not reference mock-data fixtures`);
      assert.doesNotMatch(source, FIXTURE_IMPORT, `${file} must not import demo UI or stores`);
      assert.doesNotMatch(source, FIXTURE_STORE, `${file} must not use the in-memory issue store`);
      assert.doesNotMatch(
         source,
         UNIMPLEMENTED_PATH,
         `${file} must not link into demo or unimplemented Circle routes`
      );
   }
});

test('the demo layout renders its label and excludes other organizations', async () => {
   const layout = await readFile('app/[orgId]/layout.tsx', 'utf8');
   const demoBranch = /if \(orgId === DEFAULT_ORG_ID\) \{([\s\S]*?)\n   \}/.exec(layout);
   assert.ok(demoBranch, 'the demo organization must have an explicit early-return branch');
   assert.match(demoBranch[1], /\{children\}/, 'the demo branch must render demo children');
   assert.match(demoBranch[1], /<DemoBanner\s*\/>/, 'the demo branch must render the label');

   const afterDemoBranch = layout.slice(demoBranch.index + demoBranch[0].length);
   assert.doesNotMatch(
      afterDemoBranch,
      /\{children\}/,
      'non-demo organization routes must not render fixture children'
   );
   assert.match(layout, /WorkspaceUnavailableState/, 'non-demo routes need an unavailable state');
});

test('the demo keeps a visible sample-data label', async () => {
   const demoPage = await readFile('app/demo/page.tsx', 'utf8');
   assert.match(demoPage, /Demo workspace/, 'the demo landing page must be labeled');

   const homeShell = await readFile('components/home/home-shell.tsx', 'utf8');
   assert.match(homeShell, /Demo workspace/, 'the demo interface must show a visible label');
   assert.match(homeShell, /Nothing is saved/, 'the demo must say sample data is not saved');
});
