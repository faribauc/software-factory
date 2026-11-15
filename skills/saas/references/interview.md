# The interview

Two parts: the **product questions**, always asked, and the **stack table**,
where the user's defaults stand unless the product's answers put one in doubt.
In "add a piece" mode, ask only the questions that piece depends on.

## Product rounds

Ask these in order; later rounds depend on earlier answers. Offer options with
a recommendation wherever the answer isn't free text.

**Round 1: the product**

1. In a paragraph: who it's for, what they do with it, what success looks like.
2. Who signs in: individuals, or businesses with teams? *Teams* means
   memberships, roles and invites from day one (`auth.md`); *solo* means one
   tenant per user.
3. Name, slug, apex domain, and the GitHub owner for the private repository.
4. Languages the users read. More than one means translations (`apps.md`).

**Round 2: the shape**

1. Does customers' code call a public API with API keys? *Yes* means WorkOS
   for auth (customers will want enterprise SSO) and the API module (`api.md`).
   *No* means Clerk.
2. For an API product, which extras now: MCP server, `llms.txt` and Markdown
   twins, a TypeScript SDK in its own repository, test environments
   (`development`, `staging` keys)? None is a default; each is added only when
   it's relevant. Recommend MCP and `llms.txt` when customers use AI coding
   agents, the SDK once there are endpoints worth wrapping.
3. Does an operator need an admin app to see or act on accounts?
4. A marketing site with customer docs, or only the app behind sign-in?

**Round 3: money**

1. Does it charge, now or soon? Billing is always Polar (`billing.md`).
2. The plans: names, prices, currencies, and what each allows (limits become
   Polar metadata, never code). Which plan every new account starts on.
3. Where the customers are, for the tax note in the decisions doc (Polar is the
   merchant of record, so it collects tax).

**Round 4: accounts and legal**

1. How does an account end? *Delete now* for consumer products; *close, then
   purge after a retention period with win-back emails* for business products
   (`lifecycle.md`). Recommend by the round 1 answer.
2. Terms gate: on for business products (accept the current Terms and Privacy
   before use, re-prompted on a new version); consumer products only link the
   pages. Confirm.
3. Who writes the legal copy. The skill writes placeholders marked as such.

**Round 5: the stack**, only for rows below the answers put in doubt.

## The stack table

Each row: the default, the alternatives the user weighed, and when an
alternative should win. Raise a challenge only when its "switch when" holds;
otherwise state the default in the decisions doc and move on.

| Decision | Default | Alternatives | Switch when |
| --- | --- | --- | --- |
| App framework | TanStack Start | Next.js; React Router v7 | A provider the product can't do without only supports Next.js well |
| Runtime | Bun installs packages and runs the servers; the Vite+ toolchain (lint, tests, tasks) runs on Node | Bun everywhere with `bun test` and Biome; Node + pnpm | A dependency the product needs breaks under Bun with no workaround |
| Repo shape | Monorepo, always | Single app | Never by default: the user chose one layout so a second app needs no restructure |
| Task runner | `vp run` (Vite+ tasks, dependency order, local cache) | `bun run --filter`; Turborepo | Remote caching is needed before Vite+ has it |
| Toolchain: lint, format, types | Vite+ `vp check`: Oxlint with type-aware rules, Oxfmt, type checks | Biome only; Biome + ESLint | Vite+ breaks a TanStack Start build in a way the `vite` override doesn't fix |
| Test runner | `vp test` (Vitest, reading each app's Vite config) | `bun test` | Never by default |
| Database | Turso (libSQL) | Postgres (Railway or Neon); DynamoDB on AWS | Heavy concurrent writes, query latency from Railway to Turso hurts, or the AWS move is near (Postgres moves to RDS as is) |
| Queries | Drizzle | Raw SQL in one module; Kysely | Never by default |
| Migrations | drizzle-kit migrations applied by Railway's pre-deploy command | Migrate when the connection opens | A single-service product where the deploy step isn't available |
| Hosting | Railway; AWS as the later move | Railway only; Cloudflare Workers; Fly.io | Compliance, a required AWS region or service, traffic Railway can't carry economically, or a managed WAF needed before launch (`deploy-aws.md`) |
| API service | Its own Railway service on `api.<domain>`, with webhooks and MCP | Routes inside the dashboard | Never by default |
| Edge protection | Host allow-list, per-IP and per-key limits and body caps in the app; Cloudflare DNS only | Cloudflare proxy and WAF from day one | Abuse shows up, or the product is a likely target from launch |
| Marketing site | Its own Railway service serving the prerendered files | Cloudflare Pages; served by the dashboard | Branch preview URLs for the site matter |
| Auth | WorkOS with a public API, Clerk without | Better Auth; WorkOS everywhere | Derived, not asked |
| Tenancy | Asked: solo or teams | Always one per user; always teams | Asked |
| Operator access | WorkOS: operator organization with an `admin` role. Clerk: a Clerk operators organization with an `admin` role | Allow-list variable; no admin app | Asked through the admin-app question |
| Billing | Polar | Clerk Billing; Stripe direct | Never by default: Clerk Billing has no tax handling, USD only, on/off features, no 3D Secure |
| Email | Resend | Postmark; SES | Deliverability problems (Postmark), or already on AWS (SES) |
| Observability | Sentry for errors, traces and cron monitors; PostHog for analytics and replay; one scrubber | PostHog only; Sentry only | Never by default |
| Design system | `packages/ui`, Storybook-first, a story per component | `packages/ui` without Storybook; shadcn per app | Never by default |
| Translations | General Translation, generated at build | Paraglide; Lingui | The build can't call a paid service, or translations must be reviewed and committed |
| Testing | The full kit, coverage gates included (`testing.md`) | No gates; lighter kit | Never by default |
| Account ending | Asked: delete now or retention | Always one of them | Asked |
| Terms gate | Business products | Always; never | Asked to confirm |
| Docs | Area docs, glossary, product brief, `docs:check`, a setup checklist | Add the `setup:check` validator; minimal docs | Add the validator once setup passes a dozen steps |

When the user's answer contradicts their own default, record it in the
decisions doc as a decision (*chose X over the usual Y because Z*), and follow
it in the issues.
