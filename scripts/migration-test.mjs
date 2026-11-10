#!/usr/bin/env node
/**
 * Applies the committed migrations to a disposable PostgreSQL database and
 * proves the workspace/RLS boundary with two simulated authenticated users and
 * an anonymous role.
 *
 * Local use reads `.env.dev` and creates a temporary database on the same
 * verified development instance. CI sets TEST_DATABASE_URL to a local server.
 * The database is dropped before exit. No credentials are printed.
 *
 * The harness reproduces Supabase's default public-schema grants before running
 * migrations, so removing a REVOKE or GRANT from the migration fails the test.
 */
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { validateDevDatabaseTarget } from './dev-database-target.mjs';

const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';
const WORK_TABLES = [
   'work_workspaces',
   'work_projects',
   'work_issues',
   'work_pull_requests',
   'work_github_connections',
   'work_github_oauth_states',
];
const JOURNAL_ENTRIES = 2;

function fail(message) {
   throw new Error(message);
}

function assert(condition, message) {
   if (!condition) fail(message);
}

async function expectError(promise, codes, message) {
   try {
      await promise;
   } catch (error) {
      if (codes.includes(error.code)) return error.code;
      fail(`${message}: expected ${codes.join(' or ')}, received ${error.code ?? error.message}`);
   }
   fail(`${message}: expected the operation to fail`);
}

