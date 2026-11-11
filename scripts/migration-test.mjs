#!/usr/bin/env node
/**
 * Applies the committed migrations to disposable PostgreSQL databases and
 * proves the workspace, integration-role, and RLS boundaries.
 *
 * Two databases are used:
 *  - an upgrade database that applies v1.0 migrations, inserts v1.0 rows, then
 *    applies migration 0002 to prove existing data survives;
 *  - a fresh database that applies the full history and exercises browser-role
 *    denial, the restricted runtime role, A/B isolation, and CAS races.
 *
 * Local use reads `.env.dev` and creates temporary databases on the same
 * verified development instance. CI sets TEST_DATABASE_URL to a local server.
 * Databases are dropped before exit. No credentials are printed.
 *
 * The harness reproduces Supabase's default public-schema grants before running
 * migrations, so removing a REVOKE or GRANT from the migration fails the test.
 */
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, copyFile, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as githubStore from '../lib/work/github/store.ts';
import { getGithubIssueView } from '../lib/work/github/service.ts';
import { validateDevDatabaseTarget } from './dev-database-target.mjs';

const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';
const USER_C = '00000000-0000-4000-8000-00000000000c';
const USER_D = '00000000-0000-4000-8000-00000000000d';
const WORK_TABLES = [
   'work_workspaces',
   'work_projects',
   'work_issues',
   'work_pull_requests',
   'work_github_connections',
   'work_github_oauth_states',
];
const INTEGRATION_TABLES = [
   'work_pull_requests',
   'work_github_connections',
   'work_github_oauth_states',
];
const JOURNAL_ENTRIES = 3;

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

async function bootstrapDatabase(pool) {
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
}

async function writeV1Migrations() {
   const folder = await mkdtemp(join(tmpdir(), 'ega-work-v10-'));
   await mkdir(join(folder, 'meta'), { recursive: true });
   await copyFile('drizzle/0000_work_foundation.sql', join(folder, '0000_work_foundation.sql'));
   await copyFile('drizzle/0001_work_hardening.sql', join(folder, '0001_work_hardening.sql'));
   const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
   await writeFile(
      join(folder, 'meta', '_journal.json'),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 2) })
   );
   return folder;
}

async function createDatabase(adminPool, prefix) {
   const name = `${prefix}_${Date.now()}_${randomBytes(3).toString('hex')}`;
   await adminPool.query(`create database "${name}"`);
   return name;
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

   const adminPool = new pg.Pool({ connectionString: adminUrl.toString(), ssl, max: 1 });
   const databases = [];
   let v1Folder = null;

   try {
      v1Folder = await writeV1Migrations();
      await testUpgrade({ adminUrl, ssl, adminPool, databases, v1Folder });
      const hostname = adminUrl.hostname.replace(/^\[|\]$/g, '');
      const runRealPaths =
         Boolean(process.env.TEST_DATABASE_URL) &&
         ['localhost', '127.0.0.1', '::1'].includes(hostname);
      await testFresh({ adminUrl, ssl, adminPool, databases, runRealPaths });
      console.log('PASS migration 0002, RLS, runtime role, constraints, and CAS races verified');
   } finally {
      if (v1Folder) {
         await rm(v1Folder, { recursive: true, force: true }).catch(() => {});
      }
      for (const name of databases) {
         try {
            await adminPool.query(`drop database if exists "${name}" with (force)`);
         } catch (error) {
            console.error(
               `WARN disposable database ${name} cleanup did not complete: ${error.code ?? 'error'}`
            );
         }
      }
      await adminPool.end();
   }
}

