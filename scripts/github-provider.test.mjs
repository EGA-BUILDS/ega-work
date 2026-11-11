import assert from 'node:assert/strict';
import test from 'node:test';

import {
   GITHUB_API_ORIGIN,
   GITHUB_API_VERSION,
   GITHUB_OAUTH_TOKEN_URL,
   GithubRequestError,
   classifyGithubStatus,
   exchangeAuthorizationCode,
   fetchPullRequest,
   listUserInstallations,
   parsePullRequest,
   pullRequestApiPath,
   refreshAccessToken,
} from '../lib/work/github/provider.ts';

const REFERENCE = { owner: 'ega-builds', repo: 'ega-work', number: 12 };

function jsonResponse(value, init = {}) {
   return new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      ...init,
   });
}

function errorResponse(status, headers = {}) {
   return new Response('{"message":"provider details must not leak"}', {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
   });
}

async function expectFailure(fn, failure) {
   await assert.rejects(fn, (error) => {
      assert.ok(error instanceof GithubRequestError, 'expected a provider error');
      assert.equal(error.failure, failure);
      assert.equal(error.message, failure);
      return true;
   });
}

test('pull request normalization covers open, closed, and merged', () => {
   const base = { number: 12, title: '  A change  ', html_url: 'https://evil.example/click' };

   assert.equal(
      parsePullRequest({ ...base, state: 'open', merged_at: null }, REFERENCE).state,
      'open'
   );
   assert.equal(
      parsePullRequest({ ...base, state: 'closed', merged_at: null }, REFERENCE).state,
      'closed'
   );
   assert.equal(
      parsePullRequest({ ...base, state: 'closed', merged_at: '2026-01-01T00:00:00Z' }, REFERENCE)
         .state,
      'merged'
   );

   const normalized = parsePullRequest({ ...base, state: 'open', merged_at: null }, REFERENCE);
   assert.equal(normalized.title, 'A change');
   assert.equal(normalized.url, 'https://github.com/ega-builds/ega-work/pull/12');
   assert.equal(normalized.number, 12);
});

test('pull request normalization rejects mismatched or malformed payloads', () => {
   const base = { number: 12, title: 'A change' };
   for (const value of [
      { ...base, number: 13, state: 'open' },
      { ...base, state: 'draft' },
      { ...base, state: undefined },
      { ...base, state: 'open', title: '   ' },
      { ...base, state: 'open', title: 42 },
      null,
      'text',
   ]) {
      assert.throws(() => parsePullRequest(value, REFERENCE), GithubRequestError);
   }
});

test('HTTP status mapping uses the fixed taxonomy', () => {
   assert.equal(classifyGithubStatus(401), 'reauthorization_required');
   assert.equal(classifyGithubStatus(403), 'denied');
   assert.equal(
      classifyGithubStatus(403, new Headers({ 'x-ratelimit-remaining': '0' })),
      'rate_limited'
   );
   assert.equal(classifyGithubStatus(403, new Headers({ 'retry-after': '30' })), 'rate_limited');
   assert.equal(classifyGithubStatus(404), 'not_found');
   assert.equal(classifyGithubStatus(429), 'rate_limited');
   assert.equal(classifyGithubStatus(500), 'outage');
   assert.equal(classifyGithubStatus(503), 'outage');
   assert.equal(classifyGithubStatus(400), 'denied');
});

test('provider requests use hardcoded GitHub hosts and the bearer token', async () => {
   const calls = [];
   const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ number: 12, title: 'A change', state: 'open', merged_at: null });
   };

   await fetchPullRequest('ghu_token', REFERENCE, { fetchImpl });

   assert.equal(calls.length, 1);
   assert.equal(calls[0].url, `${GITHUB_API_ORIGIN}/repos/ega-builds/ega-work/pulls/12`);
   assert.equal(new Headers(calls[0].init.headers).get('Authorization'), 'Bearer ghu_token');
   assert.equal(new Headers(calls[0].init.headers).get('X-GitHub-Api-Version'), GITHUB_API_VERSION);
   assert.equal(GITHUB_API_VERSION, '2026-03-10');
   assert.equal(pullRequestApiPath(REFERENCE), '/repos/ega-builds/ega-work/pulls/12');
});

