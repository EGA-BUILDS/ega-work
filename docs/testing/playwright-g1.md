# EGA Work — Playwright G1a guide

G1a adds the public-only P01–P04 suite and the foundation the later gates use.
**This implementation was not executed in a browser.** Runtime acceptance is an
owner step against a verified target.

## What exists after G1a

- `playwright.config.ts` — one default `public` Chromium project (`Desktop Chrome`), `testDir: ./e2e`,
  `fullyParallel: false`, `workers: 1`, `retries: 0`, `timeout: 30s`, `reporter: list`. Every
  non-public project (`setup`, `authenticated-teardown`, `authenticated`, `canary-write`,
  `github-read`) sets `default: false`; only `pnpm test:e2e` / `--project=public` runs by default.
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
- `package.json` scripts: `test:e2e` (preflight + **public-only** run), `test:e2e:typecheck`,
  `test:e2e:list` (public discovery only). Authenticated, canary-write and GitHub-fixture projects
  must be selected explicitly, e.g. `pnpm exec playwright test --project=authenticated`.

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
node_modules/.bin/playwright test --project=public --list
node_modules/.bin/playwright test --project=public -g 'P04:' --list
node_modules/.bin/playwright test --list   # all projects (never executed by CI/preflight)
```

Expected: 4 public tests for the first command, 1 for the second (`P04:` is intentionally
unanchored in the grep; no other test name contains `P04:`). The unqualified `--list` prints
every project, including the owner-only authenticated/canary/github cases — discovery is safe
(no credentials read at load), but never run without understanding what it lists.

## Running (owner)

```
E2E_BASE_URL=https://<verified-target-origin> \
E2E_ALLOWED_ORIGINS=https://<verified-target-origin> \
pnpm test:e2e
```

Expected outcome classes: **PASS**, **FAIL** (assertion mismatch), or **BLOCKED** (preflight),
never a silent skip. The monitor turns any `pageerror` or first-party 5xx into a failure.

### P04 and the 307 expectation (owner step)

Three different revisions are easy to confuse:

- **v1.1.0 Production** (tag `v1.1.0` → `58c62f1…`): expected to answer HTTP **307 → `/`** for unknown nested
  routes; the committed smoke contract (`scripts/smoke-production.mjs`) asserts exactly that.
- **Intermediate Next.js 15.5 candidate**: regressed to HTTP 404; fixed by the later not-found
  correction. It is **not** a reference for acceptance.
- **v1.1.1 candidate** `8a5d1c393590bf23abb3a92552cb1eb5e7626d4d`: expected to answer HTTP **307**; release
  decision evidence must be recorded against this exact SHA.

Issue #27 originally asserted P04 = HTTP 404 as a "negative control"; that premise is withdrawn.
G1a asserts **307**. If any candidate answers 404, file a patch finding — do **not** weaken the test.
The owner's release decision (#29) must be based on the actual candidate SHA, not on any 404 expectation.

## Authenticated and write modes

Not present in G1a. G2 adds the `setup`/`authenticated` projects (issue #30), G3 the
`canary-write` project (issue #31), G4 the provisional `github-read` project (issue #32), G5 the
manual workflow (issue #33). See [E2E-CONTEXT.md](E2E-CONTEXT.md).

## Artifact and failure handling

- `trace: retain-on-failure`, `screenshot: only-on-failure`. `test-results/`, `playwright-report/`,
  and `playwright/.auth/` are gitignored.
- Public pages carry no credentials, so failure artifacts for P01–P04 are not secret-bearing by
  construction — still, review them before sharing; exact-match scanning is not DLP (issue #34).
