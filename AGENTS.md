# EGA Work

EGA Work turns projects and issues into a clear record of work, linked pull requests, and explicit completion. This repository starts from the Circle interface. Reuse its useful UI; build real behavior in small, complete slices.

## What matters

- **Trust the saved result.** A success message means the operation succeeded. A screen backed by mock data is a prototype.
- **Keep work private.** Enforce access on the server and at the database boundary, not through hidden buttons.
- **Keep facts separate.** GitHub owns PR state. Work owns issue status. A merged PR never automatically completes an issue.
- **Keep the product simple.** Ship one useful journey before adding more screens, abstractions, or automation.

Prefer ambitious outcomes and small systems. Understand the constraint, reuse the existing pattern, and make the correct behavior obvious. Avoid scope creep and speculative frameworks.

## Read this correctly

This is the canonical agent guide. `CLAUDE.md` links here. Update this file instead of creating competing instructions. Read applicable nested `AGENTS.md` files before changing an area or its consumers. Add nested guidance only when an area needs different rules.

Explicit user instructions set the task scope and override workflow defaults within applicable safety and authorization boundaries. Continue through routine setup and implementation problems. Ask only when a consequential decision cannot be resolved from the task and repository.

### Current code and planned product

The starting code uses Next.js 15, React 19, TypeScript, Tailwind, shadcn/ui, and Zustand. Issues and projects use mock data and client state. The agent chat is a demonstration. None of these establish authentication, durable database storage, or real agent execution.

The first product journey is: sign in → create a private project → create an issue → link a GitHub PR → refresh its state → explicitly complete the issue → reload and confirm the saved result.

Supabase and Work-native authentication are proposed backend choices in the planning specification, not implemented capabilities. Confirm the applicable issue and approved design before introducing them. Do not expand this slice into agent execution, team collaboration, or an EGA House rewrite.

Terms used here:

- **Project:** a private container for issues and repository links.
- **Issue:** a unit of work whose status the user controls.
- **PR observation:** GitHub metadata with refresh time and freshness; it does not decide issue completion.
- **Beta:** the environment for acceptance with isolated test data.
- **Stable:** a separately authorized, manual release of a tested revision.

## Find the owner

| Area | Start here |
| --- | --- |
| Pages and layouts | `app/` |
| UI components | `components/` |
| Client state | `store/` |
| Shared hooks and utilities | `hooks/`, `lib/` |
| Demonstration fixtures | `mock-data/` |
| Commands and dependencies | [package.json](package.json), [pnpm-lock.yaml](pnpm-lock.yaml) |
| Type and lint rules | [tsconfig.json](tsconfig.json), [eslint.config.mjs](eslint.config.mjs) |

Search with `rg` before reading files. Follow the relevant operation through its callers, state owner, and persistence. Read only what the task needs. The upstream README describes Circle; it is not proof of Work's product behavior.

