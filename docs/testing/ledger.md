# EGA Work — E2E ledger (append-only)

Runtime behavior is recorded here only after an actual run by the owner. This file is
append-only: do not rewrite earlier entries; add corrections as new dated entries.

## Entry template

```
## YYYY-MM-DD — <gate> — <actor>
- Base: <full SHA> (<branch>) · Candidate: <full SHA or n/a> · Target: <redacted origin>
- Toolchain: Node <v> · pnpm <v> · @playwright/test <v>
- Discovery: <counts>
- Static: <commands and exit codes>
- Runtime: <per-case PASS/FAIL/BLOCKED/DEFERRED; counts; pageerror/5xx count>
- Artifacts: <audit scope and redacted outcome>
- Notes / divergences: <…>
```

## 2026-11-13 — G1a #27 — AGENT (implementation only, NOT RUN)

- Base: `58c62f1e488625771d8b124b17eba13e7d29e778` (`origin/main`, tag `v1.1.0`)
- Branch: `chore/e2e-27-g1a` · Candidate: n/a (code-only; candidate SHA unaffected: `8a5d1c393590bf23abb3a92552cb1eb5e7626d4d`)
- Toolchain: Node 24.22.3 (static checks only; CI authority is Node 22) · pnpm 10.11.0 · `@playwright/test` 1.65.0 (pinned, `-E`)
- Discovery: recorded at implementation time via `--list`; see handoff. Expected 4 (`-g 'P04:'` → 1); no tests executed.
- Static: see handoff (typecheck, e2e typecheck, lint, prettier, unit tests if run) — no browser executed, no build, no smoke test.
- Runtime: **NOT RUN — OWNER REQUEST** for P01–P04. P04 negatives: the suite expects **307 → `/`**, not 404 (issue #27 premise corrected).
- Divergences from issue #27: P04 404→307 correction; branch name per owner task; runtime steps (Production run, `pnpm build`, `test:smoke`, PR opening) intentionally not performed in this code-only task.
- Secrets: NONE created, read into test code, or committed. `playwright/.auth/` ignored.

## 2026-11-13 — G1b #28 — OWNER (BLOCKED)

- Prerequisite: exact candidate SHA `8a5d1c393590bf23abb3a92552cb1eb5e7626d4d` deployed as an **immutable** Vercel Preview URL (never a branch alias), deployment ID verified, GitHub SHA matches, status READY.
- Owner steps (agent must not hold the bypass secret): on a separate machine/OS user, run preflight with `E2E_BASE_URL=<immutable URL>` and `E2E_ALLOWED_ORIGINS=<same URL>`, then `pnpm test:e2e` twice; each run must be 4/4 PASS, 0 fail/skip, zero page errors / first-party 5xx. Use a same-origin one-time `context.request.get` with `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie=true`, `maxRedirects: 0`; never set those headers globally nor send them to third parties.
- Artifact audit (#34) is required during this gate: controlled failure with a sentinel value, scan terminal/`test-results/`/snapshots/JSON/reports/traces/logs/headers for the sentinel, then a real audit **without printing** the secret; manual review; PASS only if clean, otherwise rotation in Vercel before any further run.
- Record: redacted deployment ID, immutable URL, full SHA, READY, two-run counts, audit outcome. Never the secret, cookie, header, or token values.
- Blockers: none of these can be performed by an agent. If the candidate Preview does not exist, is not immutable, or is not READY → this gate stays BLOCKED. If candidate P04 returns 404 → file a patch finding; do not weaken the test.

## 2026-11-13 — Release #29 — OWNER (BLOCKED)

- Prerequisites: CI green for the patch SHA; dependency audit reviewed including the **R1 PostCSS residual-risk disposition** recorded explicitly; G1b evidence complete; v1.1.0 negative control recorded with the corrected 307 expectation (see divergence #1 in E2E-CONTEXT.md); candidate P04 = 307.
- Decision: the owner records a dated **APPROVE** or **BLOCK** with rationale in this ledger. Any missing prerequisite means BLOCK, never inferred approval. P01–P03 passing does not prove advisories fixed (that is the audit/CI job).

## 2026-11-13 — G2 #30 — OWNER PROVISIONS, AGENT (BLOCKED)

- Prerequisites: owner confirms the EGA Work Supabase project identity and signup policy (do **not** assume the EGA Skills project shares this database); owner provisions a **disposable** E2E user, its one private workspace, and one canary project + one canary issue (A05, and later G3 writes).
- Owner-run steps: set `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_WORKSPACE_ID` (UUID), `E2E_CANARY_PROJECT_ID`, `E2E_CANARY_ISSUE_ID` in the run environment only; `pnpm test:e2e:typecheck`, `pnpm test:e2e:list` (expect 5 A-cases plus the separate `authenticate` setup), then two sequential `pnpm test:e2e` runs targeting the same origin; verify 5 PASS / 0 SKIP each run; confirm no mutations, delete local `playwright/.auth/` afterward (the `authenticated-teardown` project also removes it).
- Blockers: without owner-provisioned account/canary records, every A-case fails at setup with a named missing-variable error. That is the intended BLOCKED signal, not a PASS.
- Artifacts: auth project runs with `trace: off` and `screenshot: off`; never attach raw artifacts without the #34 audit.

## 2026-11-13 — G3 #31 — OWNER ONLY (BLOCKED)

- Prerequisites: G2 complete; owner verifies the disposable account, workspace UUID, canary project/issue IDs, records the originals of the canary fields to be touched (project description, issue description, issue status), and confirms nothing else in the workspace is canary.
- Write gate (runtime, not config-load): `E2E_ALLOW_WRITES=I_ACCEPT_TEST_DATA`, `E2E_CONFIRMED_ORIGIN` equal to the exact target origin, `E2E_WORKSPACE_ID`/`E2E_ACCOUNT_USER_ID`/`E2E_CANARY_PROJECT_ID`/`E2E_CANARY_ISSUE_ID` all valid UUIDs and consistent. `pnpm test:e2e:list` must work **without** these set (validation happens at test runtime). Failure-injection: `E2E_INJECT_FAILURE=after-write` must still restore the original values (validated by the owner before the real run).
- Owner-run steps: 60 s timeout, one worker, zero retries; verify after each run that all touched fields match the recorded originals (version counters may advance); confirm zero extra records created; confirm no DELETE endpoint was used.
- Restoration failure: the runner reports residue explicitly and preserves the original failure; the owner must manually inspect and restore before further runs.
- Blockers: any identity mismatch or wrong origin blocks before any write. The agent never runs write mode and never sets `E2E_ALLOW_WRITES`.

## 2026-11-13 — G4 #32 — OWNER FIXTURE, AGENT (DEFERRED / BLOCKED without fixture)

- Prerequisites: owner approval; a **disposable GitHub repository** and a **disposable GitHub App installation** usable only for this fixture; known expected state documented without credentials (expected connection state, linked PR URL/title/number). No owner GitHub account, no OAuth automation, no App installation by automation, no repository writes.
- Fixture-only variables: `E2E_GITHUB_FIXTURE_CONFIRMED=I_CONFIRM_SAFE_GITHUB_FIXTURE`, `E2E_GITHUB_EXPECTED_STATE` (one of the known badge texts), `E2E_GITHUB_PR_URL`, `E2E_GITHUB_PR_TITLE`. Without them, I01/I02 fail with a **BLOCKED** message — never a PASS.
- After the owner provisions the fixture: two tests discovered, run read-only, record redacted fixture identity and results; do not click refresh/link/unlink during evidence collection unless that is the explicitly agreed fixture action.
- Blockers: none of this may be substituted by mocking — a mock proves wiring, not the integration.

## 2026-11-13 — G5 #33 — OWNER APPROVAL, AGENT (DEFERRED)

- Prerequisites: owner approves the manual workflow; owner confirms the SHA-specific Preview is reachable without leaking any protection secret; `workflow_dispatch`-only workflow on `main` with inputs `deployment_url`, `deployment_id`, `commit_sha`.
- Identity verification: the workflow queries the GitHub Deployments API (`deployments: read`) for a deployment whose `sha` equals the full input SHA, requires a **successful** deployment status, and requires the status `environment_url` origin to equal `deployment_url`. If Vercel does not publish GitHub Deployments for this repository, the verification step fails closed and the gate stays BLOCKED until the owner configures an equivalent verified mechanism. User-supplied inputs alone are never treated as proof.
- Runs P01–P04 only. No auth/write modes, no schedule, no untrusted-PR secrets, no artifacts uploaded.
- Owner-run: dispatch with the verified inputs; confirm run URL, outcome, and that no sensitive artifact (trace/screenshot/log with headers) exists. Revoke/adjust inputs if the wrong deployment was selected.
- Blockers: protection-secret handling that cannot be done safely blocks the whole gate; any leak is a rotate-and-stop event.

## 2026-11-13 — Security audit #34 — OWNER (BLOCKED)

- Prerequisites: owner-protected Preview environment; a controlled failing bootstrap with a **sentinel** value (never the real bypass secret).
- Scope: terminal output, `test-results/`, page snapshots, JSON reports, traces/screenshots if any, logs, and response headers — scanned for the sentinel; then a real audit that must never print the secret; manual review of anything found.
- Outcomes: PASS only if clean; otherwise explicit BLOCKED + bypass revocation/rotation in Vercel before any further acceptance run (G1b included).
- Exact-match scanning is not DLP; manual review is mandatory.

## 2026-11-13 — Master tracker #35 — OWNER (TO DO, tracked in issue #35)

Dependency map of the gates: #27 (G1a, FIRST) ← #28 (G1b) ← #29 (Release); #30 (G2) after #27 and #28; #31 (G3) after #30; #32 (G4) after #30 + fixture; #33 (G5) after #27 + SHA-specific Preview; #34 (audit) during #28. No gate is complete until this ledger records its evidence. Optional gates (#30–#33) must never be reported as done without their own evidence entries. No automatic merge, push, or deploy is authorized by this ledger.
