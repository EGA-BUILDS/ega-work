# EGA Work — Playwright G2 guide (authenticated, read-only)

G2 adds the `authenticated` project: five read-only cases (A01–A05) against a
**dedicated, disposable** EGA Work account with one canary project and one
canary issue. **This implementation was not executed.** Runtime acceptance is
owner-run; until then it is BLOCKED.

## What exists after G2

- `e2e/account.ts` — runtime-only environment validation (UUID + presence). Throws named
  `BLOCKED:` errors listing every missing variable. Never prints secret values.
- `e2e/auth.setup.ts` — `setup` project: fresh password login through the real `/login` page,
  `/me` → workspace landing verification against `E2E_WORKSPACE_ID`, then writes
  `playwright/.auth/user.json` (gitignored, chmod `0600`).
- `e2e/auth.teardown.ts` — `authenticated-teardown` project: deletes `playwright/.auth/user.json`
  after the dependent projects finish, even on failure.
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
separately; they are not A-cases. `playwright test --list` totals 4 public + 1 setup + 5
authenticated + 1 teardown = 11.

## Running (owner)

```
E2E_BASE_URL=https://<verified-origin> E2E_ALLOWED_ORIGINS=https://<verified-origin> \
E2E_EMAIL=… E2E_PASSWORD=… E2E_WORKSPACE_ID=… \
E2E_CANARY_PROJECT_ID=… E2E_CANARY_ISSUE_ID=… \
pnpm test:e2e
```

Expected: `setup` authenticates, 5 A-cases run, teardown deletes the stored state. Two sequential
runs must each report 5 PASS / 0 SKIP. Without the variables, the setup fails immediately with a
named `BLOCKED` error and no authenticated case runs — that is the intended behavior.

## Notes and boundaries

- Read-only: nothing in this suite mutates server state. G3 (`canary.write.spec.ts`) is the only
  authorized write path, and it is owner-only.
- Hydration is waited with value checks, not arbitrary sleeps.
- Duplicate locators are scoped (password form scope in login; label/role-scoped assertions).
- Failure artifacts for auth projects are disabled (`trace: off`, `screenshot: off`). Any artifact
  audit still goes through issue #34 before sharing.
