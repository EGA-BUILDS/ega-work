ALTER TABLE "work_github_connections" ALTER COLUMN "token_ciphertext" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_github_connections" ALTER COLUMN "token_iv" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_github_connections" ALTER COLUMN "token_tag" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "refresh_token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "refresh_token_iv" text;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "refresh_token_tag" text;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "installation_id" bigint;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "connection_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "refresh_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD COLUMN "refresh_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_github_oauth_states" ADD COLUMN "connection_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD COLUMN "connection_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD COLUMN "refresh_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD COLUMN "refresh_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD COLUMN "linked_by" uuid;--> statement-breakpoint
-- The integration tables hold provider credentials and private pull-request
-- metadata. Browser roles lose all access; only the restricted runtime role
-- may use them, scoped by request settings that the server sets per query.
DROP POLICY IF EXISTS "work_pull_requests_owner_all" ON "work_pull_requests";--> statement-breakpoint
DROP POLICY IF EXISTS "work_github_connections_owner_all" ON "work_github_connections";--> statement-breakpoint
DROP POLICY IF EXISTS "work_github_oauth_states_owner_all" ON "work_github_oauth_states";--> statement-breakpoint
REVOKE ALL ON TABLE "work_pull_requests", "work_github_connections", "work_github_oauth_states" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
ALTER TABLE "work_pull_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_github_connections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_github_oauth_states" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'work_github_runtime') THEN
      CREATE ROLE "work_github_runtime" NOLOGIN;
   END IF;
END
$$;--> statement-breakpoint
ALTER ROLE "work_github_runtime" NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO "work_github_runtime";--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.work_current_workspace_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
   SELECT nullif(current_setting('work.workspace_id', true), '')::uuid
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.work_current_user_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
   SELECT nullif(current_setting('work.user_id', true), '')::uuid
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.work_current_workspace_id() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.work_current_user_id() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.work_current_workspace_id() TO "work_github_runtime";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.work_current_user_id() TO "work_github_runtime";--> statement-breakpoint

CREATE POLICY "work_github_connections_runtime_all" ON "work_github_connections"
   FOR ALL TO "work_github_runtime"
   USING ("workspace_id" = public.work_current_workspace_id())
   WITH CHECK ("workspace_id" = public.work_current_workspace_id());--> statement-breakpoint
CREATE POLICY "work_github_oauth_states_runtime_all" ON "work_github_oauth_states"
   FOR ALL TO "work_github_runtime"
   USING ("user_id" = public.work_current_user_id())
   WITH CHECK ("user_id" = public.work_current_user_id());--> statement-breakpoint
CREATE POLICY "work_pull_requests_runtime_all" ON "work_pull_requests"
   FOR ALL TO "work_github_runtime"
   USING ("workspace_id" = public.work_current_workspace_id())
   WITH CHECK ("workspace_id" = public.work_current_workspace_id());--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "work_pull_requests", "work_github_connections", "work_github_oauth_states" TO "work_github_runtime";