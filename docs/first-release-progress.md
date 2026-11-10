# First release progress

Working backlog: [first-release-issue-drafts.md](first-release-issue-drafts.md). GitHub issues were created
from that backlog; draft numbers and GitHub numbers differ.

| Draft | GitHub | Outcome                            | Status                    |
| ----- | ------ | ---------------------------------- | ------------------------- |
| 1     | #3     | Database and migration foundation  | In progress               |
| 2     | #4     | Private workspace on first sign-in | Pending                   |
| 3     | #5     | Circle workspace after login       | Pending                   |
| 4     | #6     | Create and list projects           | Pending                   |
| 5     | #7     | View and edit a project            | Pending                   |
| 6     | #8     | Create an issue                    | Pending                   |
| 7     | #9     | Assigned issues in My issues       | Pending                   |
| 8     | #10    | Open and edit an issue             | Pending                   |
| 9     | #11    | Explicitly complete an issue       | Pending                   |
| 10    | #12    | Search saved work                  | Pending                   |
| 11    | #13    | GitHub authorization decision      | External decision pending |
| 12    | #14    | Connect and disconnect GitHub      | Blocked by #13            |
| 13    | #15    | Link a real PR                     | Blocked by #10 and #14    |
| 14    | #16    | Refresh PR state                   | Blocked by #11 and #15    |
| 15    | #17    | Remove remaining demo paths        | Pending                   |
| 16    | #18    | Account recovery                   | Pending                   |
| 17    | #19    | Beta acceptance                    | Manual acceptance pending |

## Assignment log

| Issue | Branch / PR                       | Candidate   | Implementer                       | Reviewer                                                             | Findings                                                     | Checks                                              | Merge     |
| ----- | --------------------------------- | ----------- | --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- | --------- |
| #3    | `feat/db-foundation` / PR #20     | `8333858`   | `opencode-go/deepseek-v4.1-flash` | `opencode/minimax-m3.1-flash-free`; re-review `opencode/iceman-free` | 5 material findings fixed; no material findings on re-review | `test:db`, `test:unit`, typecheck, build, CI        | `4e3b401` |
| #4-#9 | `feat/private-workspace` / PR #21 | see PR head | `opencode-go/deepseek-v4.1-flash` | `opencode/minimax-m3.1-flash-free`                                   | 3 material + 5 low findings fixed; re-review pending         | `test:unit`, `test:db`, typecheck, build, smoke, CI | pending   |

## Database

- Dev target: the project configured in `.env.dev` (session pooler, TLS verified).
- Work tables use the `work_` prefix in `public`; the configured project is shared with another application.
- Migration journal: `public.__ega_work_migrations`.
- Applied: migrations `0000_work_foundation` and `0001_work_hardening` on 2026-11-10 (development only).
- Issue numbers: per workspace, assigned by a before-insert trigger; no global counter.
- PR links: composite `(issue_id, workspace_id)` FK; cross-workspace links rejected.
- RLS proof: disposable database, two simulated users, anonymous denial, cross-workspace rejection.
- Beta and Stable isolation: not established; owner decision still required.

## Review findings for #3

Independent review by `opencode/minimax-m3.1-flash-free` on `6f951b2` found:

1. `anon` could advance the global issue sequence. Fixed by removing the global
   sequence and allocating numbers per workspace in a trigger.
2. PR links were not workspace-scoped. Fixed with a composite FK.
3. RLS tests covered only three of six tables. Fixed; all six are seeded and
   checked, including cross-user reads, writes and deletes.
4. The anonymous privilege test did not reproduce Supabase grants. Fixed by
   simulating default public-schema grants before migration.
5. No schema/migration drift check. Fixed with a CI generate-and-diff step.
   Lower-severity cleanup, SSL env handling and documentation overstatement
   were also corrected.

## Claims

Only record a stage when evidence exists: code implemented, independently
reviewed, automated checks passed, merged, development migration applied,
manual acceptance completed, production deployed. Manual Beta acceptance
(#19) remains pending until the owner performs it.
