import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

for (const timezone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
   test(`homepage dates stay on the fixture day in ${timezone}`, () => {
      const result = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', `
         import { formatHomeDate } from './lib/home-date.ts';
         console.log(JSON.stringify(['2026-07-21', '2026-01-01'].map(formatHomeDate)));
      `], { cwd: new URL('../', import.meta.url), env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
      assert.deepEqual(JSON.parse(result), ['Jul 21', 'Jan 1']);
   });
}
