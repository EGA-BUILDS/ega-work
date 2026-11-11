import type { PullRequestReference } from './url';

export const GITHUB_API_ORIGIN = 'https://api.github.com';
export const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
// Pinned to the REST API version documented when this integration was written;
// GitHub keeps named versions available so a future default cannot change the
// pull-request payload under the app.
export const GITHUB_API_VERSION = '2026-03-10';

export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 1024 * 1024;
export const MAX_PAGES = 10;
export const PAGE_SIZE = 100;

export type GithubFailure =
   | 'reauthorization_required'
   | 'rate_limited'
   | 'outage'
   | 'not_found'
   | 'denied';

export class GithubRequestError extends Error {
   readonly failure: GithubFailure;

   constructor(failure: GithubFailure) {
      super(failure);
      this.name = 'GithubRequestError';
      this.failure = failure;
   }
}

export type ProviderOptions = Readonly<{
   fetchImpl?: typeof fetch;
   timeoutMs?: number;
   maxBytes?: number;
   maxPages?: number;
}>;

export type GithubViewer = Readonly<{ id: string; login: string }>;

export type GithubInstallation = Readonly<{
   id: string;
   accountLogin: string;
   accountType: 'User' | 'Organization' | 'Enterprise' | 'Unknown';
   repositorySelection: string | null;
}>;

export type GithubRepository = Readonly<{
   owner: string;
   name: string;
   fullName: string;
}>;

export type GithubPullRequest = Readonly<{
   number: number;
   title: string;
   state: 'open' | 'closed' | 'merged';
   url: string;
}>;

export type GithubTokens = Readonly<{
   accessToken: string;
   accessTokenExpiresAt: Date | null;
   refreshToken: string | null;
   refreshTokenExpiresAt: Date | null;
}>;

export const LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_TITLE_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | null {
   return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function validLogin(value: unknown): value is string {
   return (
      typeof value === 'string' &&
      LOGIN_PATTERN.test(value) &&
      !value.endsWith('-') &&
      !value.includes('--')
   );
}

function validRepository(value: unknown): value is string {
   return (
      typeof value === 'string' &&
      REPOSITORY_PATTERN.test(value) &&
      value !== '.' &&
      value !== '..' &&
      !value.endsWith('.')
   );
}

export function classifyGithubStatus(status: number, headers?: Headers): GithubFailure {
   if (status === 401) {
      return 'reauthorization_required';
   }
   if (status === 403) {
      const remaining = headers?.get('x-ratelimit-remaining');
      const retryAfter = headers?.get('retry-after');
      return remaining === '0' || retryAfter ? 'rate_limited' : 'denied';
   }
   if (status === 404) {
      return 'not_found';
   }
   if (status === 429) {
      return 'rate_limited';
   }
   if (status >= 500) {
      return 'outage';
   }
   return 'denied';
}

async function readCappedBody(response: Response, maxBytes: number): Promise<string> {
   const body = response.body;
   if (!body) {
      return '';
   }

   const reader = body.getReader();
   const chunks: Uint8Array[] = [];
   let total = 0;

   try {
      for (;;) {
         const { done, value } = await reader.read();
         if (done) {
            break;
         }
         total += value.byteLength;
         if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new GithubRequestError('outage');
         }
         chunks.push(value);
      }
   } finally {
      reader.releaseLock();
   }

   return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

type RequestInput = Readonly<{
   url: string;
   init: RequestInit;
}>;

async function performRequest(
   { url, init }: RequestInput,
   options: ProviderOptions,
   readBody: boolean
): Promise<{ response: Response; text: string }> {
   if (
      !url.startsWith(`${GITHUB_API_ORIGIN}/`) &&
      url !== GITHUB_OAUTH_TOKEN_URL &&
      !url.startsWith(`${GITHUB_OAUTH_TOKEN_URL}?`)
   ) {
      throw new GithubRequestError('denied');
   }

   const fetchImpl = options.fetchImpl ?? fetch;
   const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
   const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), timeoutMs);

   try {
      let response: Response;
      try {
         response = await fetchImpl(url, { ...init, signal: controller.signal });
      } catch {
         throw new GithubRequestError('outage');
      }

      if (!response.ok) {
         throw new GithubRequestError(classifyGithubStatus(response.status, response.headers));
      }

      if (!readBody) {
         return { response, text: '' };
      }

      const text = await readCappedBody(response, maxBytes).catch((error: unknown) => {
         if (error instanceof GithubRequestError) {
            throw error;
         }
         throw new GithubRequestError('outage');
      });

      return { response, text };
   } finally {
      clearTimeout(timer);
   }
}

