import assert from 'node:assert/strict';
import test from 'node:test';

import {
   GITHUB_API_ORIGIN,
   GITHUB_OAUTH_AUTHORIZE_URL,
   GITHUB_OAUTH_TOKEN_URL,
   githubAppInstallUrl,
   readGithubConfig,
} from '../lib/work/github/config.ts';

const KEY = Buffer.alloc(32, 3).toString('base64');

function baseEnv(overrides = {}) {
   return {
      GITHUB_APP_CLIENT_ID: 'Iv1.abc12345',
      GITHUB_APP_CLIENT_SECRET: '0123456789abcdef0123456789abcdef01234567',
      GITHUB_APP_SLUG: 'ega-work',
      WORK_TOKEN_ENCRYPTION_KEY: KEY,
      WORK_GITHUB_DATABASE_URL: 'postgresql://work_github_login:secret@db.example:5432/postgres',
      ...overrides,
   };
}

test('complete configuration is accepted and decoded', () => {
   const result = readGithubConfig(baseEnv());
   assert.equal(result.configured, true);
   assert.equal(result.config.clientId, 'Iv1.abc12345');
   assert.equal(result.config.appSlug, 'ega-work');
   assert.equal(result.config.tokenEncryptionKey.length, 32);
   assert.equal(result.config.databaseCa, null);
});

test('a missing piece disables the integration instead of throwing', () => {
   for (const name of [
      'GITHUB_APP_CLIENT_ID',
      'GITHUB_APP_CLIENT_SECRET',
      'GITHUB_APP_SLUG',
      'WORK_TOKEN_ENCRYPTION_KEY',
      'WORK_GITHUB_DATABASE_URL',
   ]) {
      const result = readGithubConfig(baseEnv({ [name]: '' }));
      assert.deepEqual(result, { configured: false, reason: 'missing' });
   }

   assert.deepEqual(readGithubConfig({}), { configured: false, reason: 'missing' });
   assert.deepEqual(readGithubConfig({ GITHUB_APP_CLIENT_ID: '   ' }), {
      configured: false,
      reason: 'missing',
   });
});

test('malformed encryption keys fail closed', () => {
   for (const value of [
      'not base64 ***',
      'YQ==',
      Buffer.alloc(31, 1).toString('base64'),
      Buffer.alloc(33, 1).toString('base64'),
      `${KEY.slice(0, 10)} ${KEY.slice(10)}`,
   ]) {
      const result = readGithubConfig(baseEnv({ WORK_TOKEN_ENCRYPTION_KEY: value }));
      assert.deepEqual(result, { configured: false, reason: 'invalid' });
   }
});

test('malformed identifiers, slugs, and database URLs fail closed', () => {
   const invalid = [
      { GITHUB_APP_CLIENT_ID: 'short' },
      { GITHUB_APP_CLIENT_ID: 'has spaces in it' },
      { GITHUB_APP_CLIENT_SECRET: 'too-short' },
      { GITHUB_APP_SLUG: '-bad' },
      { GITHUB_APP_SLUG: 'bad-' },
      { GITHUB_APP_SLUG: 'bad slug' },
      { WORK_GITHUB_DATABASE_URL: 'http://db.example/postgres' },
      { WORK_GITHUB_DATABASE_URL: 'mysql://user:pass@db.example/db' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql:///postgres' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@/postgres' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example/' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example/db?sslmode=disable' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example/db?sslmode=no-verify' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example/db?host=evil.example' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example/db?user=postgres' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example/db#fragment' },
      { WORK_GITHUB_DATABASE_URL: 'postgresql://user:pass@db.example/db with space' },
      { WORK_GITHUB_DATABASE_URL: 'not a url' },
   ];

   for (const override of invalid) {
      const result = readGithubConfig(baseEnv(override));
      assert.equal(result.configured, false, JSON.stringify(override));
      assert.equal(result.reason, 'invalid', JSON.stringify(override));
   }
});

test('an optional database CA must be valid base64', () => {
   const accepted = readGithubConfig(
      baseEnv({ WORK_GITHUB_DATABASE_CA_BASE64: Buffer.from('certificate').toString('base64') })
   );
   assert.equal(accepted.configured, true);
   assert.equal(accepted.config.databaseCa, 'certificate');

   const rejected = readGithubConfig(baseEnv({ WORK_GITHUB_DATABASE_CA_BASE64: '***' }));
   assert.deepEqual(rejected, { configured: false, reason: 'invalid' });
});

test('fixed provider hosts and install URL are not configurable', () => {
   assert.equal(GITHUB_OAUTH_AUTHORIZE_URL, 'https://github.com/login/oauth/authorize');
   assert.equal(GITHUB_OAUTH_TOKEN_URL, 'https://github.com/login/oauth/access_token');
   assert.equal(GITHUB_API_ORIGIN, 'https://api.github.com');

   const result = readGithubConfig(baseEnv());
   assert.equal(
      githubAppInstallUrl(result.config),
      'https://github.com/apps/ega-work/installations/new'
   );
});
