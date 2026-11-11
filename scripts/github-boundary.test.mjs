import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

async function filesIn(path) {
   const entries = await readdir(path, { withFileTypes: true });
   const files = [];
   for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
         files.push(...(await filesIn(child)));
      } else if (entry.name.endsWith('.ts')) {
         files.push(child);
      }
   }
   return files;
}

const GITHUB_IMPORT = /from\s+['"]([^'"]*lib\/work\/github\/[^'"]*)['"]/g;

test('server-only GitHub modules declare the server boundary', async () => {
   for (const file of ['store.ts', 'service.ts', 'api-response.ts']) {
      const source = await readFile(`lib/work/github/${file}`, 'utf8');
      assert.match(source, /import 'server-only';/, `${file} must import server-only`);
   }
});

test('client GitHub components import only public types from the server module', async () => {
   for (const file of [
      'components/work/github-settings.tsx',
      'components/work/issue-pull-request.tsx',
   ]) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(source, /from\s+['"]pg['"]/, `${file} must not import pg`);
      for (const match of source.matchAll(GITHUB_IMPORT)) {
         assert.match(match[1], /\/github\/types$/, `${file} may only import public github types`);
      }
   }
});

test('GitHub server modules never write issue status', async () => {
   for (const file of await filesIn('lib/work/github')) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(
         source,
         /update\s+work_issues|from\s+['"]@\/lib\/work\/data['"]/,
         `${file} must not change issue status or use the issue data layer`
      );
   }
});

test('no GitHub secret is read from a public environment variable', async () => {
   for (const file of await filesIn('lib/work/github')) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z_]*GITHUB?/i, `${file} must stay server-only`);
      assert.doesNotMatch(source, /NEXT_PUBLIC_[A-Z_]*TOKEN/i, `${file} must stay server-only`);
   }
});
