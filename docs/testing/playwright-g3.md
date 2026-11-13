# EGA Work — Playwright G3 guide (canary writes, owner-only)

G3 adds W01–W03: three reversible writes against one seeded **canary** project and issue.
**This implementation was not executed.** Write mode is owner-run only, against an exact,
confirmed origin, and is BLOCKED by default.

## What exists after G3

- `e2e/write-gate.ts` — runtime gate (never at config load). Validates `E2E_ALLOW_WRITES=I_ACCEPT_TEST_DATA`,
  then re-validates the target against the same explicit allowlist as the preflight
  (`scripts/e2e-target.mjs#validateTarget` — `E2E_BASE_URL` required, https or loopback only,
  listed in `E2E_ALLOWED_ORIGINS`, no path/query/credentials) and requires
  `E2E_CONFIRMED_ORIGIN` to equal that authorized origin exactly. UUID validation for
  `E2E_WORKSPACE_ID`, `E2E_ACCOUNT_USER_ID`, `E2E_CANARY_PROJECT_ID`, `E2E_CANARY_ISSUE_ID`.
  `E2E_INJECT_FAILURE` accepts only `after-write` (or empty); anything else fails closed.
- `e2e/identity.ts` — **authenticated-identity verification, executed before any mutation.**
  Reads the Settings page (`/w/<E2E_WORKSPACE_ID>/settings`, rendered from a Supabase
  `getUser()`-verified session) and compares the rendered `Workspace ID` and `Account ID` rows
  against `E2E_WORKSPACE_ID` and `E2E_ACCOUNT_USER_ID` using row reads (`xpath=..`) and an
  `includes()` check — expected values never enter a locator or an error message. Then it opens
  the canary project and issue through the authorized UI (404 or missing editing surfaces =
  named BLOCKED error). No new endpoint, no service-role query, no application code.
- `e2e/canary.write.spec.ts` — W01 (project description), W02 (issue description), W03 (issue
  completion toggle). Each case calls the identity check first; a mismatch or an unreadable
  canary page blocks before any write. One worker, zero retries, 60 s timeout, `trace/screenshot: off`.
- `playwright.config.ts` — `canary-write` project, same auth pattern as G2.

## What identity means here — and what it does not

Before **each** canary write, the run must prove the browser session is the approved one:

1. Preflight/env gates (explicit origin, allowlist, opt-in, UUIDs).
2. `/w/<workspace>/settings` renders the session's `Workspace ID` and `Account ID`; both rows
   must contain the approved UUIDs, or the run stops with a BLOCKED identity error.
3. The canary project and issue both open through the authorized UI — this binds the two UUIDs
   to records actually visible in the approved workspace (RLS/server authorization is the only
   thing that can make those pages render). If either 404s or renders no editing surface, the run
   stops before any mutation.

This is a **rendering-level** check. It proves the signed-in session is the approved session for
this workspace and that the canary records live there; it does not replace the owner's
out-of-band confirmation that the account, workspace, project, and issue pair is the intended
one. `E2E_ACCOUNT_USER_ID` is no longer a decorative input — a mismatch now hard-blocks.

There is deliberately no E2E-only backdoor: no admin endpoints, no service-role keys, no direct
table reads. Everything goes through the same authorized UI journey the app itself enforces.

## Case behavior

- Each case reads the original value first, writes a deterministic marker
  (`e2e-canary-w0N (automated write check)`), waits for the `PATCH` via a listener registered
  **before** the triggering action, verifies the server echo and the persisted value after reload,
  then restores the original and verifies the restoration after another reload.
- Version counters are not compared; everything else is.
- `try/finally` everywhere: if the body fails _and_ restoration fails, the thrown error contains
  **both** failures plus explicit residual-state guidance. The original failure is never masked.
- Optimistic-lock versioning is handled by navigation: every write/restore navigates to a fresh
  page first (or follows a full `reload()`), so the form/issue `version` state is always the
  server's current value before a PATCH is issued. A conflict (someone else edited the record)
  surfaces as a non-200 and lands in the restore-error path, never as silent data loss. Version
  counters are therefore never compared directly; everything else is.
- Restoration re-reads the field/toggle from the fresh page before writing and verifies the
  restored value after a final reload; partial failure residue is left for manual inspection.
- W03 restoration re-reads the current toggle label and only writes when a toggle is still needed.

## Owner validation (before the real run)

1. Confirm isolated canary identity (disposable account paired with the workspace — confirmed out-of-band);
   record original values (project description, issue description, issue status). The run will,
   before any write, refuse to proceed unless the signed-in session matches `E2E_WORKSPACE_ID`
   and `E2E_ACCOUNT_USER_ID` and both canary UUIDs open in that workspace.
2. Verify the failure-injection path restores correctly:
   `E2E_INJECT_FAILURE=after-write pnpm exec playwright test --project=canary-write` — the case(s)
   should fail with `[E2E_INJECT_FAILURE]` in the original-failure line while the canary fields end
   up restored. Confirm all originals match. (`pnpm test:e2e` runs public only.)
3. Real run without `E2E_INJECT_FAILURE`. Expect 3 PASS; verify originals afterwards.
4. If any restoration fails, do **not** rerun blindly: inspect, restore manually, and record
   residue in the ledger.

## Boundaries

- No new records, no deletes, no migrations, no app changes. No agent ever sets `E2E_ALLOW_WRITES`.
- `playwright test --list` never requires write env vars.
- Failure injection is opt-in and marker-based; it is only for validating restoration.
