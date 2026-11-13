# EGA Work — Playwright G1a guide

G1a adds the public-only P01–P04 suite and the foundation the later gates use.
**This implementation was not executed in a browser.** Runtime acceptance is an
owner step against a verified target.

## What exists after G1a

- `playwright.config.ts` — one `public` Chromium project (`Desktop Chrome`), `testDir: ./e2e`,
  `fullyParallel: false`, `workers: 1`, `retries: 0`, `timeout: 30s`, `reporter: list`.
- `e2e/fixtures.ts` — auto `monitor` fixture: fails the test on any `pageerror` or any
  first-party (same-origin as `baseURL`) HTTP 5xx response. Query strings and fragments are
  stripped before URLs are logged.
- `e2e/public.public.spec.ts` — P01–P04.
- `e2e/fixtures.ts`, `e2e/public.public.spec.ts` are the only test files in G1a.
- `scripts/e2e-target.mjs` — authoritative allowlist logic (loopback always allowed; anything
  remote must be explicitly listed in `E2E_ALLOWED_ORIGINS`).
- `scripts/e2e-preflight.mjs` — fail-closed preflight; prints `BLOCKED` reasons and exits 1.
- `tsconfig.e2e.json` — isolated E2E type-check. Root `tsconfig.json` excludes `e2e/` and
  `playwright.config.ts` so application type-checking never swallows E2E files.
- `package.json` scripts: `test:e2e` (preflight + run), `test:e2e:typecheck`, `test:e2e:list`.

## Target safety model

- `E2E_BASE_URL` is **required** for any run. It must be an `https:` origin (or loopback
  `http://localhost:3000` / `http://127.0.0.1:3000`), with no path, query, fragment, or credentials.
- `E2E_ALLOWED_ORIGINS` is a comma-separated explicit allowlist. The target must be in it.
  Loopback origins are always allowed for local development.
- Fail closed: missing/malformed/unlisted values block the run with named reasons. Values are
  never printed.
- **No bypass secrets are used anywhere in this suite.** If a target is behind Vercel Deployment
  Protection, the public tests will fail or be blocked until the owner provides a safe access
  path (see issue #28 / #33 and the audit in issue #34).

## Discovery (no execution)

```
node_modules/.bin/playwright test --list
node_modules/.bin/playwright test -g 'P04:' --list
```

Expected: 4 tests for the former, 1 for the latter (`P04:` is intentionally unanchored in the
grep; no other test name contains `P04:`).

## Running (owner)

```
E2E_BASE_URL=https://<verified-target-origin> \
E2E_ALLOWED_ORIGINS=https://<verified-target-origin> \
pnpm test:e2e
```

Expected outcome classes: **PASS**, **FAIL** (assertion mismatch), or **BLOCKED** (preflight),
never a silent skip. The monitor turns any `pageerror` or first-party 5xx into a failure.

### P04 negative control (owner step, post-merge of G1a)

Issue #27 originally asserted Production P04 = HTTP 404 = "NEGATIVE CONTROL PASS". That premise
was corrected before implementation: **Production v1.1.0 expects HTTP 307 → `/`** (the 404 appeared
in an intermediate candidate and was fixed). G1a asserts 307. The owner's release decision (#29)
must be based on actual candidate/production behavior, not on the stale 404 expectation.

## Authenticated and write modes

Not present in G1a. G2 adds the `setup`/`authenticated` projects (issue #30), G3 the
`canary-write` project (issue #31), G4 the provisional `github-read` project (issue #32), G5 the
manual workflow (issue #33). See [E2E-CONTEXT.md](E2E-CONTEXT.md).

## Artifact and failure handling

- `trace: retain-on-failure`, `screenshot: only-on-failure`. `test-results/`, `playwright-report/`,
  and `playwright/.auth/` are gitignored.
- Public pages carry no credentials, so failure artifacts for P01–P04 are not secret-bearing by
  construction — still, review them before sharing; exact-match scanning is not DLP (issue #34).
