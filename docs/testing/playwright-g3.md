# EGA Work — Playwright G3 guide (canary writes, owner-only)

G3 adds W01–W03: three reversible writes against one seeded **canary** project and issue.
**This implementation was not executed.** Write mode is owner-run only, against an exact,
confirmed origin, and is BLOCKED by default.

## What exists after G3

- `e2e/write-gate.ts` — runtime gate (never at config load): requires `E2E_ALLOW_WRITES=I_ACCEPT_TEST_DATA`,
  `E2E_CONFIRMED_ORIGIN` exactly equal to the configured target origin, and UUID validation for
  `E2E_WORKSPACE_ID`, `E2E_ACCOUNT_USER_ID`, `E2E_CANARY_PROJECT_ID`, `E2E_CANARY_ISSUE_ID`.
  `E2E_INJECT_FAILURE=after-write` arms the failure-injection hook.
- `e2e/canary.write.spec.ts` — W01 (project description), W02 (issue description), W03 (issue
  completion toggle). One worker, zero retries, 60 s timeout, `trace/screenshot: off`.
- `playwright.config.ts` — `canary-write` project, same auth pattern as G2.

## Case behavior

- Each case reads the original value first, writes a deterministic marker
  (`e2e-canary-w0N (automated write check)`), waits for the `PATCH` via a listener registered
  **before** the triggering action, verifies the server echo and the persisted value after reload,
  then restores the original and verifies the restoration after another reload.
- Version counters are not compared; everything else is.
- `try/finally` everywhere: if the body fails _and_ restoration fails, the thrown error contains
  **both** failures plus explicit residual-state guidance. The original failure is never masked.
- W03 restoration re-reads the current toggle label and only writes when a toggle is still needed.

## Owner validation (before the real run)

1. Confirm isolated canary identity; record original values (project description, issue
   description, issue status).
2. Verify the failure-injection path restores correctly:
   `E2E_INJECT_FAILURE=after-write pnpm test:e2e -- --project=canary-write` — the case(s) should
   fail with `[E2E_INJECT_FAILURE]` in the original-failure line while the canary fields end up
   restored. Confirm all originals match.
3. Real run without `E2E_INJECT_FAILURE`. Expect 3 PASS; verify originals afterwards.
4. If any restoration fails, do **not** rerun blindly: inspect, restore manually, and record
   residue in the ledger.

## Boundaries

- No new records, no deletes, no migrations, no app changes. No agent ever sets `E2E_ALLOW_WRITES`.
- `playwright test --list` never requires write env vars.
- Failure injection is opt-in and marker-based; it is only for validating restoration.