async function testUpgrade({ adminUrl, ssl, adminPool, databases, v1Folder }) {
   const name = await createDatabase(adminPool, 'ega_work_upgrade');
   databases.push(name);
   const childUrl = new URL(adminUrl.toString());
   childUrl.pathname = `/${name}`;
   const pool = new pg.Pool({ connectionString: childUrl.toString(), ssl, max: 4 });

   try {
      await bootstrapDatabase(pool);
      const db = drizzle(pool);

      await migrate(db, {
         migrationsFolder: v1Folder,
         migrationsTable: '__ega_work_migrations',
         migrationsSchema: 'public',
      });

      const workspace = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_workspaces (owner_id, name) values ($1, 'Upgrade workspace') returning id`,
            [USER_A]
         );
         return result.rows[0].id;
      });
      const project = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_projects (workspace_id, name) values ($1, 'Upgrade project') returning id`,
            [workspace]
         );
         return result.rows[0].id;
      });
      const issue = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_issues (workspace_id, project_id, title) values ($1, $2, 'Upgrade issue') returning id`,
            [workspace, project]
         );
         return result.rows[0].id;
      });
      await asUser(pool, USER_A, (client) =>
         client.query(
            `insert into work_github_connections
               (workspace_id, provider_user_id, login, scopes, token_ciphertext, token_iv, token_tag)
             values ($1, '42', 'legacy-user', 'repo', 'legacy-cipher', 'legacy-iv', 'legacy-tag')`,
            [workspace]
         )
      );
      await asUser(pool, USER_A, (client) =>
         client.query(
            `insert into work_github_oauth_states
               (state_hash, workspace_id, user_id, code_verifier_ciphertext, code_verifier_iv,
                code_verifier_tag, expires_at)
             values ('legacy-state', $1, $2, 'legacy-verifier', 'iv', 'tag', now() + interval '10 minutes')`,
            [workspace, USER_A]
         )
      );
      await asUser(pool, USER_A, (client) =>
         client.query(
            `insert into work_pull_requests
               (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, title, state, last_checked_at)
             values ($1, $2, 'EGA-BUILDS', 'ega-work', 9,
                     'https://github.com/EGA-BUILDS/ega-work/pull/9', 'Legacy PR', 'open', now())`,
            [workspace, issue]
         )
      );

      await migrate(db, {
         migrationsFolder: './drizzle',
         migrationsTable: '__ega_work_migrations',
         migrationsSchema: 'public',
      });

      const journal = await pool.query(
         'select count(*)::int as count from public.__ega_work_migrations'
      );
      assert(journal.rows[0].count === JOURNAL_ENTRIES, 'upgrade must record all three migrations');

      const connection = await pool.query(
         `select provider_user_id, login, token_ciphertext, token_iv, token_tag,
                 connection_generation, token_version, installation_id
          from work_github_connections where workspace_id = $1`,
         [workspace]
      );
      assert(connection.rows.length === 1, 'the v1.0 connection row must survive migration 0002');
      assert(connection.rows[0].login === 'legacy-user', 'existing login must be preserved');
      assert(
         connection.rows[0].token_ciphertext === 'legacy-cipher',
         'existing encrypted token must be preserved'
      );
      assert(
         connection.rows[0].connection_generation === 0 && connection.rows[0].token_version === 0,
         'new connection counters must default to zero for existing rows'
      );
      assert(connection.rows[0].installation_id === null, 'legacy installation must stay empty');

      const state = await pool.query(
         `select state_hash, consumed_at, connection_generation
          from work_github_oauth_states where state_hash = 'legacy-state'`
      );
      assert(state.rows.length === 1, 'the v1.0 state row must survive');
      assert(
         state.rows[0].consumed_at === null && state.rows[0].connection_generation === 0,
         'existing state rows must keep their unconsumed status and default generation'
      );

      const pr = await pool.query(
         `select url, title, state, attempt, connection_generation, linked_by
          from work_pull_requests where workspace_id = $1`,
         [workspace]
      );
      assert(pr.rows.length === 1, 'the v1.0 pull request row must survive');
      assert(
         pr.rows[0].title === 'Legacy PR' && pr.rows[0].state === 'open',
         'PR metadata preserved'
      );
      assert(pr.rows[0].attempt === 0 && pr.rows[0].linked_by === null, 'new PR columns default');

      console.log('PASS migration 0002 applies over v1.0 data and preserves existing rows');
   } finally {
      await pool.end();
   }
}

async function testFresh({ adminUrl, ssl, adminPool, databases, runRealPaths }) {
   const name = await createDatabase(adminPool, 'ega_work_test');
   databases.push(name);
   const childUrl = new URL(adminUrl.toString());
   childUrl.pathname = `/${name}`;
   const pool = new pg.Pool({ connectionString: childUrl.toString(), ssl, max: 6 });

   try {
      await bootstrapDatabase(pool);
      const db = drizzle(pool);
      const migrations = {
         migrationsFolder: './drizzle',
         migrationsTable: '__ega_work_migrations',
         migrationsSchema: 'public',
      };

      await migrate(db, migrations);
      console.log('PASS migration applies to a fresh database');
      await migrate(db, migrations);
      console.log('PASS migration re-applies as a no-op');

      const journal = await pool.query(
         'select count(*)::int as count from public.__ega_work_migrations'
      );
      assert(journal.rows[0].count === JOURNAL_ENTRIES, 'expected every migration to be recorded');

      const rls = await pool.query(
         `select c.relname, c.relrowsecurity
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = any($1)`,
         [WORK_TABLES]
      );
      for (const table of WORK_TABLES) {
         const row = rls.rows.find((item) => item.relname === table);
         assert(row?.relrowsecurity === true, `${table} must have row-level security enabled`);
      }

      const forced = await pool.query(
         `select relname
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = any($1) and c.relforcerowsecurity`,
         [INTEGRATION_TABLES]
      );
      assert(
         forced.rows.length === INTEGRATION_TABLES.length,
         'integration tables must force row-level security for non-superuser owners'
      );

      for (const table of INTEGRATION_TABLES) {
         for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
            for (const role of ['anon', 'authenticated']) {
               const result = await pool.query(
                  `select has_table_privilege($1, $2, $3) as allowed`,
                  [role, `public.${table}`, privilege]
               );
               assert(
                  result.rows[0].allowed === false,
                  `${role} must not have ${privilege} on ${table}`
               );
            }
            const runtime = await pool.query(
               `select has_table_privilege('work_github_runtime', $1, $2) as allowed`,
               [`public.${table}`, privilege]
            );
            assert(
               runtime.rows[0].allowed === true,
               `work_github_runtime must have ${privilege} on ${table}`
            );
         }
      }

      for (const table of ['work_workspaces', 'work_projects', 'work_issues']) {
         const authenticated = await pool.query(
            `select has_table_privilege('authenticated', $1, 'SELECT') as allowed`,
            [`public.${table}`]
         );
         const runtime = await pool.query(
            `select has_table_privilege('work_github_runtime', $1, 'SELECT') as allowed`,
            [`public.${table}`]
         );
         assert(authenticated.rows[0].allowed === true, `authenticated must still read ${table}`);
         assert(runtime.rows[0].allowed === false, `runtime must not read ${table}`);
      }

      const runtimeRole = await pool.query(
         `select rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
          from pg_roles where rolname = 'work_github_runtime'`
      );
      assert(runtimeRole.rows.length === 1, 'work_github_runtime must exist');
      const role = runtimeRole.rows[0];
      assert(
         role.rolcanlogin === false &&
            role.rolsuper === false &&
            role.rolbypassrls === false &&
            role.rolcreatedb === false &&
            role.rolcreaterole === false,
         'the runtime role must be a minimal NOLOGIN role'
      );

      const ownership = await pool.query(
         `select c.relname, c.relowner = r.oid as owned
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          join pg_roles r on r.rolname = 'work_github_runtime'
          where n.nspname = 'public' and c.relname = any($1)`,
         [INTEGRATION_TABLES]
      );
      for (const table of INTEGRATION_TABLES) {
         const row = ownership.rows.find((item) => item.relname === table);
         assert(row?.owned === false, `the runtime role must not own ${table}`);
      }

      const policies = await pool.query(
         `select c.relname, p.polname
          from pg_policy p join pg_class c on c.oid = p.polrelid
          where c.relname = any($1)`,
         [INTEGRATION_TABLES]
      );
      for (const table of INTEGRATION_TABLES) {
         const names = policies.rows
            .filter((row) => row.relname === table)
            .map((row) => row.polname);
         assert(
            !names.some((policy) => policy.endsWith('_owner_all')),
            `${table} must not retain the browser owner policy`
         );
         assert(
            names.some((policy) => policy.endsWith('_runtime_all')),
            `${table} must have a runtime policy`
         );
      }

      const helpers = await pool.query(
         `select p.proname, p.prosecdef,
                 has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
                 has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
                 has_function_privilege('work_github_runtime', p.oid, 'EXECUTE') as runtime
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('work_current_workspace_id', 'work_current_user_id')`
      );
      assert(helpers.rows.length === 2, 'both context helpers must exist');
      for (const helper of helpers.rows) {
         assert(helper.prosecdef === false, `${helper.proname} must not be SECURITY DEFINER`);
         assert(
            helper.anon === false && helper.authenticated === false,
            'browser roles cannot execute'
         );
         assert(helper.runtime === true, 'runtime must execute the context helpers');
      }

      const journalPrivilege = await pool.query(
         `select has_table_privilege('anon', 'public.__ega_work_migrations', 'SELECT') as anon,
                 has_table_privilege('authenticated', 'public.__ega_work_migrations', 'SELECT') as authenticated,
                 has_table_privilege('work_github_runtime', 'public.__ega_work_migrations', 'SELECT') as runtime`
      );
      assert(
         journalPrivilege.rows[0].anon === false &&
            journalPrivilege.rows[0].authenticated === false &&
            journalPrivilege.rows[0].runtime === false,
         'no application role may read the migration journal'
      );

      await pool.query('create table public.house_documents (id int primary key, title text)');
      await pool.query("insert into public.house_documents values (1, 'House row')");
      await pool.query('create table auth.widgets (id int primary key)');
      await pool.query('insert into auth.widgets values (1)');

      console.log('PASS privileges, policies, helpers, and RLS match the runtime role model');

      // --- browser-role and runtime-role behavior -------------------------
      const workspaceA = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_workspaces (owner_id, name) values ($1, 'Workspace A') returning id`,
            [USER_A]
         );
         return result.rows[0].id;
      });
      const projectA = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_projects (workspace_id, name, description) values ($1, 'Project A', 'Saved') returning id`,
            [workspaceA]
         );
         return result.rows[0].id;
      });
      const issueA = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_issues (workspace_id, project_id, title, assignee_id)
             values ($1, $2, 'Issue A', $3) returning id, number, status`,
            [workspaceA, projectA, USER_A]
         );
         return { ...result.rows[0], number: Number(result.rows[0].number) };
      });
      assert(issueA.status === 'open', 'new issues start open');
      assert(issueA.number === 1, 'the first issue in a workspace is number 1');

      const issueA2 = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_issues (workspace_id, project_id, title)
             values ($1, $2, 'Issue A second') returning id`,
            [workspaceA, projectA]
         );
         return result.rows[0].id;
      });

      await asRuntime(pool, workspaceA, USER_A, (client) =>
         client.query(
            `insert into work_github_connections
               (workspace_id, provider_user_id, login, token_ciphertext, token_iv, token_tag,
                token_expires_at, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag,
                refresh_token_expires_at, installation_id)
             values ($1, '42', 'octocat', 'cipher-a', 'iv-a', 'tag-a', now() + interval '1 hour',
                     'refresh-cipher-a', 'refresh-iv-a', 'refresh-tag-a', now() + interval '30 days', 777)`,
            [workspaceA]
         )
      );
      await asRuntime(pool, workspaceA, USER_A, (client) =>
         client.query(
            `insert into work_github_oauth_states
               (state_hash, workspace_id, user_id, code_verifier_ciphertext, code_verifier_iv,
                code_verifier_tag, expires_at)
             values ('hash-a', $1, $2, 'verifier-cipher-a', 'verifier-iv-a', 'verifier-tag-a',
                     now() + interval '10 minutes')`,
            [workspaceA, USER_A]
         )
      );
      const prA = await asRuntime(pool, workspaceA, USER_A, async (client) => {
         const result = await client.query(
            `insert into work_pull_requests
               (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, title, state,
                last_checked_at, connection_generation, linked_by)
             values ($1, $2, 'ega-builds', 'ega-work', 1,
                     'https://github.com/ega-builds/ega-work/pull/1', 'A PR', 'open', now(), 0, $3)
             returning id`,
            [workspaceA, issueA.id, USER_A]
         );
         return result.rows[0].id;
      });
      assert(typeof prA === 'string', 'runtime can insert a PR without SELECT on work_issues');

      // One PR per issue and one use of a PR per workspace.
      await expectError(
         asRuntime(pool, workspaceA, USER_A, (client) =>
            client.query(
               `insert into work_pull_requests
                  (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, state)
                values ($1, $2, 'ega-builds', 'ega-work', 2,
                        'https://github.com/ega-builds/ega-work/pull/2', 'open')`,
               [workspaceA, issueA.id]
            )
         ),
         ['23505'],
         'an issue cannot link a second pull request'
      );
      await expectError(
         asRuntime(pool, workspaceA, USER_A, (client) =>
            client.query(
               `insert into work_pull_requests
                  (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, state)
                values ($1, $2, 'ega-builds', 'ega-work', 1,
                        'https://github.com/ega-builds/ega-work/pull/1', 'open')`,
               [workspaceA, issueA2]
            )
         ),
         ['23505'],
         'a pull request cannot be linked to two issues in one workspace'
      );

      // Browser roles cannot read, insert, update, or delete integration rows.
      for (const table of INTEGRATION_TABLES) {
         await expectError(
            asUser(pool, USER_A, (client) => client.query(`select count(*) from ${table}`)),
            ['42501'],
            `authenticated must not read ${table}`
         );
         await expectError(
            asUser(pool, USER_A, (client) =>
               client.query(
                  `insert into ${table} (workspace_id) values ($1) on conflict do nothing`,
                  [workspaceA]
               )
            ),
            ['42501'],
            `authenticated must not insert into ${table}`
         );
         await expectError(
            asUser(pool, USER_A, (client) =>
               client.query(
                  `update ${table} set ${
                     table === 'work_github_oauth_states'
                        ? 'consumed_at = now()'
                        : 'updated_at = now()'
                  }`
               )
            ),
            ['42501'],
            `authenticated must not update ${table}`
         );
         await expectError(
            asUser(pool, USER_A, (client) => client.query(`delete from ${table}`)),
            ['42501'],
            `authenticated must not delete ${table}`
         );
      }
      await expectError(
         asRole(pool, 'anon', null, null, (client) =>
            client.query('select count(*) from work_pull_requests')
         ),
         ['42501'],
         'anonymous requests must be denied'
      );

      // Runtime role cannot reach unrelated workspace, House, auth, or journal data.
      for (const target of [
         'work_workspaces',
         'work_projects',
         'work_issues',
         'house_documents',
         'auth.widgets',
         '__ega_work_migrations',
      ]) {
         await expectError(
            asRuntime(pool, workspaceA, USER_A, (client) =>
               client.query(`select count(*) from ${target}`)
            ),
            ['42501'],
            `runtime must not read ${target}`
         );
      }
      const sequencePrivilege = await pool.query(
         `select has_sequence_privilege('work_github_runtime',
                  'public.__ega_work_migrations_id_seq', 'USAGE') as allowed`
      );
      assert(
         sequencePrivilege.rows[0].allowed === false,
         'runtime must not use migration sequences'
      );

      // Runtime without context sees nothing; each context only sees its rows.
      const noContext = await asRuntime(pool, null, null, async (client) => {
         const result = await client.query(
            'select count(*)::int as count from work_github_connections'
         );
         return result.rows[0].count;
      });
      assert(noContext === 0, 'runtime without workspace context must see no connections');

      const workspaceB = await asUser(pool, USER_B, async (client) => {
         const result = await client.query(
            `insert into work_workspaces (owner_id, name) values ($1, 'Workspace B') returning id`,
            [USER_B]
         );
         return result.rows[0].id;
      });
      const projectB = await asUser(pool, USER_B, async (client) => {
         const result = await client.query(
            `insert into work_projects (workspace_id, name) values ($1, 'Project B') returning id`,
            [workspaceB]
         );
         return result.rows[0].id;
      });
      const issueB = await asUser(pool, USER_B, async (client) => {
         const result = await client.query(
            `insert into work_issues (workspace_id, project_id, title, assignee_id)
             values ($1, $2, 'Issue B', $3) returning id, number`,
            [workspaceB, projectB, USER_B]
         );
         return { ...result.rows[0], number: Number(result.rows[0].number) };
      });
      assert(issueB.number === 1, 'issue numbering is scoped to each workspace');

      await asRuntime(pool, workspaceB, USER_B, (client) =>
         client.query(
            `insert into work_github_connections
               (workspace_id, provider_user_id, login, token_ciphertext, token_iv, token_tag)
             values ($1, '43', 'hubot', 'cipher-b', 'iv-b', 'tag-b')`,
            [workspaceB]
         )
      );

      const isolated = await asRuntime(pool, workspaceB, USER_B, async (client) => {
         const connection = await client.query(
            'select count(*)::int as count from work_github_connections where workspace_id = $1',
            [workspaceA]
         );
         const pr = await client.query(
            'select count(*)::int as count from work_pull_requests where workspace_id = $1',
            [workspaceA]
         );
         return { connection: connection.rows[0].count, pr: pr.rows[0].count };
      });
      assert(
         isolated.connection === 0 && isolated.pr === 0,
         'runtime context B must not read workspace A integration rows'
      );

      await expectError(
         asRuntime(pool, workspaceA, USER_A, (client) =>
            client.query(
               `insert into work_pull_requests
                  (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, state)
                values ($1, $2, 'ega-builds', 'ega-work', 3,
                        'https://github.com/ega-builds/ega-work/pull/3', 'open')`,
               [workspaceA, issueB.id]
            )
         ),
         ['23503'],
         'a PR link cannot reference an issue outside the workspace context'
      );

      // PR state never changes issue status.
      const merged = await asRuntime(pool, workspaceA, USER_A, async (client) => {
         const result = await client.query(
            `update work_pull_requests set state = 'merged' where id = $1 returning state`,
            [prA]
         );
         return result.rows[0].state;
      });
      assert(merged === 'merged', 'runtime can update PR state');
      const statusAfterMerge = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(`select status from work_issues where id = $1`, [
            issueA.id,
         ]);
         return result.rows[0].status;
      });
      assert(statusAfterMerge === 'open', 'merging a PR must not change issue status');

      const completed = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(
            `update work_issues set status = 'completed' where id = $1 returning status`,
            [issueA.id]
         );
         return result.rows[0].status;
      });
      assert(completed === 'completed', 'owner can complete an issue');
      await asRuntime(pool, workspaceA, USER_A, (client) =>
         client.query(`update work_pull_requests set state = 'open' where id = $1`, [prA])
      );
      const statusAfterReopenPr = await asUser(pool, USER_A, async (client) => {
         const result = await client.query(`select status from work_issues where id = $1`, [
            issueA.id,
         ]);
         return result.rows[0].status;
      });
      assert(
         statusAfterReopenPr === 'completed',
         'changing PR state never reopens or completes an issue'
      );

      // v1.0 cross-user checks for workspace data remain intact.
      for (const table of ['work_workspaces', 'work_projects', 'work_issues']) {
         const count = await asUser(pool, USER_B, async (client) => {
            const column = table === 'work_workspaces' ? 'id' : 'workspace_id';
            const result = await client.query(
               `select count(*)::int as count from ${table} where ${column} = $1`,
               [workspaceA]
            );
            return result.rows[0].count;
         });
         assert(count === 0, `user B must not read user A rows from ${table}`);
      }
      await expectError(
         asUser(pool, USER_B, (client) =>
            client.query(`insert into work_projects (workspace_id, name) values ($1, 'Intruder')`, [
               workspaceA,
            ])
         ),
         ['42501'],
         'user B must not create a project inside user A workspace'
      );

      const updateOther = await asUser(pool, USER_B, async (client) => {
         const result = await client.query(
            `update work_projects set name = 'Hijacked' where id = $1`,
            [projectA]
         );
         return result.rowCount;
      });
      assert(updateOther === 0, 'user B must not update user A rows');

      console.log('PASS browser roles and the runtime role enforce the integration boundary');
      console.log('PASS one PR per issue, workspace isolation, and PR/issue status independence');

      // --- one-time state claim ------------------------------------------
      const stateClaim = await asRuntime(pool, workspaceA, USER_A, async (client) => {
         const first = await client.query(
            `update work_github_oauth_states set consumed_at = now()
             where state_hash = 'hash-a' and consumed_at is null returning id`
         );
         const second = await client.query(
            `update work_github_oauth_states set consumed_at = now()
             where state_hash = 'hash-a' and consumed_at is null returning id`
         );
         return [first.rowCount, second.rowCount];
      });
      assert(
         stateClaim[0] === 1 && stateClaim[1] === 0,
         'an OAuth state can be claimed exactly once'
      );

      await testCasRaces(pool, { workspaceA, issueA2, prA });

      if (runRealPaths) {
         await testStoreAndService({ pool, adminUrl, databaseName: name });
      } else {
         console.log(
            'SKIP real store/service paths: TEST_DATABASE_URL is not a local disposable server'
         );
      }
   } finally {
      await pool.end();
   }
}

async function testCasRaces(pool, { workspaceA, issueA2, prA }) {
   // Reset PR A so the refresh-claim race starts from an unleased row.
   await asRuntime(pool, workspaceA, USER_A, (client) =>
      client.query(
         `update work_pull_requests
          set refresh_lease_id = null, refresh_lease_expires_at = null, hidden = false
          where id = $1`,
         [prA]
      )
   );

   const leaseOne = '00000000-0000-4000-8000-0000000000a1';
   const leaseTwo = '00000000-0000-4000-8000-0000000000a2';
   const claims = await Promise.all(
      [leaseOne, leaseTwo].map((lease) =>
         asRuntime(pool, workspaceA, USER_A, async (client) => {
            const result = await client.query(
               `update work_pull_requests
                set attempt = attempt + 1, refresh_lease_id = $2,
                    refresh_lease_expires_at = now() + interval '30 seconds'
                where id = $1 and hidden = false
                  and (refresh_lease_id is null or refresh_lease_expires_at < now())
                returning attempt, refresh_lease_id`,
               [prA, lease]
            );
            return result.rowCount;
         })
      )
   );
   assert(
      claims.reduce((total, count) => total + count, 0) === 1,
      'only one concurrent refresh claim may win'
   );

   const claimed = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `select attempt, refresh_lease_id from work_pull_requests where id = $1`,
         [prA]
      );
      return result.rows[0];
   });

   // Unlink during an in-flight refresh: finalize must affect zero rows.
   await asRuntime(pool, workspaceA, USER_A, (client) =>
      client.query('delete from work_pull_requests where id = $1', [prA])
   );
   const afterUnlink = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `update work_pull_requests
          set state = 'closed', refresh_lease_id = null
          where id = $1 and attempt = $2 and refresh_lease_id = $3 and hidden = false
          returning id`,
         [prA, claimed.attempt, claimed.refresh_lease_id]
      );
      return result.rowCount;
   });
   assert(afterUnlink === 0, 'an unlinked PR cannot be restored by a late refresh');

   // Fresh PR for the disconnect race.
   const prForDisconnect = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `insert into work_pull_requests
            (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, title, state,
             last_checked_at, connection_generation, linked_by)
          values ($1, $2, 'ega-builds', 'other-repo', 4,
                  'https://github.com/ega-builds/other-repo/pull/4', 'Disconnect PR', 'open', now(), 0, $3)
          returning id`,
         [workspaceA, issueA2, USER_A]
      );
      return result.rows[0].id;
   });
   const refreshClaim = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `update work_pull_requests
          set attempt = attempt + 1, refresh_lease_id = $2,
              refresh_lease_expires_at = now() + interval '30 seconds'
          where id = $1 and hidden = false
          returning attempt, refresh_lease_id`,
         [prForDisconnect, leaseOne]
      );
      return result.rows[0];
   });

   const disconnect = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `update work_github_connections
          set connection_generation = connection_generation + 1,
              revoked_at = now(),
              token_ciphertext = null, token_iv = null, token_tag = null,
              refresh_token_ciphertext = null, refresh_token_iv = null, refresh_token_tag = null,
              installation_id = null, refresh_lease_id = null, refresh_lease_expires_at = null
          where workspace_id = $1
          returning connection_generation`,
         [workspaceA]
      );
      await client.query(
         `update work_pull_requests
          set hidden = true, title = null, state = null, url = null,
              last_checked_at = null, last_check_error = null, is_stale = true,
              refresh_lease_id = null, refresh_lease_expires_at = null
          where workspace_id = $1`,
         [workspaceA]
      );
      return result.rows[0].connection_generation;
   });
   assert(disconnect === 1, 'disconnect must bump the connection generation');

   const afterDisconnect = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const finalize = await client.query(
         `update work_pull_requests
          set state = 'closed', refresh_lease_id = null
          where id = $1 and attempt = $2 and refresh_lease_id = $3
            and connection_generation = 0 and hidden = false
          returning id`,
         [prForDisconnect, refreshClaim.attempt, refreshClaim.refresh_lease_id]
      );
      const row = await client.query(
         `select hidden, title, state, url from work_pull_requests where id = $1`,
         [prForDisconnect]
      );
      return { finalize: finalize.rowCount, row: row.rows[0] };
   });
   assert(afterDisconnect.finalize === 0, 'a late refresh cannot restore a disconnected PR');
   assert(
      afterDisconnect.row.hidden === true &&
         afterDisconnect.row.title === null &&
         afterDisconnect.row.state === null &&
         afterDisconnect.row.url === null,
      'disconnect must hide and clear private PR metadata'
   );

   // A callback state from before disconnect cannot overwrite the new generation.
   const staleReconnect = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `update work_github_connections
          set token_ciphertext = 'restored', token_iv = 'iv', token_tag = 'tag'
          where workspace_id = $1 and connection_generation = 0
          returning workspace_id`,
         [workspaceA]
      );
      return result.rowCount;
   });
   assert(staleReconnect === 0, 'an old callback generation cannot reconnect the workspace');

   // Token refresh lease is single-winner.
   await asRuntime(pool, workspaceA, USER_A, (client) =>
      client.query(
         `update work_github_connections
          set revoked_at = null,
              token_ciphertext = 'cipher-a', token_iv = 'iv-a', token_tag = 'tag-a',
              token_expires_at = now() - interval '1 minute',
              refresh_token_ciphertext = 'refresh-cipher-a', refresh_token_iv = 'iv-a',
              refresh_token_tag = 'tag-a', refresh_token_expires_at = now() + interval '30 days',
              refresh_lease_id = null, refresh_lease_expires_at = null
          where workspace_id = $1`,
         [workspaceA]
      )
   );

   const tokenLeases = await Promise.all(
      [leaseOne, leaseTwo].map((lease) =>
         asRuntime(pool, workspaceA, USER_A, async (client) => {
            const result = await client.query(
               `update work_github_connections
                set refresh_lease_id = $2,
                    refresh_lease_expires_at = now() + interval '30 seconds'
                where workspace_id = $1 and revoked_at is null
                  and refresh_lease_id is null
                returning token_version`,
               [workspaceA, lease]
            );
            return result.rowCount;
         })
      )
   );
   assert(
      tokenLeases.reduce((total, count) => total + count, 0) === 1,
      'only one concurrent token refresh lease may win'
   );

   const activeLease = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         'select refresh_lease_id from work_github_connections where workspace_id = $1',
         [workspaceA]
      );
      return result.rows[0].refresh_lease_id;
   });
   assert(typeof activeLease === 'string', 'the winning refresh lease must be stored');

   // A worker crash leaves a lease behind. The store's claim SQL only accepts a
   // null lease, so an expired lease is never reclaimed and its single-use
   // refresh token is never replayed.
   await asRuntime(pool, workspaceA, USER_A, (client) =>
      client.query(
         `update work_github_connections
          set refresh_lease_expires_at = now() - interval '1 second'
          where workspace_id = $1`,
         [workspaceA]
      )
   );
   const stalledReclaim = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `update work_github_connections
          set refresh_lease_id = $2, refresh_lease_expires_at = now() + interval '30 seconds'
          where workspace_id = $1 and refresh_lease_id is null
          returning workspace_id`,
         [workspaceA, leaseTwo]
      );
      return result.rowCount;
   });
   assert(stalledReclaim === 0, 'an expired lease with an owner must not be reclaimed');

   // The application never releases a stalled lease for another attempt.
   // A successful finalize is the only path that clears it.
   const finalized = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         `update work_github_connections
          set token_ciphertext = 'cipher-final', token_iv = 'iv-final', token_tag = 'tag-final',
              token_version = token_version + 1,
              refresh_lease_id = null, refresh_lease_expires_at = null
          where workspace_id = $1 and refresh_lease_id = $2
          returning refresh_lease_id`,
         [workspaceA, activeLease]
      );
      return result.rowCount === 1 && result.rows[0]?.refresh_lease_id === null;
   });
   assert(finalized === true, 'finalize must clear the refresh lease');

   // Successful re-authorization bumps the connection generation and carries
   // linked PR rows forward; an old callback generation then affects no rows.
   const beforeGeneration = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const result = await client.query(
         'select connection_generation from work_github_connections where workspace_id = $1',
         [workspaceA]
      );
      return result.rows[0].connection_generation;
   });
   const nextGeneration = beforeGeneration + 1;
   const savedGeneration = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      const saved = await client.query(
         `update work_github_connections
          set connection_generation = connection_generation + 1
          where workspace_id = $1 and connection_generation = $2
          returning connection_generation`,
         [workspaceA, beforeGeneration]
      );
      assert(saved.rowCount === 1, 'a current generation can be bumped');
      await client.query(
         `update work_pull_requests
          set connection_generation = $2
          where workspace_id = $1`,
         [workspaceA, saved.rows[0].connection_generation]
      );
      const pr = await client.query(
         `select distinct connection_generation
          from work_pull_requests where workspace_id = $1`,
         [workspaceA]
      );
      const stale = await client.query(
         `update work_github_connections
          set connection_generation = connection_generation + 1
          where workspace_id = $1 and connection_generation = $2
          returning workspace_id`,
         [workspaceA, beforeGeneration]
      );
      return {
         generation: saved.rows[0].connection_generation,
         prGenerations: pr.rows.map((row) => row.connection_generation),
         stale: stale.rowCount,
      };
   });
   assert(savedGeneration.generation === nextGeneration, 'connect must bump the generation');
   assert(
      savedGeneration.prGenerations.every((generation) => generation === nextGeneration),
      'linked PR rows must move to the new generation'
   );
   assert(savedGeneration.stale === 0, 'an old callback generation must not finalize');

   // A transient refresh failure marks observations stale without clearing the
   // last successful PR data, tokens, or the refresh lease.
   const transient = await asRuntime(pool, workspaceA, USER_A, async (client) => {
      await client.query(
         `update work_pull_requests
          set hidden = false, title = 'Preserved observation', state = 'closed',
              url = 'https://github.com/ega-builds/other-repo/pull/4',
              last_checked_at = timestamptz '2026-11-11 10:20:30+00',
              is_stale = false, last_check_error = null
          where id = $1`,
         [prForDisconnect]
      );
      await client.query(
         `update work_github_connections
          set revoked_at = null, refresh_lease_id = $2,
              refresh_lease_expires_at = now() + interval '30 seconds'
          where workspace_id = $1`,
         [workspaceA, leaseOne]
      );
      const snapshot = async () => {
         const result = await client.query(
            `select pr.title, pr.url, pr.state, pr.last_checked_at, pr.is_stale,
                    pr.last_check_error, c.token_ciphertext, c.refresh_lease_id
             from work_pull_requests pr
             cross join work_github_connections c
             where pr.id = $1 and c.workspace_id = $2`,
            [prForDisconnect, workspaceA]
         );
         return result.rows[0];
      };
      const before = await snapshot();
      await client.query(
         `update work_pull_requests
          set is_stale = true, last_check_error = 'outage', updated_at = now()
          where workspace_id = $1 and hidden = false`,
         [workspaceA]
      );
      return { before, after: await snapshot() };
   });
   assert(
      transient.after.title === 'Preserved observation' &&
         transient.after.url === 'https://github.com/ega-builds/other-repo/pull/4' &&
         transient.after.state === 'closed',
      'a transient refresh failure must preserve the last observation'
   );
   assert(
      transient.after.last_checked_at.getTime() === transient.before.last_checked_at.getTime(),
      'a transient refresh failure must preserve the last successful check time'
   );
   assert(
      transient.after.is_stale === true && transient.after.last_check_error === 'outage',
      'a transient refresh failure must mark the observation stale'
   );
   assert(
      transient.after.token_ciphertext === transient.before.token_ciphertext &&
         transient.after.refresh_lease_id === transient.before.refresh_lease_id,
      'a transient refresh failure must not clear tokens or the lease'
   );

   console.log(
      'PASS CAS races: single-winner leases, stalled lease, unlink, disconnect, generation'
   );
}

async function testStoreAndService({ pool, adminUrl, databaseName }) {
   const role = `ega_work_gh_${Date.now()}_${randomBytes(3).toString('hex')}`;
   const password = randomBytes(12).toString('hex');
   await pool.query(
      `create role "${role}" login password '${password}' in role work_github_runtime`
   );

   const databaseUrl = new URL(adminUrl.toString());
   databaseUrl.username = role;
   databaseUrl.password = password;
   databaseUrl.pathname = `/${databaseName}`;
   databaseUrl.search = '';
   databaseUrl.hash = '';
   const key = Buffer.alloc(32, 11);
   const config = {
      clientId: 'test-client-id-1234',
      clientSecret: 'test-client-secret-0123456789',
      appSlug: 'ega-work-test',
      tokenEncryptionKey: key,
      databaseUrl: databaseUrl.toString(),
      databaseCa: null,
   };

   const envKeys = [
      'NODE_ENV',
      'GITHUB_APP_CLIENT_ID',
      'GITHUB_APP_CLIENT_SECRET',
      'GITHUB_APP_SLUG',
      'WORK_TOKEN_ENCRYPTION_KEY',
      'WORK_GITHUB_DATABASE_URL',
      'WORK_GITHUB_DATABASE_CA_BASE64',
   ];
   const previousEnv = Object.fromEntries(envKeys.map((name) => [name, process.env[name]]));
   process.env.NODE_ENV = 'test';
   process.env.GITHUB_APP_CLIENT_ID = config.clientId;
   process.env.GITHUB_APP_CLIENT_SECRET = config.clientSecret;
   process.env.GITHUB_APP_SLUG = config.appSlug;
   process.env.WORK_TOKEN_ENCRYPTION_KEY = key.toString('base64');
   process.env.WORK_GITHUB_DATABASE_URL = config.databaseUrl;
   delete process.env.WORK_GITHUB_DATABASE_CA_BASE64;

   const token = (label) => ({
      accessCiphertext: `cipher-${label}`,
      accessIv: `iv-${label}`,
      accessTag: `tag-${label}`,
      accessExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      refreshCiphertext: `refresh-cipher-${label}`,
      refreshIv: `refresh-iv-${label}`,
      refreshTag: `refresh-tag-${label}`,
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
   });

   try {
      const workspace = await asUser(pool, USER_C, async (client) => {
         const result = await client.query(
            `insert into work_workspaces (owner_id, name) values ($1, 'Store workspace') returning id`,
            [USER_C]
         );
         return result.rows[0].id;
      });
      const project = await asUser(pool, USER_C, async (client) => {
         const result = await client.query(
            `insert into work_projects (workspace_id, name) values ($1, 'Store project') returning id`,
            [workspace]
         );
         return result.rows[0].id;
      });
      const createIssue = async (title) =>
         asUser(pool, USER_C, async (client) => {
            const result = await client.query(
               `insert into work_issues (workspace_id, project_id, title) values ($1, $2, $3) returning id`,
               [workspace, project, title]
            );
            return result.rows[0].id;
         });
      const issueOne = await createIssue('Store issue one');
      const issueTwo = await createIssue('Store issue two');

      const connected = await githubStore.saveConnection(config, {
         workspaceId: workspace,
         stateGeneration: 0,
         providerUserId: '100',
         login: 'octocat',
         ...token('one'),
      });
      assert(connected.kind === 'saved', 'saveConnection must create the connection');
      assert(
         connected.row.connection_generation === 1,
         'a new connection must start at generation 1'
      );

      const installationA = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 1001,
         generation: 1,
      });
      assert(installationA.kind === 'saved', 'the first installation selection must save');
      const generationA = installationA.row.connection_generation;
      assert(
         generationA === 2 && installationA.hiddenCount === 0,
         'first switch has nothing to hide'
      );

      const linkOne = await githubStore.insertPullRequest(config, {
         workspaceId: workspace,
         userId: USER_C,
         issueId: issueOne,
         owner: 'ega-builds',
         repo: 'ega-work',
         number: 1,
         url: 'https://github.com/ega-builds/ega-work/pull/1',
         title: 'Visible observation',
         state: 'open',
         generation: generationA,
      });
      assert(linkOne.kind === 'saved', 'a verified link must save');

      const claimed = await githubStore.claimPullRequestRefresh(config, {
         workspaceId: workspace,
         issueId: issueOne,
         generation: generationA,
      });
      assert(claimed, 'an in-flight refresh must claim the PR lease');

      const installationB = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 2002,
         generation: generationA,
      });
      assert(installationB.kind === 'saved', 'switching installations must save');
      assert(
         installationB.row.connection_generation === generationA + 1,
         'switching installations must bump the generation'
      );
      assert(installationB.hiddenCount === 1, 'switching must hide one visible PR');

      const hidden = await githubStore.readPullRequest(config, workspace, issueOne);
      assert(
         hidden?.hidden === true &&
            hidden.title === null &&
            hidden.url === null &&
            hidden.state === null &&
            hidden.last_checked_at === null &&
            hidden.last_check_error === null &&
            hidden.refresh_lease_id === null,
         'installation switch must hide and clear observation metadata and the PR lease'
      );

      const lateFinalize = await githubStore.finalizePullRequestRefresh(config, {
         workspaceId: workspace,
         issueId: issueOne,
         pullRequestId: claimed.id,
         attempt: claimed.attempt,
         generation: generationA,
         leaseId: claimed.refresh_lease_id,
         outcome: {
            kind: 'success',
            title: 'Late observation',
            state: 'merged',
            url: 'https://github.com/ega-builds/ega-work/pull/1',
         },
      });
      assert(lateFinalize === null, 'a late refresh must finalize zero rows after a switch');

      const lateLink = await githubStore.insertPullRequest(config, {
         workspaceId: workspace,
         userId: USER_C,
         issueId: issueOne,
         owner: 'ega-builds',
         repo: 'ega-work',
         number: 1,
         url: 'https://github.com/ega-builds/ega-work/pull/1',
         title: 'Late link',
         state: 'open',
         generation: generationA,
      });
      assert(lateLink.kind === 'stale', 'a delayed link from the old generation must be stale');
      assert(
         (await githubStore.readPullRequest(config, workspace, issueOne))?.hidden === true,
         'a delayed link must not restore the hidden row'
      );

      const reselect = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 2002,
         generation: installationB.row.connection_generation,
      });
      assert(reselect.kind === 'unchanged', 'reselecting the same installation must be unchanged');

      const linkTwo = await githubStore.insertPullRequest(config, {
         workspaceId: workspace,
         userId: USER_C,
         issueId: issueTwo,
         owner: 'ega-builds',
         repo: 'ega-work',
         number: 2,
         url: 'https://github.com/ega-builds/ega-work/pull/2',
         title: 'Second observation',
         state: 'closed',
         generation: installationB.row.connection_generation,
      });
      assert(linkTwo.kind === 'saved', 'a link under the current generation must save');
      const reselectWithPr = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 2002,
         generation: installationB.row.connection_generation,
      });
      assert(reselectWithPr.kind === 'unchanged', 'unchanged must not bump the generation');
      assert(
         (await githubStore.readPullRequest(config, workspace, issueTwo))?.hidden === false,
         'unchanged must not hide a currently visible PR'
      );

      const expectedGeneration = installationB.row.connection_generation;
      const concurrent = await Promise.all([
         githubStore.selectInstallation(config, {
            workspaceId: workspace,
            installationId: 3003,
            generation: expectedGeneration,
         }),
         githubStore.selectInstallation(config, {
            workspaceId: workspace,
            installationId: 4004,
            generation: expectedGeneration,
         }),
      ]);
      assert(
         concurrent.filter((result) => result.kind === 'saved').length === 1,
         'only one concurrent installation switch may save'
      );
      assert(
         concurrent.some((result) => result.kind === 'stale' || result.kind === 'conflict'),
         'the losing concurrent switch must be stale or conflict'
      );
      const afterConcurrent = await githubStore.readConnection(config, workspace);
      assert(
         afterConcurrent &&
            afterConcurrent.connection_generation === expectedGeneration + 1 &&
            [3003, 4004].includes(Number(afterConcurrent.installation_id)),
         'concurrent switches must leave one complete selection'
      );
      assert(
         (await githubStore.readPullRequest(config, workspace, issueTwo))?.hidden === true,
         'a successful switch must hide the visible PR'
      );

      const staleSwitch = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 5005,
         generation: expectedGeneration,
      });
      assert(staleSwitch.kind === 'stale', 'an old generation must be stale');

      const activeLeaseId = '00000000-0000-4000-8000-0000000000b1';
      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_github_connections
             set refresh_lease_id = $2, refresh_lease_expires_at = now() + interval '30 seconds'
             where workspace_id = $1`,
            [workspace, activeLeaseId]
         )
      );
      const beforeLease = await githubStore.readConnection(config, workspace);
      const activeLeaseSwitch = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 5005,
         generation: beforeLease.connection_generation,
      });
      assert(activeLeaseSwitch.kind === 'conflict', 'an active lease must block the switch');
      const afterActiveLease = await githubStore.readConnection(config, workspace);
      assert(
         afterActiveLease.installation_id === beforeLease.installation_id &&
            afterActiveLease.refresh_lease_id === activeLeaseId &&
            afterActiveLease.connection_generation === beforeLease.connection_generation,
         'an active lease conflict must not change the selection or lease'
      );

      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_github_connections
             set refresh_lease_expires_at = now() - interval '1 second'
             where workspace_id = $1`,
            [workspace]
         )
      );
      const expiredLeaseSwitch = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 5005,
         generation: beforeLease.connection_generation,
      });
      assert(expiredLeaseSwitch.kind === 'conflict', 'an expired lease must block the switch');
      const afterExpiredLease = await githubStore.readConnection(config, workspace);
      assert(
         afterExpiredLease.installation_id === beforeLease.installation_id &&
            afterExpiredLease.refresh_lease_id === activeLeaseId,
         'an expired lease conflict must leave the lease and selection untouched'
      );

      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_github_connections
             set refresh_lease_id = null, refresh_lease_expires_at = null
             where workspace_id = $1`,
            [workspace]
         )
      );

      const otherWorkspace = await asUser(pool, USER_D, async (client) => {
         const result = await client.query(
            `insert into work_workspaces (owner_id, name) values ($1, 'Other workspace') returning id`,
            [USER_D]
         );
         return result.rows[0].id;
      });
      const otherConnected = await githubStore.saveConnection(config, {
         workspaceId: otherWorkspace,
         stateGeneration: 0,
         providerUserId: '200',
         login: 'hubot',
         ...token('other'),
      });
      assert(otherConnected.kind === 'saved', 'the other workspace connection must save');
      const otherSelected = await githubStore.selectInstallation(config, {
         workspaceId: otherWorkspace,
         installationId: 7007,
         generation: otherConnected.row.connection_generation,
      });
      assert(otherSelected.kind === 'saved', 'the other workspace must select its installation');
      const current = await githubStore.readConnection(config, workspace);
      const otherSwitch = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: 8008,
         generation: current.connection_generation,
      });
      assert(otherSwitch.kind === 'saved', 'workspace A must still switch independently');
      const otherAfter = await githubStore.readConnection(config, otherWorkspace);
      assert(
         otherAfter.installation_id === otherSelected.row.installation_id &&
            otherAfter.connection_generation === otherSelected.row.connection_generation,
         'a switch in one workspace must not affect another'
      );

      // Fix B: same-provider reconnect invalidates observations and keeps the
      // connection usable with the installation retained.
      const beforeReconnect = await githubStore.readConnection(config, workspace);
      const reconnect = await githubStore.saveConnection(config, {
         workspaceId: workspace,
         stateGeneration: beforeReconnect.connection_generation,
         providerUserId: beforeReconnect.provider_user_id,
         login: beforeReconnect.login,
         ...token('reconnect'),
      });
      assert(reconnect.kind === 'saved', 'same-account reconnect must save');
      assert(
         reconnect.row.connection_generation === beforeReconnect.connection_generation + 1,
         'same-account reconnect must bump the generation'
      );
      assert(
         reconnect.row.installation_id === beforeReconnect.installation_id,
         'same-account reconnect must retain the installation'
      );
      assert(
         reconnect.row.revoked_at === null &&
            reconnect.row.token_ciphertext === 'cipher-reconnect' &&
            reconnect.row.token_version === beforeReconnect.token_version + 1,
         'same-account reconnect must leave a usable token'
      );
      for (const issueId of [issueOne, issueTwo]) {
         const row = await githubStore.readPullRequest(config, workspace, issueId);
         assert(
            row?.hidden === true &&
               row.title === null &&
               row.url === null &&
               row.state === null &&
               row.last_checked_at === null,
            'same-account reconnect must hide and clear every PR'
         );
      }

      const afterReconnect = await githubStore.readConnection(config, workspace);
      const selectAfterReconnect = await githubStore.selectInstallation(config, {
         workspaceId: workspace,
         installationId: Number(afterReconnect.installation_id),
         generation: afterReconnect.connection_generation,
      });
      assert(
         selectAfterReconnect.kind === 'unchanged',
         'reselecting the retained installation must not reveal hidden PRs'
      );
      assert(
         (await githubStore.readPullRequest(config, workspace, issueTwo))?.hidden === true,
         'installation selection alone must not reveal hidden PRs'
      );

      const relink = await githubStore.insertPullRequest(config, {
         workspaceId: workspace,
         userId: USER_C,
         issueId: issueTwo,
         owner: 'ega-builds',
         repo: 'ega-work',
         number: 2,
         url: 'https://github.com/ega-builds/ega-work/pull/2',
         title: 'Relinked observation',
         state: 'open',
         generation: afterReconnect.connection_generation,
      });
      assert(relink.kind === 'saved', 'a fresh link under the new generation must save');
      assert(
         (await githubStore.readPullRequest(config, workspace, issueTwo))?.hidden === false,
         'the relinked PR must be visible'
      );
      assert(
         (await githubStore.readPullRequest(config, workspace, issueOne))?.hidden === true,
         'the old PR must stay hidden until explicitly relinked'
      );

      const visibleView = await getGithubIssueView(workspace, issueTwo);
      assert(
         visibleView.status === 'connected' && visibleView.pullRequest !== null,
         'the read path must project a matching visible PR'
      );
      assert(visibleView.needsRelink === false, 'a visible PR must not request relinking');

      const hiddenView = await getGithubIssueView(workspace, issueOne);
      assert(hiddenView.pullRequest === null, 'a hidden PR must not be projected');
      assert(hiddenView.needsRelink === true, 'a hidden row must request relinking');

      const currentAfterReconnect = await githubStore.readConnection(config, workspace);
      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_pull_requests set connection_generation = $2, hidden = false where id = $1`,
            [relink.row.id, currentAfterReconnect.connection_generation - 1]
         )
      );
      const oldGenerationView = await getGithubIssueView(workspace, issueTwo);
      assert(
         oldGenerationView.pullRequest === null && oldGenerationView.needsRelink === true,
         'an old-generation PR must not be projected and must request relinking'
      );
      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(`update work_pull_requests set connection_generation = $2 where id = $1`, [
            relink.row.id,
            currentAfterReconnect.connection_generation,
         ])
      );

      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_github_connections set installation_id = null where workspace_id = $1`,
            [workspace]
         )
      );
      const noInstallationView = await getGithubIssueView(workspace, issueTwo);
      assert(
         noInstallationView.pullRequest === null,
         'a connection without a selected installation must not project PR data'
      );
      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_github_connections set installation_id = $2 where workspace_id = $1`,
            [workspace, currentAfterReconnect.installation_id]
         )
      );

      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_github_connections set revoked_at = now() where workspace_id = $1`,
            [workspace]
         )
      );
      const revokedView = await getGithubIssueView(workspace, issueTwo);
      assert(
         revokedView.status === 'reauthorization_required' &&
            revokedView.pullRequest === null &&
            revokedView.needsRelink === false,
         'a revoked connection must not project PR data'
      );
      await asRuntime(pool, workspace, USER_C, (client) =>
         client.query(
            `update work_github_connections set revoked_at = null where workspace_id = $1`,
            [workspace]
         )
      );

      console.log('PASS real store/service installation, reconnect, and read-path behavior');
   } finally {
      await githubStore.closeGithubPool();
      for (const name of envKeys) {
         if (previousEnv[name] === undefined) {
            delete process.env[name];
         } else {
            process.env[name] = previousEnv[name];
         }
      }
      await pool.query(`drop role if exists "${role}"`).catch((error) => {
         console.error(
            `WARN disposable login role cleanup did not complete: ${error.code ?? 'error'}`
         );
      });
   }
}

function asRole(pool, role, workspaceId, userId, callback) {
   return withTransaction(pool, async (client) => {
      await client.query(`set local role ${role}`);
      await client.query(
         `select set_config('work.workspace_id', $1, true),
                 set_config('work.user_id', $2, true)`,
         [workspaceId ?? '', userId ?? '']
      );
      return callback(client);
   });
}

function asUser(pool, userId, callback, role = 'authenticated') {
   return withTransaction(pool, async (client) => {
      await client.query(`set local role ${role}`);
      if (userId) {
         await client.query('select set_config($1, $2, true)', [
            'request.jwt.claims',
            JSON.stringify({ sub: userId, role }),
         ]);
      }
      return callback(client);
   });
}

function asRuntime(pool, workspaceId, userId, callback) {
   return asRole(pool, 'work_github_runtime', workspaceId, userId, callback);
}

async function withTransaction(pool, callback) {
   const client = await pool.connect();
   try {
      await client.query('begin');
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

main().catch((error) => {
   console.error(`FAIL ${error.message}`);
   process.exitCode = 1;
});
