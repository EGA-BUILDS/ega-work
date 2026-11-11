import 'server-only';

import {
   GITHUB_OAUTH_AUTHORIZE_URL,
   GITHUB_OAUTH_CALLBACK_PATH,
   githubAppInstallUrl,
   readGithubConfig,
   type GithubConfig,
} from './config';
import { decryptSecret, encryptSecret, pkceChallenge, randomToken, sha256Hex } from './crypto';
import { presentInstallation, presentPullRequest, presentStatus } from './present';
import {
   GithubRequestError,
   exchangeAuthorizationCode,
   fetchPullRequest,
   fetchViewer,
   listInstallationRepositories,
   listUserInstallations,
   refreshAccessToken,
   revokeAccessToken,
   type GithubInstallation,
   type GithubPullRequest,
   type GithubRepository,
   type GithubTokens,
   type GithubViewer,
   type ProviderOptions,
} from './provider';
import * as store from './store';
import type {
   GithubConnectionRecord,
   GithubConnectionStatus,
   GithubInstallationView,
   GithubIssueView,
   GithubPullRequestView,
   GithubStatusView,
} from './types';
import { parsePullRequestUrl } from './url';

export type GithubServiceErrorCode =
   | 'unconfigured'
   | 'disconnected'
   | 'reauthorization_required'
   | 'installation_unavailable'
   | 'not_found'
   | 'rate_limited'
   | 'outage'
   | 'denied'
   | 'conflict'
   | 'invalid_input';

export class GithubServiceError extends Error {
   constructor(readonly code: GithubServiceErrorCode) {
      super(code);
      this.name = 'GithubServiceError';
   }
}

export type GithubActor = Readonly<{ workspaceId: string; userId: string }>;

const STATE_TTL_MS = 10 * 60 * 1000;

function fail(code: GithubServiceErrorCode): never {
   throw new GithubServiceError(code);
}

function requireConfig(): GithubConfig {
   const result = readGithubConfig();
   if (!result.configured) {
      return fail('unconfigured');
   }
   return result.config;
}

function normalizeOrigin(origin: string): string {
   let url: URL;
   try {
      url = new URL(origin);
   } catch {
      return fail('invalid_input');
   }
   if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
   ) {
      return fail('invalid_input');
   }
   return url.origin;
}

function callbackUrl(origin: string): string {
   return new URL(GITHUB_OAUTH_CALLBACK_PATH, `${origin}/`).toString();
}

function decryptAccess(config: GithubConfig, row: GithubConnectionRecord): string | null {
   return decryptSecret(config.tokenEncryptionKey, {
      ciphertext: row.token_ciphertext ?? '',
      iv: row.token_iv ?? '',
      tag: row.token_tag ?? '',
   });
}

function providerCode(error: unknown): GithubServiceErrorCode {
   if (!(error instanceof GithubRequestError)) {
      return 'outage';
   }
   switch (error.failure) {
      case 'reauthorization_required':
         return 'reauthorization_required';
      case 'rate_limited':
         return 'rate_limited';
      case 'not_found':
         return 'not_found';
      case 'denied':
         return 'denied';
      default:
         return 'outage';
   }
}

async function broken(config: GithubConfig, actor: GithubActor, generation: number): Promise<void> {
   await store
      .markConnectionBroken(config, {
         workspaceId: actor.workspaceId,
         userId: actor.userId,
         generation,
      })
      .catch(() => {});
}

type AuthorizedToken = Readonly<{
   token: string;
   generation: number;
   row: GithubConnectionRecord;
}>;

/**
 * Returns a usable user-to-server access token. An expiring token is refreshed
 * through a durable single-winner lease; a consumed refresh token is never
 * retried. Definitive authorization failures make the connection unusable.
 */
