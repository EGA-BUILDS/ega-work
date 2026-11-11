import 'server-only';

import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

import type { GithubConfig } from './config';
import { classifyConnectionToken } from './token.ts';
import type { GithubConnectionRecord, GithubOauthStateRecord, PullRequestRecord } from './types';

type Context = Readonly<{ workspaceId: string; userId: string }>;

type PoolEntry = Readonly<{ key: string; pool: Pool; ready: Promise<void> }>;

const globalForGithub = globalThis as unknown as { __egaWorkGithubPool?: PoolEntry };

function poolKey(config: GithubConfig): string {
   return `${config.databaseUrl}\u0000${config.databaseCa ? 'ca' : 'default'}`;
}

function createPool(config: GithubConfig): Pool {
   const url = new URL(config.databaseUrl);
   const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
   if (loopback && process.env.NODE_ENV === 'production') {
      throw new Error('loopback integration database is not allowed in production');
   }
   return new Pool({
      connectionString: config.databaseUrl,
      ssl: loopback
         ? false
         : {
              rejectUnauthorized: true,
              ...(config.databaseCa ? { ca: config.databaseCa } : {}),
           },
      max: 2,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      statement_timeout: 10_000,
      query_timeout: 10_000,
      application_name: 'ega-work-github',
      allowExitOnIdle: true,
   });
}

/**
 * Fails closed unless the runtime connection is the restricted integration
 * role. A privileged or superuser URL must never be able to bypass RLS here.
 */
async function assertRestrictedRole(pool: Pool): Promise<void> {
   const result = await pool.query<{
      rolsuper: boolean;
      rolbypassrls: boolean;
      member: boolean;
      owned: number;
   }>(`
      select r.rolsuper,
             r.rolbypassrls,
             pg_has_role(current_user, 'work_github_runtime', 'USAGE') as member,
             (
                select count(*)::int
                from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public'
                  and c.relname = any(array[
                     'work_pull_requests',
                     'work_github_connections',
                     'work_github_oauth_states'
                  ])
                  and c.relowner in (
                     r.oid,
                     (select oid from pg_roles where rolname = 'work_github_runtime')
                  )
             ) as owned
      from pg_roles r
      where r.rolname = current_user
   `);

   const row = result.rows[0];
   if (!row || row.rolsuper || row.rolbypassrls || !row.member || row.owned > 0) {
      throw new Error('restricted integration role required');
   }
}

function getPool(config: GithubConfig): Pool {
   const key = poolKey(config);
   const cached = globalForGithub.__egaWorkGithubPool;
   if (cached?.key === key) {
      return cached.pool;
   }

   const pool = createPool(config);
   const entry: PoolEntry = { key, pool, ready: assertRestrictedRole(pool) };
   entry.ready.catch(() => {});
   globalForGithub.__egaWorkGithubPool = entry;
   return pool;
}

async function readyPool(config: GithubConfig): Promise<Pool> {
   const pool = getPool(config);
   await globalForGithub.__egaWorkGithubPool?.ready;
   return pool;
}

/** Closes the cached pool. Used by the disposable database harness. */
export async function closeGithubPool(): Promise<void> {
   const cached = globalForGithub.__egaWorkGithubPool;
   globalForGithub.__egaWorkGithubPool = undefined;
   if (cached) {
      await cached.pool.end().catch(() => {});
   }
}

async function withContext<T>(
   config: GithubConfig,
   context: Partial<Context>,
   work: (client: PoolClient) => Promise<T>
): Promise<T> {
   const pool = await readyPool(config);
   const client = await pool.connect();
   try {
      await client.query('begin');
      await client.query(
         `select set_config('work.workspace_id', $1, true),
                 set_config('work.user_id', $2, true)`,
         [context.workspaceId ?? '', context.userId ?? '']
      );
      const result = await work(client);
      await client.query('commit');
      return result;
   } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
   } finally {
      client.release();
   }
}

function firstRow<T>(rows: T[]): T | null {
   return rows[0] ?? null;
}

export async function readConnection(
   config: GithubConfig,
   workspaceId: string
): Promise<GithubConnectionRecord | null> {
   return withContext(config, { workspaceId }, async (client) => {
      const result = await client.query<GithubConnectionRecord>(
         'select * from work_github_connections where workspace_id = $1',
         [workspaceId]
      );
      return firstRow(result.rows);
   });
}