async function main() {
   let adminUrl;
   let ssl;
   if (process.env.TEST_DATABASE_URL) {
      adminUrl = new URL(process.env.TEST_DATABASE_URL);
      const local = ['localhost', '127.0.0.1', '::1'].includes(adminUrl.hostname);
      if (!local && process.env.TEST_DATABASE_ALLOW_REMOTE !== '1') {
         fail('TEST_DATABASE_URL must point at localhost unless TEST_DATABASE_ALLOW_REMOTE=1.');
      }
      ssl = false;
   } else {
      const env = parseEnv(await readFile('.env.dev', 'utf8'));
      adminUrl = new URL(
         validateDevDatabaseTarget(env.DEV_DATABASE_URL, env.DEV_SUPABASE_PROJECT_REF)
      );
      let ca;
      try {
         ca = await readFile('certs/supabase-ca.crt', 'utf8');
      } catch (error) {
         if (error?.code !== 'ENOENT') throw error;
      }
      ssl = { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
   }

   const databaseName = `ega_work_test_${Date.now()}_${randomBytes(3).toString('hex')}`;
   const adminPool = new pg.Pool({ connectionString: adminUrl.toString(), ssl, max: 1 });

   let created = false;
   try {
      await adminPool.query(`create database "${databaseName}"`);
      created = true;

      const childUrl = new URL(adminUrl.toString());
      childUrl.pathname = `/${databaseName}`;
      const pool = new pg.Pool({ connectionString: childUrl.toString(), ssl, max: 4 });

      try {
         await pool.query(`
            do $$
            begin
               if not exists (select 1 from pg_roles where rolname = 'authenticated') then
                  create role authenticated nologin;
               end if;
               if not exists (select 1 from pg_roles where rolname = 'anon') then
                  create role anon nologin;
               end if;
            end
            $$;
         `);
         await pool.query('create schema auth');
         await pool.query(`
            create function auth.uid() returns uuid
            language sql stable
            as $$
               select nullif(
                  coalesce(
                     nullif(current_setting('request.jwt.claim.sub', true), ''),
                     nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
                  ),
                  ''
               )::uuid
            $$;
         `);
         await pool.query('grant usage on schema auth to authenticated, anon');

         // Supabase grants the browser roles broad default privileges in public.
         // Reproduce that so the migration's REVOKE/GRANT lines are load-bearing.
         await pool.query(
            'alter default privileges in schema public grant all on tables to anon, authenticated'
         );
         await pool.query(
            'alter default privileges in schema public grant all on sequences to anon, authenticated'
         );
         await pool.query('grant usage on schema public to anon, authenticated');

         const db = drizzle(pool);
         await migrate(db, {
            migrationsFolder: './drizzle',
            migrationsTable: '__ega_work_migrations',
            migrationsSchema: 'public',
         });
         console.log('PASS migration applies to a fresh database');

         await migrate(db, {
            migrationsFolder: './drizzle',
            migrationsTable: '__ega_work_migrations',
            migrationsSchema: 'public',
         });
         console.log('PASS migration re-applies as a no-op');

         const journal = await pool.query(
            'select count(*)::int as count from public.__ega_work_migrations'
         );
         assert(
            journal.rows[0].count === JOURNAL_ENTRIES,
            'expected every migration to be recorded'
         );

         const rls = await pool.query(
            `select c.relname, c.relrowsecurity
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = any($1)`,
            [WORK_TABLES]
         );
         for (const table of WORK_TABLES) {
            const row = rls.rows.find((item) => item.relname === table);
            assert(row?.relrowsecurity === true, `${table} must have row-level security enabled`);
            const anon = await pool.query(
               `select has_table_privilege('anon', $1, 'SELECT') as allowed`,
               [`public.${table}`]
            );
            const authenticated = await pool.query(
               `select has_table_privilege('authenticated', $1, 'SELECT') as allowed`,
               [`public.${table}`]
            );
            assert(anon.rows[0].allowed === false, `anon must not read ${table}`);
            assert(authenticated.rows[0].allowed === true, `authenticated must read ${table}`);
         }
         const counters = await pool.query(
            `select has_table_privilege('anon', 'public.work_issue_number_counters', 'SELECT') as anon,
                    has_table_privilege('authenticated', 'public.work_issue_number_counters', 'SELECT') as authenticated`
         );
         assert(
            counters.rows[0].anon === false && counters.rows[0].authenticated === false,
            'the issue-number counter must only be reachable through its trigger'
         );
         const legacySequence = await pool.query(
            `select to_regclass('public.work_issues_number_seq') as sequence`
         );
         assert(
            legacySequence.rows[0].sequence === null,
            'the global issue-number sequence must be gone'
         );
         const journalPrivilege = await pool.query(
            `select has_table_privilege('anon', 'public.__ega_work_migrations', 'SELECT') as anon,
                    has_table_privilege('authenticated', 'public.__ega_work_migrations', 'SELECT') as authenticated`
         );
         assert(
            journalPrivilege.rows[0].anon === false &&
               journalPrivilege.rows[0].authenticated === false,
            'browser roles must not read the migration journal'
         );
         console.log('PASS privileges and RLS match the production role model');

         async function asUser(userId, callback, role = 'authenticated') {
            const client = await pool.connect();
            try {
               await client.query('begin');
               await client.query(`set local role ${role}`);
               if (userId) {
                  await client.query('select set_config($1, $2, true)', [
                     'request.jwt.claims',
                     JSON.stringify({ sub: userId, role }),
                  ]);
               }
               const result = await callback(client);
               await client.query('commit');
               return result;
            } catch (error) {
               await client.query('rollback').catch(() => {});
               throw error;
            } finally {
               client.release();
            }
         }

         const workspaceA = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `insert into work_workspaces (owner_id, name) values ($1, 'Workspace A') returning id`,
               [USER_A]
            );
            return result.rows[0].id;
         });

         const duplicate = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `insert into work_workspaces (owner_id, name) values ($1, 'Duplicate') on conflict (owner_id) do nothing`,
               [USER_A]
            );
            return result.rowCount;
         });
         assert(duplicate === 0, 'repeated workspace creation must not duplicate');

         const projectA = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `insert into work_projects (workspace_id, name, description) values ($1, 'Project A', 'Saved') returning id`,
               [workspaceA]
            );
            return result.rows[0].id;
         });

         const issueA = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `insert into work_issues (workspace_id, project_id, title, assignee_id)
                values ($1, $2, 'Issue A', $3) returning id, number, status`,
               [workspaceA, projectA, USER_A]
            );
            return { ...result.rows[0], number: Number(result.rows[0].number) };
         });
         assert(issueA.status === 'open', 'new issues start open');
         assert(issueA.number === 1, 'the first issue in a workspace is number 1');

         const concurrent = await Promise.all(
            [1, 2].map((index) =>
               asUser(USER_A, async (client) => {
                  const result = await client.query(
                     `insert into work_issues (workspace_id, project_id, title, assignee_id)
                      values ($1, $2, $3, $4) returning number`,
                     [workspaceA, projectA, `Concurrent ${index}`, USER_A]
                  );
                  return Number(result.rows[0].number);
               })
            )
         );
         assert(
            new Set(concurrent).size === 2 && !concurrent.includes(issueA.number),
            'concurrent issue creation must allocate distinct workspace numbers'
         );

         const prA = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `insert into work_pull_requests (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, title, state, last_checked_at)
                values ($1, $2, 'EGA-BUILDS', 'ega-work', 1, 'https://github.com/EGA-BUILDS/ega-work/pull/1', 'A PR', 'open', now())
                returning id`,
               [workspaceA, issueA.id]
            );
            return result.rows[0].id;
         });

         await asUser(USER_A, (client) =>
            client.query(
               `insert into work_github_connections (workspace_id, provider_user_id, login, scopes, token_ciphertext, token_iv, token_tag)
                values ($1, '1', 'octocat', 'repo', 'cipher', 'iv', 'tag')`,
               [workspaceA]
            )
         );

         await asUser(USER_A, (client) =>
            client.query(
               `insert into work_github_oauth_states (state_hash, workspace_id, user_id, code_verifier_ciphertext, code_verifier_iv, code_verifier_tag, expires_at)
                values ('hash-a', $1, $2, 'cipher', 'iv', 'tag', now() + interval '10 minutes')`,
               [workspaceA, USER_A]
            )
         );

         const completed = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `update work_issues set status = 'completed' where id = $1 returning status`,
               [issueA.id]
            );
            return result.rows[0]?.status;
         });
         assert(completed === 'completed', 'owner can complete an issue');

         await expectError(
            asUser(USER_A, (client) =>
               client.query(`update work_issues set status = 'done' where id = $1`, [issueA.id])
            ),
            ['23514'],
            'invalid issue status must be rejected'
         );

         const workspaceB = await asUser(USER_B, async (client) => {
            const result = await client.query(
               `insert into work_workspaces (owner_id, name) values ($1, 'Workspace B') returning id`,
               [USER_B]
            );
            return result.rows[0].id;
         });

         const projectB = await asUser(USER_B, async (client) => {
            const result = await client.query(
               `insert into work_projects (workspace_id, name) values ($1, 'Project B') returning id`,
               [workspaceB]
            );
            return result.rows[0].id;
         });

         const issueB = await asUser(USER_B, async (client) => {
            const result = await client.query(
               `insert into work_issues (workspace_id, project_id, title, assignee_id)
                values ($1, $2, 'Issue B', $3) returning id, number`,
               [workspaceB, projectB, USER_B]
            );
            return { ...result.rows[0], number: Number(result.rows[0].number) };
         });
         assert(issueB.number === 1, 'issue numbering is scoped to each workspace');

         await expectError(
            asUser(USER_A, (client) =>
               client.query(
                  `insert into work_pull_requests (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, state)
                   values ($1, $2, 'EGA-BUILDS', 'ega-work', 3, 'https://github.com/EGA-BUILDS/ega-work/pull/3', 'open')`,
                  [workspaceA, issueB.id]
               )
            ),
            ['23503'],
            'a PR link cannot reference an issue outside its workspace'
         );

         const prB = await asUser(USER_B, async (client) => {
            const result = await client.query(
               `insert into work_pull_requests (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, state)
                values ($1, $2, 'EGA-BUILDS', 'ega-work', 2, 'https://github.com/EGA-BUILDS/ega-work/pull/2', 'open')
                returning id`,
               [workspaceB, issueB.id]
            );
            return result.rows[0].id;
         });

         for (const table of WORK_TABLES) {
            const count = await asUser(USER_B, async (client) => {
               const column = table === 'work_workspaces' ? 'id' : 'workspace_id';
               const target = workspaceA;
               const result = await client.query(
                  `select count(*)::int as count from ${table} where ${column} = $1`,
                  [target]
               );
               return result.rows[0].count;
            });
            assert(count === 0, `user B must not read user A rows from ${table}`);
         }

         const updateOther = await asUser(USER_B, async (client) => {
            const result = await client.query(
               `update work_projects set name = 'Hijacked' where id = $1`,
               [projectA]
            );
            return result.rowCount;
         });
         assert(updateOther === 0, 'user B must not update user A rows');

         await expectError(
            asUser(USER_B, (client) =>
               client.query(
                  `insert into work_projects (workspace_id, name) values ($1, 'Intruder')`,
                  [workspaceA]
               )
            ),
            ['42501'],
            'user B must not create a project inside user A workspace'
         );

         await expectError(
            asUser(USER_B, (client) =>
               client.query(
                  `insert into work_issues (workspace_id, project_id, title, assignee_id)
                   values ($1, $2, 'Cross workspace', $3)`,
                  [workspaceB, projectA, USER_B]
               )
            ),
            ['23503', '42501'],
            'an issue cannot reference a project outside its workspace'
         );

         await expectError(
            asUser(USER_A, (client) =>
               client.query(`update work_issues set assignee_id = $1 where id = $2`, [
                  USER_B,
                  issueA.id,
               ])
            ),
            ['42501'],
            'an issue cannot be assigned to another user in a private workspace'
         );

         const deleteOther = await asUser(USER_B, async (client) => {
            const result = await client.query(`delete from work_issues where id = $1`, [issueA.id]);
            return result.rowCount;
         });
         assert(deleteOther === 0, 'user B must not delete user A issues');

         const prAfterDeleteAttempt = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `select count(*)::int as count from work_pull_requests where id = $1`,
               [prA]
            );
            return result.rows[0].count;
         });
         assert(
            prAfterDeleteAttempt === 1,
            'a refused cross-user delete must not cascade another row'
         );

         const anonymousPrivilege = await pool.query(
            `select has_table_privilege('anon', 'public.work_workspaces', 'SELECT') as allowed`
         );
         assert(anonymousPrivilege.rows[0].allowed === false, 'anon must not have table access');
         await expectError(
            asUser(
               null,
               (client) => client.query('select count(*)::int as count from work_workspaces'),
               'anon'
            ),
            ['42501'],
            'anonymous requests must be denied'
         );

         const statusAfterPr = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `update work_issues set status = 'open' where id = $1
                returning status, (select state from work_pull_requests where id = $2) as pr_state`,
               [issueA.id, prA]
            );
            return result.rows[0];
         });
         assert(
            statusAfterPr.status === 'open' && statusAfterPr.pr_state === 'open',
            'issue status and PR state remain independent'
         );

         const prForB = await asUser(USER_B, async (client) => {
            const result = await client.query(
               `select count(*)::int as count from work_pull_requests where id = $1`,
               [prB]
            );
            return result.rows[0].count;
         });
         assert(prForB === 1, 'user B can read its own PR link');

         console.log(
            'PASS workspace creation and per-workspace numbering are unique under concurrency'
         );
         console.log('PASS all six tables deny cross-user reads and writes');
         console.log(
            'PASS migration, constraints, RLS, privileges and PR/status independence verified'
         );
      } finally {
         await pool.end();
      }
   } finally {
      if (created) {
         try {
            await adminPool.query(`drop database if exists "${databaseName}" with (force)`);
         } catch (error) {
            console.error(
               `WARN disposable database ${databaseName} cleanup did not complete: ${error.code ?? 'error'}`
            );
         }
      }
      await adminPool.end();
   }
}

main().catch((error) => {
   console.error(`FAIL ${error.message}`);
   process.exitCode = 1;
});
