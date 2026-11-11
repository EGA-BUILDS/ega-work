# Development database migrations

Drizzle owns the versioned SQL migrations in `drizzle/`. Supabase Auth and request-scoped Supabase clients remain the authority for user identity and RLS. The migration connection has elevated privileges and must never be used for user-facing queries or exposed to the browser.

## Configure development

1. Identify the designated **development** Supabase project in its dashboard. Do not assume the project used for authentication is isolated from production or other applications.
2. Copy `.env.dev.example` to `.env.dev`. Set `DEV_SUPABASE_PROJECT_REF` to that project's reference and `DEV_DATABASE_URL` to its Postgres connection string from **Connect**. The password must be URL-encoded if it contains reserved characters.
3. Use the direct connection or the session pooler on port 5432. The transaction pooler is not supported for migrations. Remove connection-string query parameters; the migration runner requires verified TLS itself. The direct connection may require IPv6; use the session pooler if the VM has no IPv6 connectivity.
4. If the database certificate is not trusted by the VM, download the database CA from **Project Settings > Database > SSL Configuration** in Supabase and save it as `certs/supabase-ca.crt`. The runner uses this CA when present and otherwise uses Node's default trust store. Verify the certificate comes from the intended project; never disable TLS verification.

The runner reads only `.env.dev`, ignoring inherited environment variables. It checks the project reference against the direct hostname or session-pooler username before connecting, rejects other targets and uses certificate-verified TLS. This catches connection mix-ups, but it cannot establish whether the chosen project is truly a development project. Confirm that designation in Supabase before the first migration.

## Current target and ownership

The configured development project also hosts other application tables in its
`public` schema. EGA Work therefore:

- uses the `work_` table prefix for every Work table;
- stores its Drizzle journal in `public.__ega_work_migrations`, separate from
  another application's `drizzle.__drizzle_migrations` journal;
- creates no foreign keys or policies on another application's tables;
- treats the configured project as a shared development target. Separate,
  isolated Beta and Stable projects remain an owner decision and are not
  established by a successful connection or migration.

RLS is the authorization boundary. Migrations grant the Work workspace,
project, and issue tables only to the Supabase `authenticated` role and revoke
`anon`. Policies scope every row to a workspace whose `owner_id = auth.uid()`.
User-facing requests go through the request-scoped Supabase client with the
signed-in user's session; the privileged migration connection is never used by
application code.

Migration `0002_github_app_user_tokens` moves the three GitHub integration
tables out of the browser role entirely:

- `work_pull_requests`, `work_github_connections`, and
  `work_github_oauth_states` are revoked from `PUBLIC`, `anon`, and
  `authenticated`, and their old browser policies are dropped.
- The `work_github_runtime` role (NOLOGIN) is the only role with table
  privileges. Its policies scope rows by
  `public.work_current_workspace_id()` or `public.work_current_user_id()`,
  which read `work.workspace_id` and `work.user_id` set per transaction by the
  server. Both helpers are `STABLE`, not `SECURITY DEFINER`, and executable only
  by the runtime role.
- The runtime role receives `USAGE` on `public` and only the four DML privileges
  on those three tables. It has no privileges on Work workspace/project/issue
  tables, sequences, the migration journal, House tables, or `auth`.
- RLS is forced on all three integration tables, so even a non-superuser table
  owner cannot bypass policies. The application role must not own them.
- Foreign-key checks do not require runtime `SELECT` on the parent Work tables.
  The migration test proves a runtime insert with a cross-workspace issue fails
  with a foreign-key error and a valid insert succeeds.

Issue numbers are allocated per workspace by a `SECURITY DEFINER` before-insert
trigger that increments only the calling owner's counter and checks
`auth.uid()`. The counter table is not exposed to either browser role. The
human-readable identifier is `W-<number>` within that workspace; the same
number can exist in another workspace. Pull requests reference
`(issue_id, workspace_id)` so a link can never cross workspaces.

Every successful GitHub connect bumps `work_github_connections.
connection_generation` and hides every cached pull-request observation, even for
the same GitHub provider user. Switching the selected installation also bumps
the generation and hides all links in the same transaction. An explicit relink
under the new generation is required before a link is projected again. A
callback holding an older generation finalizes nothing. The generation is also
part of every refresh, link, installation switch, and disconnect
compare-and-set.

## GitHub runtime role

Provisioning is an operational step; it is not stored in a migration and no
password is committed:

1. Create a LOGIN role and make it a member of the migration-created runtime
   role. Use a unique password and a dedicated database user:

   ```sql
   create role work_github_login login password '<generated-secret>'
      in role work_github_runtime;
   ```

