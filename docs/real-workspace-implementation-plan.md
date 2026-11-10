# EGA Work: from Circle demo to a usable workspace

Status: implementation plan, not a claim that any issue below is complete. This file defines proposed issues; it does not create tracker issues or authorize a production release.

## Outcome

After sign-in, a person lands in the familiar Circle workspace interface, sees their own workspace and can create a project and an issue. They can link a GitHub pull request, refresh its actual state, explicitly complete the issue and reload to see the same saved result. A second account cannot read or change their data.

The first release is for private individual workspaces. Collaboration, teams, agent execution, sprints and the rest of Circle's interface can follow. Every feature shown as available in the real workspace must work with real data. Hide or clearly mark unfinished features; direct URLs and API calls must not bypass this rule. The separately labeled `/demo` may keep sample data, but real workspace routes must never fall back to fixtures.

## Baseline checked

Local checkout: `docs/agent-dev-env`, commit `a3ada3a671f5d8a4cab6c788a954e0e1d36904a3`, with existing uncommitted database setup. This is a source snapshot, not proof of the current production deployment. Recheck the target branch, remote and deployment before implementation.

- Circle's interface remains under `app/[orgId]/` and `components/layout/`. `/demo` displays the sample overview. The login default in `lib/auth/redirect.ts` is `/me`, a protected placeholder, so login does not lead into the Circle workspace.
- `app/[orgId]/page.tsx` sends requests to a hardcoded `lndev-ui` team. The sidebar, command palette, projects and issue screens import `mock-data/`; the issue store holds mutations in memory. An `orgId` in a URL is not proof of membership or ownership.
- Supabase email/password and magic-link sign-in, server-side session verification and sign-out exist. Live shared sign-in with EGA House and cross-domain session behavior are not established by this review.
- The local, uncommitted Drizzle setup includes `db/schema.ts`, `drizzle.config.ts` and a guarded development migration runner. `docs/database.md` says there are no application tables or migrations yet. This plan does not claim the uncommitted setup is merged, deployed or that a database is isolated from House.
- Existing CI checks lint, types, unit tests, build and HTTP smoke. They do not prove real database isolation or an authenticated end-to-end workflow.

## Product and security rules

1. Retain and adapt the Circle layout and shadcn components. Replace Circle branding and fixture identity with the verified user and actual workspace.
2. The server derives the user from the verified Supabase session. Every data access and mutation checks workspace access; database RLS enforces the same boundary. Never trust a workspace ID or owner ID supplied by a browser. A privileged migration connection must not become an unchecked user-facing CRUD client.
3. Use committed, reviewed Drizzle migrations. Confirm the development project and schema before applying them. A project-reference match alone does not prove that a database is isolated from House or production. Beta and Stable need separate data. Preserve existing House tables and authentication.
4. Do not create fake success states. Validation failures, permission denials, provider outages and failed saves must be visible; preserve unsaved input where practical. UI-only preferences may remain in local storage.
5. GitHub owns PR state; Work owns issue status. A merged PR never completes an issue automatically. No agent or integration may merge or deploy on the user's behalf in this release.
6. Review each final candidate independently, run applicable CI and prove real data behavior with two authenticated users. Source checks, CI, development migration, deployment and acceptance are distinct results.

## Delivery map

| Order | Issue | Depends on | User-visible result |
| --- | --- | --- | --- |
| 01 | Stabilize database foundation | None | Safe, repeatable development migrations |
| 02 | Private workspace and membership | 01 | Every user has an isolated workspace |
| 03 | Signed-in Circle shell | 02 | Login opens the familiar interface |
| 04 | Create and list projects | 02, 03 | Real projects survive reload |
| 05 | Create and list issues | 04 | Real issues survive reload |
| 06 | Issue details and completion | 05 | Work can be edited and explicitly completed |
| 07 | Real navigation and search | 04–06 | Sidebar and search find real work |
| 08 | GitHub connection | 02, 04 | A user can authorize repository access |
| 09 | Link and refresh PRs | 06, 08 | An issue shows real PR state |
| 10 | Eliminate demo behavior from real routes | 03–09 | No mock data or fake actions in the shipped workspace |
| 11 | Account recovery and workspace entry | 03 | Users can reliably regain and enter their workspace |
| 12 | Beta acceptance and release readiness | 01–11 | The complete journey is proven in an isolated environment |
| 13–18 | Later Circle features | As specified | Real reviews, people, teams and other screens |

