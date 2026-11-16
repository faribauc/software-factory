---
name: sf-saas
description: Interview the user about a SaaS product they have in mind, challenging each tech decision against their usual stack, then create its repository skeleton and file ordered, accepted foundation issues for the sf-build and sf-ship skills. Inside an existing product, add a missing foundation piece the same way. Use only when the user runs /sf-saas in Claude Code or $sf-saas in Codex.
---

# SaaS

Turn the product the user has in mind into a repository that runs and a queue of
accepted issues that build its foundation: auth and tenancy, billing, the
public API, admin, docs, account lifecycle, observability and deploy. How to
build each piece lives in the references below, so every product is written for
its own needs instead of copied from a template.

The command has two modes:

- **New product** (run outside a product repo, or the user says so): project,
  interview, decisions doc, skeleton, issues. A folder holding only what step 0
  created (a README and an icon) is a new product, not a repo to add to.
- **Add a piece** (run inside a product repo): read its `AGENTS.md` and docs,
  interview only about the piece, then file its issues. The product's own
  decisions win over these defaults; where they differ, say so and ask.

## References

Read the one you need when you need it.

| Reference | Holds |
| --- | --- |
| [interview.md](references/interview.md) | The question rounds, each default with its alternatives and when an alternative wins |
| [repo.md](references/repo.md) | Monorepo layout, tooling, scripts, CI, product config, env files |
| [docs-system.md](references/docs-system.md) | `AGENTS.md`, `PRODUCT.md`, `CONTEXT.md`, area docs, `docs:check`, the setup checklist |
| [auth.md](references/auth.md) | WorkOS or Clerk, tenancy, the tenant boundary, operator access, terms gate |
| [data.md](references/data.md) | Turso with Drizzle, migrations, entities, concurrency, purge |
| [billing.md](references/billing.md) | Polar: plans in metadata, provisioning, webhook sync, entitlements |
| [api.md](references/api.md) | API keys, the request pipeline, metering, environments, MCP, SDK |
| [apps.md](references/apps.md) | Dashboard, admin, marketing site, customer docs, translations |
| [ui.md](references/ui.md) | The design system package and Storybook |
| [lifecycle.md](references/lifecycle.md) | Legal pages, export, deletion or retention, purge, email |
| [observability.md](references/observability.md) | Sentry, PostHog, scrubbing |
| [testing.md](references/testing.md) | The test kit, provider fakes, end to end, accessibility, coverage gates |
| [deploy-railway.md](references/deploy-railway.md) | Railway services, `.railway/railway.ts`, Turso, domains, production auth |
| [deploy-aws.md](references/deploy-aws.md) | The move to AWS when a product outgrows Railway |
| [issues.md](references/issues.md) | The foundation issue catalogue, its order and what each issue's spec holds |

## 0. Project

In T3 Code, the product gets its own T3 project first, and everything after
this step runs in a thread there, so its threads, PRs and issues sit together
on the dashboard from the start.

1. Ask only the product's name and the paragraph from interview round 1:
   who it's for, what they do with it, what success looks like.
2. Create the project with `t3_project_create`, titled with the name and no
   `workspaceRoot`: T3 makes the folder as a git repo with a README, an icon
   and a first commit. If a project of that name exists, ask before going on.
3. Launch a thread in it with `t3_thread_launch` (the new `projectId`,
   `workspaceStrategy: { type: "root" }`, titled "<name>: SaaS interview"). Its
   message runs `/sf-saas` (`$sf-saas` for Codex) and carries the name and the
   paragraph, saying the project was just created so the interview picks up at
   round 1's remaining questions.
4. Give the user the thread's `link` and stop. This thread's work is done.

Outside T3 Code, skip this step: create a folder named after the slug, run
`git init` in it, and work there.

## 1. Interview

Follow `interview.md`. Ask in rounds of three or four questions, grouped by
area, with the harness's question tool (`AskUserQuestion` in Claude Code,
`request_user_input` in Codex), or in chat when there is none. Each question
stands alone: what's being decided, the default, the strongest alternative and
when it wins, with your recommendation first.

