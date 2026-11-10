# Development database migrations

Drizzle owns the versioned SQL migrations in `drizzle/`. Supabase Auth and request-scoped Supabase clients remain the authority for user identity and RLS. The migration connection has elevated privileges and must never be used for user-facing queries or exposed to the browser.

## Configure development

1. Identify the designated **development** Supabase project in its dashboard. Do not assume the project used for authentication is isolated from production or other applications.
2. Copy `.env.dev.example` to `.env.dev`. Set `DEV_SUPABASE_PROJECT_REF` to that project's reference and `DEV_DATABASE_URL` to its Postgres connection string from **Connect**. The password must be URL-encoded if it contains reserved characters.
3. Use the direct connection or the session pooler on port 5432. The transaction pooler is not supported for migrations. Remove connection-string query parameters; the migration runner requires verified TLS itself. The direct connection may require IPv6; use the session pooler if the VM has no IPv6 connectivity.
4. If the database certificate is not trusted by the VM, download the database CA from **Project Settings > Database > SSL Configuration** in Supabase and save it as `certs/supabase-ca.crt`. The runner uses this CA when present and otherwise uses Node's default trust store. Verify the certificate comes from the intended project; never disable TLS verification.

The runner reads only `.env.dev`, ignoring inherited environment variables. It checks the project reference against the direct hostname or session-pooler username before connecting, rejects other targets and uses certificate-verified TLS. This catches connection mix-ups, but it cannot establish whether the chosen project is truly a development project. Confirm that designation in Supabase before the first migration.

## Change and apply the schema

1. Define the required tables in `db/schema.ts`. Add and review RLS policies and grants with the table changes; do not rely on client-side filtering for privacy.
2. Run `pnpm db:generate` and review the generated SQL and journal under `drizzle/`. Commit both alongside the schema change. Add any necessary RLS SQL to the migration.
3. Run `pnpm db:migrate:dev`. Drizzle applies pending migrations and records them in its migration table. This command is for the designated development project only.
4. Verify the actual user journey with separate authenticated users, including reload persistence and refusal of cross-user access.

There are no application tables or migrations yet. `.env.dev` is ignored by Git. Vercel authentication variables do not supply the Postgres password or automatically configure this local file. Production migrations and deployment require separate authorization.

References: [Supabase with Drizzle](https://supabase.com/docs/guides/database/drizzle), [Supabase Postgres connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Drizzle migrations](https://orm.drizzle.team/docs/drizzle-kit-migrate), and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
