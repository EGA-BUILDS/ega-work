import assert from 'node:assert/strict';
import test from 'node:test';

import {
   ACCESS_TOKEN_SKEW_MS,
   classifyConnectionToken,
   tokenIsUsable,
} from '../lib/work/github/token.ts';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);

function row(overrides = {}) {
   return {
      revoked_at: null,
      token_ciphertext: 'cipher',
      token_iv: 'iv',
      token_tag: 'tag',
      token_expires_at: new Date(NOW + ACCESS_TOKEN_SKEW_MS + 1).toISOString(),
      refresh_token_ciphertext: 'refresh-cipher',
      refresh_token_iv: 'refresh-iv',
      refresh_token_tag: 'refresh-tag',
      refresh_token_expires_at: new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(),
      refresh_lease_id: null,
      refresh_lease_expires_at: null,
      ...overrides,
   };
}

test('a non-expiring or fresh access token is usable', () => {
   assert.equal(classifyConnectionToken(row({ token_expires_at: null }), NOW).kind, 'usable');
   assert.equal(
      classifyConnectionToken(
         row({ token_expires_at: new Date(NOW + ACCESS_TOKEN_SKEW_MS + 1).toISOString() }),
         NOW
      ).kind,
      'usable'
   );
   assert.equal(tokenIsUsable(row(), NOW), true);
});

test('an access token inside the refresh window needs a refresh', () => {
   const inside = row({
      token_expires_at: new Date(NOW + ACCESS_TOKEN_SKEW_MS - 1).toISOString(),
   });
   assert.deepEqual(classifyConnectionToken(inside, NOW), { kind: 'refresh' });

   const expired = row({ token_expires_at: new Date(NOW - 1).toISOString() });
   assert.equal(classifyConnectionToken(expired, NOW).kind, 'refresh');
});

test('a revoked connection is unusable even with a stored token', () => {
   assert.deepEqual(
      classifyConnectionToken(row({ revoked_at: new Date(NOW).toISOString() }), NOW),
      { kind: 'unusable', reason: 'revoked' }
   );
   assert.equal(tokenIsUsable(row({ revoked_at: new Date(NOW).toISOString() }), NOW), false);
});

test('missing access or refresh material is classified explicitly', () => {
   assert.deepEqual(
      classifyConnectionToken(
         row({ token_ciphertext: null, token_expires_at: new Date(NOW - 1).toISOString() }),
         NOW
      ),
      { kind: 'refresh' }
   );

   assert.deepEqual(classifyConnectionToken(row({ refresh_token_ciphertext: null }), NOW), {
      kind: 'usable',
      accessExpiresAt: new Date(NOW + ACCESS_TOKEN_SKEW_MS + 1),
   });

   const noAccessNoRefresh = row({
      token_ciphertext: null,
      token_expires_at: null,
      refresh_token_ciphertext: null,
   });
   assert.deepEqual(classifyConnectionToken(noAccessNoRefresh, NOW), {
      kind: 'unusable',
      reason: 'missing_refresh',
   });

   const expiredRefresh = row({
      token_expires_at: new Date(NOW - 1).toISOString(),
      refresh_token_expires_at: new Date(NOW - 1).toISOString(),
   });
   assert.deepEqual(classifyConnectionToken(expiredRefresh, NOW), {
      kind: 'unusable',
      reason: 'expired_refresh',
   });
});

test('an active lease belongs to another worker', () => {
   const active = row({
      token_expires_at: new Date(NOW - 1).toISOString(),
      refresh_lease_id: '00000000-0000-4000-8000-000000000001',
      refresh_lease_expires_at: new Date(NOW + 15_000).toISOString(),
   });
   assert.deepEqual(classifyConnectionToken(active, NOW), {
      kind: 'leased',
      leaseId: '00000000-0000-4000-8000-000000000001',
   });
});

test('an expired lease is stalled and is never reclaimable', () => {
   const expired = row({
      token_expires_at: new Date(NOW - 1).toISOString(),
      refresh_lease_id: '00000000-0000-4000-8000-000000000002',
      refresh_lease_expires_at: new Date(NOW - 1).toISOString(),
   });
   assert.deepEqual(classifyConnectionToken(expired, NOW), {
      kind: 'stalled',
      leaseId: '00000000-0000-4000-8000-000000000002',
   });

   const noExpiry = row({
      token_expires_at: new Date(NOW - 1).toISOString(),
      refresh_lease_id: '00000000-0000-4000-8000-000000000003',
      refresh_lease_expires_at: null,
   });
   assert.equal(classifyConnectionToken(noExpiry, NOW).kind, 'stalled');
});

test('a usable access token wins over a leftover lease', () => {
   const leasedButFresh = row({
      refresh_lease_id: '00000000-0000-4000-8000-000000000004',
      refresh_lease_expires_at: new Date(NOW + 15_000).toISOString(),
   });
   assert.equal(classifyConnectionToken(leasedButFresh, NOW).kind, 'usable');
});
