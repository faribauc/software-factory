# Deploy on Railway + Turso

Each app is a Railway service built from the GitHub repository; data lives in
Turso; Railway deploys `main` once CI passes. The skill writes the config and
the checklist; the user
creates the Railway project, the Turso databases and the domains.

## Services

| Service | App | Domain | Notes |
| --- | --- | --- | --- |
| `web` | `apps/web` | `<domain>`, `www.<domain>` | Serves the prerendered files: directory index, `404.html` with status 404, long cache on hashed assets, HTML revalidated |
| `dashboard` | `apps/dashboard` | `app.<domain>` | Owns migrations when there's no `api` |
| `admin` | `apps/admin` | `admin.<domain>` | |
| `api` | `apps/api` | `api.<domain>` | Public API, webhooks, unsubscribe, MCP; owns migrations |
| `jobs` | `apps/jobs` | none | A cron service: runs the job and exits |

Services that call each other use Railway's private network
(`RAILWAY_PRIVATE_DOMAIN`), never public domains.

## The build

- Nitro with the `bun` preset in each app's `vite.config.ts`:
  `nitro({ preset: "bun" })`, `tailwindcss()`, `tanstackStart()`, `viteReact()`.
- **Every service builds from the repo root**, never from its app's folder. A
  root directory makes Railway pull down only that folder, so the workspace
  packages the app imports (`packages/ui`, `packages/db`, `config`, `env`) and
  the root `bun.lock` are missing and the build fails.
- Each server (`web` included: its Nitro server serves the prerendered files)
  scopes its commands to its app: the build command is
  `bun run --filter @<slug>/<app> build`, which writes `apps/<app>/.output/`;
  the start command is `bun apps/<app>/.output/server/index.mjs`. `jobs` has
  no server (see the cron service).
- Installing from the root runs the root `prepare` script (`vp hooks enable`);
  check on the first deploy that it doesn't fail the build.
- Locally `start` sets `HOST=localhost`. On Railway the start command sets no
  `HOST`, so the server listens on all interfaces, on the `PORT` Railway
  injects.
- Translations run inside the build (`gt translate`), with their keys as
  Railway variables.
- Every server has `/health`, for Railway's healthcheck.

## `.railway/railway.ts`

Railway's older config files (`railway.json`, `railway.toml`) are deprecated:
new services can't use them and existing ones **stop being read on
2026-12-01**. Use Railway's Infrastructure as Code: one TypeScript file
describing the project (the `railway` package, imports from `railway/iac`).
The user applies it: `railway link`, then `railway config plan` and
`railway config apply`. `railway config pull` writes the live setup back into
the file. An old service moves with `railway config migrate --apply`.

```ts
import { defineRailway, github, preserve, project, service } from "railway/iac";

const repo = "<owner>/<repo>";

export default defineRailway((ctx) => {
  const prod = ctx.environment === "production";

  const api = service("api", {
    source: github(repo, { branch: "main" }), // no rootDirectory: builds from the repo root
    build: "bun run --filter @<slug>/api build",
    preDeploy: "bun run db:migrate",
    start: "bun apps/api/.output/server/index.mjs",
    healthcheck: "/health",
    domains: prod ? ["api.<domain>"] : [],
    env: {
      APP_DOMAINS: prod ? "api.<domain>" : "",
      TURSO_DATABASE_URL: preserve(),
      TURSO_AUTH_TOKEN: preserve(),
      POLAR_ACCESS_TOKEN: preserve(),
      POLAR_WEBHOOK_SECRET: preserve(),
      // …each secret as preserve(); public values as plain strings
    },
  });

  const dashboard = service("dashboard", {
    source: github(repo, { branch: "main" }),
    build: "bun run --filter @<slug>/dashboard build",
    start: "bun apps/dashboard/.output/server/index.mjs",
    healthcheck: "/health",
    domains: prod ? ["app.<domain>"] : [],
    env: {
      APP_DOMAINS: prod ? "app.<domain>" : "",
      API_INTERNAL_URL: api.env.RAILWAY_PRIVATE_DOMAIN,
      TURSO_DATABASE_URL: preserve(),
      TURSO_AUTH_TOKEN: preserve(),
    },
  });

  return project("<slug>", { resources: [api, dashboard /*, web, admin, jobs */] });
});
```

