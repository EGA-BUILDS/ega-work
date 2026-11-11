# Release readiness

Status: **code and documentation ready for review; no live GitHub acceptance was
performed.**

This is not a claim that v1.1 is accepted, deployed, or proven against GitHub.

## Candidate

- Repository: `EGA-BUILDS/ega-work`
- Base: `main` at `976885f` (tag `v1.0.0`).
- Candidate branch: `feat/v1.1-github-pr-tracking`.
- The exact candidate SHA is recorded in the implementation handoff. It is not
  merged.
- Target: `main` plus the shared Supabase development project. This slice has no
  separate acceptance environment or promotion step.

## Database

- Migrations `0000_work_foundation`, `0001_work_hardening`, and
  `0002_github_app_user_tokens` are committed.
- Migration `0002` is forward-only. It adds the GitHub token/lease columns,
  nulls the obsolete `NOT NULL` token constraints, moves the three integration
  tables off browser roles, creates `work_github_runtime`, and adds the
  request-scoped runtime policies.
- Migration `0002` was **not applied to the shared Supabase project** by this
  implementation. Applying a development migration requires a target check and
  is a separate action; production migrations require separate authorization.
- The GitHub runtime login role (`work_github_login` or similar) is not created
  by a migration. An owner must provision it, make it a member of
  `work_github_runtime`, and supply `WORK_GITHUB_DATABASE_URL`. No password is
  committed.
- `docs/database.md` records provisioning, rotation, and recovery.

## Automated evidence

| Check              | Result                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `pnpm exec eslint` | Passed on every changed TypeScript file                                                                      |
| `pnpm typecheck`   | Passed on the candidate                                                                                      |
| `pnpm test:unit`   | 73 tests passed, including GitHub URL, crypto, token lease, provider, config, sanitizer                      |
| `pnpm test:db`     | Passed on local disposable PostgreSQL: upgrade, RLS/runtime role, CAS, real store/service                    |
| `pnpm build`       | Passed on the candidate                                                                                      |
| `pnpm test:smoke`  | Passed against the production build; rendered routes only, not provider acceptance                           |
| Independent review | Iterative independent review; the handoff records the exact approved SHA. Any new commit requires re-review. |

Command results and any blocked check are reported in the handoff. A green
local check does not replace CI or independent review.

## GitHub acceptance gaps (owner)

Live provider acceptance was **not performed**. No GitHub App credentials,
installation, repository, or test pull request exist in this environment.

- [ ] Create the GitHub App with only **Pull requests: read-only** and
      **Metadata: read-only**. Do not grant contents or write permissions.
- [ ] Register `https://<origin>/api/github/callback` and
      `https://<origin>/api/github/setup` for each deployed origin. No wildcard.
- [ ] Configure `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`,
      `GITHUB_APP_SLUG`, a base64 32-byte `WORK_TOKEN_ENCRYPTION_KEY`, the
      restricted `WORK_GITHUB_DATABASE_URL`, and optional
      `WORK_GITHUB_DATABASE_CA_BASE64`.
- [ ] Apply migration `0002` to the intended development or acceptance
      database after confirming the target.
- [ ] Provision `work_github_login`, verify it is a member of
      `work_github_runtime` and not a superuser.
- [ ] Connect a disposable account, choose an installation, link a disposable
      pull request, reload, and confirm the saved observation.
- [ ] Refresh open, closed, and merged states. Confirm the issue's manual status
      never changes.
- [ ] Reject a replayed, expired, altered, cross-user, and denied callback.
- [ ] Confirm a PR the installation cannot see produces no title or URL leak.
- [ ] Simulate a provider outage (stale observation, retry) separately from a
      revoked authorization (tokens cleared, PR details hidden, reconnect).
- [ ] Unlink or disconnect while a refresh is in flight and confirm the late
      response restores nothing.
- [ ] Confirm the token never appears in a browser payload, URL, log, or error.
- [ ] Confirm uninstall and revocation ownership. Uninstall is a separate GitHub
      action; local disconnect revokes the stored authorization best-effort.

## v1.0 acceptance still required

- [ ] Sign in with password and with a magic link; both reach the user's
      `/w/<workspaceId>`.
- [ ] Reload and sign out/in; the same workspace returns and private pages
      require a session.
- [ ] Create a project and issue; both persist after reload.
- [ ] Edit with a stale version and confirm the visible 409 conflict.
- [ ] Complete and reopen an issue; both persist.
- [ ] Search by project name, issue title, and `W-<number>`.
- [ ] User B cannot open or mutate user A's workspace, project, issue, or API
      paths.
- [ ] Request a recovery link, set a password, sign in, and return to the same
      workspace.
- [ ] Confirm the sign-out failure state with `?error=signout`.

## Approvals and operational checks

- Independent review of the exact candidate revision is required before merge.
  Self-review is not independent review.
- A human owner must approve the GitHub App creation, permissions, callback
  origins, install scope, and test repository.
- Confirm logs exclude tokens, passwords, connection strings, PKCE verifiers,
  and private pull-request details.
- Confirm no `service_role`, privileged `DATABASE_URL`, or App private key is
  present in the runtime environment.
- Confirm backups and a recovery owner for the target database.
- Review inherited Circle license notices before release.

## Rollback and recovery

- Application: redeploy the previous known-good `main` revision. The v1.0
  workspace/project/issue journey does not depend on the GitHub feature.
- Database: migrations are forward-only. Migration `0002` does not drop Work
  data tables. To recover a development mistake, restore the target from a
  Supabase backup or create a fresh database and apply the committed history.
  Do not edit or delete an applied migration.
- GitHub: disconnect the workspace and revoke the user authorization. Uninstall
  the App from the account or repository separately. Delete stored integration
  rows only through an authorized operational procedure; never by weakening RLS.
- If `WORK_TOKEN_ENCRYPTION_KEY` is lost or rotated without reconnecting, stored
  tokens cannot be decrypted. Disconnect and reconnect affected workspaces.

## Known limitations

- Live signed-in verification, cross-user browser switching, email delivery,
  GitHub authorization, installation selection, PR linking, refresh, and
  revocation were not possible in the implementation environment.
- Browser interaction and keyboard behavior for the new settings and PR cards
  were not observed against a running deployment.
- Search and writes depend on the target database having the Work migrations
  applied.