- **The user's stack is the default.** Don't ask about a default the answers so
  far don't put in doubt. Do challenge it, out loud, when they do.
- **Derived decisions aren't questions.** A public API with API keys means
  WorkOS; otherwise Clerk. Billing is always Polar. Say what was derived and
  why.
- **Product and business decisions are always asked**, never defaulted:
  pricing and plan limits, who the users are, legal copy, which paid providers
  to sign up for, the GitHub owner, the domain.
- Stop when every decision in `interview.md`'s table has an answer or a stated
  default.

## 2. Decisions doc

Write the outcome as the product's first docs, in the project folder,
uncommitted until the user approves:

- `PRODUCT.md`: users, purpose, brand personality, anti-references, design
  principles, accessibility (`docs-system.md`).
- `docs/architecture.md`: the pieces and where each runs, then **Decisions**,
  one line each: *chose X over Y because Z*, covering every row of the
  interview table, including the defaults kept.
- `docs/roadmap.md`: what was left out on purpose and where it would go.
- The issue plan: the issues from `issues.md` this product gets, in order.

Show it to the user and get an explicit yes before creating anything. Change
it as many times as they ask.

## 3. Skeleton

After approval, and only then:

1. Create the GitHub repository, **private**, under the owner the user named,
   from the project folder: `gh repo create <owner>/<slug> --private
   --source . --remote origin`.
2. Scaffold with the official CLIs (TanStack Start, shadcn, Storybook), never
   hand-written boilerplate. Read the `tanstack-router`, `vite` and `workos`
   skills first when installed.
3. Build the skeleton from `repo.md`: the monorepo layout, Bun workspaces,
   Vite+ (`vp check`, `vp test`, `vp run`, with the `vite` override TanStack
   Start needs), TypeScript, the product config package, the env module and
   `.env.example`, `verify` and the git hooks, CI, the docs from step 2 plus
   `AGENTS.md`, `CONTEXT.md`, `docs/README.md` and `docs:check`, the test kit's
   guards (`testing.md`), an empty design system with Storybook (`ui.md`), and
   `.railway/railway.ts` describing the services (not applied).
4. Run `verify` until it's green. Commit with short messages and push to
   `main`. Protect `main`: pull requests required and CI must pass.

Never create provider accounts, Railway projects or Turso databases, never
deploy, and never put a secret in a file. Those steps go in the setup checklist
for the user (`docs-system.md`).

## 4. Issues

File the issues from the plan with `issues.md`. Each gets a short request as
its body, then a spec comment in the `sf-spec` skill's format, posted with the
`sf-pr` skill's comment line, and the `factory` label, so `/sf-build` and
`/sf-ship` can take them in order. Every spec names the references its builder
must read; the builder reads them from this skill.

## 5. Report

Lead with the repository URL and the T3 project. Then the decisions that
differ from the user's defaults and why, the issues in order with links, the
setup steps waiting for the user (accounts, keys, Railway, Turso, domain), and
anything you couldn't verify.

## Rules every product keeps

Each reference has its own area's rules. These hold everywhere:

- **The tenant comes from the server session**, never from input, checked on
  every call. Another tenant's id answers 404, not 403.
- **Our database is the source of truth.** Providers are synced into it; gates
  on the hot path read only it.
- **No plan or tier names in code.** Limits come from Polar metadata.
- **Secrets never live in code, client bundles or committed files.** Only public
  identifiers reach the browser (`VITE_*`).
- **Every browser input is validated on the server**, where it's received.
- **Every webhook is signature-checked first**, and replays are safe.
- **Writes that must happen once are idempotent:** derived ids, conditional
  writes, claim then act.
- **Hosts are allow-listed** on every server with a public hostname.
- **Tests never touch the network or a real provider.**
- **WCAG 2.2 AA**: labels, keyboard use, focus, contrast, reduced motion.
- **Agents never deploy, create provider accounts, or start or stop the user's
  dev servers** unless asked.
- **Left-out work goes in `docs/roadmap.md`**, not as stubs in the code.