async function authorizedToken(
   config: GithubConfig,
   actor: GithubActor,
   providerOptions: ProviderOptions = {}
): Promise<AuthorizedToken> {
   const claim = await store.claimTokenRefresh(config, actor.workspaceId);

   if (claim.kind === 'fresh') {
      const token = decryptAccess(config, claim.row);
      if (!token) {
         await broken(config, actor, claim.row.connection_generation);
         fail('reauthorization_required');
      }
      return { token, generation: claim.row.connection_generation, row: claim.row };
   }

   if (claim.kind === 'leased') {
      const reread = await store.readConnection(config, actor.workspaceId);
      if (reread && !reread.revoked_at) {
         const token = decryptAccess(config, reread);
         if (token) {
            return { token, generation: reread.connection_generation, row: reread };
         }
      }
      fail('conflict');
   }

   if (claim.kind === 'unusable') {
      const reread = await store.readConnection(config, actor.workspaceId);
      if (!reread || reread.revoked_at) {
         fail('disconnected');
      }
      await broken(config, actor, reread.connection_generation);
      fail('reauthorization_required');
   }

   const refreshToken = decryptSecret(config.tokenEncryptionKey, {
      ciphertext: claim.row.refresh_token_ciphertext ?? '',
      iv: claim.row.refresh_token_iv ?? '',
      tag: claim.row.refresh_token_tag ?? '',
   });
   if (!refreshToken) {
      await store.releaseTokenLease(config, actor.workspaceId, claim.leaseId);
      await broken(config, actor, claim.row.connection_generation);
      fail('reauthorization_required');
   }

   let tokens;
   try {
      tokens = await refreshAccessToken(
         {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            refreshToken,
         },
         providerOptions
      );
   } catch (error) {
      await store.releaseTokenLease(config, actor.workspaceId, claim.leaseId);
      if (
         error instanceof GithubRequestError &&
         (error.failure === 'reauthorization_required' || error.failure === 'denied')
      ) {
         await broken(config, actor, claim.row.connection_generation);
         fail('reauthorization_required');
      }
      fail(providerCode(error));
   }

   const access = encryptSecret(config.tokenEncryptionKey, tokens.accessToken);
   const refresh = tokens.refreshToken
      ? encryptSecret(config.tokenEncryptionKey, tokens.refreshToken)
      : {
           ciphertext: claim.row.refresh_token_ciphertext ?? '',
           iv: claim.row.refresh_token_iv ?? '',
           tag: claim.row.refresh_token_tag ?? '',
        };

   const finalized = await store.finalizeTokenRefresh(config, {
      workspaceId: actor.workspaceId,
      generation: claim.row.connection_generation,
      tokenVersion: claim.row.token_version,
      leaseId: claim.leaseId,
      accessCiphertext: access.ciphertext,
      accessIv: access.iv,
      accessTag: access.tag,
      accessExpiresAt: tokens.accessTokenExpiresAt,
      refreshCiphertext: refresh.ciphertext,
      refreshIv: refresh.iv,
      refreshTag: refresh.tag,
      refreshExpiresAt: tokens.refreshToken
         ? tokens.refreshTokenExpiresAt
         : claim.row.refresh_token_expires_at
           ? new Date(claim.row.refresh_token_expires_at)
           : null,
   });

   if (!finalized) {
      const reread = await store.readConnection(config, actor.workspaceId);
      if (reread && !reread.revoked_at) {
         const token = decryptAccess(config, reread);
         if (token) {
            return { token, generation: reread.connection_generation, row: reread };
         }
      }
      fail('conflict');
   }

   const token = decryptAccess(config, finalized);
   if (!token) {
      await broken(config, actor, finalized.connection_generation);
      fail('reauthorization_required');
   }
   return { token, generation: finalized.connection_generation, row: finalized };
}

/**
 * Confirms that the selected App installation lists the repository before the
 * workspace stores or displays PR metadata. This is a bounded enumeration of
 * `GET /user/installations/{id}/repositories`; the later PR read uses the same
 * user-to-server token.
 */
async function requireInstallationRepository(
   config: GithubConfig,
   actor: GithubActor,
   authorized: AuthorizedToken,
   owner: string,
   repo: string
): Promise<void> {
   const installationId = authorized.row.installation_id;
   if (installationId === null) {
      fail('installation_unavailable');
   }

   let repositories: GithubRepository[];
   try {
      repositories = await listInstallationRepositories(authorized.token, String(installationId));
   } catch (error) {
      if (error instanceof GithubRequestError) {
         if (error.failure === 'reauthorization_required') {
            await broken(config, actor, authorized.generation);
            fail('reauthorization_required');
         }
         if (error.failure === 'denied' || error.failure === 'not_found') {
            fail('installation_unavailable');
         }
      }
      fail(providerCode(error));
   }

   if (!repositories.some((repository) => repository.owner === owner && repository.name === repo)) {
      fail('installation_unavailable');
   }
}

