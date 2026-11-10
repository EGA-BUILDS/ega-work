CREATE TABLE "work_issue_number_counters" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"last_number" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_pull_requests" DROP CONSTRAINT "work_pull_requests_issue_id_work_issues_id_fk";
--> statement-breakpoint
DROP INDEX "work_issues_number_key";--> statement-breakpoint
ALTER TABLE "work_issues" ALTER COLUMN "number" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "work_issue_number_counters" ADD CONSTRAINT "work_issue_number_counters_workspace_id_work_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."work_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_issue_number_counters_workspace_id_idx" ON "work_issue_number_counters" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "work_issues" ADD CONSTRAINT "work_issues_id_workspace_key" UNIQUE("id","workspace_id");--> statement-breakpoint
ALTER TABLE "work_pull_requests" ADD CONSTRAINT "work_pull_requests_issue_workspace_fk" FOREIGN KEY ("issue_id","workspace_id") REFERENCES "public"."work_issues"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_issues_workspace_number_key" ON "work_issues" USING btree ("workspace_id","number");
--> statement-breakpoint
-- Issue numbers are allocated per workspace by a before-insert trigger. This
-- removes the global identity sequence (and the cross-tenant activity leak).
DROP SEQUENCE IF EXISTS "work_issues_number_seq";--> statement-breakpoint
INSERT INTO "work_issue_number_counters" ("workspace_id", "last_number")
SELECT "workspace_id", max("number") FROM "work_issues" GROUP BY "workspace_id"
ON CONFLICT ("workspace_id") DO UPDATE SET "last_number" = greatest("work_issue_number_counters"."last_number", excluded."last_number");--> statement-breakpoint

CREATE OR REPLACE FUNCTION "work_assign_issue_number"() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
   next_number bigint;
BEGIN
   IF NOT EXISTS (
      SELECT 1 FROM "work_workspaces" w
      WHERE w."id" = NEW."workspace_id" AND w."owner_id" = auth.uid()
   ) THEN
      RAISE EXCEPTION 'workspace not accessible' USING ERRCODE = '42501';
   END IF;

   IF NEW."number" IS NULL THEN
      INSERT INTO "work_issue_number_counters" ("workspace_id", "last_number", "updated_at")
      VALUES (NEW."workspace_id", 1, now())
      ON CONFLICT ("workspace_id") DO UPDATE
         SET "last_number" = "work_issue_number_counters"."last_number" + 1,
             "updated_at" = now()
      RETURNING "last_number" INTO next_number;
      NEW."number" := next_number;
   END IF;

   RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "work_issues_assign_number"
BEFORE INSERT ON "work_issues"
FOR EACH ROW EXECUTE FUNCTION "work_assign_issue_number"();--> statement-breakpoint

ALTER TABLE "work_issue_number_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "work_issue_number_counters" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION "work_assign_issue_number"() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

-- The migration journal is not application data; no browser role may read or
-- advance it. Drizzle still owns it through the privileged migration role.
DO $$
BEGIN
   IF to_regclass('public.__ega_work_migrations') IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON TABLE public.__ega_work_migrations FROM anon, authenticated';
   END IF;
   IF to_regclass('public.__ega_work_migrations_id_seq') IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON SEQUENCE public.__ega_work_migrations_id_seq FROM anon, authenticated';
   END IF;
END
$$;