async function requestJson(
   url: string,
   init: RequestInit,
   options: ProviderOptions
): Promise<unknown> {
   const { text } = await performRequest({ url, init }, options, true);
   try {
      return JSON.parse(text) as unknown;
   } catch {
      throw new GithubRequestError('outage');
   }
}

function apiHeaders(token: string): Record<string, string> {
   return {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'ega-work',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
   };
}

function getApi<T>(
   path: string,
   token: string,
   options: ProviderOptions,
   parse: (value: unknown) => T
): Promise<T> {
   return requestJson(
      `${GITHUB_API_ORIGIN}${path}`,
      { method: 'GET', headers: apiHeaders(token), cache: 'no-store' },
      options
   ).then(parse);
}

async function listPages(
   path: string,
   field: string,
   token: string,
   options: ProviderOptions
): Promise<unknown[]> {
   const maxPages = options.maxPages ?? MAX_PAGES;
   const items: unknown[] = [];

   for (let page = 1; page <= maxPages; page += 1) {
      const data = await getApi(
         `${path}?per_page=${PAGE_SIZE}&page=${page}`,
         token,
         options,
         (value) => value
      );
      if (!isRecord(data)) {
         throw new GithubRequestError('outage');
      }
      const array = data[field];
      if (!Array.isArray(array)) {
         throw new GithubRequestError('outage');
      }
      items.push(...array);
      if (array.length < PAGE_SIZE) {
         break;
      }
   }

   return items;
}

export function parseViewer(value: unknown): GithubViewer {
   if (!isRecord(value)) {
      throw new GithubRequestError('outage');
   }
   const id = positiveInteger(value.id);
   if (id === null || !validLogin(value.login)) {
      throw new GithubRequestError('outage');
   }
   return { id: String(id), login: value.login };
}

export function fetchViewer(token: string, options: ProviderOptions = {}): Promise<GithubViewer> {
   return getApi('/user', token, options, parseViewer);
}

function parseInstallation(value: unknown): GithubInstallation {
   if (!isRecord(value) || !isRecord(value.account)) {
      throw new GithubRequestError('outage');
   }
   const id = positiveInteger(value.id);
   const login = value.account.login;
   if (id === null || !validLogin(login)) {
      throw new GithubRequestError('outage');
   }

   const type = value.account.type;
   return {
      id: String(id),
      accountLogin: login,
      accountType:
         type === 'User' || type === 'Organization' || type === 'Enterprise' ? type : 'Unknown',
      repositorySelection:
         typeof value.repository_selection === 'string' ? value.repository_selection : null,
   };
}

export async function listUserInstallations(
   token: string,
   options: ProviderOptions = {}
): Promise<GithubInstallation[]> {
   const items = await listPages('/user/installations', 'installations', token, options);
   return items.map(parseInstallation);
}

function parseRepository(value: unknown): GithubRepository {
   if (!isRecord(value) || !isRecord(value.owner)) {
      throw new GithubRequestError('outage');
   }
   const owner = value.owner.login;
   const name = value.name;
   if (!validLogin(owner) || !validRepository(name)) {
      throw new GithubRequestError('outage');
   }
   return { owner: owner.toLowerCase(), name: name.toLowerCase(), fullName: `${owner}/${name}` };
}

export async function listInstallationRepositories(
   token: string,
   installationId: string,
   options: ProviderOptions = {}
): Promise<GithubRepository[]> {
   if (!/^[1-9][0-9]{0,18}$/.test(installationId)) {
      throw new GithubRequestError('denied');
   }
   const items = await listPages(
      `/user/installations/${installationId}/repositories`,
      'repositories',
      token,
      options
   );
   return items.map(parseRepository);
}

export function pullRequestApiPath(reference: PullRequestReference): string {
   return `/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(
      reference.repo
   )}/pulls/${reference.number}`;
}

