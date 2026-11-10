# Why Work uses this agent guide

Work needs a small guide that helps an agent find the right code, make a safe change, review it, and report exactly how far it shipped. T3 Code is the closest fit for its product-first structure and preference for simple systems. Work adds explicit review and delivery steps because its first milestone must prove saved database state and user isolation.

## Comparison of the examples

These are design choices for Work, based on primary sources checked on 2026-11-10. Upstream guides change; historical line counts and summaries are not requirements.

| Example | What to adopt | What to leave out or adapt |
| --- | --- | --- |
| [T3 Code](https://raw.githubusercontent.com/pingdotgg/t3code/HEAD/AGENTS.md) | Product overview, a few invariants, simple systems, a glossary, concrete safety rules, verification, and taste. This supplies the main structure. | Its multi-surface architecture, event workers, commands, and test rules belong to T3. Work needs its own commands and product boundaries. Defaults can yield to user intent without waiving authorization or safety. |
| [Hermes Agent](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/AGENTS.md) | A short root guide that routes to area guidance, concrete invariants, and proof through real entry points. | Prompt caching and plugin constraints describe Hermes. Work should add nested guides when its own areas need them, rather than create an empty instruction tree now. |
| [OpenClaw](https://raw.githubusercontent.com/openclaw/openclaw/main/AGENTS.md) | One owner per responsibility, scoped instructions, small mechanisms, and clear authority boundaries. | Runtime workspace files such as persona and memory serve a different purpose from repository development instructions. Do not import that boot sequence into Work. |
| [Vercel evaluation](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) | Make relevant documentation discoverable and match it to the installed framework. | The reported 100% versus 79% results concern a specific Next.js 16 evaluation. They do not establish a universal advantage or guarantee Work's results. |
| [Next.js agent guide](https://nextjs.org/docs/app/guides/ai-agents) | Consult version-matched documentation before using unfamiliar framework APIs. | Bundled docs start with Next.js 16.2. Work currently declares Next.js 15.2.8, so the root guide points to version 15 docs. No upgrade or codemod is required for this documentation task. |
| [Anthropic](https://code.claude.com/docs/en/best-practices) | Keep instructions short, include exact checks and non-obvious decisions, and separate guidance from enforcement. | Repeated emphasis cannot guarantee compliance. Add hooks or CI only for concrete enforcement needs; this task creates guidance, not new enforcement. |
| OpenAI Codex | The supplied example suggests narrow, executable conventions and area-specific instructions. Those are useful design ideas. | The attempted root guide URLs on [main](https://raw.githubusercontent.com/openai/codex/main/AGENTS.md) and [master](https://raw.githubusercontent.com/openai/codex/master/AGENTS.md) returned 404. This comparison does not verify the claimed file count or current Rust rules. No Codex-specific rules are copied. |
| [Sentry](https://raw.githubusercontent.com/getsentry/sentry/master/AGENTS.md) | Make `AGENTS.md` canonical and name exact commands with focused validation. | Sentry's environment, migrations, permission settings, and tools are not Work's. Copy the discipline, not its commands. |
| [AGENTS.md standard](https://agents.md/) | Use a predictable repository guide with setup, checks, conventions, and scoped instructions. | Examples are placeholders. Every command must match Work. `CLAUDE.md` is a relative symlink to the canonical guide instead of a second maintained copy. |

## Choices specific to Work

- Describe the current mock interface separately from the planned authenticated product. A proposed database does not become an implemented architecture through documentation.
- Keep GitHub PR observations separate from the user's issue-completion decision.
- Review a recorded candidate revision. Give findings a trigger, impact, and location. Require independent review before merge without automatically spawning another agent.
- Ship one user outcome through definition, implementation, proof, integration, and release. Apply only the stages authorized for the task.
- Prove real saves, reloads, and access refusal when implementing persistence. Report Beta and Stable acceptance separately.
- Name the commands that exist today. There is no test script or CI workflow at this baseline; a guide must not suggest otherwise.

## What this change establishes

The root guide and its `CLAUDE.md` alias provide shared instructions. This comparison holds the rationale so every coding session does not need to load it.

This documentation does not establish a successful install, lint, type check, build, CI run, database policy, or deployment. Those require execution evidence. It also does not publish the external planning documents or approve their proposed backend choices.

Keep the root under 200 lines as a maintenance target. Add links or scoped guidance when detail grows, and remove guidance that no longer describes the repository.