export async function getGithubStatus(workspaceId: string): Promise<GithubStatusView> {
   const result = readGithubConfig();
   if (!result.configured) {
      return presentStatus(false, null);
   }

   try {
      const row = await store.readConnection(result.config, workspaceId);
      return presentStatus(true, row);
   } catch {
      return presentStatus(true, null, true);
   }
}

/**
 * Server-rendered view for the issue page. PR metadata is only exposed while
 * the saved connection is usable; a disconnected or unavailable connection
 * shows no stored PR details.
 */
export async function getGithubIssueView(
   workspaceId: string,
   issueId: string
): Promise<GithubIssueView> {
   const result = readGithubConfig();
   if (!result.configured) {
      return { configured: false, status: 'unconfigured', pullRequest: null, installUrl: null };
   }

   const installUrl = githubAppInstallUrl(result.config);
   try {
      const connection = await store.readConnection(result.config, workspaceId);
      const status = presentStatus(true, connection).status;
      if (status !== 'connected') {
         return { configured: true, status, pullRequest: null, installUrl };
      }
      const row = await store.readPullRequest(result.config, workspaceId, issueId);
      return {
         configured: true,
         status,
         pullRequest: presentPullRequest(row),
         installUrl,
      };
   } catch {
      return { configured: true, status: 'unavailable', pullRequest: null, installUrl };
   }
}

export async function startGithubConnect(
   actor: GithubActor,
   origin: string
): Promise<{ url: string }> {
   const config = requireConfig();
   const safeOrigin = normalizeOrigin(origin);

   const connection = await store.readConnection(config, actor.workspaceId);
   const generation = connection?.connection_generation ?? 0;

   const state = randomToken(32);
   const verifier = randomToken(32);
   const encryptedVerifier = encryptSecret(config.tokenEncryptionKey, verifier);

   await store.createOauthState(config, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      stateHash: sha256Hex(state),
      verifierCiphertext: encryptedVerifier.ciphertext,
      verifierIv: encryptedVerifier.iv,
      verifierTag: encryptedVerifier.tag,
      connectionGeneration: generation,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
   });

   const url = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
   url.searchParams.set('client_id', config.clientId);
   url.searchParams.set('redirect_uri', callbackUrl(safeOrigin));
   url.searchParams.set('state', state);
   url.searchParams.set('code_challenge', pkceChallenge(verifier));
   url.searchParams.set('code_challenge_method', 'S256');
   url.searchParams.set('scope', 'offline_access');
   url.searchParams.set('allow_signup', 'false');

   return { url: url.toString() };
}

export type CompleteConnectResult =
   | { ok: true; workspaceId: string; login: string }
   | { ok: false; workspaceId: string | null; code: GithubServiceErrorCode };

/**
 * Completes the authorization callback. The state is consumed atomically
 * before the code is exchanged, so a replay can never create a second
 * connection, and the saved connection is only updated when the generation
 * observed at connect time is still current.
 */
export async function completeGithubConnect(input: {
   userId: string;
   origin: string;
   code: string;
   state: string;
}): Promise<CompleteConnectResult> {
   let workspaceId: string | null = null;
   try {
      if (!input.code || !input.state) {
         fail('denied');
      }

      const config = requireConfig();
      const safeOrigin = normalizeOrigin(input.origin);
      const stateRow = await store.claimOauthState(config, input.userId, sha256Hex(input.state));
      if (!stateRow) {
         fail('denied');
      }
      workspaceId = stateRow.workspace_id;

      const verifier = decryptSecret(config.tokenEncryptionKey, {
         ciphertext: stateRow.code_verifier_ciphertext,
         iv: stateRow.code_verifier_iv,
         tag: stateRow.code_verifier_tag,
      });
      if (!verifier) {
         fail('denied');
      }

      let tokens: GithubTokens;
      try {
         tokens = await exchangeAuthorizationCode({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            code: input.code,
            redirectUri: callbackUrl(safeOrigin),
            codeVerifier: verifier,
         });
      } catch (error) {
         fail(providerCode(error));
      }

      let viewer: GithubViewer;
      try {
         viewer = await fetchViewer(tokens.accessToken);
      } catch (error) {
         fail(providerCode(error));
      }

      const access = encryptSecret(config.tokenEncryptionKey, tokens.accessToken);
      const refresh = tokens.refreshToken
         ? encryptSecret(config.tokenEncryptionKey, tokens.refreshToken)
         : null;

      const saved = await store.saveConnection(config, {
         workspaceId: stateRow.workspace_id,
         stateGeneration: stateRow.connection_generation,
         providerUserId: viewer.id,
         login: viewer.login,
         accessCiphertext: access.ciphertext,
         accessIv: access.iv,
         accessTag: access.tag,
         accessExpiresAt: tokens.accessTokenExpiresAt,
         refreshCiphertext: refresh?.ciphertext ?? null,
         refreshIv: refresh?.iv ?? null,
         refreshTag: refresh?.tag ?? null,
         refreshExpiresAt: tokens.refreshTokenExpiresAt,
      });

      if (saved.kind === 'stale') {
         fail('denied');
      }

      return { ok: true, workspaceId: stateRow.workspace_id, login: viewer.login };
   } catch (error) {
      return {
         ok: false,
         workspaceId,
         code: error instanceof GithubServiceError ? error.code : 'outage',
      };
   }
}

