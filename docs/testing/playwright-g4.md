# EGA Work — Playwright G4 guide (GitHub PR display, read-only, provisional)

G4 adds I01–I02: read-only display of the GitHub connection state and of a previously linked
pull request. **This implementation was not executed.** Without an owner-provided disposable
fixture, both cases fail with a named `BLOCKED` error — never a PASS.

## What exists after G4

- `e2e/github.read.spec.ts` — I01 (expected connection state badge on workspace settings) and
  I02 (previously linked PR shown read-only on the issue page). Provisional; no app installation,
  OAuth flow, linking, refresh, unlink, or repository write occurs anywhere in these cases.
- `playwright.config.ts` — `github-read` project, same auth pattern as G2/G3.

## Fixture contract (owner provisions; agent never does)

- A **disposable** GitHub repository and a **disposable** GitHub App installation (Pull requests:
  read-only; Metadata: read-only), connected to a disposable EGA Work workspace.
- One canary issue with a previously linked pull request.
- Environment (run-time only): `E2E_GITHUB_FIXTURE_CONFIRMED=I_CONFIRM_SAFE_GITHUB_FIXTURE`,
  `E2E_GITHUB_EXPECTED_STATE` (`connected` | `reauthorization_required` | `unconfigured` |
  `unavailable` | `disconnected`), `E2E_WORKSPACE_ID`, `E2E_CANARY_ISSUE_ID`, and for I02
  `E2E_GITHUB_PR_URL` (https github.com URL), `E2E_GITHUB_PR_TITLE`, optional
  `E2E_GITHUB_REPO_REF` (e.g. `owner/repo#123`).

## Behavior without a fixture

I01/I02 throw `BLOCKED: GitHub fixture is not configured …` before any assertion runs. Discovery
still lists exactly two tests. No mock or stub is used — a mock would prove wiring, not the
integration, and would be a false PASS.

## Badge mapping asserted by I01

| `E2E_GITHUB_EXPECTED_STATE` | Badge text       |
| --------------------------- | ---------------- |
| `connected`                 | Connected        |
| `reauthorization_required`  | Reconnect needed |
| `unconfigured`              | Not configured   |
| `unavailable`               | Unavailable      |
| `disconnected`              | Not connected    |

(These come from `components/work/github-settings.tsx`; if that mapping changes, update this
table and the spec.)

## Boundaries

- No GitHub App installation or authorization automation; no repository writes; no owner GitHub
  account; no bypass of Deployment Protection.
- I02 never clicks Refresh / Unlink / Link.
- Account creation, installation, and linking remain owner actions.
