# EGA Work first release: issue drafts

Status: proposed for review. These are not GitHub issues yet. Numbers below are draft references, not GitHub issue numbers. Types: AFK means implementable without a product decision; HITL means a person must confirm a consequential target, provider choice, or acceptance.

## Baseline and shared contract

Checked locally at `a3ada3a671f5d8a4cab6c788a954e0e1d36904a3` on `docs/agent-dev-env`. The checkout has uncommitted Drizzle setup, including an empty `db/schema.ts`; it is not established as merged or deployed. Recheck the actual base and any existing changes before starting each issue. `docs/database.md` describes the local migration runner, but a successful connection is not proof of an isolated database or applied application migrations.

Current behavior: `lib/auth/redirect.ts` defaults to `/me`; `app/[orgId]/page.tsx` redirects to a hardcoded Circle team; the sidebar, project details, command palette and issue store use fixtures. `components/common/my-issues/use-my-issues.ts` identifies the current user as `users[0]`. The create issue dialog currently changes an in-memory store. Those are not private, durable workspace features.

All issues below inherit these acceptance rules:

- Preserve the Circle layout and existing Supabase sign-in. The production workspace must never silently serve sample records or fake success. `/demo` may retain clearly labeled fixtures; it must be separate from private routes.
- Resolve identity from a verified server session. Authorize workspace access on the server and enforce database policies using request-scoped identity. Do not use the privileged migration connection as an authorization shortcut. Deny another user even when they supply a valid record ID.
- Private responses and data caches must not expose one user's data to another user or after sign-out. Verify the actual application with user A, then user B and a signed-out session in the same browser, and exercise any shared cache used by the deployment.
- Validate inputs server-side, preserve unsaved data on failure where practical, and report failures honestly. Test real saved state after reload and direct access denial for every new protected entity or mutation.
- Use committed, reviewed migrations and a verified development target. Do not change House data or apply production migrations without the required authorization. Separate Beta data from Stable data.
- Keep PR status and issue status independent. For a merge, follow the repository's independent review and CI requirements. Each issue records its revision, tests and remaining gaps.

## 1. Confirm a safe development database and migration path

Type: HITL. Blocked by: none. This is a prerequisite/operational issue rather than an end-user feature because an unsafe target cannot be resolved by UI work.

**Build:** Review the existing uncommitted Drizzle setup and designate a development project or isolated Work schema with the owner. Preserve the existing TLS and target checks. Establish how request-scoped user identity reaches RLS; do not assume that a direct privileged Drizzle connection enforces it.

**Acceptance criteria**

- [ ] Document the chosen development project/schema, whether House uses it, and the separate Beta/Stable targets; do not write to an unverified target.
- [ ] A reviewed test migration applies to a disposable database, and a second run applies nothing. An intentionally mismatched project reference is rejected before connecting or writing.
- [ ] In CI, apply the full committed migration history to a fresh disposable database and upgrade a database at the previous migration revision; both reach the same application schema, grants and RLS policies. Reapplying is a no-op. If there is no previous migration yet, establish the fresh baseline and add the upgrade check when the next migration exists.
- [ ] Document and test how real application requests carry verified user identity to a least-privileged role that cannot bypass RLS. Prove actual reads and writes for two users and anonymous access; migration credentials are never used for user requests.
- [ ] The owner records who can sign up, whether magic links create accounts, and how existing accounts in the shared Supabase project are treated. Record required email confirmation and allowed callback URLs. Issue 2 must implement the confirmed policy, not assume that sharing an email grants access.
- [ ] TLS and hostname checks remain enabled; secrets are excluded from output and Git. Document recovery and the user-request/RLS approach.
- [ ] Existing local setup is integrated or its outstanding changes explicitly accounted for; no claim of production readiness follows from connectivity alone.

**Start at:** `docs/database.md`, `drizzle.config.ts`, `scripts/migrate-dev.mjs`, `scripts/dev-database-target.mjs`.

## 2. Create a private workspace on first sign-in

Type: AFK. Blocked by: 1.

**Build:** For a verified user, create or retrieve one personal workspace and show its actual name on a minimal entry page. Use a durable owner relationship, database constraints and RLS. Initial name may be `My workspace`; renaming can be a later issue.

**Acceptance criteria**

