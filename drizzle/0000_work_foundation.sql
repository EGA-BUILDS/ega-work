CREATE TABLE "work_github_connections" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"provider_user_id" text NOT NULL,
	"login" text NOT NULL,
	"scopes" text,
	"token_ciphertext" text NOT NULL,
	"token_iv" text NOT NULL,
	"token_tag" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_github_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"code_verifier_ciphertext" text NOT NULL,
	"code_verifier_iv" text NOT NULL,
	"code_verifier_tag" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" bigint GENERATED ALWAYS AS IDENTITY (sequence name "work_issues_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_issues_title_check" CHECK (length(btrim("work_issues"."title")) between 1 and 500),
	CONSTRAINT "work_issues_description_check" CHECK ("work_issues"."description" is null or length("work_issues"."description") <= 20000),
	CONSTRAINT "work_issues_status_check" CHECK ("work_issues"."status" in ('open', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "work_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_projects_id_workspace_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "work_projects_name_check" CHECK (length(btrim("work_projects"."name")) between 1 and 200),
	CONSTRAINT "work_projects_description_check" CHECK ("work_projects"."description" is null or length("work_projects"."description") <= 10000)
);
--> statement-breakpoint
CREATE TABLE "work_pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"pr_number" integer NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"state" text,
	"last_checked_at" timestamp with time zone,
	"last_check_error" text,
	"is_stale" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_pull_requests_pr_number_check" CHECK ("work_pull_requests"."pr_number" > 0),
	CONSTRAINT "work_pull_requests_state_check" CHECK ("work_pull_requests"."state" is null or "work_pull_requests"."state" in ('open', 'closed', 'merged'))
);
--> statement-breakpoint
CREATE TABLE "work_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_workspaces_name_check" CHECK (length(btrim("work_workspaces"."name")) between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "work_github_connections" ADD CONSTRAINT "work_github_connections_workspace_id_work_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."work_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_github_oauth_states" ADD CONSTRAINT "work_github_oauth_states_workspace_id_work_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."work_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_issues" ADD CONSTRAINT "work_issues_workspace_id_work_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."work_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_issues" ADD CONSTRAINT "work_issues_project_workspace_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."work_projects"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_projects" ADD CONSTRAINT "work_projects_workspace_id_work_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."work_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD CONSTRAINT "work_pull_requests_workspace_id_work_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."work_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD CONSTRAINT "work_pull_requests_issue_id_work_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."work_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_github_connections_workspace_id_idx" ON "work_github_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_github_oauth_states_state_hash_key" ON "work_github_oauth_states" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "work_github_oauth_states_expires_at_idx" ON "work_github_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "work_issues_workspace_id_idx" ON "work_issues" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "work_issues_project_id_idx" ON "work_issues" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "work_issues_assignee_id_idx" ON "work_issues" USING btree ("assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_issues_number_key" ON "work_issues" USING btree ("number");--> statement-breakpoint
CREATE INDEX "work_projects_workspace_id_idx" ON "work_projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_pull_requests_issue_id_key" ON "work_pull_requests" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_pull_requests_identity_key" ON "work_pull_requests" USING btree ("workspace_id","repo_owner","repo_name","pr_number");--> statement-breakpoint
CREATE INDEX "work_pull_requests_workspace_id_idx" ON "work_pull_requests" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_workspaces_owner_id_key" ON "work_workspaces" USING btree ("owner_id");
--> statement-breakpoint
-- Row-level security: every Work row belongs to a workspace owned by the
-- verified Supabase user. The request role is `authenticated`; anon has no
-- policy and therefore no access. Migration credentials are never used for
-- application reads or writes.
ALTER TABLE "work_workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_pull_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_github_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_github_oauth_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "work_workspaces_owner_select" ON "work_workspaces" FOR SELECT TO authenticated USING ("owner_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "work_workspaces_owner_insert" ON "work_workspaces" FOR INSERT TO authenticated WITH CHECK ("owner_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "work_workspaces_owner_update" ON "work_workspaces" FOR UPDATE TO authenticated USING ("owner_id" = auth.uid()) WITH CHECK ("owner_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "work_workspaces_owner_delete" ON "work_workspaces" FOR DELETE TO authenticated USING ("owner_id" = auth.uid());--> statement-breakpoint

CREATE POLICY "work_projects_owner_all" ON "work_projects" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_projects"."workspace_id" AND w."owner_id" = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_projects"."workspace_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

CREATE POLICY "work_issues_owner_all" ON "work_issues" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_issues"."workspace_id" AND w."owner_id" = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_issues"."workspace_id" AND w."owner_id" = auth.uid()) AND ("assignee_id" IS NULL OR "assignee_id" = auth.uid()));--> statement-breakpoint

CREATE POLICY "work_pull_requests_owner_all" ON "work_pull_requests" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_pull_requests"."workspace_id" AND w."owner_id" = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_pull_requests"."workspace_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

CREATE POLICY "work_github_connections_owner_all" ON "work_github_connections" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_github_connections"."workspace_id" AND w."owner_id" = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_github_connections"."workspace_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

CREATE POLICY "work_github_oauth_states_owner_all" ON "work_github_oauth_states" FOR ALL TO authenticated USING ("user_id" = auth.uid() AND EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_github_oauth_states"."workspace_id" AND w."owner_id" = auth.uid())) WITH CHECK ("user_id" = auth.uid() AND EXISTS (SELECT 1 FROM "work_workspaces" w WHERE w."id" = "work_github_oauth_states"."workspace_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

REVOKE ALL ON TABLE "work_workspaces", "work_projects", "work_issues", "work_pull_requests", "work_github_connections", "work_github_oauth_states" FROM anon;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "work_workspaces", "work_projects", "work_issues", "work_pull_requests", "work_github_connections", "work_github_oauth_states" TO authenticated;--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE "work_issues_number_seq" TO authenticated;
