# EGA Work — E2E context (G1a)

Status: **implementation-only snapshot. No browser test has been executed.**
Owner-approved plan transcribed from GitHub issues #27–#35. Anything not stated
there or in the repository is explicitly marked as unknown, not guessed.

## Repository and targets

- Repository: `EGA-BUILDS/ega-work` (origin: `https://github.com/EGA-BUILDS/ega-work.git`)
- `origin/main` at time of G1a implementation: `58c62f1e488625771d8b124b17eba13e7d29e778`
- Issues #27–#29 treat tag `v1.1.0` as the Production baseline; that claim comes from the issues,
  it is **not independently verified from this repository**. Tag `v1.1.0` resolves to the base above.
- Intermediate Next.js 15.5 candidate: regressed unknown-route handling to HTTP 404; fixed before
  release. Not a reference for acceptance.
- **v1.1.1 candidate SHA** (not merged, not this branch): `8a5d1c393590bf23abb3a92552cb1eb5e7626d4d`
- Package manager: pnpm 10.11.0; CI uses Node 22 (implementation environment ran Node 24.22.3 for static checks only)
- Runner: `@playwright/test` **1.65.0**, pinned exactly, Chromium only, one worker, zero retries

## Gates, actors, and dependencies (from issues #27–#35)

| Gate    | Issue | Actor                          | IDs           | Depends on                      | State after G1a                                  |
| ------- | ----- | ------------------------------ | ------------- | ------------------------------- | ------------------------------------------------ |
| G1a     | #27   | agent (code)                   | P01–P04       | none                            | TO DO → implemented, runtime NOT RUN             |
| G1b     | #28   | OWNER                          | P01–P04 twice | #27                             | BLOCKED until exact candidate SHA deployment     |
| Release | #29   | OWNER                          | none          | #28                             | BLOCKED until evidence                           |
| G2      | #30   | OWNER provisions, agent writes | A01–A05       | #27, #28                        | BLOCKED — owner credentials and fixture required |
| G3      | #31   | OWNER ONLY (writes)            | W01–W03       | #30                             | BLOCKED — owner-only                             |
| G4      | #32   | OWNER (fixture), agent writes  | I01–I02       | #30 + disposable GitHub fixture | DEFERRED                                         |
| G5      | #33   | OWNER approves, agent drafts   | P01–P04 only  | #27 + SHA-specific Preview      | DEFERRED                                         |
| Audit   | #34   | OWNER                          | none          | #27 (during #28)                | BLOCKED until owner-protected Preview            |
| Tracker | #35   | OWNER                          | none          | none                            | TO DO (tracks the others)                        |

## Hard constraints (all gates)

- Never claim browser PASS without an actual run. Runtime verification is **NOT RUN — OWNER REQUEST** for everything in this document.
- Agent never provisions or provisions into real accounts, never holds owner credentials, Vercel bypass secrets, service-role keys, or GitHub tokens.
- No `data-testid` attributes may be added; no application code, migrations, RLS, or security behavior changes to make tests pass.
- Client stores are not a database; tests assert rendered behavior and persisted reload state only.
- Issues track scope; this file records what the issues say, corrected where an issue is technically wrong (see divergences).

## Environment variables

| Variable                       | Gate  | Meaning                                                                                               |
| ------------------------------ | ----- | ----------------------------------------------------------------------------------------------------- |
| `E2E_BASE_URL`                 | all   | Explicit https origin of the target (or loopback for local dev)                                       |
| `E2E_ALLOWED_ORIGINS`          | all   | Comma-separated explicit allowlist; `E2E_BASE_URL` must be in it. Loopback origins are always allowed |
| `E2E_EMAIL`                    | G2+   | Dedicated disposable E2E account email (owner-provisioned)                                            |
| `E2E_PASSWORD`                 | G2+   | That account's password. Never logged, never committed                                                |
| `E2E_WORKSPACE_ID`             | G2+   | Exact UUID of the E2E workspace; validated as UUID at runtime                                         |
| `E2E_CANARY_PROJECT_ID`        | G2/G3 | Canary project UUID (owner-provisioned)                                                               |
| `E2E_CANARY_ISSUE_ID`          | G2/G3 | Canary issue UUID (owner-provisioned)                                                                 |
| `E2E_ACCOUNT_USER_ID`          | G3    | Dedicated account's user UUID (write gate)                                                            |
| `E2E_ALLOW_WRITES`             | G3    | Must equal `I_ACCEPT_TEST_DATA`; set only by the owner, never by automation                           |
| `E2E_CONFIRMED_ORIGIN`         | G3    | Must equal the target origin exactly (write gate)                                                     |
| `E2E_INJECT_FAILURE`           | G3    | Failure-injection hook, e.g. `after-write`; used to validate restoration                              |
| `E2E_GITHUB_FIXTURE_CONFIRMED` | G4    | Must equal `I_CONFIRM_SAFE_GITHUB_FIXTURE`; owner sets it only for the disposable fixture             |
| `E2E_GITHUB_EXPECTED_STATE`    | G4    | One of `connected`, `reauthorization_required`, `unconfigured`, `unavailable`, `disconnected`         |
| `E2E_GITHUB_PR_URL`            | G4    | github.com https URL of the previously linked fixture PR (I02)                                        |
| `E2E_GITHUB_PR_TITLE`          | G4    | Exact title of the linked fixture PR (I02)                                                            |
| `E2E_GITHUB_REPO_REF`          | G4    | Optional `owner/repo#number` text asserted by I02                                                     |