export async function createOauthState(
   config: GithubConfig,
   input: Readonly<{
      workspaceId: string;
      userId: string;
      stateHash: string;
      verifierCiphertext: string;
      verifierIv: string;
      verifierTag: string;
      connectionGeneration: number;
      expiresAt: Date;
   }>
): Promise<void> {
   await withContext(
      config,
      { workspaceId: input.workspaceId, userId: input.userId },
      async (client) => {
         await client.query(
            `delete from work_github_oauth_states
             where user_id = $1
               and (expires_at < now() - interval '1 day'
                    or consumed_at < now() - interval '1 day')`,
            [input.userId]
         );
         await client.query(
            `insert into work_github_oauth_states
               (state_hash, workspace_id, user_id, code_verifier_ciphertext,
                code_verifier_iv, code_verifier_tag, connection_generation, expires_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
               input.stateHash,
               input.workspaceId,
               input.userId,
               input.verifierCiphertext,
               input.verifierIv,
               input.verifierTag,
               input.connectionGeneration,
               input.expiresAt,
            ]
         );
      }
   );
}

/**
 * Atomically consumes a state row. Only one callback can win; a replay,
 * expired state, or another user's state returns null.
 */
export async function claimOauthState(
   config: GithubConfig,
   userId: string,
   stateHash: string
): Promise<GithubOauthStateRecord | null> {
   return withContext(config, { userId }, async (client) => {
      const result = await client.query<GithubOauthStateRecord>(
         `update work_github_oauth_states
          set consumed_at = now()
          where state_hash = $1 and consumed_at is null and expires_at > now()
          returning *`,
         [stateHash]
      );
      return firstRow(result.rows);
   });
}

export type ConnectionSaveResult =
   | { kind: 'saved'; row: GithubConnectionRecord }
   | { kind: 'stale' };

export async function saveConnection(
   config: GithubConfig,
   input: Readonly<{
      workspaceId: string;
      stateGeneration: number;
      providerUserId: string;
      login: string;
      accessCiphertext: string;
      accessIv: string;
      accessTag: string;
      accessExpiresAt: Date | null;
      refreshCiphertext: string | null;
      refreshIv: string | null;
      refreshTag: string | null;
      refreshExpiresAt: Date | null;
   }>
): Promise<ConnectionSaveResult> {
   return withContext(config, { workspaceId: input.workspaceId }, async (client) => {
      const existing = await client.query<GithubConnectionRecord>(
         'select * from work_github_connections where workspace_id = $1 for update',
         [input.workspaceId]
      );
      const current = firstRow(existing.rows);

      if (current) {
         if (current.connection_generation !== input.stateGeneration) {
            return { kind: 'stale' };
         }
         const result = await client.query<GithubConnectionRecord>(
            `update work_github_connections
             set provider_user_id = $2,
                 login = $3,
                 token_ciphertext = $4,
                 token_iv = $5,
                 token_tag = $6,
                 token_expires_at = $7,
                 refresh_token_ciphertext = $8,
                 refresh_token_iv = $9,
                 refresh_token_tag = $10,
                 refresh_token_expires_at = $11,
                 installation_id = case when provider_user_id = $2 then installation_id else null end,
                 connection_generation = connection_generation + 1,
                 token_version = token_version + 1,
                 refresh_lease_id = null,
                 refresh_lease_expires_at = null,
                 revoked_at = null,
                 connected_at = now(),
                 updated_at = now()
             where workspace_id = $1
             returning *`,
            [
               input.workspaceId,
               input.providerUserId,
               input.login,
               input.accessCiphertext,
               input.accessIv,
               input.accessTag,
               input.accessExpiresAt,
               input.refreshCiphertext,
               input.refreshIv,
               input.refreshTag,
               input.refreshExpiresAt,
            ]
         );
         const saved = result.rows[0];

         // Re-authorization always invalidates cached observations, even for
         // the same GitHub account: the new token/generation may expose a
         // different repository set, so an explicit relink is required.
         await saveHiddenPullRequests(client, input.workspaceId);

         return { kind: 'saved', row: saved };
      }

      if (input.stateGeneration !== 0) {
         return { kind: 'stale' };
      }

      const result = await client.query<GithubConnectionRecord>(
         `insert into work_github_connections
            (workspace_id, provider_user_id, login, token_ciphertext, token_iv, token_tag,
             token_expires_at, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag,
             refresh_token_expires_at, connection_generation, token_version)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, 1)
          returning *`,
         [
            input.workspaceId,
            input.providerUserId,
            input.login,
            input.accessCiphertext,
            input.accessIv,
            input.accessTag,
            input.accessExpiresAt,
            input.refreshCiphertext,
            input.refreshIv,
            input.refreshTag,
            input.refreshExpiresAt,
         ]
      );
      const inserted = result.rows[0];
      await saveHiddenPullRequests(client, input.workspaceId);
      return { kind: 'saved', row: inserted };
   });
}

export type InstallationSelectionResult =
   | { kind: 'saved'; row: GithubConnectionRecord; hiddenCount: number }
   | { kind: 'unchanged'; row: GithubConnectionRecord }
   | { kind: 'conflict' }
   | { kind: 'stale' }
   | { kind: 'missing' };

/**
 * Switches the selected App installation. The connection row is locked for
 * the whole transaction so the generation bump and PR invalidation cannot be
 * observed separately: any refresh or link that raced against the old
 * generation will finalize zero rows. A non-null refresh lease (active or
 * stalled) blocks the switch instead of being cleared or replayed.
 */
export async function selectInstallation(
   config: GithubConfig,
   input: Readonly<{ workspaceId: string; installationId: number; generation: number }>
): Promise<InstallationSelectionResult> {
   return withContext(config, { workspaceId: input.workspaceId }, async (client) => {
      const current = await client.query<GithubConnectionRecord>(
         'select * from work_github_connections where workspace_id = $1 for update',
         [input.workspaceId]
      );
      const row = firstRow(current.rows);
      if (!row || row.revoked_at || !row.token_ciphertext || !row.token_iv || !row.token_tag) {
         return { kind: 'missing' };
      }
      if (row.connection_generation !== input.generation) {
         return { kind: 'stale' };
      }
      if (row.refresh_lease_id !== null) {
         return { kind: 'conflict' };
      }
      if (
         row.installation_id !== null &&
         String(row.installation_id) === String(input.installationId)
      ) {
         return { kind: 'unchanged', row };
      }

      const visible = await client.query<{ count: number }>(
         `select count(*)::int as count
          from work_pull_requests
          where workspace_id = $1 and hidden = false`,
         [input.workspaceId]
      );

      const updated = await client.query<GithubConnectionRecord>(
         `update work_github_connections
          set installation_id = $3,
              connection_generation = connection_generation + 1,
              updated_at = now()
          where workspace_id = $1 and connection_generation = $2
          returning *`,
         [input.workspaceId, input.generation, input.installationId]
      );
      const saved = firstRow(updated.rows);
      if (!saved) {
         return { kind: 'stale' };
      }

      await saveHiddenPullRequests(client, input.workspaceId);
      return { kind: 'saved', row: saved, hiddenCount: visible.rows[0]?.count ?? 0 };
   });
}

export type DisconnectResult =
   | {
        kind: 'disconnected';
        generation: number;
        login: string;
        previousAccess: Readonly<{ ciphertext: string; iv: string; tag: string }> | null;
     }
   | { kind: 'missing' };

export async function disconnectConnection(
   config: GithubConfig,
   input: Readonly<{ workspaceId: string; userId: string }>
): Promise<DisconnectResult> {
   return withContext(
      config,
      { workspaceId: input.workspaceId, userId: input.userId },
      async (client) => {
         const existing = await client.query<GithubConnectionRecord>(
            'select * from work_github_connections where workspace_id = $1 for update',
            [input.workspaceId]
         );
         const current = firstRow(existing.rows);
         if (!current) {
            return { kind: 'missing' };
         }

         const updated = await client.query<{ connection_generation: number }>(
            `update work_github_connections
             set connection_generation = connection_generation + 1,
                 token_version = token_version + 1,
                 revoked_at = now(),
                 token_ciphertext = null,
                 token_iv = null,
                 token_tag = null,
                 token_expires_at = null,
                 refresh_token_ciphertext = null,
                 refresh_token_iv = null,
                 refresh_token_tag = null,
                 refresh_token_expires_at = null,
                 installation_id = null,
                 refresh_lease_id = null,
                 refresh_lease_expires_at = null,
                 updated_at = now()
             where workspace_id = $1
             returning connection_generation`,
            [input.workspaceId]
         );

         await client.query('delete from work_github_oauth_states where workspace_id = $1', [
            input.workspaceId,
         ]);
         await saveHiddenPullRequests(client, input.workspaceId);

         const previousAccess =
            current.token_ciphertext && current.token_iv && current.token_tag
               ? {
                    ciphertext: current.token_ciphertext,
                    iv: current.token_iv,
                    tag: current.token_tag,
                 }
               : null;

         return {
            kind: 'disconnected',
            generation: updated.rows[0].connection_generation,
            login: current.login,
            previousAccess,
         };
      }
   );
}

/**
 * Hides linked pull requests and clears private observation metadata. The
 * repo identity columns stay because they are NOT NULL link identity; hidden
 * rows are never projected to the browser. Callers must move the connection
 * generation so a late refresh cannot finalize against them.
 */
async function saveHiddenPullRequests(client: PoolClient, workspaceId: string): Promise<void> {
   await client.query(
      `update work_pull_requests
       set hidden = true,
           title = null,
           state = null,
           url = null,
           last_checked_at = null,
           last_check_error = null,
           is_stale = true,
           refresh_lease_id = null,
           refresh_lease_expires_at = null,
           updated_at = now()
       where workspace_id = $1`,
      [workspaceId]
   );
}

/**
 * Marks the last successful observations stale without clearing them. Used
 * when a token refresh fails transiently: title, URL, state, and the last
 * success time stay visible, and the refresh lease is intentionally left in
 * place so a later attempt cannot replay a possibly-consumed refresh token.
 */
export async function markPullRequestsStale(
   config: GithubConfig,
   workspaceId: string,
   errorCode: string
): Promise<void> {
   const safeCode = [
      'outage',
      'rate_limited',
      'installation_unavailable',
      'not_found',
      'reauthorization_required',
   ].includes(errorCode)
      ? errorCode
      : 'outage';

   await withContext(config, { workspaceId }, async (client) => {
      await client.query(
         `update work_pull_requests
          set is_stale = true,
              last_check_error = $2,
              updated_at = now()
          where workspace_id = $1 and hidden = false`,
         [workspaceId, safeCode]
      );
   });
}

/**
 * Marks a connection unusable after a definitive authorization failure.
 * Returns false when the generation already moved (disconnect won the race),
 * in which case nothing is restored.
 */
export async function markConnectionBroken(
   config: GithubConfig,
   input: Readonly<{ workspaceId: string; userId: string; generation: number }>
): Promise<boolean> {
   return withContext(
      config,
      { workspaceId: input.workspaceId, userId: input.userId },
      async (client) => {
         const updated = await client.query(
            `update work_github_connections
             set connection_generation = connection_generation + 1,
                 token_version = token_version + 1,
                 revoked_at = now(),
                 token_ciphertext = null,
                 token_iv = null,
                 token_tag = null,
                 token_expires_at = null,
                 refresh_token_ciphertext = null,
                 refresh_token_iv = null,
                 refresh_token_tag = null,
                 refresh_token_expires_at = null,
                 installation_id = null,
                 refresh_lease_id = null,
                 refresh_lease_expires_at = null,
                 updated_at = now()
             where workspace_id = $1
               and connection_generation = $2
               and revoked_at is null
             returning workspace_id`,
            [input.workspaceId, input.generation]
         );

         if (updated.rowCount === 0) {
            return false;
         }

         await client.query('delete from work_github_oauth_states where workspace_id = $1', [
            input.workspaceId,
         ]);
         await saveHiddenPullRequests(client, input.workspaceId);
         return true;
      }
   );
}

export type TokenClaim =
   | { kind: 'fresh'; row: GithubConnectionRecord }
   | { kind: 'leased' }
   | { kind: 'stalled' }
   | { kind: 'unusable' }
   | { kind: 'claimed'; row: GithubConnectionRecord; leaseId: string };

/**
 * Claims the single refresh lease for an expiring access token. The row lock
 * makes concurrent callers single-winner; the finalize step later requires the
 * same lease, generation, and token version.
 *
 * A lease that was never released (worker crash) is reported as `stalled` and
 * is never reclaimed, because the stored refresh token may already have been
 * consumed by the previous worker. A new lease is only claimed when none is
 * present.
 */
export async function claimTokenRefresh(
   config: GithubConfig,
   workspaceId: string
): Promise<TokenClaim> {
   return withContext(config, { workspaceId }, async (client) => {
      const result = await client.query<GithubConnectionRecord>(
         'select * from work_github_connections where workspace_id = $1 for update',
         [workspaceId]
      );
      const row = firstRow(result.rows);
      if (!row) {
         return { kind: 'unusable' };
      }

      const state = classifyConnectionToken(row);
      if (state.kind === 'usable') {
         return { kind: 'fresh', row };
      }
      if (state.kind === 'leased') {
         return { kind: 'leased' };
      }
      if (state.kind === 'stalled') {
         return { kind: 'stalled' };
      }
      if (state.kind === 'unusable') {
         return { kind: 'unusable' };
      }

      const leaseId = randomUUID();
      const claimed = await client.query<GithubConnectionRecord>(
         `update work_github_connections
          set refresh_lease_id = $2,
              refresh_lease_expires_at = now() + interval '30 seconds',
              updated_at = now()
          where workspace_id = $1
            and refresh_lease_id is null
            and revoked_at is null
          returning *`,
         [workspaceId, leaseId]
      );
      const claimedRow = firstRow(claimed.rows);
      if (!claimedRow) {
         return { kind: 'leased' };
      }
      return { kind: 'claimed', row: claimedRow, leaseId };
   });
}

export async function finalizeTokenRefresh(
   config: GithubConfig,
   input: Readonly<{
      workspaceId: string;
      generation: number;
      tokenVersion: number;
      leaseId: string;
      accessCiphertext: string;
      accessIv: string;
      accessTag: string;
      accessExpiresAt: Date | null;
      refreshCiphertext: string;
      refreshIv: string;
      refreshTag: string;
      refreshExpiresAt: Date | null;
   }>
): Promise<GithubConnectionRecord | null> {
   return withContext(config, { workspaceId: input.workspaceId }, async (client) => {
      const result = await client.query<GithubConnectionRecord>(
         `update work_github_connections
          set token_ciphertext = $5,
              token_iv = $6,
              token_tag = $7,
              token_expires_at = $8,
              refresh_token_ciphertext = $9,
              refresh_token_iv = $10,
              refresh_token_tag = $11,
              refresh_token_expires_at = $12,
              token_version = token_version + 1,
              refresh_lease_id = null,
              refresh_lease_expires_at = null,
              revoked_at = null,
              updated_at = now()
          where workspace_id = $1
            and connection_generation = $2
            and token_version = $3
            and refresh_lease_id = $4
            and revoked_at is null
          returning *`,
         [
            input.workspaceId,
            input.generation,
            input.tokenVersion,
            input.leaseId,
            input.accessCiphertext,
            input.accessIv,
            input.accessTag,
            input.accessExpiresAt,
            input.refreshCiphertext,
            input.refreshIv,
            input.refreshTag,
            input.refreshExpiresAt,
         ]
      );
      return firstRow(result.rows);
   });
}

export type PullRequestInsertResult =
   | { kind: 'saved'; row: PullRequestRecord }
   | { kind: 'stale' }
   | { kind: 'not_found' }
   | { kind: 'conflict' };

export async function insertPullRequest(
   config: GithubConfig,
   input: Readonly<{
      workspaceId: string;
      userId: string;
      issueId: string;
      owner: string;
      repo: string;
      number: number;
      url: string;
      title: string;
      state: 'open' | 'closed' | 'merged';
      generation: number;
   }>
): Promise<PullRequestInsertResult> {
   return withContext(
      config,
      { workspaceId: input.workspaceId, userId: input.userId },
      async (client) => {
         const connection = await client.query<{ connection_generation: number }>(
            `select connection_generation
             from work_github_connections
             where workspace_id = $1 and revoked_at is null and token_ciphertext is not null
             for update`,
            [input.workspaceId]
         );
         const current = connection.rows[0];
         if (!current || current.connection_generation !== input.generation) {
            return { kind: 'stale' };
         }

         await client.query(
            `delete from work_pull_requests
             where workspace_id = $1
               and hidden = true
               and repo_owner = $2
               and repo_name = $3
               and pr_number = $4
               and issue_id <> $5`,
            [input.workspaceId, input.owner, input.repo, input.number, input.issueId]
         );

         try {
            const result = await client.query<PullRequestRecord>(
               `insert into work_pull_requests
                  (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, title, state,
                   last_checked_at, last_check_error, is_stale, hidden, attempt,
                   connection_generation, linked_by)
                values ($1, $2, $3, $4, $5, $6, $7, $8, now(), null, false, false, 0, $9, $10)
                on conflict (issue_id) do update
                  set repo_owner = excluded.repo_owner,
                      repo_name = excluded.repo_name,
                      pr_number = excluded.pr_number,
                      url = excluded.url,
                      title = excluded.title,
                      state = excluded.state,
                      last_checked_at = now(),
                      last_check_error = null,
                      is_stale = false,
                      hidden = false,
                      attempt = 0,
                      connection_generation = excluded.connection_generation,
                      refresh_lease_id = null,
                      refresh_lease_expires_at = null,
                      linked_by = excluded.linked_by,
                      updated_at = now()
                  where work_pull_requests.hidden
                returning *`,
               [
                  input.workspaceId,
                  input.issueId,
                  input.owner,
                  input.repo,
                  input.number,
                  input.url,
                  input.title,
                  input.state,
                  input.generation,
                  input.userId,
               ]
            );
            const row = firstRow(result.rows);
            return row ? { kind: 'saved', row } : { kind: 'conflict' };
         } catch (error) {
            const code = (error as { code?: string }).code;
            if (code === '23503') {
               return { kind: 'not_found' };
            }
            if (code === '23505') {
               return { kind: 'conflict' };
            }
            if (code === '22P02') {
               return { kind: 'not_found' };
            }
            throw error;
         }
      }
   );
}

export async function readPullRequest(
   config: GithubConfig,
   workspaceId: string,
   issueId: string
): Promise<PullRequestRecord | null> {
   return withContext(config, { workspaceId }, async (client) => {
      const result = await client.query<PullRequestRecord>(
         `select * from work_pull_requests
          where workspace_id = $1 and issue_id = $2`,
         [workspaceId, issueId]
      );
      return firstRow(result.rows);
   });
}

export async function claimPullRequestRefresh(
   config: GithubConfig,
   input: Readonly<{ workspaceId: string; issueId: string; generation: number }>
): Promise<PullRequestRecord | null> {
   const leaseId = randomUUID();
   return withContext(config, { workspaceId: input.workspaceId }, async (client) => {
      const result = await client.query<PullRequestRecord>(
         `update work_pull_requests
          set attempt = attempt + 1,
              refresh_lease_id = $4,
              refresh_lease_expires_at = now() + interval '30 seconds',
              updated_at = now()
          where workspace_id = $1
            and issue_id = $2
            and connection_generation = $3
            and hidden = false
            and (refresh_lease_id is null or refresh_lease_expires_at < now())
          returning *`,
         [input.workspaceId, input.issueId, input.generation, leaseId]
      );
      return firstRow(result.rows);
   });
}

export async function finalizePullRequestRefresh(
   config: GithubConfig,
   input: Readonly<{
      workspaceId: string;
      issueId: string;
      pullRequestId: string;
      attempt: number;
      generation: number;
      leaseId: string;
      outcome:
         | { kind: 'success'; title: string; state: 'open' | 'closed' | 'merged'; url: string }
         | { kind: 'failure'; errorCode: string };
   }>
): Promise<PullRequestRecord | null> {
   return withContext(config, { workspaceId: input.workspaceId }, async (client) => {
      const result =
         input.outcome.kind === 'success'
            ? await client.query<PullRequestRecord>(
                 `update work_pull_requests
                  set title = $6,
                      state = $7,
                      url = $8,
                      last_checked_at = now(),
                      last_check_error = null,
                      is_stale = false,
                      refresh_lease_id = null,
                      refresh_lease_expires_at = null,
                      updated_at = now()
                  where workspace_id = $1 and issue_id = $2 and id = $3
                    and attempt = $4 and connection_generation = $5
                    and refresh_lease_id = $9 and hidden = false
                  returning *`,
                 [
                    input.workspaceId,
                    input.issueId,
                    input.pullRequestId,
                    input.attempt,
                    input.generation,
                    input.outcome.title,
                    input.outcome.state,
                    input.outcome.url,
                    input.leaseId,
                 ]
              )
            : await client.query<PullRequestRecord>(
                 `update work_pull_requests
                  set last_check_error = $6,
                      is_stale = true,
                      refresh_lease_id = null,
                      refresh_lease_expires_at = null,
                      updated_at = now()
                  where workspace_id = $1 and issue_id = $2 and id = $3
                    and attempt = $4 and connection_generation = $5
                    and refresh_lease_id = $7 and hidden = false
                  returning *`,
                 [
                    input.workspaceId,
                    input.issueId,
                    input.pullRequestId,
                    input.attempt,
                    input.generation,
                    input.outcome.errorCode,
                    input.leaseId,
                 ]
              );
      return firstRow(result.rows);
   });
}

export async function deletePullRequest(
   config: GithubConfig,
   workspaceId: string,
   issueId: string
): Promise<boolean> {
   return withContext(config, { workspaceId }, async (client) => {
      const result = await client.query(
         'delete from work_pull_requests where workspace_id = $1 and issue_id = $2',
         [workspaceId, issueId]
      );
      return (result.rowCount ?? 0) > 0;
   });
}