For framework changes, check the installed version and use [Next.js 15 documentation](https://nextjs.org/docs/15/app). Do not assume newer APIs or bundled documentation exist. Do not upgrade dependencies as incidental cleanup.

## Start safely

- Confirm the repository, branch, HEAD, intended base, worktree ownership, and dirty state.
- Implement on a task branch from `main`. Preserve unrelated changes; use an isolated worktree when needed.
- Read applicable host instructions before running commands. Coordinate installs, builds, and generated output with other users of the checkout.
- Never reset, clean, overwrite, or delete unfamiliar work. Stop only processes you started and tracked; never kill by name pattern.
- Keep credentials and private data out of code, logs, fixtures, screenshots, and reports. Configure external origins and callbacks instead of hardcoding an environment.
- Code changes do not authorize merges, deployments, hosted migrations, credential changes, or destructive cleanup. Honor authorization already given for the task.
- Use subagents only when the user explicitly requests them. Independent review can be performed by a human or in a separate authorized review session.

## Make the change

- **Use [shadcn/ui](https://ui.shadcn.com/) for the interface.** Reuse the existing primitives in `components/ui/` and follow [components.json](components.json). Compose new screens with these components, Tailwind, and the existing theme tokens. Consult the official component documentation before adding a missing primitive. Preserve keyboard access and focus behavior; do not introduce a competing component library or replace primitives with custom lookalikes.
- State the expected behavior, acceptance criteria, exclusions, and finish boundary before substantial implementation. Use the existing issue or specification when available.
- Build the smallest complete user journey first. Keep loading, empty, error, and retry behavior clear.
- Put each business rule and durable state under one owner. Client stores may manage UI state or a cache; they must not become a second database authority.
- Validate untrusted input at entry points. Derive identity from a verified server session. Never trust a browser-supplied owner ID or use privileged database access to bypass user authorization.
- When adding persistence, preserve ownership, constraints, and transactional behavior. Handle failed writes and safe retries; do not report success after a failed save.
- Keep integration credentials server-side. A failed PR refresh preserves the last successful observation and marks it stale.
- Keep mocks explicit. Production paths must not silently fall back to fixtures, canned agent responses, or fake successful writes.
- Reuse components and utilities where their behavior fits. Add dependencies or abstractions only for a concrete requirement.
- Follow existing TypeScript and formatting conventions. Do not hide defects with casts, suppressions, weaker assertions, disabled checks, or unrelated rewrites.
- For a bug, reproduce it and trace the owning behavior before editing. Add a focused regression test for a logic defect; use visual evidence for a purely visual fix.

## Run the right checks

Use pnpm and preserve the lockfile. These commands describe the starting repository; their presence is not a passing result.

| Purpose | Command |
| --- | --- |
| Install locked dependencies | `pnpm install --frozen-lockfile` |
| Start development server | `pnpm dev` |
| Type check | `pnpm exec tsc --noEmit` |
| Lint | `pnpm lint` |
| Lint selected files | `pnpm exec eslint <changed-files>` |
| Check selected formatting | `pnpm exec prettier --check <changed-files>` |
| Format selected files | `pnpm exec prettier --write <changed-files>` |
| Production build | `pnpm build` |
| Serve an existing production build | `pnpm start` |

Replace `<changed-files>` with explicit paths. `pnpm format` rewrites the whole repository; avoid it for a focused change. No test script or CI workflow exists in the starting repository. Do not invent passing tests or assume a green CI gate exists. Add the necessary harness when implementing behavior that needs it.

- Documentation only: check the diff, local links, and commands. No application build is needed.
- Code: start with focused lint and relevant tests. Run the type check for TypeScript changes and a production build for application, dependency, or build configuration changes.
- UI behavior: verify the affected journey in the browser, including a relevant failure state and keyboard interaction. State when browser verification was unavailable.
- Authentication or persistence: use the actual application entry point and a disposable database with the real migrations and user sessions. Prove reload persistence and refusal of another user's access. Mocks alone do not prove this boundary.
- Diagnose a failed check before retrying. Distinguish source failures, setup failures, and resource limits. Report unrun or blocked checks plainly.

## Review code

Review the behavior against the outcome, not just the changed lines. Self-review every change. Before merge, obtain independent review of the candidate revision; self-review is not independent review.

1. Record the base and candidate SHA. Read the diff and relevant owners, callers, contracts, and tests.
2. Check correctness, regression risk, identity and ownership, persistence, error handling, retry behavior, and integration permissions. Look for mock behavior accidentally presented as real.
3. Check the user journey, including empty and failed states. Confirm that PR state and issue completion remain independent.
4. Assess whether the checks prove the changed behavior. Distinguish source inspection, local checks, CI, and observed runtime behavior.
5. Report actionable findings first: severity, file and line, concrete trigger, impact, and suggested correction. Separate optional style suggestions from defects. If there are no findings, say so and name any coverage gaps.
6. Fix material findings and revalidate the affected behavior. Refresh review when the candidate changes. Record the reviewed revision and resolution of findings.

Do not approve based only on an agent's completion message, an old green build, or a screenshot. Missing required review or checks blocks merge; it does not block independent local preparation. Never weaken a gate to make a change pass.

## Ship one outcome

Use this sequence. Stop at the task's authorized finish boundary; a request for a patch does not require a deployment.

1. **Define it.** Name one observable user outcome, its acceptance criteria, target environment, and finish boundary. Resolve required access and target configuration early.
2. **Build it.** Connect the smallest complete journey through the actual application. Prove the first save and reload early when persistence is in scope.
3. **Prove it.** Run the applicable checks and one important failure or permission case. Record commands, results, candidate SHA, environment, and remaining gaps. Complete the review above.
4. **Integrate it.** When publication is authorized, open a focused PR to `main` with the outcome, validation, and risks. Before an authorized merge, verify the current candidate, independent review, and required checks. Record both the PR head and any tested synthetic merge SHA.
5. **Release it.** When deployment and hosted writes are authorized, verify the target before migrations or acceptance writes. Prove the journey in Beta with isolated test data. Stable promotion is manual and requires its own authorization, target checks, migration compatibility, and recovery plan. Do not copy Beta records into Stable.

For a database-backed journey, capture redacted evidence of the saved records, relationships, reload result, and cross-user refusal. A visible UI update or a successful HTTP response alone does not prove correct storage.

Report each achieved stage separately: local verification, reviewed revision, merged revision, Beta acceptance, and Stable release. `BETA_PROVEN` requires the complete first-pipeline acceptance matrix; one successful journey alone does not earn it. `STABLE_RELEASED` requires the additional Stable gates. If the applicable specification is unavailable, retrieve it before claiming either milestone.

## Leave a useful handoff

Report what changed, affected files, checks and results, the achieved delivery stage, and remaining risks or blockers. Include a PR or deployment link when one exists. Never describe unrun checks, unapplied migrations, or unobserved behavior as complete.

Keep this guide short. Update commands and ownership guidance when the code changes. Put detailed designs in the owning documentation and link them here when needed. The source comparison for this guide lives in [docs/agent-guidance-design.md](docs/agent-guidance-design.md).
