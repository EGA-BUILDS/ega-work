# First release progress

Working backlog: [first-release-issue-drafts.md](first-release-issue-drafts.md). GitHub issues were created
from that backlog; draft numbers and GitHub numbers differ.

| Draft | GitHub | Outcome | Status |
| --- | --- | --- | --- |
| 1 | #3 | Database and migration foundation | In progress |
| 2 | #4 | Private workspace on first sign-in | Pending |
| 3 | #5 | Circle workspace after login | Pending |
| 4 | #6 | Create and list projects | Pending |
| 5 | #7 | View and edit a project | Pending |
| 6 | #8 | Create an issue | Pending |
| 7 | #9 | Assigned issues in My issues | Pending |
| 8 | #10 | Open and edit an issue | Pending |
| 9 | #11 | Explicitly complete an issue | Pending |
| 10 | #12 | Search saved work | Pending |
| 11 | #13 | GitHub authorization decision | External decision pending |
| 12 | #14 | Connect and disconnect GitHub | Blocked by #13 |
| 13 | #15 | Link a real PR | Blocked by #10 and #14 |
| 14 | #16 | Refresh PR state | Blocked by #11 and #15 |
| 15 | #17 | Remove remaining demo paths | Pending |
| 16 | #18 | Account recovery | Pending |
| 17 | #19 | Beta acceptance | Manual acceptance pending |

## Assignment log

| Issue | Branch / PR | Candidate | Implementer | Reviewer | Findings | Checks | Merge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #3 | `feat/db-foundation` | pending | `opencode-go/deepseek-v4.1-flash` | pending | pending | `test:db`, `test:unit`, typecheck | pending |

## Database

- Dev target: the project configured in `.env.dev` (session pooler, TLS verified).
- Work tables use the `work_` prefix in `public`; the configured project is shared with another application.
- Migration journal: `public.__ega_work_migrations`.
- Applied: migration `0000_work_foundation` on 2026-11-10 (development only).
- RLS proof: disposable database, two simulated users, anonymous denial, cross-workspace rejection.
- Beta and Stable isolation: not established; owner decision still required.

## Claims

Only record a stage when evidence exists: code implemented, independently
reviewed, automated checks passed, merged, development migration applied,
manual acceptance completed, production deployed. Manual Beta acceptance
(#19) remains pending until the owner performs it.