2. Set `WORK_GITHUB_DATABASE_URL` to that login's connection string, for
   example `postgresql://work_github_login:<encoded-secret>@db.example:5432/postgres`.
   The URL must include a database path and must not contain query parameters or
   a fragment; identity (`host`, `user`) and TLS (`sslmode`) cannot be overridden
   from the connection string. The application verifies at runtime that
   `current_user` is not a superuser, does not bypass RLS, is a member of
   `work_github_runtime`, and owns none of the three integration tables.
3. For a non-loopback host, TLS is always verified. If the VM does not trust the
   database CA, set `WORK_GITHUB_DATABASE_CA_BASE64` to the base64-encoded CA.
   Plaintext is allowed only for a loopback host (`localhost`, `127.0.0.1`,
   `::1`, `[::1]`) outside production; a loopback URL is rejected when
   `NODE_ENV=production`.
4. Rotate the password through the database owner and update the server
   environment. Disconnect and reconnect workspaces after rotating
   `WORK_TOKEN_ENCRYPTION_KEY`; old ciphertext cannot be read with a new key.

## Change and apply the schema

1. Define the required tables in `db/schema.ts`. Add and review RLS policies and grants with the table changes; do not rely on client-side filtering for privacy.
2. Run `pnpm db:generate --name <change>` and review the generated SQL and journal under `drizzle/`. Commit both alongside the schema change. Append any necessary RLS SQL to the generated migration.
3. Run `pnpm db:migrate:dev`. Drizzle applies pending migrations and records them in `public.__ega_work_migrations`. This command is for the designated development project only.
4. Verify the actual user journey with separate authenticated users, including reload persistence and refusal of cross-user access.

## Test migrations and RLS

`pnpm test:db` uses a disposable local PostgreSQL server and never the shared
Supabase project. It creates two temporary databases, creates minimal
`auth.uid()`/role stubs, and reproduces Supabase's default public-schema grants
before applying the committed migrations.

The first database applies migrations `0000` and `0001`, inserts v1.0 workspace,
connection, state, and pull-request rows as `authenticated`, then applies
migration `0002` to prove existing rows and their encrypted token fields survive
and new columns receive safe defaults.

The second database applies the full history from empty, then checks:

- every migration is recorded (`0000`, `0001`, `0002`) and re-running the
  migrator applies nothing new;
- RLS is enabled on all six Work tables and the old browser owner policies are
  gone from the three integration tables;
- `anon` and `authenticated` cannot SELECT, INSERT, UPDATE, or DELETE the three
  integration tables, while `work_github_runtime` can;
- the runtime role cannot read Work workspace/project/issue tables, House
  example tables, `auth` tables, the migration journal, or its sequences;
- two simulated users prove workspace uniqueness, per-workspace concurrent
  numbering, browser isolation for workspace data, runtime A/B isolation for
  integration data, foreign-key checks without parent `SELECT`, one PR per
  issue, and PR/issue status independence;
- one-time OAuth state claim and the refresh/token CAS races are single-winner;
  an expired lease with an owner is not reclaimable and finalize is the only
  path that clears it, unlink or disconnect during a refresh commits zero rows,
  a transient token-refresh failure preserves the last observation and marks it
  stale, a successful re-authorization or installation switch bumps the
  generation and hides linked PRs, and a stale callback generation cannot
  reconnect.

When `TEST_DATABASE_URL` points at a local server, the harness also creates a
disposable login role that is a member of `work_github_runtime`, points a
`GithubConfig` at the temporary database, and calls the actual store/service
exports. It runs Node with `--conditions=react-server` so the `server-only`
package resolves to its empty react-server entry. These tests cover atomic
installation switches, delayed refresh/link races, same-account reconnect,
generation-guarded reads, hidden-link relinking, and the read-path projection
gate.

It drops both databases before exit and prints no credentials. The migration SQL
is not idempotent; the journal is what prevents re-application.

In CI no development secret is available. The workflow starts the runner's local
PostgreSQL service and sets:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres pnpm test:db
```

The test script only accepts a non-local `TEST_DATABASE_URL` when
`TEST_DATABASE_ALLOW_REMOTE=1` is set explicitly. On a local server it creates
the `anon` and `authenticated` roles when they are missing; those roles and
`work_github_runtime` are cluster-scoped, matching Supabase.

## Rollback and recovery

Drizzle migrations are forward-only. To recover a development mistake, restore
the project from a Supabase backup or create a fresh disposable database and
apply the committed history. Do not edit or delete an applied migration that
other environments may have recorded. Production migrations and deployment
require separate authorization.

References: [Supabase with Drizzle](https://supabase.com/docs/guides/database/drizzle), [Supabase Postgres connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Drizzle migrations](https://orm.drizzle.team/docs/drizzle-kit-migrate), and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