- [ ] First entry creates one workspace; reload and repeated or concurrent requests return the same workspace without duplicates.
- [ ] User A can read their own workspace; user B and anonymous requests cannot read or change it through a direct request or an RLS-enforced database request.
- [ ] Exercise creation, reads and writes through the real application as A, B and anonymously, and verify the request database role cannot bypass RLS. Test allowed and disallowed new and existing accounts against the signup policy confirmed in issue 1.
- [ ] Unavailable database or failed creation shows a retryable error and never claims success. Sign-out and missing session do not expose workspace data.
- [ ] A migration, focused concurrency/access tests and an authenticated create/reload test accompany the change.

**Start at:** `app/me/page.tsx`, `lib/supabase/server.ts`, `db/schema.ts`.

## 3. Open a safe Circle workspace after login

Type: AFK. Blocked by: 2.

**Build:** Send successful sign-in to the user's workspace using the Circle shell, with the real account/workspace identity. Preserve valid safe return paths and the public demo.

**Acceptance criteria**

- [ ] Password and magic-link sign-in lead to the user's Circle-style workspace; reload and sign-out work and signed-out direct requests require login.
- [ ] An unauthorized workspace URL is refused server-side. The hardcoded `lndev-ui` redirect, fixture account and fixture counts are not shown in the real shell.
- [ ] Until later issues implement them, sample-backed navigation, direct routes, create dialogs, shortcuts and command palette actions are disabled, hidden or return an honest unavailable state. A direct URL cannot bypass this restriction.
- [ ] `/demo` remains explicitly labeled and functional without being presented as private saved data. Desktop/mobile keyboard navigation and existing redirect-security tests pass.

**Start at:** `lib/auth/redirect.ts`, `app/[orgId]/page.tsx`, `components/layout/sidebar/`, `components/layout/command-palette.tsx`.

## 4. Create and list a real project

Type: AFK. Blocked by: 3.

**Build:** Let a signed-in owner create a project with a required name and optional description and see it in the existing Circle projects screen.

**Acceptance criteria**

- [ ] Empty workspace displays an empty state. A valid project is saved and appears in the list after reload and a new session.
- [ ] Empty/invalid name and failed writes show an error without creating a success-shaped UI. A repeated submission cannot silently create duplicate records from one request.
- [ ] User B cannot list, create in, or read user A's workspace or project by changing request IDs; RLS tests cover the same boundary.
- [ ] The visible create control and list use real records, not `mock-data/projects.ts`. Other project actions remain unavailable until implemented.

**Start at:** `app/[orgId]/projects/page.tsx`, `components/common/projects/`, `components/layout/headers/projects/header-nav.tsx`.

## 5. View and edit a saved project

Type: AFK. Blocked by: 4.

**Build:** Open a real project and edit its name and description using the Circle project layout.

**Acceptance criteria**

- [ ] A project from the list opens its saved detail; changes persist after reload. Unknown or inaccessible IDs return the same safe refusal/not-found behavior without exposing details.
- [ ] Invalid and failed edits show an error and retain input. Prevent silent lost updates using a version check or an explicitly documented conflict strategy.
- [ ] Another user cannot read or edit the project through direct requests or database access. Fixture detail/activity and unsupported controls are not shown as real.

**Start at:** `app/[orgId]/project/[projectId]/overview/page.tsx`, `components/common/projects/details/`.

## 6. Create an issue inside a project

Type: AFK. Blocked by: 4.

**Build:** Create an issue with title, optional description, initial open status and the current user as assignee; list it in its real project. Use a durable, workspace-unique human-readable identifier.

**Acceptance criteria**

- [ ] Valid creation appears in the project and survives reload. Empty title and database failure leave the dialog usable and do not claim the issue was saved.
- [ ] Concurrent creates have distinct identifiers. The database rejects an issue referencing a project outside its workspace.
- [ ] Another user cannot create, list or read the issue using altered IDs. The real create flow no longer writes only to `store/issues-store.ts`.
- [ ] Unsupported fixture-only properties are hidden or unavailable; schema, migration and real-session tests are included.

**Start at:** `components/layout/sidebar/create-new-issue/`, `app/[orgId]/project/[projectId]/issues/page.tsx`, `store/issues-store.ts`.

## 7. Show assigned issues in My issues

Type: AFK. Blocked by: 6.

**Build:** Replace the fixture identity and list with saved issues assigned to the verified user in the current workspace.

**Acceptance criteria**

- [ ] The issue created in 6 appears for its assignee after reload; an empty account sees a genuine empty state.
- [ ] Another user's issues do not appear, including through filters or direct server requests. The current user is never selected using `users[0]`.
- [ ] Existing visible filters operate on saved data; unsupported filters and fixture counts are unavailable rather than misleading.

