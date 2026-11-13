# EGA Work — Playwright G5 guide (manual public E2E workflow)

G5 adds `.github/workflows/e2e-public.yml`: a **manual-only** workflow that runs the four public
cases (P01–P04) against an explicitly verified deployment. **It was never triggered or tested.**

## What it does

- Trigger: `workflow_dispatch` only — no push, pull request, or schedule. No other workflow is
  changed or added.
- Inputs: `deployment_url` (https origin, no path/query/credentials), `deployment_id` (integer
  GitHub Deployment ID), `commit_sha` (full 40-hex SHA).
- Step 1 validates input shapes and normalizes the origin. Step 2 **verifies the deployment
  identity using the GitHub Deployments API** for this repository: the deployment must exist, its
  `sha` must equal `commit_sha`, its latest status must be `success`, and the status'
  `environment_url` origin must equal the `deployment_url` origin. Any mismatch fails the job
  closed. This proves repository/sha/state/environment_url **parity only** — GitHub Deployments
  carry no authoritative Vercel _project_ identifier, so the Vercel project is **not** verified by
  this step (confirm it in the Vercel console if it matters). If the platform does not publish
  GitHub Deployments for this repository, verification fails closed and the workflow is unusable
  until the owner configures a verified deployment-metadata mechanism — by design; user input
  alone never proves identity.
- Node 22, pnpm 10.11.0 (`packageManager`), frozen lockfile, Chromium only, one worker, zero
  retries (from `playwright.config.ts`), `contents: read` + `deployments: read` permissions only.
- Runs preflight, prints `--list` discovery, then P01–P04 against the verified origin. No
  authenticated/write cases, no secrets mapped, no artifacts uploaded (traces/screenshots stay on
  the runner and are discarded).

## What it does not do

- It does not bypass Vercel Deployment Protection, and it uses no bypass secret. If the Preview
  is protected, public checks fail or are blocked; unprotecting or bypassing is an owner decision
  handled outside this workflow (see issue #34).
- It does not run G2–G4, does not dispatch automatically, and does not upload artifacts.

## Owner acceptance (after this branch is merged to the default branch)

1. Ensure the repository publishes GitHub Deployments for the Preview (check
   `gh api repos/EGA-BUILDS/ega-work/deployments?sha=<candidate-sha>`). If not, configure the
   verified metadata mechanism first (or keep this gate BLOCKED).
2. Dispatch with the immutable Preview origin, its GitHub Deployment ID, and the full candidate
   SHA. Confirm the verification logs, the P01–P04 outcome, and the absence of artifacts.
3. Any identity mismatch means stop: do not retry with relaxed checks; investigate the deployment.
