import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidEmail, normalizeEmail } from '../lib/auth/email.ts';
import { loginPath, safeNextPath } from '../lib/auth/redirect.ts';
import { isTrustedRequestOrigin } from '../lib/auth/request-origin.ts';
import { resolveSiteOrigin } from '../lib/auth/site-origin.ts';
import { readSupabaseConfig } from '../lib/supabase/config.ts';

test('safeNextPath keeps internal destinations with query and hash', () => {
   assert.equal(safeNextPath('/me'), '/me');
   assert.equal(safeNextPath('/projects/7?tab=issues#top'), '/projects/7?tab=issues#top');
   assert.equal(safeNextPath('  /inbox  '), '/inbox');
   assert.equal(safeNextPath(null), '/me');
   assert.equal(safeNextPath(undefined), '/me');
   assert.equal(safeNextPath(''), '/me');
});

test('safeNextPath rejects open redirects, control characters, and auth loops', () => {
   const unsafe = [
      'https://evil.example',
      'http://evil.example/path',
      '//evil.example',
      '///evil.example',
      '/..//evil.example',
      '/.//evil.example',
      '/a/..//evil.example',
      '/%2e%2e//evil.example',
      '/\\evil.example',
      '\\evil.example',
      'javascript:alert(1)',
      '/inbox\nLocation: https://evil.example',
      '/login',
      '/login?next=/me',
      '/auth',
      '/auth/callback',
      '/auth/signout',
   ];

   for (const value of unsafe) {
      assert.equal(safeNextPath(value), '/me', `${value} must not escape the app`);
   }
});

test('loginPath only carries a safe internal return path', () => {
   assert.equal(loginPath(undefined), '/login');
   assert.equal(loginPath('/me'), '/login');
   assert.equal(loginPath('/projects/7?tab=issues'), '/login?next=%2Fprojects%2F7%3Ftab%3Dissues');
   assert.equal(loginPath('https://evil.example'), '/login');
});

test('email validation normalizes and rejects malformed addresses', () => {
   assert.equal(normalizeEmail('  Person@Example.COM  '), 'person@example.com');
   assert.equal(normalizeEmail(null), '');
   assert.equal(isValidEmail('person@example.com'), true);
   assert.equal(isValidEmail('person+tag@example.co.uk'), true);
   assert.equal(isValidEmail('person@example'), false);
   assert.equal(isValidEmail('person example@example.com'), false);
   assert.equal(isValidEmail(''), false);
   assert.equal(isValidEmail(`person@${'a'.repeat(250)}.com`), false);
});