export function parsePullRequest(
   value: unknown,
   reference: PullRequestReference
): GithubPullRequest {
   if (!isRecord(value)) {
      throw new GithubRequestError('outage');
   }
   if (value.number !== reference.number || typeof value.title !== 'string') {
      throw new GithubRequestError('outage');
   }

   const merged = value.merged_at !== null && value.merged_at !== undefined;
   const state =
      merged || value.state === 'closed'
         ? merged
            ? 'merged'
            : 'closed'
         : value.state === 'open'
           ? 'open'
           : null;
   if (!state) {
      throw new GithubRequestError('outage');
   }

   const title = value.title.trim().slice(0, MAX_TITLE_LENGTH);
   if (!title) {
      throw new GithubRequestError('outage');
   }

   return {
      number: reference.number,
      title,
      state,
      url: `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}`,
   };
}

export function fetchPullRequest(
   token: string,
   reference: PullRequestReference,
   options: ProviderOptions = {}
): Promise<GithubPullRequest> {
   return getApi(pullRequestApiPath(reference), token, options, (value) =>
      parsePullRequest(value, reference)
   );
}

function parseTokenResponse(value: unknown): GithubTokens {
   if (!isRecord(value)) {
      throw new GithubRequestError('outage');
   }

   if (typeof value.access_token !== 'string' || !value.access_token) {
      const error = value.error;
      if (
         error === 'bad_verification_code' ||
         error === 'invalid_grant' ||
         error === 'expired_token'
      ) {
         throw new GithubRequestError('reauthorization_required');
      }
      if (typeof error === 'string') {
         throw new GithubRequestError('denied');
      }
      throw new GithubRequestError('outage');
   }

   const now = Date.now();
   const expiresIn = positiveInteger(value.expires_in);
   const refreshExpiresIn = positiveInteger(value.refresh_token_expires_in);
   const refreshToken =
      typeof value.refresh_token === 'string' && value.refresh_token ? value.refresh_token : null;

   return {
      accessToken: value.access_token,
      accessTokenExpiresAt: expiresIn ? new Date(now + expiresIn * 1000) : null,
      refreshToken,
      refreshTokenExpiresAt:
         refreshToken && refreshExpiresIn ? new Date(now + refreshExpiresIn * 1000) : null,
   };
}

async function postToken(body: URLSearchParams, options: ProviderOptions): Promise<GithubTokens> {
   const value = await requestJson(
      GITHUB_OAUTH_TOKEN_URL,
      {
         method: 'POST',
         headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'ega-work',
         },
         body: body.toString(),
         cache: 'no-store',
      },
      options
   );
   return parseTokenResponse(value);
}

export function exchangeAuthorizationCode(
   input: Readonly<{
      clientId: string;
      clientSecret: string;
      code: string;
      redirectUri: string;
      codeVerifier: string;
   }>,
   options: ProviderOptions = {}
): Promise<GithubTokens> {
   return postToken(
      new URLSearchParams({
         client_id: input.clientId,
         client_secret: input.clientSecret,
         code: input.code,
         redirect_uri: input.redirectUri,
         code_verifier: input.codeVerifier,
      }),
      options
   );
}

export function refreshAccessToken(
   input: Readonly<{
      clientId: string;
      clientSecret: string;
      refreshToken: string;
   }>,
   options: ProviderOptions = {}
): Promise<GithubTokens> {
   return postToken(
      new URLSearchParams({
         grant_type: 'refresh_token',
         refresh_token: input.refreshToken,
         client_id: input.clientId,
         client_secret: input.clientSecret,
      }),
      options
   );
}

/**
 * Best-effort revocation of a user-to-server token. The caller invalidates
 * local state first; a provider failure never restores a usable credential.
 */
export async function revokeAccessToken(
   input: Readonly<{ clientId: string; clientSecret: string; accessToken: string }>,
   options: ProviderOptions = {}
): Promise<boolean> {
   const basic = Buffer.from(`${input.clientId}:${input.clientSecret}`, 'utf8').toString('base64');
   try {
      await performRequest(
         {
            url: `${GITHUB_API_ORIGIN}/applications/${encodeURIComponent(input.clientId)}/token`,
            init: {
               method: 'DELETE',
               headers: {
                  'Accept': 'application/vnd.github+json',
                  'Authorization': `Basic ${basic}`,
                  'Content-Type': 'application/json',
                  'User-Agent': 'ega-work',
                  'X-GitHub-Api-Version': GITHUB_API_VERSION,
               },
               body: JSON.stringify({ access_token: input.accessToken }),
               cache: 'no-store',
            },
         },
         { ...options, timeoutMs: options.timeoutMs ?? 5_000 },
         false
      );
      return true;
   } catch {
      return false;
   }
}
