import assert from 'node:assert/strict';
import test from 'node:test';

import {
   issueIdentifier,
   isIssueStatus,
   parseVersion,
   validateIssueInput,
   validateProjectInput,
} from '../lib/work/validation.ts';

test('project input trims and requires a name', () => {
   assert.deepEqual(validateProjectInput({ name: '  Launch  ', description: '  Ship it ' }), {
      ok: true,
      value: { name: 'Launch', description: 'Ship it' },
   });
   assert.deepEqual(validateProjectInput({ name: '   ', description: '' }), {
      ok: false,
      error: 'Enter a project name.',
   });
   assert.deepEqual(validateProjectInput({ name: 'x'.repeat(201) }), {
      ok: false,
      error: 'Keep the project name under 200 characters.',
   });
});

test('project description is optional and bounded', () => {
   assert.deepEqual(validateProjectInput({ name: 'Launch', description: '   ' }), {
      ok: true,
      value: { name: 'Launch', description: null },
   });
   assert.equal(validateProjectInput({ name: 'Launch', description: 7 }).ok, false);
   assert.equal(validateProjectInput({ name: 'Launch', description: 'x'.repeat(10001) }).ok, false);
});

test('issue input trims and requires a title', () => {
   assert.deepEqual(validateIssueInput({ title: '  Fix auth  ', description: ' Details ' }), {
      ok: true,
      value: { title: 'Fix auth', description: 'Details' },
   });
   assert.deepEqual(validateIssueInput({ title: '' }), {
      ok: false,
      error: 'Enter an issue title.',
   });
   assert.equal(validateIssueInput({ title: 'x'.repeat(501) }).ok, false);
   assert.equal(validateIssueInput({ title: 'x', description: 'x'.repeat(20001) }).ok, false);
});

test('status and version validation accept only documented values', () => {
   assert.equal(isIssueStatus('open'), true);
   assert.equal(isIssueStatus('completed'), true);
   assert.equal(isIssueStatus('done'), false);
   assert.equal(isIssueStatus(null), false);

   assert.equal(parseVersion(1), 1);
   assert.equal(parseVersion(0), null);
   assert.equal(parseVersion(-1), null);
   assert.equal(parseVersion(1.5), null);
   assert.equal(parseVersion('2'), null);
});

test('issue identifiers are stable workspace labels', () => {
   assert.equal(issueIdentifier(1), 'W-1');
   assert.equal(issueIdentifier(42), 'W-42');
});
