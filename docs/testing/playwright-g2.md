# EGA Work — Playwright G2 guide (authenticated, read-only)

G2 adds the `authenticated` project: five read-only cases (A01–A05) against a
**dedicated, disposable** EGA Work account with one canary project and one
canary issue. **This implementation was not executed.** Runtime acceptance is
owner-run; until then it is BLOCKED.

## What exists after G2

- `e2e/account.ts` — runtime-only environment validation (UUID + presence). Throws named
  `BLOCKED:` errors listing every missing variable. Never prints secret values.
- `e2e/auth.setup.ts` — `setup` project: deletes any orphaned `playwright/.auth/user.json` first,
  then performs a fresh password login through the real `/login` page, `/me` → workspace landing
  verification against `E2E_WORKSPACE_ID`, then writes `playwright/.auth/user.json`
  (gitignored, chmod `0600`). Never reuses a stored session.
- `e2e/auth.teardown.ts` — `authenticated-teardown` project: deletes `playwright/.auth/user.json`
  after the dependent projects finish. Removing a missing file is fine (idempotent); genuine
  removal errors fail the teardown and are surfaced by the runner.
- `e2e/workspace.auth.spec.ts` — A01–A05.
- `playwright.config.ts` — `public`, `setup`, `authenticated-teardown`, `authenticated` projects;
  one worker, zero retries; auth projects run with `trace: off` and `screenshot: off`.

## Required owner actions (before any run)

1. Confirm the actual EGA Work Supabase project identity and signup policy. Do **not** assume the
   EGA Skills database is shared.
2. Create the disposable E2E user; give it its one private workspace (via `/me`) and one canary
   project and issue (for A05, later G3).
3. Export (in the run environment only): `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_WORKSPACE_ID`,
   `E2E_CANARY_PROJECT_ID`, `E2E_CANARY_ISSUE_ID`. Optional exact-match content checks:
   `E2E_CANARY_PROJECT_NAME`, `E2E_CANARY_ISSUE_TITLE`.
4. Target: `E2E_BASE_URL` (explicit origin) + `E2E_ALLOWED_ORIGINS` containing it.

The agent must never perform steps 1–2, never see the password, and never provision users.

## Discovery (no execution)

```
node_modules/.bin/playwright test --project=authenticated --list
```

Expected: exactly 5 tests (A01–A05). The `setup` and `authenticated-teardown` projects are listed
separately; they are not A-cases. The full `playwright test --list` prints 4 public + 1 setup +
1 teardown + 5 authenticated + 3 canary-write + 2 github-read = 16 tests.

`--list` never reads credentials at load time; the A-cases fail at **test execution** with named
`BLOCKED:` errors until the owner provides the environment below.

## Auth-state lifecycle and crash recovery

- `setup` deletes any orphaned `playwright/.auth/user.json` **before** logging in fresh, so a stale
  file can never contaminate a new session.
- `authenticated-teardown` deletes the file after the dependent projects run — Playwright schedules
  the teardown project even when `setup` fails. After an interrupted run (SIGINT/hard kill) the
  file can remain orphaned on disk; recover manually:

   ```
   rm -f playwright/.auth/user.json   # or, from repo root, simply: rm -f playwright/.auth/user.json
   ```

   and re-create the login on the next run. The file is `0600`, gitignored, and never needed twice
   (each run logs in fresh).

- Non-public projects set `trace: off` and `screenshot: off` so no authentication artifacts are
  recorded. Before sharing any of `test-results/` with anyone, run the issue #34 audit.

## Running (owner)

```
E2E_BASE_URL=https://<verified-origin> E2E_ALLOWED_ORIGINS=https://<verified-origin> \
E2E_EMAIL=… E2E_PASSWORD=… E2E_WORKSPACE_ID=… \
E2E_CANARY_PROJECT_ID=… E2E_CANARY_ISSUE_ID=… \
pnpm exec playwright test --project=authenticated
```

Note: `pnpm test:e2e` now runs the **public** suite only; authenticated cases are always selected
explicitly. Expected: `setup` deletes any stale state, authenticates, 5 A-cases run, teardown
deletes the stored state. Two sequential runs must each report 5 PASS / 0 SKIP. Without the
variables, the setup fails immediately with a named `BLOCKED` error and no authenticated case
runs — that is the intended behavior.

## Notes and boundaries

- Read-only: nothing in this suite mutates server state. G3 (`canary.write.spec.ts`) is the only
  authorized write path, and it is owner-only.
- Hydration is waited with value checks, not arbitrary sleeps.
- Duplicate locators are scoped (password form scope in login; label/role-scoped assertions).
- Failure artifacts for auth projects are disabled (`trace: off`, `screenshot: off`). Any artifact
  audit still goes through issue #34 before sharing.