**Start at:** `components/common/my-issues/`, `app/[orgId]/my-issues/page.tsx`.

## 8. Open and edit an issue

Type: AFK. Blocked by: 6.

**Build:** Open a real issue and save changes to its title and description using the Circle detail view.

**Acceptance criteria**

- [ ] Saved changes appear in detail and lists after reload. Unknown and unauthorized issue IDs have a safe response without fixture fallback.
- [ ] Validation, failed writes and concurrent edit conflicts are visible and do not discard unsaved input silently.
- [ ] User B cannot read or edit A's issue through routes, actions or RLS-enforced database requests. Fixture activity and unsupported properties are not presented as real.

**Start at:** `app/[orgId]/issue/[issueId]/page.tsx`, `components/common/issues/details/`.

## 9. Explicitly complete an issue

Type: AFK. Blocked by: 7, 8.

**Build:** Add an explicit owner-controlled action to change an issue between open and completed, without any GitHub dependency.

**Acceptance criteria**

- [ ] Completion and reopening persist after reload and are reflected in the project and My issues views.
- [ ] Unauthorized or failed status updates do not change the visible saved status or show success. Invalid status values are rejected server-side.
- [ ] Linking, closing or merging a PR never changes the issue status; test the invariant when PR integration exists.

**Start at:** `components/common/issues/status-selector.tsx`, issue mutation owner from 8.

## 10. Search saved projects and issues

Type: AFK. Blocked by: 4, 7, 8.

**Build:** Enable a simple workspace-scoped search through the Circle command palette for saved project names and issue titles/identifiers.

**Acceptance criteria**

- [ ] Search opens real matching records; empty input, no matches and request errors have honest states. Keyboard navigation works.
- [ ] Results include only records the verified user can access, including on direct search requests.
- [ ] Fixture projects, people, teams and commands that mutate the in-memory issue store do not appear in the real workspace.

**Start at:** `components/layout/command-palette.tsx`, `store/search-store.ts`.

## 11. Decide GitHub authorization and repository scope

Type: HITL. Blocked by: 4. This is a provider/configuration decision, not a complete user feature.

**Build:** Choose GitHub App or OAuth based on the actual desired repository access, ownership, least permissions, callback and token storage. Select a disposable test repository.

**Acceptance criteria**

- [ ] Document the selected method, required scopes, installation/account ownership, callback, credential protection, revocation and private repository behavior.
- [ ] The owner confirms the provider setup and test repository; no production permission or deployment is assumed.
- [ ] Define an authorization callback bound to the initiating verified user and workspace, with expiring, single-use state and PKCE where supported. Document how altered, expired, replayed and cross-user callbacks are rejected.
- [ ] Record which provider actions require external configuration and how the next issue will test denied/revoked access.

**Start at:** `docs/real-workspace-implementation-plan.md`, issue 08.

## 12. Connect and disconnect GitHub

Type: AFK. Blocked by: 11.

**Build:** Implement the chosen authorization flow and a real connection state in the user's workspace, including disconnect.

**Acceptance criteria**

- [ ] A test user connects, sees the authorized identity/repository scope after reload, and disconnects. Provider denial or expiry gives a recoverable error.
- [ ] Tokens remain server-side and out of logs/client payloads; callback state is bound to the initiating user and workspace, expires and is consumed once. Missing, altered, expired, replayed and cross-user callbacks fail; a second workspace cannot use the connection.
- [ ] Disconnect removes Work's usable credential and documents whether provider-side revocation also occurs; revoked access is reported, not treated as connected.
- [ ] After confirmed revocation or disconnect, hide previously stored private PR details; a temporary provider outage is handled separately as specified in issue 14.

**Evidence:** Real test-provider flow plus cross-user and denied/revoked tests.

## 13. Link a real PR to an issue

Type: AFK. Blocked by: 8, 12.

**Build:** A user adds a GitHub PR URL to a saved issue and can remove that link. Verify repository access before displaying PR information.

**Acceptance criteria**

- [ ] A valid authorized PR can be linked, seen after reload and unlinked. Duplicate links have defined idempotent behavior.
- [ ] Accept only a valid HTTPS GitHub pull-request URL, extract its owner, repository and PR number, and query the GitHub API using those parsed values; never fetch a user-supplied URL. Reject alternate hosts, credentials, ports and non-PR paths, including SSRF attempts.
- [ ] After a successful authorized check, show the PR title, canonical URL, open/closed/merged state and last successful check time. Distinguish a PR never successfully checked from a previously checked, stale result.
- [ ] Invalid URLs, inaccessible/private repositories and provider errors produce clear errors without leaking private data or creating a fake link.
- [ ] Another user cannot read or change the link by supplying IDs; real authenticated tests use a disposable PR.