/**
 * Consumes a one-time state row for a denied or cancelled authorization. The
 * workspace is resolved from the stored state, never from the callback query.
 */
export async function consumeGithubState(userId: string, rawState: string): Promise<string | null> {
   if (!rawState) {
      return null;
   }
   try {
      const config = requireConfig();
      const stateRow = await store.claimOauthState(config, userId, sha256Hex(rawState));
      return stateRow?.workspace_id ?? null;
   } catch {
      return null;
   }
}

export async function listGithubInstallations(
   actor: GithubActor
): Promise<GithubInstallationView[]> {
   const config = requireConfig();
   const authorized = await authorizedToken(config, actor);

   try {
      const installations = await listUserInstallations(authorized.token);
      return installations.map(presentInstallation);
   } catch (error) {
      if (error instanceof GithubRequestError && error.failure === 'reauthorization_required') {
         await broken(config, actor, authorized.generation);
         fail('reauthorization_required');
      }
      if (error instanceof GithubRequestError && error.failure === 'denied') {
         fail('installation_unavailable');
      }
      fail(providerCode(error));
   }
}

export async function chooseGithubInstallation(
   actor: GithubActor,
   rawInstallationId: unknown
): Promise<GithubStatusView> {
   const config = requireConfig();
   const installationId =
      typeof rawInstallationId === 'number' && Number.isSafeInteger(rawInstallationId)
         ? rawInstallationId
         : typeof rawInstallationId === 'string' && /^[1-9][0-9]{0,18}$/.test(rawInstallationId)
           ? Number(rawInstallationId)
           : null;
   if (installationId === null || installationId < 1 || !Number.isSafeInteger(installationId)) {
      return fail('invalid_input');
   }

   const authorized = await authorizedToken(config, actor);
   let installations: GithubInstallation[];
   try {
      installations = await listUserInstallations(authorized.token);
   } catch (error) {
      if (error instanceof GithubRequestError && error.failure === 'reauthorization_required') {
         await broken(config, actor, authorized.generation);
         fail('reauthorization_required');
      }
      fail(providerCode(error));
   }

   // A browser-supplied installation id only counts when the verified GitHub
   // enumeration contains it.
   if (!installations.some((installation) => installation.id === String(installationId))) {
      return fail('installation_unavailable');
   }

   const updated = await store.selectInstallation(config, {
      workspaceId: actor.workspaceId,
      installationId,
      generation: authorized.generation,
   });
   if (!updated) {
      return fail('reauthorization_required');
   }

   return presentStatus(true, updated);
}

export async function disconnectGithub(actor: GithubActor): Promise<GithubStatusView> {
   const config = requireConfig();
   const result = await store.disconnectConnection(config, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
   });

   if (result.kind === 'disconnected' && result.previousAccess) {
      const accessToken = decryptSecret(config.tokenEncryptionKey, result.previousAccess);
      if (accessToken) {
         await revokeAccessToken({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            accessToken,
         }).catch(() => false);
      }
   }

   return presentStatus(true, null);
}