Issues 04–06 are the first end-to-end persistence milestone. Issues 08–09 complete the agreed first product journey. Issue 10 is continuous work as routes move, with a final audit after issue 09. Issue 11 can run in parallel once its prerequisites are met.

## Issue 01: Stabilize database foundation

**Outcome:** A developer can generate, review and apply a versioned migration to the intended development database and reproduce it in a disposable test database.

**Work:** Review and finish the existing uncommitted Drizzle setup rather than adding a second ORM or migration runner. Select a dedicated development project or a Work-specific schema after inspecting existing database ownership. Keep connection secrets local and TLS/hostname verification enabled. Establish migration ordering, rollback/recovery and separate Beta/Stable targets. Decide and document how user-facing database requests run under RLS before writing application queries.

**Done when:** A fresh database and an already-up-to-date database reach the same schema using the committed migration history; a wrong target is rejected before writes; a read-only connection and migration status are verified without printing credentials. CI can exercise migrations against disposable Postgres. No production or House tables are changed.

**Evidence:** Target designation, sanitized command results, generated SQL review and a clean install/reapply test. A connection test alone is not a migration proof.

## Issue 02: Create a private workspace

**Outcome:** Each signed-in user can enter one durable private workspace, created once on first use.

**Work:** Add the minimum workspace and ownership/membership schema needed for a private workspace, with unique constraints and RLS. Use a transaction or another concurrency-safe mechanism for first-use creation; derive identity on the server. Use an opaque workspace identifier and an authorized server lookup. Handle existing users, simultaneous first requests, sign-out and expired sessions. Keep the design open to later invitations without implementing them now.

**Done when:** Two real test accounts each get exactly one workspace; repeat and concurrent entry do not create duplicates; user B cannot read, modify or enumerate user A's workspace through direct routes or database access. Errors do not produce a fake workspace. Workspace and account names are real values or honest defaults.

**Evidence:** Migrations, RLS tests with separate sessions, concurrent creation test, and an application-level sign-in and reload.

## Issue 03: Open the Circle shell after sign-in

**Outcome:** Successful password or magic-link login opens the user's real workspace in the familiar Circle layout.

**Work:** Adapt `components/layout/` and the workspace route to a verified workspace, replacing hardcoded `lndev-ui` and fixture account data. Make workspace selection/entry resolve on the server. Keep safe internal return paths, callback flow, sign-out and the public homepage. Replace `/me` with an account destination or a redirect once safe. Preserve `/demo` as explicitly sample-only. Temporarily show only working or clearly unavailable sections; direct legacy routes must be guarded or isolated.

**Done when:** New and existing users reach their own workspace after both login methods; refresh works; signed-out access returns to login; another user's workspace URL is refused; desktop/mobile navigation, keyboard access and sign-out work. No sample person, team, project or count appears in the real shell.

**Evidence:** Browser walkthrough for both auth methods and a direct-request permission test. Preserve regression tests for redirect safety.

## Issue 04: Create and list real projects

**Outcome:** A user can create, view and edit a project in their workspace.

**Work:** Add a minimal project table and policies. Reuse the Circle projects list and create flow, with name and optional description; add project detail and empty/error/loading states. Validate input and workspace access server-side. Provide safe retry behavior and avoid duplicate creation on accidental retries. Scope every project lookup and mutation to the verified workspace.

**Done when:** Creation and editing persist across reload and a new session; invalid input and database failure give an honest error; user B cannot list, open or change A's project by changing an ID. Unimplemented archive/delete controls are hidden or disabled with clear copy until their semantics are specified.

**Evidence:** Two-user integration tests against migrations, plus a real browser create/edit/reload journey.

## Issue 05: Create and list real issues

**Outcome:** A user can add an issue to a project and see it in the project and My issues.

**Work:** Add workspace-scoped issue storage with stable IDs, a readable identifier, title, optional description and an initial status. Define the single-user assignment rule: initially assign to the signed-in owner, or explicitly offer unassigned. Ensure project and issue belong to the same workspace through database constraints and authorization. Connect the Circle create dialog and lists to server reads/writes; remove the fixture-seeded issue store from those paths.

**Done when:** A new issue persists across reload and appears consistently in its project and My issues according to assignment; two simultaneous creates receive distinct identifiers; failed saves do not appear as saved. Cross-workspace project IDs and issue reads/writes are rejected.

