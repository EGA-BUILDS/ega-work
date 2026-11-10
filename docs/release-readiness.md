# Release readiness

Status: **code and documentation ready for review; Beta acceptance not performed.**
This is not a claim that the release is accepted or deployed.

## Candidate

- Repository: `EGA-BUILDS/ega-work`
- Branch: `main`
- Record the exact `main` SHA in the acceptance report when Beta testing starts.
- The last merged code slice before release documentation was `387205a`
  (account recovery). Later commits are documentation and test guard changes.

## Database

- Migrations `0000_work_foundation` and `0001_work_hardening` are committed.
- The configured development project has both migrations applied. It is a
  shared project; Work uses the `work_` prefix and `public.__ega_work_migrations`.
- Beta and Stable database isolation is **not established**. Use a separate,
  owner-confirmed Beta project/database before acceptance. Do not reuse the
  shared development data.
- Production migrations require separate authorization.

## Automated evidence

| Check              | Result                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| `pnpm test:unit`   | 28+ tests: auth, password, search, validation, demo boundary, dates           |
| `pnpm typecheck`   | Pass on the reviewed candidates                                               |
| `pnpm test:db`     | Fresh apply, no-op reapply, two-user/anon RLS, per-workspace numbering, PR FK |
| `pnpm build`       | Pass on the reviewed candidates                                               |
| `pnpm test:smoke`  | Public routes, labeled demo, login protection, recovery callback              |
| CI **Check**       | Passed for each merged PR head                                                |
| Independent review | Every merged slice was reviewed; material findings fixed and re-reviewed      |

## Beta acceptance matrix (owner)

Use isolated Beta data and two disposable accounts.

- [ ] Sign in with password and with a magic link; both reach the user's
      `/w/<workspaceId>`.
- [ ] Reload and sign out/in; the same workspace returns and private pages
      require a session.
- [ ] Create a project; it appears after reload and a new session.
- [ ] Create an issue; it gets a per-workspace `W-<number>` and appears in the
      project and My issues.
- [ ] Edit project and issue; changes persist. Force a stale edit and confirm
      the 409 conflict is visible without losing input.
- [ ] Complete and reopen the issue; both persist in project and My issues.
- [ ] Search by project name, issue title, and `W-<number>`; empty/no-match/error
      states are honest.
- [ ] User B cannot open user A's workspace, project, or issue by changing
      identifiers, and cannot use user A's API paths.
- [ ] A failed save shows an error and does not create a fake record.
- [ ] The demo is reachable and labeled; a non-demo `/[orgId]` path cannot render
      fixtures.
- [ ] Request a recovery link, set a password, sign in, and return to the same
      workspace. Expired links are actionable.
- [ ] Verify the sign-out failure state with `?error=signout`.
- [ ] GitHub connect/link/refresh is either configured and tested with a
      disposable PR, or explicitly marked unavailable. Do not accept a fake
      GitHub state.

## GitHub

No provider is configured. See
[github-integration-decision.md](github-integration-decision.md). Issues #13–#16
remain blocked until the owner confirms the App/OAuth choice, test repository,
callback origins, and server credentials.

## Operational checks

- Confirm Supabase Auth: email confirmation, allowed callback URLs, recovery
  template, and whether signup is open.
- Confirm `SITE_URL` is set for the deployment; production email links fail
  closed without it.
- Confirm secrets are server-side: Supabase anon key only in the browser,
  Postgres migration credentials never in application requests, no service-role
  key.
- Confirm logs exclude tokens, passwords, connection strings, and private PR
  details.
- Confirm backups and a recovery owner for the Beta database.
- Review inherited Circle license notices before promoting to Stable.

## Rollback and recovery

- Application: redeploy the previous known-good `main` revision. No database
  changes are required for the workspace/project/issue slice.
- Database: migrations are forward-only. Restore the Beta project from a
  Supabase backup or rebuild from the committed history. Do not edit or delete
  an applied migration.
- GitHub (when implemented): disconnect the installation and revoke it
  provider-side; delete stored installation/token records.

## Known limitations

- Live signed-in verification, cross-user browser switching, and email delivery
  were not possible in the implementation environment.
- GitHub authorization, PR linking, and refresh are not implemented.
- Search and all writes depend on the configured Supabase project having the
  Work migrations applied.
- Beta acceptance and Stable promotion are manual owner decisions.