Confirmed in Railway's IaC reference (checked 2026-11): `service`,
`github(repo, { branch })`, `build`, `start`, `preDeploy` (a
failure stops the deploy), `healthcheck`, `healthcheckTimeout`, `domains`
(strings or `{ domain, port }`), `env` with references to other services,
shared variables (`ctx.shared.X`) and `preserve()` (keep the value already set
in Railway), `replicas`, and branching on `ctx.environment`. `github()` also
takes `rootDirectory` (the reference's larger example uses it); leave it out
(see the build). Railway's monorepo guide builds a shared monorepo from
the root with a build and start command per service.

**Not confirmed there; check the reference before writing them:** the builder
choice (Railpack is the default), the cron schedule, the restart policy, watch
paths and Wait for CI. Until confirmed, the setup checklist sets them in each
service's settings (watch paths: see below). Also check the exact import list.

## Watch paths

Building from the root means any change would redeploy every service, so each
service gets watch paths: its app's folder, the workspace packages it imports
(follow its `@<slug>/*` dependencies, and theirs), and the root files every
install reads. Patterns are gitignore-style and start from `/`; a change that
matches none skips the deploy, so `/docs/**`, `/AGENTS.md` and `/.github/**`
deploy nothing. Set them in each service's settings, one per line, each
package as `/packages/<name>/**`, replacing any value Railway pre-filled (its
monorepo import sets the app's folder alone):

| Service | Watch paths |
| --- | --- |
| every service | `/package.json`, `/bun.lock`, `/bunfig.toml`, `/packages/typescript-config/**` |
| `web` | `/apps/web/**`; packages `config`, `env`, `start-kit`, `ui`, `docs`, `observability`, `billing` (pricing) |
| `dashboard` | `/apps/dashboard/**`; packages `config`, `env`, `start-kit`, `ui`, `db`, `billing`, `email`, `observability` |
| `admin` | `/apps/admin/**`; packages `config`, `env`, `start-kit`, `ui`, `db`, `billing`, `email`, `observability` |
| `api` | `/apps/api/**`; packages `config`, `env`, `start-kit`, `db`, `billing`, `email`, `observability`, `docs` (MCP) |
| `jobs` | `/apps/jobs/**`; packages `config`, `env`, `db`, `billing`, `email`, `observability` |

The service that owns migrations also watches `/scripts/**`, where the
migrations runner lives. The rows are a starting point: each app's resolved
`@<slug>/*` dependencies decide. When they change, update that service's
watch paths in Railway and in `docs/setup.md`. A missing package means its
changes never deploy that app.

## Variables

- Secrets are Railway variables, sealed, and `preserve()` in the file, so the
  file never holds a value.
- Railway injects `PORT`, `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PRIVATE_DOMAIN` and
  `RAILWAY_GIT_COMMIT_SHA`; never set them.
- When swapping a key (the auth provider's development keys for production
  ones), keep the old value until the new one is proven, to roll back.

## Host allow-list

Every server answers only its own hosts, which blocks DNS rebinding and the
stale `*.up.railway.app` address:

- locally: loopback only (`localhost`, `127.0.0.1`, `::1`);
- on Railway: also `RAILWAY_PUBLIC_DOMAIN` (Railway sets it to the custom
  domain once there is one) and the comma-separated `APP_DOMAINS`;
- anything else gets 403 from the first request middleware.

The list is parsed once (trimmed, lowercased, trailing dot dropped) and the
Host header's hostname compared at any port. It lives in `start-kit` with
tests.

## Deploys

- **Wait for CI** on every service: deployments wait until every GitHub Actions
  workflow on the commit finishes, and a failed workflow skips the deploy. It
  only shows when the repo has a workflow on `push`, and it gives up after two
  hours. CI must never cancel a `main` run (`repo.md`), or that merge never
  deploys. A merge whose deploy Wait for CI skipped, or whose deploy failed,
  isn't retried by a later merge outside that service's watch paths: once the
  cause is fixed, deploy the latest commit by hand on each service it should
  have reached (Deploy Latest Commit in Railway's command palette; Redeploy
  rebuilds the old code).
- **Migrations** run in the owning service's pre-deploy command (the root
  `bun run db:migrate`, never filtered to the app), with the service's
  variables and private network. A failure stops the deploy and the
  old version keeps serving. Migrations are additive (`data.md`).
- **Rollback:** redeploy an earlier deployment in Railway. An applied
  migration stays applied, which is why they're additive.
- **Previews (optional):** Railway PR environments create an environment per
  pull request and delete it on merge or close. Point each at a branch database
  (`turso db create <slug>-pr-<n> --from-db <slug>-dev`), never production, and
  delete it afterwards. Automatic domains there only work when the base
  environment uses Railway's own domains.

## The cron service

`apps/jobs` runs one script per job on a cron schedule, from the repo root like
every service. The start command is
`bun run --filter @<slug>/jobs retention -- --apply` (the script's default is a
dry run, `lifecycle.md`); when emails are translated, the build command is
`bun run --filter @<slug>/jobs build`, which runs `gt translate`.

- UTC, at least five minutes apart, not exact to the minute: jobs work from due
  dates in the data, never "it's 14:00 now";
- the process **exits** when done, closing its database client;
- Railway skips a run while the previous one is still going;
- each job runs under a Sentry cron monitor;
- `railway cron list` and `railway cron run` inspect and trigger runs.

## Turso

1. `turso db create <slug>` and `<slug>-dev`, in the region nearest the Railway
   region.
2. A database token each: `turso db tokens create <db>` (never a Platform API
   token); `--read-only` for anything that only reads.
3. Set `TURSO_DATABASE_URL` (`libsql://…`) and `TURSO_AUTH_TOKEN` on the
   services that use it, and in `.env.local` for development.
4. Restoring: create a point-in-time copy
   (`turso db create <new> --from-db <slug> --timestamp <RFC3339>`), check it,
   then point `TURSO_DATABASE_URL` at it. The README has these steps before
   they're needed.

## Going to production

In this order; each step ends with a check.

1. **Domains.** Set `APP_DOMAINS` on each service first, so it accepts the new
   host. Add the custom domains on each service (target port: its `PORT`).
   Create the records Railway shows at the DNS host; the apex needs CNAME
   flattening or ALIAS (Cloudflare does it). On Cloudflare, keep Railway's and
   the auth provider's records **DNS only**. Wait until Railway marks them
   active.
   *Check:* each host serves its app, not 403.
2. **Production auth.**
   - *Clerk:* create the production instance for the domain, add its DNS records
     and wait for verification and certificates; set up Google sign-in with your
     own OAuth client (the redirect URI Clerk shows) and publish the consent
     screen; set sign-up mode and turn off self-service deletion; name the
     application. Swap `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to
     `pk_live_…` and `sk_live_…`; Railway rebuilds. Invite people only once the
     rebuild is live.
   - *WorkOS:* the production environment's API key and client id, redirect
     URIs, sign-in endpoint and sign-out redirects on the production domains, a
     new cookie password, the production operator organization.
   *Check:* sign-in shows no development badge and works.
3. **Move existing data**, if anyone used the app under development user ids
   (Clerk's production instance creates new ids). Per person: sign in once on
   production **without saving any first-run page**, note the new and old ids,
   then run in Turso's SQL console a script that is safe to run twice: clear a
   mistaken first-run save for the new id only when the old id has settings,
   `UPDATE` the owner column of each owned table from old to new, then
   `SELECT`s showing the new id has the rows and the old id none.
4. **Webhooks.** Register `https://api.<domain>/webhooks/polar` and
   `/webhooks/workos` (or the dashboard's) with the production providers, and
   set their signing secrets.
5. **Smoke:** each host on its domain; production sign-in; your data there and
   a second account sees none; the `*.up.railway.app` address gets 403; every
   `/health` 200; a keyed endpoint without a key 401; a webhook without a
   signature 400.

## When to leave Railway

Compliance or a required AWS region, traffic Railway can't carry economically,
or a managed WAF needed before launch. Then `deploy-aws.md`.