**Evidence:** Database constraints/RLS tests and actual create/reload with two users. Test a failed write and concurrent creation.

## Issue 06: Issue details and explicit completion

**Outcome:** The user can open a saved issue, edit it and decide when it is complete.

**Work:** Connect the issue detail route and status controls to the saved issue. Support a small documented status set and validate transitions on the server. Persist title/description edits and status changes. Handle concurrent edits without silently discarding a later user's changes; for this private release, a version check and conflict message is sufficient. Remove fixture fallbacks from detail and activity surfaces.

**Done when:** Edits and an explicit completion survive reload; another account cannot read or mutate the issue; failed or stale edits are visible and retryable. Completing an issue does not require a PR, and PR changes do not automatically complete it.

**Evidence:** Browser create/edit/complete/reload, cross-user direct request, conflict and failed-save tests.

## Issue 07: Real sidebar, navigation and search

**Outcome:** The Circle shell directs users to their own saved work without displaying sample counts or people.

**Work:** Replace fixture-backed workspace switcher, navigation counts, command palette and search in the real app. Provide workspace-scoped project and issue search, clear empty states and keyboard navigation. Audit quick-create and context menus for fixture-dependent operations. Keep UI preferences local if they are not business data.

**Done when:** Search and navigation return only accessible real records; no sample `lndev-ui` names, demo counts or hardcoded links appear in the real workspace. Unsupported commands cannot perform fake writes. Keyboard and mobile navigation work.

**Evidence:** Browser and direct-request tests with two users, including empty search and keyboard use.

## Issue 08: Connect GitHub securely

**Outcome:** A user can authorize access to the repositories needed for their workspace and disconnect it.

**Work:** Decide the smallest suitable GitHub authorization method before implementing; document repository permissions, callback validation, credential storage, revocation and how access is scoped to a workspace. Avoid exposing tokens to the browser or logs. Add a real connected/disconnected/error state and a way to revoke or disconnect. Do not assume a user can view a private GitHub repository merely because they can see a Work issue.

**Done when:** A test user connects an authorized test repository, refreshes the session and disconnects; denied, expired and revoked authorization fail clearly without exposing credentials. A second user cannot use the first user's connection.

**Evidence:** Actual GitHub test installation/authorization and revocation, permission tests and documented required provider configuration. No production integration is implied by this issue.

## Issue 09: Link and refresh pull requests

**Outcome:** A user can link a real GitHub PR to an issue and see a trustworthy, refreshable observation.

**Work:** Accept and validate a PR URL, check the user's repository access, store the relationship and retrieve title, URL, state and last successful refresh time. Define uniqueness and unlink behavior. Support manual refresh first; add automatic refresh only with a documented trigger and retry policy. Preserve the last successful observation and label it stale if refresh fails or access is revoked.

**Done when:** A test PR can be linked, refreshed and unlinked; data survives reload; unauthorized/private PRs are refused without leakage. Closing or merging the PR updates its observation on refresh but leaves the Work issue status unchanged. Failures show stale data and an actionable error.

**Evidence:** Real test repository and PR, successful and failed refresh, revoked access, cross-user refusal and reload of the linked record.

## Issue 10: Remove demo behavior from the real workspace

**Outcome:** The shipped workspace contains no mock business records or pretend-success interactions.

**Work:** Inventory all production-reachable pages, nested routes, sidebar items, dialogs, context menus, keyboard shortcuts and data sources. Convert the first-release paths to real data. Hide or explicitly mark later features unavailable and guard their direct URLs. Audit fixture imports including `mock-data/`, seeded Zustand stores, canned agent replies, hardcoded identifiers and in-memory mutations. Constants such as an actual status definition can move to a neutral domain module; distinguish them from fake records. Keep `/demo` visibly separate with no implied persistence.

**Done when:** Every visible action in the real workspace saves real data or states that it is unavailable before the user acts. Direct requests cannot surface shared demo records as personal data. The real workspace builds and runs without fixture fallback. Demo data is reachable only through the clearly labeled demo and its isolated routes.

**Evidence:** Checked route/action inventory, import audit, browser walkthrough and direct URL tests. Removing a sidebar link alone does not complete the issue.

## Issue 11: Account recovery and workspace entry

**Outcome:** An existing user can sign in, recover access and reliably return to their own workspace.

