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

RLS is the authorization boundary. Migrations grant Work tables only to the
Supabase `authenticated` role and revoke `anon`. Policies scope every row to a
workspace whose `owner_id = auth.uid()`. User-facing requests go through the
request-scoped Supabase client with the signed-in user's session; the
privileged migration connection is never used by application code.

Issue numbers are allocated per workspace by a `SECURITY DEFINER` before-insert
trigger that increments only the calling owner's counter and checks
`auth.uid()`. The counter table is not exposed to either browser role. The
human-readable identifier is `W-<number>` within that workspace; the same
number can exist in another workspace. Pull requests reference
`(issue_id, workspace_id)` so a link can never cross workspaces.

## Change and apply the schema

1. Define the required tables in `db/schema.ts`. Add and review RLS policies and grants with the table changes; do not rely on client-side filtering for privacy.
2. Run `pnpm db:generate --name <change>` and review the generated SQL and journal under `drizzle/`. Commit both alongside the schema change. Append any necessary RLS SQL to the generated migration.
3. Run `pnpm db:migrate:dev`. Drizzle applies pending migrations and records them in `public.__ega_work_migrations`. This command is for the designated development project only.
4. Verify the actual user journey with separate authenticated users, including reload persistence and refusal of cross-user access.

## Test migrations and RLS

`pnpm test:db` creates a disposable database on the configured development
instance, creates minimal `auth.uid()`/role stubs, and reproduces Supabase's
default public-schema grants before applying the committed migration history.
It then checks that every migration is recorded, that re-running the migrator
applies nothing new, that RLS is enabled on all six tables, that `anon` has no
table or journal-sequence access, and that the counter table is unreachable by
browser roles. Two simulated users prove workspace uniqueness, per-workspace
concurrent numbering, isolation for all six tables, anonymous denial,
cross-workspace issue and PR rejection, invalid-status rejection, and PR/issue
status independence. It drops the database before exit and prints no
credentials. The migration SQL itself is not idempotent; the journal is what
prevents re-application.

In CI no development secret is available. The workflow starts the runner's local
PostgreSQL service and sets:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres pnpm test:db
```

The test script only accepts a non-local `TEST_DATABASE_URL` when
`TEST_DATABASE_ALLOW_REMOTE=1` is set explicitly. On a local server it creates
the `anon` and `authenticated` roles when they are missing; those roles are
cluster-scoped, matching Supabase.

## Rollback and recovery

Drizzle migrations are forward-only. To recover a development mistake, restore
the project from a Supabase backup or create a fresh disposable database and
apply the committed history. Do not edit or delete an applied migration that
other environments may have recorded. Production migrations and deployment
require separate authorization.

References: [Supabase with Drizzle](https://supabase.com/docs/guides/database/drizzle), [Supabase Postgres connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Drizzle migrations](https://orm.drizzle.team/docs/drizzle-kit-migrate), and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
