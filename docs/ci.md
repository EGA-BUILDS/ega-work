# CI and delivery

[GitHub Actions](../.github/workflows/ci.yml) runs on every pull request, every branch push (including `main`), and manual dispatch. One required candidate check, **Check**, installs the frozen pnpm lockfile, lints, checks TypeScript, builds Next.js, then starts that build and checks rendered routes plus a missing-route failure. A failed step fails the job. There are no path filters or allowed failures.

Use Node 22 and the `packageManager` version in `package.json`. Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:smoke` to reproduce. The smoke script owns and stops its server on an operating-system-assigned loopback port.

The workflow uses read-only repository permissions and no application secrets. pnpm's download cache is keyed by the lockfile; build output is rebuilt each run. Superseded PR runs cancel; push runs remain independent. Branch pushes also validate the initial workflow before it reaches the default branch. The 15-minute timeout bounds a stuck run.

Before merging, confirm **Check** passed for the current candidate and obtain the independent review required by [AGENTS.md](../AGENTS.md). Workflow presence does not configure GitHub branch protection: repository rules must require **Check** to enforce it for all contributors. Never bypass an existing required check.

Vercel is already connected to this repository. Its preview/deployment checks remain separate from CI. This change does not configure production promotion or make Vercel wait for CI. A deployment target, environment approval, and recovery path must be established before adding automatic delivery. No database migrations or persistence acceptance run here.

The HTTP smoke test verifies production startup and server-rendered output, not hydration, keyboard interaction, authentication, or saved records. Verify those journeys separately when they change.

Inspired by [T3 Code's CI workflow](https://github.com/pingdotgg/t3code/blob/main/.github/workflows/ci.yml): PR/main triggers, read-only permissions, cancellation of superseded PRs, bounded jobs, and a production boot check. Work uses a single job because it has one Next.js app; T3's monorepo sharding, desktop packaging, and release machinery are unnecessary here.
