#!/usr/bin/env node
/**
 * Applies the committed migrations to a disposable PostgreSQL database and
 * proves the workspace/RLS boundary with two simulated authenticated users and
 * an anonymous role.
 *
 * Local use reads `.env.dev` and creates a temporary database on the same
 * verified development instance. CI sets TEST_DATABASE_URL to a local server.
 * The database is dropped before exit. No credentials are printed.
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
   const adminPool = new pg.Pool({
      connectionString: adminUrl.toString(),
      ssl,
      max: 1,
   });

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
         assert(journal.rows[0].count === 1, 'expected exactly one applied migration');

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
         assert(duplicate === 0, 'concurrent/repeated workspace creation must not duplicate');

         const workspaceCount = await asUser(USER_A, async (client) => {
            const result = await client.query('select count(*)::int as count from work_workspaces');
            return result.rows[0].count;
         });
         assert(workspaceCount === 1, 'user A must see exactly one workspace');

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
            return result.rows[0];
         });
         assert(issueA.status === 'open', 'new issues start open');
         assert(issueA.number > 0, 'new issues receive a durable number');

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

         for (const table of [
            'work_workspaces',
            'work_projects',
            'work_issues',
            'work_pull_requests',
            'work_github_connections',
         ]) {
            const count = await asUser(USER_B, async (client) => {
               const result = await client.query(`select count(*)::int as count from ${table}`);
               return result.rows[0].count;
            });
            assert(count === 0, `user B must not read any row from ${table}`);
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

         const workspaceB = await asUser(USER_B, async (client) => {
            const result = await client.query(
               `insert into work_workspaces (owner_id, name) values ($1, 'Workspace B') returning id`,
               [USER_B]
            );
            return result.rows[0].id;
         });

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

         const anonymousCount = await asUser(
            null,
            async (client) => {
               const result = await client.query(
                  'select count(*)::int as count from work_workspaces'
               );
               return result.rows[0].count;
            },
            'anon'
         ).catch((error) => {
            if (error.code === '42501') return 0;
            throw error;
         });
         assert(anonymousCount === 0, 'anonymous requests must not read workspaces');

         const link = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `insert into work_pull_requests (workspace_id, issue_id, repo_owner, repo_name, pr_number, url, state, last_checked_at)
                values ($1, $2, 'EGA-BUILDS', 'ega-work', 1, 'https://github.com/EGA-BUILDS/ega-work/pull/1', 'open', now())
                returning id`,
               [workspaceA, issueA.id]
            );
            return result.rows[0].id;
         });
         assert(link, 'owner can store a PR observation');

         const statusAfterPr = await asUser(USER_A, async (client) => {
            const result = await client.query(
               `update work_issues set status = 'open' where id = $1 returning status, (select state from work_pull_requests where id = $2) as pr_state`,
               [issueA.id, link]
            );
            return result.rows[0];
         });
         assert(
            statusAfterPr.status === 'open' && statusAfterPr.pr_state === 'open',
            'issue status and PR state remain independent'
         );

         console.log('PASS workspace creation is unique and repeatable');
         console.log('PASS migration, constraints, RLS and PR/status independence verified');
      } finally {
         await pool.end();
      }
   } finally {
      if (created) {
         try {
            await adminPool.query(
               `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1`,
               [databaseName]
            );
            await adminPool.query(`drop database if exists "${databaseName}" with (force)`);
         } catch (error) {
            console.error(
               `WARN disposable database cleanup did not complete: ${error.code ?? 'error'}`
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
