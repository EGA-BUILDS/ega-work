import assert from 'node:assert/strict';
import test from 'node:test';

import {
   isPullRequestVisible,
   presentInstallation,
   presentPullRequest,
   presentPullRequestError,
   presentStatus,
   utcLabel,
} from '../lib/work/github/present.ts';

function row(overrides = {}) {
   return {
      id: '00000000-0000-4000-8000-000000000010',
      workspace_id: '00000000-0000-4000-8000-000000000001',
      issue_id: '00000000-0000-4000-8000-000000000002',
      repo_owner: 'ega-builds',
      repo_name: 'ega-work',
      pr_number: 12,
      url: 'https://github.com/ega-builds/ega-work/pull/12',
      title: 'A change',
      state: 'open',
      last_checked_at: '2026-11-11T10:20:30.000Z',
      last_check_error: null,
      is_stale: false,
      hidden: false,
      attempt: 3,
      connection_generation: 4,
      refresh_lease_id: '00000000-0000-4000-8000-000000000099',
      refresh_lease_expires_at: '2026-11-11T10:21:00.000Z',
      linked_by: '00000000-0000-4000-8000-00000000000a',
      created_at: '2026-11-11T10:00:00.000Z',
      updated_at: '2026-11-11T10:20:30.000Z',
      ...overrides,
   };
}

test('public pull-request objects never expose credentials or leases', () => {
   const view = presentPullRequest(
      row({
         token_ciphertext: 'cipher-secret',
         token_iv: 'iv-secret',
         token_tag: 'tag-secret',
         refresh_token_ciphertext: 'refresh-cipher',
         code_verifier_ciphertext: 'verifier-cipher',
         access_token: 'ghu_plaintext',
      })
   );

   const serialized = JSON.stringify(view);
   assert.equal(view.id, '00000000-0000-4000-8000-000000000010');
   assert.equal(view.owner, 'ega-builds');
   assert.equal(view.repository, 'ega-work');
   assert.equal(view.number, 12);
   assert.equal(view.state, 'open');
   assert.equal(view.lastCheckedLabel, '2026-11-11 10:20 UTC');

   for (const forbidden of [
      'token',
      'cipher',
      'verifier',
      'ghu_plaintext',
      'refresh_lease',
      'linked_by',
      'workspace_id',
      'issue_id',
      'attempt',
      'connection_generation',
   ]) {
      assert.equal(
         serialized.includes(forbidden),
         false,
         `public payload must not include ${forbidden}`
      );
   }
});

test('hidden or incomplete pull requests are not public', () => {
   assert.equal(presentPullRequest(null), null);
   assert.equal(presentPullRequest(row({ hidden: true })), null);
   assert.equal(presentPullRequest(row({ state: null })), null);
   assert.equal(presentPullRequest(row({ url: null })), null);
});

test('stored error codes map to fixed messages', () => {
   assert.match(presentPullRequestError('rate_limited'), /rate limiting/);
   assert.match(presentPullRequestError('outage'), /did not respond/);
   assert.match(presentPullRequestError('installation_unavailable'), /installation/);
   assert.match(presentPullRequestError('not_found'), /no longer available/);
   assert.match(presentPullRequestError('reauthorization_required'), /Reconnect/);
   assert.equal(presentPullRequestError(null), null);
   assert.equal(
      presentPullRequestError('provider said secret <script>'),
      'The last check did not complete. The last saved result is shown.'
   );
   assert.equal(
      presentPullRequest(row({ last_check_error: 'provider said secret <script>' })).error,
      'The last check did not complete. The last saved result is shown.'
   );
});

test('connection status is honest about configuration and usability', () => {
   assert.deepEqual(presentStatus(false, null), {
      configured: false,
      status: 'unconfigured',
      login: null,
      installationId: null,
      connectedAt: null,
   });
   assert.equal(presentStatus(true, null).status, 'disconnected');
   assert.equal(presentStatus(true, null, true).status, 'unavailable');

   const connectedRow = {
      workspace_id: '00000000-0000-4000-8000-000000000001',
      provider_user_id: '42',
      login: 'octocat',
      token_ciphertext: 'cipher',
      token_iv: 'iv',
      token_tag: 'tag',
      token_expires_at: null,
      refresh_token_ciphertext: 'refresh',
      refresh_token_iv: 'iv',
      refresh_token_tag: 'tag',
      refresh_token_expires_at: null,
      installation_id: '12345',
      connection_generation: 0,
      token_version: 1,
      refresh_lease_id: null,
      refresh_lease_expires_at: null,
      connected_at: '2026-11-11T10:00:00.000Z',
      revoked_at: null,
      updated_at: '2026-11-11T10:00:00.000Z',
   };

   const connected = presentStatus(true, connectedRow);

   assert.equal(connected.status, 'connected');
   assert.equal(connected.login, 'octocat');
   assert.equal(connected.installationId, '12345');
   assert.equal(JSON.stringify(connected).includes('cipher'), false);

   const revoked = presentStatus(true, {
      ...connectedRow,
      revoked_at: '2026-11-11T11:00:00.000Z',
      token_ciphertext: null,
      token_iv: null,
      token_tag: null,
   });
   assert.equal(revoked.status, 'reauthorization_required');
   assert.equal(revoked.login, null);
   assert.equal(revoked.installationId, null);

   const missingToken = presentStatus(true, {
      ...connectedRow,
      token_ciphertext: null,
   });
   assert.equal(missingToken.status, 'reauthorization_required');
});

test('read-path projection requires a usable connection and matching generation', () => {
   const connection = {
      revoked_at: null,
      token_ciphertext: 'cipher',
      token_iv: 'iv',
      token_tag: 'tag',
      installation_id: '12345',
      connection_generation: 4,
   };
   const visible = row({ connection_generation: 4, hidden: false });

   assert.equal(isPullRequestVisible(connection, visible), true);
   assert.equal(isPullRequestVisible(null, visible), false);
   assert.equal(isPullRequestVisible(connection, null), false);
   assert.equal(
      isPullRequestVisible({ ...connection, revoked_at: '2026-11-11T11:00:00Z' }, visible),
      false
   );
   assert.equal(isPullRequestVisible({ ...connection, token_ciphertext: null }, visible), false);
   assert.equal(isPullRequestVisible({ ...connection, token_iv: null }, visible), false);
   assert.equal(isPullRequestVisible({ ...connection, token_tag: null }, visible), false);
   assert.equal(isPullRequestVisible({ ...connection, installation_id: null }, visible), false);
   assert.equal(isPullRequestVisible(connection, { ...visible, hidden: true }), false);
   assert.equal(isPullRequestVisible(connection, { ...visible, connection_generation: 3 }), false);
});

test('installation sanitization keeps only display fields', () => {
   const view = presentInstallation({
      id: '12345',
      accountLogin: 'octocat',
      accountType: 'User',
      repositorySelection: 'selected',
   });
   assert.deepEqual(view, {
      id: '12345',
      accountLogin: 'octocat',
      accountType: 'User',
      repositorySelection: 'selected',
   });
});

test('UTC labels are stable and do not use the host timezone', () => {
   assert.equal(utcLabel('2026-01-02T03:04:05.000Z'), '2026-01-02 03:04 UTC');
   assert.equal(utcLabel(null), null);
   assert.equal(utcLabel('not-a-date'), null);
});
