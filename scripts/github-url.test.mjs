import assert from 'node:assert/strict';
import test from 'node:test';

import { isUuid, parsePullRequestUrl, pullRequestUrl } from '../lib/work/github/url.ts';

test('pull-request URLs accept only the canonical GitHub form', () => {
   const valid = [
      ['https://github.com/EGA-BUILDS/ega-work/pull/123', 'ega-builds', 'ega-work', 123],
      ['https://github.com/octocat/Hello-World/pull/1', 'octocat', 'hello-world', 1],
      ['https://github.com/my-org/repo.name/pull/42', 'my-org', 'repo.name', 42],
      ['https://github.com/my-org/repo_name/pull/42', 'my-org', 'repo_name', 42],
      ['https://github.com/a/b/pull/2147483647', 'a', 'b', 2147483647],
   ];

   for (const [url, owner, repo, number] of valid) {
      const result = parsePullRequestUrl(url);
      assert.equal(result.ok, true, `${url} must be accepted`);
      assert.deepEqual(result.value, { owner, repo, number });
   }
});

test('pull-request URLs reject every unsafe or ambiguous form', () => {
   const invalid = [
      'http://github.com/owner/repo/pull/1',
      'ftp://github.com/owner/repo/pull/1',
      '//github.com/owner/repo/pull/1',
      'github.com/owner/repo/pull/1',
      'https://www.github.com/owner/repo/pull/1',
      'https://github.com.evil.example/owner/repo/pull/1',
      'https://github.com@evil.example/owner/repo/pull/1',
      'https://user:pass@github.com/owner/repo/pull/1',
      'https://github.com:443/owner/repo/pull/1',
      'https://github.com:8443/owner/repo/pull/1',
      'https://github.com/owner/repo/pull/1?redirect=https://evil.example',
      'https://github.com/owner/repo/pull/1#comment',
      'https://github.com/owner/repo/pull/1/files',
      'https://github.com/owner/repo/pull/1/',
      'https://github.com/owner/repo/pulls/1',
      'https://github.com/owner/repo/pull/%31',
      'https://github.com/owner/repo/pull/1%20',
      'https://github.com/owner%2Frepo/pull/1',
      'https://github.com/owner/repo%2Fpull%2F1',
      'https://github.com/owner/repo/pull/01',
      'https://github.com/owner/repo/pull/0',
      'https://github.com/owner/repo/pull/-1',
      'https://github.com/owner/repo/pull/2147483648',
      'https://github.com/owner/repo/pull/999999999999999999999',
      ' https://github.com/owner/repo/pull/1',
      'https://github.com/owner/repo/pull/1 ',
      'https://github.com/owner/repo/pull/1\n',
      'https://github.com/-owner/repo/pull/1',
      'https://github.com/owner-/repo/pull/1',
      'https://github.com/own--er/repo/pull/1',
      'https://github.com/owner/./pull/1',
      'https://github.com/owner/../pull/1',
      'https://github.com/owner/repo./pull/1',
      'https://github.com/владелец/repo/pull/1',
      'https://github.com/owner/répo/pull/1',
      'https://github.com/owner/repo\n/pull/1',
      'https://github.com/owner/repo/pull/1\u0000',
      'https://github.com/owner/repo/pull/1%00',
      'https://github.com/owner/repo/pull/1?x=1&y=2',
      ' https://github.com/owner/repo/pull/1\t',
   ];

   for (const url of invalid) {
      assert.equal(parsePullRequestUrl(url).ok, false, `${JSON.stringify(url)} must be rejected`);
   }

   assert.equal(parsePullRequestUrl(null).ok, false);
   assert.equal(parsePullRequestUrl(42).ok, false);
   assert.equal(parsePullRequestUrl({}).ok, false);
});

test('owner, repository, and number limits stay within GitHub rules', () => {
   assert.equal(parsePullRequestUrl(`https://github.com/${'a'.repeat(39)}/repo/pull/1`).ok, true);
   assert.equal(parsePullRequestUrl(`https://github.com/${'a'.repeat(40)}/repo/pull/1`).ok, false);
   assert.equal(parsePullRequestUrl(`https://github.com/owner/${'a'.repeat(100)}/pull/1`).ok, true);
   assert.equal(
      parsePullRequestUrl(`https://github.com/owner/${'a'.repeat(101)}/pull/1`).ok,
      false
   );
});

test('pullRequestUrl reconstructs the canonical URL from parsed parts', () => {
   assert.equal(
      pullRequestUrl({ owner: 'ega-builds', repo: 'ega-work', number: 7 }),
      'https://github.com/ega-builds/ega-work/pull/7'
   );
});

test('UUID validation only accepts canonical UUIDs', () => {
   assert.equal(isUuid('00000000-0000-4000-8000-00000000000a'), true);
   assert.equal(isUuid('00000000-0000-0000-0000-00000000000a'), false);
   assert.equal(isUuid('not-a-uuid'), false);
   assert.equal(isUuid(null), false);
});