## 14. Refresh PR state without changing the issue

Type: AFK. Blocked by: 9, 13.

**Build:** Show the PR's actual state, last successful refresh time and a manual refresh action on the issue.

**Acceptance criteria**

- [ ] A refresh reads the current state from GitHub and persists the observation for reload. The UI distinguishes open, closed and merged.
- [ ] During a temporary outage, report the failure and label the last successful observation stale only while its authorization has not been revoked. Never invent a fresh timestamp or treat an unchecked PR as previously verified.
- [ ] Confirmed loss of access or disconnect hides previously stored private PR details and reports that reconnection or renewed access is needed. Test this separately from an outage.
- [ ] Concurrent refreshes cannot replace a newer observation with an older one. A refresh completing after unlink or disconnect cannot restore the link or expose removed details; test both races.
- [ ] A PR merge or closure never changes the issue's open/completed status; test both before and after reload.

## 15. Audit and close remaining demo paths

Type: AFK. Blocked by: 3–14, except 11 where provider setup is a prerequisite of 12. Safety restrictions in issue 3 apply immediately; do not wait for this audit.

**Build:** Audit all real workspace routes, menus, shortcuts and direct actions against fixtures and in-memory writes. Convert any remaining first-release behavior or make it unavailable. Preserve a clearly separate demo.

**Acceptance criteria**

- [ ] A checked route/action inventory covers sidebar, command palette, context menus, direct routes, settings and keyboard shortcuts. Every visible real-workspace action saves real data or is clearly unavailable before use.
- [ ] Direct URLs and requests cannot reveal demo records as personal data or invoke pretend writes. Search for `mock-data` imports, fixture-seeded stores and hardcoded `lndev-ui` paths and account for each reachable use.
- [ ] `/demo` remains clearly labeled and does not imply persistence. No user-facing success is shown on a failed write.

## 16. Recover an account and return to its workspace

Type: AFK. Blocked by: 3.

**Build:** Add email password setup/reset for existing accounts, including magic-link-created accounts, using the existing Supabase authentication and safe redirect rules.

**Acceptance criteria**

- [ ] A test account requests a recovery link, sets a password, signs in and returns to its own workspace. Responses do not reveal whether an email exists.
- [ ] Expired/used links, provider failures and invalid passwords display actionable errors; open redirects remain rejected.
- [ ] Password and magic-link sign-in, session refresh and sign-out still work. Verify with a real test mailbox in the configured test environment.
- [ ] Verify new and existing accounts against the approved signup policy, including email confirmation and configured callback URLs; recovery must not create an unauthorized account or change another user's workspace.

**Start at:** `app/login/actions.ts`, `app/auth/callback/route.ts`, `docs/auth.md`.

## 17. Accept the first release in isolated Beta

Type: HITL. Blocked by: 1–16.

**Build:** Exercise the actual application and decide whether the tested candidate is ready for Stable. Record deployment/migration targets and recovery procedure.

**Acceptance criteria**

- [ ] With isolated Beta data, a test user signs in, sees the Circle shell, creates a project and issue, links and refreshes a real test PR, explicitly completes the issue, signs out/in and sees all saved results.
- [ ] A second user cannot read or change the first user's workspace, projects, issues or PR links, including direct requests; failed save and failed PR refresh are verified.
- [ ] Verify Beta signup, email confirmation, recovery and callback settings with new and existing test accounts. Exercise account switching and sign-out in the same browser and check any shared cache for private-data leakage.
- [ ] Confirm provider settings, redacted operational logs, monitoring ownership and alerts; verify inherited Circle license notices and document a practical rollback and data recovery procedure for this candidate.
- [ ] Record candidate SHA, migrations, exact CI/review results, environment, redacted evidence, backup/recovery procedure and outstanding limitations. The owner makes the Stable promotion decision.
- [ ] No Stable migration or deployment is implied by successful Beta acceptance.

## Later scope

Reviews/inbox, invitations and collaboration, teams/cycles, initiatives/views, agents and House integration need separate product decisions and issue breakdowns. Their Circle demo screens must remain unavailable in the real workspace until they have real data and authorization. Same email alone does not establish a shared House/Work session.