test('authorization-code exchange posts PKCE fields to the fixed token host', async () => {
   const calls = [];
   const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
         access_token: 'ghu_access',
         expires_in: 28800,
         refresh_token: 'ghr_refresh',
         refresh_token_expires_in: 15897600,
      });
   };

   const tokens = await exchangeAuthorizationCode(
      {
         clientId: 'Iv1.example',
         clientSecret: 'secret-value',
         code: 'code-value',
         redirectUri: 'https://work.example/api/github/callback',
         codeVerifier: 'verifier-value',
      },
      { fetchImpl }
   );

   assert.equal(calls[0].url, GITHUB_OAUTH_TOKEN_URL);
   assert.equal(calls[0].init.method, 'POST');
   assert.equal(
      new Headers(calls[0].init.headers).get('Content-Type'),
      'application/x-www-form-urlencoded'
   );

   const body = new URLSearchParams(calls[0].init.body);
   assert.equal(body.get('code_verifier'), 'verifier-value');
   assert.equal(body.get('redirect_uri'), 'https://work.example/api/github/callback');
   assert.equal(body.get('client_secret'), 'secret-value');

   assert.equal(tokens.accessToken, 'ghu_access');
   assert.equal(tokens.refreshToken, 'ghr_refresh');
   assert.ok(tokens.accessTokenExpiresAt instanceof Date);
});

test('refresh posts a single-use rotation request', async () => {
   const calls = [];
   const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
         access_token: 'ghu_new',
         expires_in: 28800,
         refresh_token: 'ghr_new',
         refresh_token_expires_in: 15897600,
      });
   };

   const tokens = await refreshAccessToken(
      { clientId: 'Iv1.example', clientSecret: 'secret', refreshToken: 'ghr_old' },
      { fetchImpl }
   );

   const body = new URLSearchParams(calls[0].init.body);
   assert.equal(body.get('grant_type'), 'refresh_token');
   assert.equal(body.get('refresh_token'), 'ghr_old');
   assert.equal(tokens.accessToken, 'ghu_new');
   assert.equal(tokens.refreshToken, 'ghr_new');
});

test('authorization failures map without echoing provider text', async () => {
   await expectFailure(
      () =>
         exchangeAuthorizationCode(
            {
               clientId: 'Iv1.example',
               clientSecret: 'secret',
               code: 'bad',
               redirectUri: 'https://work.example/api/github/callback',
               codeVerifier: 'verifier',
            },
            {
               fetchImpl: async () =>
                  jsonResponse({
                     error: 'bad_verification_code',
                     error_description: 'secret detail',
                  }),
            }
         ),
      'reauthorization_required'
   );

   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            fetchImpl: async () => errorResponse(401),
         }),
      'reauthorization_required'
   );

   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            fetchImpl: async () => errorResponse(403),
         }),
      'denied'
   );

   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            fetchImpl: async () => errorResponse(429),
         }),
      'rate_limited'
   );

   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            fetchImpl: async () => errorResponse(404),
         }),
      'not_found'
   );

   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            fetchImpl: async () => errorResponse(500),
         }),
      'outage'
   );
});

test('network errors and timeouts become an outage', async () => {
   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            fetchImpl: async () => {
               throw new Error('network down');
            },
         }),
      'outage'
   );

   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            timeoutMs: 5,
            fetchImpl: (_url, init) =>
               new Promise((_resolve, reject) => {
                  init.signal.addEventListener('abort', () => reject(new Error('aborted')));
               }),
         }),
      'outage'
   );
});

test('response bodies are capped at the configured size', async () => {
   await expectFailure(
      () =>
         fetchPullRequest('ghu_token', REFERENCE, {
            maxBytes: 10,
            fetchImpl: async () => jsonResponse({ number: 12, title: 'A change', state: 'open' }),
         }),
      'outage'
   );
});

test('installation pagination is bounded at ten pages of 100', async () => {
   let calls = 0;
   const pages = [];
   const fetchImpl = async (url) => {
      calls += 1;
      pages.push(url);
      const page = Number(new URL(url).searchParams.get('page'));
      return jsonResponse({
         total_count: 1000,
         installations: Array.from({ length: 100 }, (_, index) => ({
            id: page * 1000 + index + 1,
            account: { login: 'octocat', type: 'User' },
            repository_selection: 'all',
         })),
      });
   };

   const installations = await listUserInstallations('ghu_token', { fetchImpl });

   assert.equal(calls, 10);
   assert.equal(installations.length, 1000);
   assert.match(pages[0], /^https:\/\/api\.github\.com\/user\/installations\?per_page=100&page=1$/);

   let shortCalls = 0;
   const short = await listUserInstallations('ghu_token', {
      fetchImpl: async () => {
         shortCalls += 1;
         return jsonResponse({
            total_count: 3,
            installations: [
               { id: 1, account: { login: 'a', type: 'User' }, repository_selection: 'all' },
               { id: 2, account: { login: 'b', type: 'User' }, repository_selection: 'all' },
               { id: 3, account: { login: 'c', type: 'User' }, repository_selection: 'all' },
            ],
         });
      },
   });
   assert.equal(shortCalls, 1);
   assert.equal(short.length, 3);
});
