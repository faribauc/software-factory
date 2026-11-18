# Internal docs

Every product carries its own docs, written for agents and contributors. They
describe what the code does today, so a builder reads one file before touching
an area and keeps it true in the same change.

## The files

| File | Holds |
| --- | --- |
| `AGENTS.md` (`CLAUDE.md` links to it) | What the repo is, a "where to look" table (area → doc → code), hard rules, how to keep docs current, agent workflow, the verify command, conventions |
| `PRODUCT.md` | Register (brand or product), users, purpose, brand personality, anti-references, design principles, accessibility commitment |
| `CONTEXT.md` | The glossary: one entry per term, its definition and words to avoid. No rules here |
| `docs/README.md` | Index of area docs and these conventions |
| `docs/<area>.md` | One per area, from the template below |
| `docs/architecture.md` | The pieces, where each runs, what it talks to, how the main requests flow, and the stack decisions |
| `docs/setup.md` | The setup checklist (below) |
| `docs/roadmap.md` | What's left out on purpose, why, and where it would go |
| `README.md` | For people: what it is, how to run it, how to deploy |

## Area doc template

```markdown
# <Area>

> **Code:** <paths> · **Last verified against code:** <date>

## Summary
## Rules (do not break)
## <how it works: the sections this area needs>
## Decisions
## Tests
```

- **Current state only.** No history, banners or strikethroughs. If code and
  doc disagree, fix one in the same change.
- **Decisions are one line each:** *chose X over Y because Z*. Rewrite the line
  when the decision changes; git keeps the history.
- **Tests** names the test files and what they prove.
- **No ADRs, plans or transcripts in the repo.** Only outcomes land in the
  area doc; scratch notes go in `.scratch/` (gitignored).
- A new area gets a file, a row in `docs/README.md` and a row in `AGENTS.md`. A
  new term gets a `CONTEXT.md` entry in the same change.

## `AGENTS.md` must say

- The hard rules from the skill's rule list, plus the product's own.
- Read the area doc before changing an area, and update it in the same change.
- Read the matching skill before acting; use official CLIs over hand-written
  boilerplate.
- Keep the dev servers running on their fixed ports (list them). Start the
  ones the work touches as early as you can, in the background. After a change
  Vite can't hot-reload (dependencies, env, Vite or workspace config), restart
  that server and reload the page. Never leave one stopped. If another checkout
  already holds a port, leave its server alone and run this checkout's on a
  free port. Tests start their own servers on port 0.
- Never edit generated files (route trees, generated docs content); regenerate
  and commit them.
- Never deploy, apply `.railway/railway.ts`, run production migrations or
  publish unless asked.
- The verify command, and Conventional Commits or the repo's convention.

## `docs:check`

A script that `verify` runs, failing on:

- relative links and `#anchors` that don't resolve;
- ADR references;
- stale terms outside a doc's **Decisions** section or a glossary *Avoid* line
  (the list lives in the script, with the replacement term);
- residue from a product the code was copied from (names, scopes, key
  prefixes);
- customer docs or the SDK's docs linking to internal docs or repo paths.

## The setup checklist (`docs/setup.md`)

Everything only the user can do, in phases, each step with the exact values
(URLs, scopes, metadata keys, webhook events, DNS records) and a check that
proves it worked:

```markdown
### 3. Turso (development)

1. `turso db create <slug>-dev`, then `turso db tokens create <slug>-dev`.
2. Put the `libsql://` URL and the token in `.env.local`.

**Check:** `bun run db:migrate` applies every migration and exits 0.
```

Phases: local tools · Turso (development) · auth provider (development) · Polar
(sandbox) · email (Resend) · observability · ready for local development ·
Railway · domain · production auth · production database and webhooks · smoke.

The Railway phase also sets, in each service's settings, what
`deploy-railway.md` lists as unconfirmed in `.railway/railway.ts`, watch paths
first. Check them both ways: a commit touching only `docs/` deploys nothing,
and one touching only `packages/env` deploys every service.

Each provider step says which of its environments to use (Clerk development
instance, WorkOS staging, Polar sandbox, a dev Turso database) and repeats in
the production phases with production values.

Before release, list the selected environment's prerequisites in dependency
order. Give each step a read-only command or inspection and the expected
result. Verify that services point to the intended target and that development
cannot access production data. Check that required configuration is available
to each service and report missing setting names without printing secret
values. Include the check agreed for the product's data protection needs,
such as confirming that backups are enabled and recent.

After release, record the actual commands, endpoints and expected responses
for read-only smoke checks. Include only the surfaces the product ships:

- For each deployed service with a public page or health endpoint, request it
  and check for its documented success response.
- For a keyed API, make a read-only request to a protected endpoint without
  a key and check for its documented authentication error.
- For a signed webhook, send a request with an invalid signature and check
  for its documented rejection response. Use a non-actionable payload and
  confirm from the handler's test that signature rejection happens before
  any handler side effect.

When the checklist passes about a dozen steps, add a read-only `setup:check`
validator: one step registry with ids, phases, `requires` and a `fix` per step,
checks with an injected `exec`, `readFile` and DNS resolver so tests never touch
the network, phase gating so the first failure is what to fix, and a manual
`--confirm <id>` kept in a gitignored file. `docs:check` then keeps the
checklist's step ids and the registry in sync.