export async function linkGithubPullRequest(
   actor: GithubActor,
   issueId: string,
   rawUrl: unknown
): Promise<GithubPullRequestView> {
   const config = requireConfig();
   const parsed = parsePullRequestUrl(rawUrl);
   if (!parsed.ok) {
      return fail('invalid_input');
   }

   const authorized = await authorizedToken(config, actor);
   await requireInstallationRepository(
      config,
      actor,
      authorized,
      parsed.value.owner,
      parsed.value.repo
   );
   let observation: GithubPullRequest;
   try {
      observation = await fetchPullRequest(authorized.token, parsed.value);
   } catch (error) {
      if (error instanceof GithubRequestError) {
         if (error.failure === 'reauthorization_required') {
            await broken(config, actor, authorized.generation);
            fail('reauthorization_required');
         }
         if (error.failure === 'denied') {
            await broken(config, actor, authorized.generation);
            fail('installation_unavailable');
         }
         if (error.failure === 'not_found') {
            fail('not_found');
         }
      }
      fail(providerCode(error));
   }

   const saved = await store.insertPullRequest(config, {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      issueId,
      owner: parsed.value.owner,
      repo: parsed.value.repo,
      number: parsed.value.number,
      url: observation.url,
      title: observation.title,
      state: observation.state,
      generation: authorized.generation,
   });

   if (saved.kind === 'stale') {
      return fail('reauthorization_required');
   }
   if (saved.kind === 'not_found') {
      return fail('not_found');
   }
   if (saved.kind === 'conflict') {
      return fail('conflict');
   }

   const view = presentPullRequest(saved.row);
   if (!view) {
      return fail('conflict');
   }
   return view;
}

export async function refreshGithubPullRequest(
   actor: GithubActor,
   issueId: string
): Promise<GithubPullRequestView> {
   const config = requireConfig();
   const authorized = await authorizedToken(config, actor);

   const claimed = await store.claimPullRequestRefresh(config, {
      workspaceId: actor.workspaceId,
      issueId,
      generation: authorized.generation,
   });
   if (!claimed) {
      const existing = await store.readPullRequest(config, actor.workspaceId, issueId);
      if (!existing || existing.hidden) {
         return fail('not_found');
      }
      return fail('conflict');
   }

   let observation: GithubPullRequest;
   try {
      observation = await fetchPullRequest(authorized.token, {
         owner: claimed.repo_owner,
         repo: claimed.repo_name,
         number: claimed.pr_number,
      });
   } catch (error) {
      const failure = error instanceof GithubRequestError ? error.failure : 'outage';
      if (failure === 'reauthorization_required') {
         await broken(config, actor, authorized.generation);
         fail('reauthorization_required');
      }
      if (failure === 'denied') {
         await broken(config, actor, authorized.generation);
         fail('installation_unavailable');
      }
      if (failure === 'not_found') {
         // A deleted PR and a lost repository both surface as 404. Only treat
         // it as an installation problem when the verified repository list no
         // longer contains this repository.
         try {
            await requireInstallationRepository(
               config,
               actor,
               authorized,
               claimed.repo_owner,
               claimed.repo_name
            );
         } catch (verifyError) {
            if (
               verifyError instanceof GithubServiceError &&
               verifyError.code === 'installation_unavailable'
            ) {
               await broken(config, actor, authorized.generation);
               fail('installation_unavailable');
            }
            throw verifyError;
         }
      }
      const code =
         failure === 'not_found'
            ? 'not_found'
            : failure === 'rate_limited'
              ? 'rate_limited'
              : 'outage';
      const finalized = await store.finalizePullRequestRefresh(config, {
         workspaceId: actor.workspaceId,
         issueId,
         pullRequestId: claimed.id,
         attempt: claimed.attempt,
         generation: authorized.generation,
         leaseId: claimed.refresh_lease_id ?? '',
         outcome: { kind: 'failure', errorCode: code },
      });
      if (!finalized) {
         return fail('conflict');
      }
      return fail(code);
   }

   const finalized = await store.finalizePullRequestRefresh(config, {
      workspaceId: actor.workspaceId,
      issueId,
      pullRequestId: claimed.id,
      attempt: claimed.attempt,
      generation: authorized.generation,
      leaseId: claimed.refresh_lease_id ?? '',
      outcome: {
         kind: 'success',
         title: observation.title,
         state: observation.state,
         url: observation.url,
      },
   });
   if (!finalized) {
      return fail('conflict');
   }

   const view = presentPullRequest(finalized);
   if (!view) {
      return fail('conflict');
   }
   return view;
}

export async function unlinkGithubPullRequest(actor: GithubActor, issueId: string): Promise<void> {
   const config = requireConfig();
   const removed = await store.deletePullRequest(config, actor.workspaceId, issueId);
   if (!removed) {
      return fail('not_found');
   }
}

export type { GithubConnectionStatus };