**Work:** Add password reset/setup if needed for accounts created through magic links; keep generic responses to avoid account enumeration. Verify callback configuration per environment, session refresh, logout and expired/used links. Determine whether House and Work use the same Supabase project and whether actual single sign-on across domains is intended and supported; same email alone does not prove a shared session. Do not change House authentication as a side effect.

**Done when:** Password and magic-link journeys, reset, expired links, session refresh and sign-out work in the target test environment. The user's workspace is selected securely after recovery. Document actual House/Work behavior and any remaining setup.

**Evidence:** Two disposable accounts and a test mailbox through the real application; negative link and session cases. Never include passwords or tokens in evidence.

## Issue 12: Beta acceptance and release readiness

**Outcome:** The first version is demonstrably usable with real private data and has an accountable release path.

**Work:** Use isolated Beta data and test accounts. Exercise the entire journey: sign in, enter Circle layout, create project and issue, link and refresh a PR, explicitly complete the issue, sign out/in and reload. Repeat denial tests as a second user. Verify migration status, backups/recovery, provider configuration, logging without secrets, monitoring, deployment settings and a manual Stable promotion/rollback procedure. Review license notices inherited from Circle.

**Done when:** The exact release candidate passes applicable CI, independent review and the full Beta journey; cross-user refusal and failed-save/failed-refresh cases are recorded. The owner can identify the tested revision, migration state and remaining limitations. Production deployment and migration occur only under applicable authorization.

**Evidence:** Redacted test report with candidate SHA, environment, migration identity, checks, browser results, permission refusal, GitHub refresh and reviewer findings. A green build or screenshot alone is not acceptance.

## Later issues: make the remaining Circle interface real

These are separate product decisions and do not block the first private release if their routes and actions are unavailable. Each requires its own schema and real authorization, empty/error states, reload proof and two-user tests where applicable. Do not build all of Circle merely because a screen exists.

### Issue 13: Reviews and inbox

**Depends on:** 08–09. Define whether reviews are GitHub-derived or Work-owned, then show only authorized real PR/review data. Add notifications only for events actually ingested; support read/unread persistence. Prove revoked GitHub access and user isolation.

### Issue 14: People, invitations and shared projects

**Depends on:** 02 and a decision on roles. Define owner/member permissions, invite acceptance, removal and visibility before exposing members or sharing. Prove invitation expiry, revocation and refusal after removal at both server and database boundaries.

### Issue 15: Teams, cycles and triage

**Depends on:** 14 and a product decision on team workflows. Add real team membership, issue assignment, cycle dates and triage only when specified. Prove membership-based access, status transitions and persistence; do not make fixture teams appear real.

### Issue 16: Views and initiatives

**Depends on:** 04–06 and a decision on scope. Define whether saved filters and initiatives are private or shared. Persist real definitions, enforce access for referenced records and test deleted or inaccessible references.

### Issue 17: Agent access

**Depends on:** an explicit agent permissions and execution design. Replace the canned agent chat only with a real authorized service and scoped credentials. Record attribution, enforce owner-approved capabilities and report failures. PR merges and deployments remain separate authorized actions.

### Issue 18: House / Work connection

**Depends on:** 11 and a separate integration decision. Verify identity and session boundaries, define a navigation switch and link records only where needed. Do not synchronize or expose House data by default. Test access independently in both applications.

## Decisions to settle before their dependent issues

- **Database target (01):** Is Work development a separate Supabase project, a branch, or a dedicated schema in the existing project? Confirm actual House and production ownership before applying migrations.
- **Workspace naming and entry (02–03):** Default name, ability to rename, and eventual multi-workspace selection. Initial recommendation: one automatically created private workspace with a real editable name.
- **Project and issue fields (04–06):** Initial recommendation: project name/description and issue title/description/status/assignment, with a small status set. Agree on deletion and archive semantics before exposing them.
- **GitHub model (08–09):** GitHub App or OAuth, repository selection, credential custody and refresh cadence. Prefer the least privilege needed for actual PR visibility.
- **Account behavior (11):** Existing Supabase project, signup policy, password recovery and whether cross-app single sign-on is actually required.
- **Release (12):** Beta and Stable projects, domains, backups, migration/recovery owner and manual promotion method.

## Definition of ready to use

The first release is ready only when a new user can complete the full journey in issue 12 using their own account, all visible features on the real workspace work honestly, another user is refused access, and data persists across sessions. Remaining Circle sections may be absent or clearly unavailable. Demo fixtures, a connected ORM, an authenticated placeholder page, a passing build or a merged PR alone do not meet this definition.
