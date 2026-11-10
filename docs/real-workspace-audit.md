# Real workspace audit

Scope: routes and actions reachable in the first private release. Checked against
`main` after the workspace, project, issue, and search slices.

## Route inventory

| Route                                   | Data                                     | Status                           |
| --------------------------------------- | ---------------------------------------- | -------------------------------- |
| `/`                                     | Marketing copy                           | Public                           |
| `/login`                                | Supabase Auth                            | Public                           |
| `/auth/callback`, `/auth/signout`       | Supabase Auth                            | Public, origin checked           |
| `/me`                                   | Workspace bootstrap                      | Verified session                 |
| `/w/[workspaceId]`                      | Saved counts and projects                | Verified owner                   |
| `/w/[workspaceId]/projects`             | Saved projects + create                  | Verified owner                   |
| `/w/[workspaceId]/projects/[projectId]` | Saved project + edit + issue create      | Verified owner                   |
| `/w/[workspaceId]/issues/[issueId]`     | Saved issue + edit + explicit completion | Verified owner                   |
| `/w/[workspaceId]/my-issues`            | Saved assigned issues                    | Verified owner                   |
| `/w/[workspaceId]/settings`             | Workspace/account; GitHub disabled       | Verified owner                   |
| `/api/workspaces/[workspaceId]/**`      | Projects, issues, search                 | Verified owner + same-origin     |
| `/demo`                                 | Marketing demo overview                  | Public, labeled                  |
| `/lndev-ui/**`                          | Circle fixtures                          | Public demo, persistent label    |
| `/[orgId]/**` (other)                   | None                                     | Login required, then unavailable |

## Action inventory

| Action                   | Owner                                | Honest failure                             |
| ------------------------ | ------------------------------------ | ------------------------------------------ |
| Create project           | `POST /api/.../projects`             | Validation/failure alert; no success state |
| Edit project             | `PATCH /api/.../projects/[id]`       | Version conflict 409; input retained       |
| Create issue             | `POST /api/.../projects/[id]/issues` | Validation/failure alert                   |
| Edit issue               | `PATCH /api/.../issues/[id]`         | Version conflict 409; input retained       |
| Complete/reopen issue    | Same PATCH with `status`             | Invalid status 400; no PR dependency       |
| Search                   | `GET /api/.../search`                | Empty, loading, no-match, error states     |
| Sign out                 | `POST /auth/signout`                 | `/me?error=signout` is visible             |
| Connect GitHub / link PR | Not rendered as available            | Disabled with explanation                  |

## Guard checks

- `scripts/workspace-boundary.test.mjs` scans real workspace source for
  `mock-data`, demo UI/store imports, the in-memory issue store, and links into
  demo or unimplemented Circle routes. It also asserts the demo branch renders
  its children plus `<DemoBanner />`, that non-demo branches do not render
  fixture children, and that the demo interface shows a visible sample-data
  label. It is a source guard, not a render test.
- `pnpm test:smoke` is the render-level check: public routes, the labeled demo,
  login protection for guessed workspace and non-demo organization routes, and
  the unknown-route redirect.
- Direct `/[orgId]` routes other than the demo cannot render fixture children.

## Remaining intentional gaps

- GitHub authorization, PR linking, and PR refresh await provider configuration
  and the issue #13 decision. The UI states this rather than faking a connection.
- The demo's detail pages remain sample data and are reachable only under
  `/lndev-ui/**` with the demo banner.
- Search, project, and issue actions still need live signed-in verification
  against the configured Supabase project.