test('readSupabaseConfig returns missing and invalid states', () => {
   assert.deepEqual(readSupabaseConfig({}), { ok: false, reason: 'missing' });
   assert.deepEqual(
      readSupabaseConfig({
         NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      }),
      { ok: false, reason: 'missing' }
   );
   assert.deepEqual(
      readSupabaseConfig({
         NEXT_PUBLIC_SUPABASE_URL: 'ftp://abc.supabase.co',
         NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
      { ok: false, reason: 'invalid' }
   );
   assert.deepEqual(
      readSupabaseConfig({
         NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/rest/v1',
         NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
      { ok: false, reason: 'invalid' }
   );
   assert.deepEqual(
      readSupabaseConfig({
         NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
         NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon key with spaces',
      }),
      { ok: false, reason: 'invalid' }
   );
});

test('readSupabaseConfig prefers runtime server names and normalizes the URL', () => {
   assert.equal(
      readSupabaseConfig({
         NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
         NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }).ok,
      true
   );
   assert.deepEqual(
      readSupabaseConfig({
         SUPABASE_URL: 'https://runtime.supabase.co/',
         SUPABASE_ANON_KEY: 'runtime-key',
         NEXT_PUBLIC_SUPABASE_URL: 'https://public.supabase.co',
         NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
      }),
      {
         ok: true,
         config: { url: 'https://runtime.supabase.co', anonKey: 'runtime-key' },
      }
   );

   assert.deepEqual(
      readSupabaseConfig({
         NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/',
         NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
      {
         ok: true,
         config: { url: 'https://abc.supabase.co', anonKey: 'anon-key' },
      }
   );
});

test('resolveSiteOrigin prefers a configured origin and fails closed when malformed', () => {
   assert.deepEqual(
      resolveSiteOrigin({
         configured: 'https://ega.work/',
         host: 'evil.example',
      }),
      { ok: true, origin: 'https://ega.work', source: 'configured' }
   );

   assert.deepEqual(resolveSiteOrigin({ configured: 'https://ega.work/path' }), {
      ok: false,
      reason: 'invalid_configured',
   });

   assert.deepEqual(resolveSiteOrigin({ configured: 'javascript:alert(1)' }), {
      ok: false,
      reason: 'invalid_configured',
   });
});

test('resolveSiteOrigin falls back to validated request headers', () => {
   assert.deepEqual(
      resolveSiteOrigin({
         forwardedHost: 'preview.ega.work, proxy.internal',
         forwardedProto: 'https',
      }),
      { ok: true, origin: 'https://preview.ega.work', source: 'request' }
   );

   assert.deepEqual(
      resolveSiteOrigin({
         host: 'localhost:3000',
         defaultProtocol: 'http',
      }),
      { ok: true, origin: 'http://localhost:3000', source: 'request' }
   );

   assert.deepEqual(resolveSiteOrigin({}), { ok: false, reason: 'missing' });

   assert.deepEqual(resolveSiteOrigin({ forwardedProto: 'ftp', forwardedHost: 'ega.work' }), {
      ok: false,
      reason: 'missing',
   });

   assert.deepEqual(resolveSiteOrigin({ host: 'evil.example/path' }), {
      ok: false,
      reason: 'missing',
   });
});

test('trusted request origins accept direct and proxied same-origin writes', () => {
   const direct = resolveSiteOrigin({ host: '127.0.0.1:3000', defaultProtocol: 'http' });
   assert.equal(
      isTrustedRequestOrigin({
         origin: 'http://127.0.0.1:3000',
         expectedOrigin: direct.ok ? direct.origin : null,
      }),
      true
   );

   const proxied = resolveSiteOrigin({
      forwardedHost: 'app.example.com',
      forwardedProto: 'https',
      host: 'internal:3000',
   });
   assert.equal(
      isTrustedRequestOrigin({
         origin: 'https://app.example.com',
         expectedOrigin: proxied.ok ? proxied.origin : null,
      }),
      true
   );

   const configured = resolveSiteOrigin({ configured: 'https://ega.work' });
   assert.equal(
      isTrustedRequestOrigin({
         origin: 'https://ega.work',
         expectedOrigin: configured.ok ? configured.origin : null,
      }),
      true
   );
   assert.equal(
      isTrustedRequestOrigin({
         origin: null,
         expectedOrigin: configured.ok ? configured.origin : null,
      }),
      true
   );
});

test('trusted request origins reject cross-site, mismatched and unparseable origins', () => {
   const expected = resolveSiteOrigin({ host: '127.0.0.1:3000', defaultProtocol: 'http' });
   const expectedOrigin = expected.ok ? expected.origin : null;

   assert.equal(
      isTrustedRequestOrigin({
         origin: 'http://127.0.0.1:3000',
         fetchSite: 'cross-site',
         expectedOrigin,
      }),
      false
   );
   assert.equal(isTrustedRequestOrigin({ origin: 'https://evil.example', expectedOrigin }), false);
   assert.equal(isTrustedRequestOrigin({ origin: 'not a url', expectedOrigin }), false);
   assert.equal(
      isTrustedRequestOrigin({ origin: 'https://ega.work', expectedOrigin: null }),
      false
   );
});
