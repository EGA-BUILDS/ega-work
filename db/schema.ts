import { sql } from 'drizzle-orm';
import {
   bigint,
   boolean,
   check,
   foreignKey,
   index,
   integer,
   pgTable,
   text,
   timestamp,
   unique,
   uniqueIndex,
   uuid,
} from 'drizzle-orm/pg-core';

/**
 * EGA Work application tables.
 *
 * Tables use a `work_` prefix because the configured development Supabase
 * project also hosts other applications in its `public` schema. Row-level
 * security policies live in the migration SQL and scope every row to a
 * workspace owned by the verified Supabase user (`auth.uid()`).
 */

export const workWorkspaces = pgTable(
   'work_workspaces',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      ownerId: uuid('owner_id').notNull(),
      name: text('name').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (table) => [
      uniqueIndex('work_workspaces_owner_id_key').on(table.ownerId),
      check('work_workspaces_name_check', sql`length(btrim(${table.name})) between 1 and 120`),
   ]
);

export const workProjects = pgTable(
   'work_projects',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      workspaceId: uuid('workspace_id')
         .notNull()
         .references(() => workWorkspaces.id, { onDelete: 'cascade' }),
      name: text('name').notNull(),
      description: text('description'),
      version: integer('version').notNull().default(1),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (table) => [
      index('work_projects_workspace_id_idx').on(table.workspaceId),
      unique('work_projects_id_workspace_key').on(table.id, table.workspaceId),
      check('work_projects_name_check', sql`length(btrim(${table.name})) between 1 and 200`),
      check(
         'work_projects_description_check',
         sql`${table.description} is null or length(${table.description}) <= 10000`
      ),
   ]
);

export const workIssues = pgTable(
   'work_issues',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      workspaceId: uuid('workspace_id')
         .notNull()
         .references(() => workWorkspaces.id, { onDelete: 'cascade' }),
      projectId: uuid('project_id').notNull(),
      number: bigint('number', { mode: 'number' }).notNull().generatedAlwaysAsIdentity(),
      title: text('title').notNull(),
      description: text('description'),
      status: text('status').notNull().default('open'),
      assigneeId: uuid('assignee_id'),
      version: integer('version').notNull().default(1),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (table) => [
      index('work_issues_workspace_id_idx').on(table.workspaceId),
      index('work_issues_project_id_idx').on(table.projectId),
      index('work_issues_assignee_id_idx').on(table.assigneeId),
      uniqueIndex('work_issues_number_key').on(table.number),
      foreignKey({
         columns: [table.projectId, table.workspaceId],
         foreignColumns: [workProjects.id, workProjects.workspaceId],
         name: 'work_issues_project_workspace_fk',
      }).onDelete('cascade'),
      check('work_issues_title_check', sql`length(btrim(${table.title})) between 1 and 500`),
      check(
         'work_issues_description_check',
         sql`${table.description} is null or length(${table.description}) <= 20000`
      ),
      check('work_issues_status_check', sql`${table.status} in ('open', 'completed')`),
   ]
);

export const workPullRequests = pgTable(
   'work_pull_requests',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      workspaceId: uuid('workspace_id')
         .notNull()
         .references(() => workWorkspaces.id, { onDelete: 'cascade' }),
      issueId: uuid('issue_id')
         .notNull()
         .references(() => workIssues.id, { onDelete: 'cascade' }),
      repoOwner: text('repo_owner').notNull(),
      repoName: text('repo_name').notNull(),
      prNumber: integer('pr_number').notNull(),
      url: text('url').notNull(),
      title: text('title'),
      state: text('state'),
      lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
      lastCheckError: text('last_check_error'),
      isStale: boolean('is_stale').notNull().default(false),
      hidden: boolean('hidden').notNull().default(false),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (table) => [
      uniqueIndex('work_pull_requests_issue_id_key').on(table.issueId),
      uniqueIndex('work_pull_requests_identity_key').on(
         table.workspaceId,
         table.repoOwner,
         table.repoName,
         table.prNumber
      ),
      index('work_pull_requests_workspace_id_idx').on(table.workspaceId),
      check('work_pull_requests_pr_number_check', sql`${table.prNumber} > 0`),
      check(
         'work_pull_requests_state_check',
         sql`${table.state} is null or ${table.state} in ('open', 'closed', 'merged')`
      ),
   ]
);

export const workGithubConnections = pgTable(
   'work_github_connections',
   {
      workspaceId: uuid('workspace_id')
         .primaryKey()
         .references(() => workWorkspaces.id, { onDelete: 'cascade' }),
      providerUserId: text('provider_user_id').notNull(),
      login: text('login').notNull(),
      scopes: text('scopes'),
      tokenCiphertext: text('token_ciphertext').notNull(),
      tokenIv: text('token_iv').notNull(),
      tokenTag: text('token_tag').notNull(),
      connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
      revokedAt: timestamp('revoked_at', { withTimezone: true }),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (table) => [index('work_github_connections_workspace_id_idx').on(table.workspaceId)]
);

export const workGithubOauthStates = pgTable(
   'work_github_oauth_states',
   {
      id: uuid('id').primaryKey().defaultRandom(),
      stateHash: text('state_hash').notNull(),
      workspaceId: uuid('workspace_id')
         .notNull()
         .references(() => workWorkspaces.id, { onDelete: 'cascade' }),
      userId: uuid('user_id').notNull(),
      codeVerifierCiphertext: text('code_verifier_ciphertext').notNull(),
      codeVerifierIv: text('code_verifier_iv').notNull(),
      codeVerifierTag: text('code_verifier_tag').notNull(),
      expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
      consumedAt: timestamp('consumed_at', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (table) => [
      uniqueIndex('work_github_oauth_states_state_hash_key').on(table.stateHash),
      index('work_github_oauth_states_expires_at_idx').on(table.expiresAt),
   ]
);