No value from this table may be committed. `.env*` files are gitignored (except `.env.dev.example`).

## Commands

| Command                          | Purpose                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm test:e2e:typecheck`        | Type-check `e2e/` and `playwright.config.ts` with `tsconfig.e2e.json`                                           |
| `pnpm test:e2e:list`             | Public discovery only (`--project=public --list`); does not execute tests                                       |
| `pnpm test:e2e`                  | Public-only run (preflight + `--project=public`). **Runtime execution requires owner request and environment.** |
| `node scripts/e2e-preflight.mjs` | Print OK or BLOCKED reasons; exits 1 on any problem                                                             |

Authenticated, canary-write and GitHub-fixture projects are never selected by default:
only `public` runs via `pnpm test:e2e`; every other project sets `default: false` (Playwright 1.65)
and must be selected explicitly, e.g. `pnpm exec playwright test --project=authenticated`.

## Discovery targets (per issue)

- G1a: exactly 4 (`P01`–`P04`); `-g 'P04:' --list` reports exactly 1
- G2: exactly 5 (`A01`–`A05`), excluding the separate `authenticate` setup test
- G3: exactly 3 (`W01`–`W03`)
- G4: exactly 2 (`I01`–`I02`)

## Divergences from the issues (recorded, with justification)

1. **P04 expected status — issue #27 assumed Production must return HTTP 404; that is wrong.**
   Production v1.1.0 expects HTTP **307** to `/`. The 404 appeared only in an
   intermediate Next.js 15.5 candidate and was fixed afterward. G1a implements
   the actual HTTP behavior: a real response assertion on status 307 with the
   `Location` header normalized via `new URL()`. No Production behavior was
   changed to match a test.
2. **Branch names — issues #27/#30/#31 specify `chore/playwright-g1` etc.** The owner-approved task
   instruction overrides branch naming: `chore/e2e-27-g1a`, `feat/e2e-30-g2`, `feat/e2e-31-g3`,
   `feat/e2e-32-g4`, `chore/e2e-33-g5` (stacked, base = previous HEAD).
3. **Issue #27 says "Run pnpm build / pnpm test:smoke / P01–P04 on Production"** — explicitly out of scope
   for this implementation-only task. No build, smoke test, or browser test was executed. These remain
   owner-run steps; see [ledger.md](ledger.md).
4. **Node version** — this implementation environment has Node 24.22.3 only; CI and the issues target Node 22.
   Static checks ran on Node 24.22.3; CI remains the Node 22 authority.
5. **Production origin is not documented in the repository.** `E2E_ALLOWED_ORIGINS` therefore has no remote
   default: the owner must set it explicitly (or rely on loopback). Fail-closed by construction.
6. **`~/.agents/skills/playwright-cli/SKILL.md` was not present** on this machine; Playwright guidance was
   taken from the official documentation at playwright.dev instead. No global Playwright CLI was present either;
   the pinned local `@playwright/test` 1.65.0 was used for discovery.
7. **Post-implementation review hardening (`fix/e2e-post-implementation-review`)**: non-public projects set
   `default: false`; `test:e2e` and `test:e2e:list` are public-only; `auth.setup.ts` deletes orphaned
   `playwright/.auth/user.json` before logging in; the canary write gate re-validates the target allowlist
   (via `scripts/e2e-target.mjs#validateTarget`) before any write and rejects unknown `E2E_INJECT_FAILURE`
   values; allowlist diagnostics never echo raw entries; the manual workflow's identity check documents that
   it proves repository/sha/state/environment_url parity only — **not** the Vercel project.
8. **`tsconfig.json` excludes `ega-work/`** — an untracked nested copy of this repository present only in some
   local checkouts (here: the owner's parallel candidate inspection). The exclusion changes nothing in a clean
   checkout; it prevents `**/*.ts` from swallowing a duplicate app with its own `node_modules`. It may be
   removed when the nested copy is gone. Root typechecking otherwise covers exactly the same files.
9. **Issue #30 said "wait hydration with `toHaveValue`"** — the implementation compares `inputValue()` instead,
   because a failed `toHaveValue(email/password)` would print the account email (and, for the password field,
   its cleartext) into assertion errors and artifacts. Semantics are identical; only the failure output differs.
10.   **Issue #30 expects the auth state deleted "afterward"** — Playwright's teardown project deletes it after the
      dependent projects finish (verified in the installed 1.65.0 task-runner source: the teardown project is
      scheduled after its setup/dependents and runs even when setup fails). Setup additionally deletes orphaned
      state before a fresh login. A hard kill can still orphan the file; recovery is documented in
      `playwright-g2.md`.

## Ledger

All gate outcomes are recorded append-only in [ledger.md](ledger.md). Until the
owner runs and reviews the gates, every outcome there is **NOT RUN** or **BLOCKED**.
