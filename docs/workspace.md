# Private workspace

The first-release workspace is reachable only after Supabase verifies a session.
`/me` creates or retrieves the signed-in user's single workspace and redirects to
`/w/<workspace-id>`.

## Routes

| Route                                   | Purpose                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `/me`                                   | Verifies the session and bootstraps the workspace             |
| `/w/[workspaceId]`                      | Overview with real project and open-issue counts              |
| `/w/[workspaceId]/projects`             | List and create saved projects                                |
| `/w/[workspaceId]/projects/[projectId]` | Project details, edit, and issue creation                     |
| `/w/[workspaceId]/issues/[issueId]`     | Issue edit and explicit completion                            |
| `/w/[workspaceId]/my-issues`            | Issues assigned to the verified user                          |
| `/w/[workspaceId]/settings`             | Workspace and account details                                 |
| `/demo`                                 | Separately labeled sample interface                           |
| `/[orgId]/...`                          | Legacy Circle fixture routes, now an honest unavailable state |

## Authorization

Every page resolves the user with `supabase.auth.getUser()` on the server and
then looks up the workspace with both its identifier and `owner_id`. A guessed
workspace, project, or issue identifier returns a 404 rather than another user's
data. Supabase RLS repeats the ownership check at the database boundary; the
client never supplies an owner identifier.

State-changing API routes also reject cross-site requests. Repository functions
validate names, titles, descriptions, statuses, and versions before writing.
Failed writes return a destructive error and never render a success state.

## Persistence and conflicts

Projects and issues store a `version` integer. Edits send the version the page
rendered with and update only when it still matches, preventing a silent lost
update. A conflict returns 409 and asks the user to reload. Issue numbers are
allocated per workspace by the database trigger from issue #3.

Issue completion is an explicit owner action. No pull-request state changes it.

## Unavailable in this slice

- GitHub connection, PR linking, and PR refresh are not configured; the issue
  page says so instead of showing a fake link.
- Search, invitations, teams, cycles, reviews, views, initiatives, agents, and
  the remaining Circle sections are not part of the private workspace.
- Renaming or deleting a workspace, projects, and issues is not exposed.

## Verification and gaps

Focused checks: `pnpm test:unit`, `pnpm typecheck`, `pnpm test:db`, `pnpm build`.
Database tests prove workspace uniqueness, per-workspace numbering, and
two-user/anon denial. The checkout has no Supabase URL/anon key, so a signed-in
browser session against the real Supabase project, cross-user browser switching,
and reload persistence through PostgREST remain live-verification gaps.
