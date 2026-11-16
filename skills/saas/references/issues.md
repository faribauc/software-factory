# Foundation issues

After the skeleton is pushed, the foundation is filed as GitHub issues, one per
piece, each small enough for one pull request. `/sf:build` or `/sf:ship` takes
them in order.

## Filing

For each issue in the product's plan:

1. `gh issue create` with a title that says what the user gets ("Sign in with
   Clerk and keep each account's data to itself") and a body of two or three
   sentences: the request, and `Depends on #<n>` lines.
2. Post the spec as a comment, in the `spec` skill's format (the
   `<!-- spec -->` marker, decision ACCEPT, risk, surfaces, then Scope,
   Context, Requirements, Acceptance criteria, Out of scope, Assumptions),
   starting with the `pr` skill's agent comment line. Context names this
   skill's references the builder must read, by absolute path (`realpath` of
   this skill's directory, then `references/<file>`), since the builder works in
   the product's repo. Copy into the spec the few rules the issue can't be
   accepted without, so it still reads correctly if the skill changes later.
3. Add the `factory` label (create it with `gh label create factory --force`).

Acceptance criteria are checkable from the repo alone: `bun run verify` passes,
a named test proves a named behaviour, a page shows a named thing, a doc
section exists. Every issue's criteria include the area doc and the
`CONTEXT.md` terms it introduces. Risk is `high` for auth, billing, data,
migrations and deletion; surfaces are `security` for those and `ui` for pages.

File in dependency order, so each `Depends on` points at an issue that exists.

## The catalogue

Include an issue only when its module is in the plan. The skeleton (step 3 of
the skill) is already on `main`, so the first issue builds on it.

| # | Issue | Module | Depends on | References |
| --- | --- | --- | --- | --- |
| 1 | Data layer: Drizzle schema for the tenant, membership and audit tables, migrations runner, `freshDb()`, tenant-first repositories | core | skeleton | `data.md`, `testing.md` |
| 2 | Sign-in and the tenant boundary: provider wiring, provisioning (`ensureTenant` or `/welcome`), `customerCall`, the security registry test, auth pages, the fake auth provider | core | 1 | `auth.md`, `apps.md`, `testing.md` |
| 3 | Teams: memberships, roles, invites, the `/team` page | teams | 2 | `auth.md` |
| 4 | Observability: scrubber, Sentry and PostHog in apps and server, consent banner, event catalogue | core | 2 | `observability.md`, `ui.md` |
| 5 | Email: templates, layout, log and Resend transports | core | 1 | `lifecycle.md` |
| 6 | Legal pages and, for business products, the terms gate | core | 2 | `lifecycle.md`, `auth.md` |
| 7 | Billing: Polar client, catalogue and metadata, provisioning, webhook sync, `/billing`, the Polar fake | billing | 2, 5 | `billing.md`, `testing.md` |
| 8 | API service: `apps/api`, host allow-list, rate limits, `/health`, the route list, `dev:api` | API | 1 | `api.md`, `deploy-railway.md` |
| 9 | API keys and the pipeline: keys, `withApiKey`, gates, metering, quota emails, the keys page | API | 7, 8 | `api.md` |
| 10 | Test environments: roles granted by plan, environment pages | API, environments | 9 | `api.md` |
| 11 | Admin app: operator access, tenant list and detail, disable and enable, key revoke, audit timeline | admin | 2 (and 9 for keys) | `apps.md`, `auth.md` |
| 12 | Marketing site and customer docs: prerendered site, docs package, SEO, 404 | site | skeleton | `apps.md` |
| 13 | `llms.txt`, `llms-full.txt` and Markdown twins | API, llms | 12 | `apps.md` |
| 14 | MCP server: docs tools and product tools through the pipeline | API, MCP | 9, 12 | `api.md` |
| 15 | TypeScript SDK: its own public repository as a submodule, golden fixtures, contract test, trusted publishing | API, SDK | 9 | `api.md` |
| 16 | Account ending, consumer: export and Delete my account | delete now | 2 (and 7) | `lifecycle.md` |
| 17 | Account ending, business: export, close and reopen | retention | 7 | `lifecycle.md` |
| 18 | Retention job and purge: the cron script, claims, win-backs, final notice, purge, unsubscribe | retention | 17, 5 | `lifecycle.md`, `deploy-railway.md` |
| 19 | Translations: General Translation wiring, language selector, account language, translated emails | i18n | 2, 5 | `apps.md`, `lifecycle.md` |
| 20 | End-to-end suite: Playwright against built apps, provider mock server, axe, the flows built so far | core | 2 | `testing.md` |
| 21 | Deploy: finish `.railway/railway.ts` for every service, the production checklist in `docs/setup.md`, the smoke steps | core | every issue above | `deploy-railway.md`, `docs-system.md` |

Later issues extend the end-to-end suite with their own flows; issue 20 sets it
up once sign-in exists. The product's own first feature is filed by the user
through `/sf:spec` once the foundation it needs is in.

## Adding a piece to an existing product

Read the product's `AGENTS.md`, its docs and its open issues, pick the
catalogue rows for the piece, rewrite their dependencies against what already
exists, and file only those. If the product's patterns differ from the
references (another database, another auth provider), the spec follows the
product and says so under Assumptions.
