import assert from 'node:assert/strict';
import test from 'node:test';

import {
   escapeLikePattern,
   issueNumberFromQuery,
   normalizeSearchQuery,
} from '../lib/work/search.ts';

test('search patterns escape LIKE wildcards so input is literal', () => {
   assert.equal(escapeLikePattern('100% done'), '100\\% done');
   assert.equal(escapeLikePattern('a_b'), 'a\\_b');
   assert.equal(escapeLikePattern('back\\slash'), 'back\\\\slash');
   assert.equal(escapeLikePattern('normal title'), 'normal title');
});

test('issue identifier search accepts only a positive W-number', () => {
   assert.equal(issueNumberFromQuery('W-12'), 12);
   assert.equal(issueNumberFromQuery('  w-7  '), 7);
   assert.equal(issueNumberFromQuery('W-0'), null);
   assert.equal(issueNumberFromQuery('W-abc'), null);
   assert.equal(issueNumberFromQuery('12'), null);
   assert.equal(issueNumberFromQuery('W-999999999999999999999'), null);
});

test('search queries are trimmed and bounded', () => {
   assert.equal(normalizeSearchQuery('  launch  '), 'launch');
   assert.equal(normalizeSearchQuery('x'.repeat(200)).length, 100);
   assert.equal(normalizeSearchQuery('   '), '');
});
