# EGA Work — Playwright G5 guide (manual public E2E workflow)

G5 adds `.github/workflows/e2e-public.yml`: a **manual-only** workflow that runs the four public
cases (P01–P04) against an explicitly verified deployment. **It was never triggered or tested.**

## Activation reality (read this first)

`workflow_dispatch` only works once the workflow file exists on the repository's **default
branch**. The workflow currently exists only on local implementation branches, so:

- **It cannot be dispatched from GitHub right now** — the "Actions" tab does not list it, and any
  attempt to trigger it fails with "workflow does not exist on the default branch".
- It becomes eligible for manual dispatch **only after the owner reviews and integrates the
  workflow into `main`** (by whatever integration path the owner chooses for the stacked E2E
  branches).
- **Do not merge the workflow (or the E2E branches) merely to enable testing.** Eligibility is a
  side-effect of legitimate integration, never a reason to force it.

## What it does

- Trigger: `workflow_dispatch` only — no push, pull request, or schedule. No other workflow is
  changed or added.
- Inputs: `deployment_url` (https origin, no path/query/credentials), `deployment_id` (integer
  GitHub Deployment ID), `commit_sha` (full 40-hex SHA).
- Step 1 validates input shapes and normalizes the origin. Step 2 **verifies the deployment
  identity using the GitHub Deployments API** for this repository: the deployment must exist, its
  `sha` must equal `commit_sha`, its latest status must be `success`, and the status'
  `environment_url` origin must equal the `deployment_url` origin. Any mismatch fails the job
  closed.
- What that verification proves — and what it does not:
   - **Proves:** this repository records a deployment for exactly `commit_sha`, ending in state
     `success`, whose `environment_url` origin equals the supplied URL.
   - **Does NOT prove:** that the deployment belongs to the correct **Vercel project** (GitHub
     Deployments carry no project identifier), that `deployment_id` maps to the intended project,
     or that the URL is the immutable hash URL rather than a branch/Production alias (the origin
     check catches alias mismatch only when the `environment_url` and your URL differ).
   - Confirm the Vercel project identity **out-of-band** in the Vercel console/API with a
     Vercel-scoped credential if the release decision requires it — this workflow deliberately
     holds no Vercel token.
- If the platform does not publish GitHub Deployments for this repository, or the metadata is
  insufficient, verification fails closed and the workflow is unusable until the owner configures
  a verified deployment-metadata mechanism — by design; user input alone never proves identity.

## What it does not do

- It does not bypass Vercel Deployment Protection, and it uses no bypass secret. If the Preview
  is protected, public checks fail or are blocked; unprotecting or bypassing is an owner decision
  handled outside this workflow (see issues #28/#34 and `docs/testing/E2E-CONTEXT.md`, G1b).
- It does not run authenticated or canary cases (default project is `public`; non-public projects
  are `default: false`), does not dispatch automatically, and does not upload artifacts.

## Is the workflow eligible today?

**No.** It is unmerged; dispatch is impossible until the owner integrates it into the default
branch after review. Eligibility is not evidence of correctness — run `--list` discovery and the
owner-approved preflight after any integration, and verify the identity step's logs on the first
real dispatch.

## Owner acceptance (after this branch is integrated into the default branch)

1. Ensure the repository publishes GitHub Deployments for the Preview (check
   `gh api repos/EGA-BUILDS/ega-work/deployments?sha=<candidate-sha>`). If not, configure the
   verified metadata mechanism first (or keep this gate BLOCKED).
2. Dispatch with the immutable Preview origin, its GitHub Deployment ID, and the full candidate
   SHA. Confirm the verification logs, the P01–P04 outcome, and the absence of artifacts.
3. Any identity mismatch means stop: do not retry with relaxed checks; investigate the deployment.
