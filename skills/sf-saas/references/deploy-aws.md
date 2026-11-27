# Moving to AWS

Railway is the default; AWS is where a product goes when it outgrows it (see
the "switch when" in `interview.md`). This is the AWS design for products
that start on Railway + Turso with Drizzle. Write the stacks when the move is
decided, not before.

## The target

| Concern | On Railway | On AWS |
| --- | --- | --- |
| Dashboard, admin | Railway services | One Fargate task each behind CloudFront, image in ECR |
| Marketing site | Railway static service | S3 + CloudFront |
| API, webhooks, MCP | `api` service | The same app on Fargate behind CloudFront + WAF, or Lambda per route |
| Database | Turso | Aurora or RDS Postgres, switching Drizzle's dialect; DynamoDB only if access patterns demand it (a data-layer rewrite) |
| Migrations | pre-deploy command | A one-off ECS task before the service update |
| Jobs | Railway cron | EventBridge Scheduler → ECS task or Lambda |
| Secrets | Railway variables | SSM SecureString under `/<slug>/<target>/`, read once per process |
| Email | Resend | Resend, or SES with its identity in the domain stack |
| DNS, TLS | Railway domains, DNS at the user's host | Route 53 zone, ACM certificate in us-east-1 |
| Edge | App limits, Cloudflare later | CloudFront + WAF (per-IP rate rule, AWS managed rules), an origin-verify header so the origin can't be reached around the WAF |
| Deploys | Railway after CI | A SemVer tag per app → GitHub Actions with an OIDC role per app |

Moving Turso to Postgres changes the dialect: Drizzle's schema moves from
`sqlite-core` to `pg-core`, and SQLite-specific SQL (`RETURNING` works on both;
`GLOB`, `PRAGMA` don't) gets rewritten. The repository tests then run on PGlite
or a Postgres container instead of `:memory:`.

## Rules

- One AWS account per product, **us-east-1** (CloudFront takes certificates
  only from there), CDK in TypeScript, development and production separated by
  resource names.
- `buildApp()` builds every stack, so tests synthesize the real app without
  AWS.
- **cdk-nag (`AwsSolutionsChecks`) on every synth**: a finding is fixed, or
  acknowledged at finding level with a written reason.
- Exact IAM per task or function: named tables or databases, named secrets,
  nothing wildcarded.
- Synth and deploys fail closed when a value they bake in is missing.
- The user deploys; agents synthesize and test.
- One Fargate task per app with no load balancer: the task's security group
  admits only CloudFront's origin-facing prefix list, and a small function
  repoints `<app>-origin.<domain>` at the task's IP when ECS reports it running.
  An ALB costs more than the tasks at this size.
- Images: one root `Dockerfile` with `ARG APP`, immutable tags `<app>-v<SemVer>`,
  only public `VITE_*` values baked in, secrets read from SSM at start. ECR scans
  on push and keeps the last 20.
- Security headers on every distribution: a CSP per site, HSTS with preload,
  `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy.
- Alerts: an SNS topic to the alerts address; CloudFront 5xx over 5%, a
  task-down alarm per app, and a monthly budget at 80% and 100%.
- Releases: a SemVer tag per app deploys that app (below).

## Releases

On AWS nothing deploys on merge: each deployed app or stack has its own version,
and pushing its release tag is what deploys it.

- **What has a version:** each deployed app or stack holds a canonical SemVer in
  its own `package.json` (`1.4.0`, `1.4.0-rc.1`; never `v1.4.0` or `01.4.0`).
  Internal workspace packages (`ui`, `db`, `env`, `config`, …) stay `private`
  at `0.0.0` and are never tagged. The SDK releases from its own repo
  (`api.md`).
- **The first version:** a product on AWS from the start keeps the skeleton's
  `0.0.0` in each app, and its first release bumps from there (patch `0.0.1`,
  minor `0.1.0`, major `1.0.0`). A product moving from Railway starts each app
  at `2.0.0`: the pull request that adds the release workflows sets it, and the
  cut-over's first deploy is the tag `<app>-v2.0.0`. An app that already has a
  version other than `0.0.0` keeps it and bumps from it.
- **Tags:** `<app>-v<SemVer>`, one family per app. A pushed tag is never moved,
  deleted or reused; a release that fails after its tag is out ships as the
  next version.
- **Cutting a release** is the `sf-release` skill's job. The bump goes through
  a release PR that changes only the app's `package.json` and `bun.lock`,
  committed as `chore(<app>): release v<x.y.z>`. Merge it once its CI passes,
  then tag the merged commit on `main` and push that tag by name.
- **The release workflow:** one per app, on `push` of `<app>-v*` tags, in that
  app's GitHub environment `production-<app>`. Before it asks for AWS
  credentials, it checks out full history and:
  1. runs the version check on `$GITHUB_REF_NAME`, which fails on a
     non-canonical version (`<app>-vv1.2.3`, `<app>-v01.2.3`), another app's
     tag, or a version that differs from the app's `package.json`;
  2. fetches `main` and fails unless the tagged commit is on it
     (`git merge-base --is-ancestor "$GITHUB_SHA" origin/main`).

  It doesn't run `verify` again: CI ran it on the release PR. Then it assumes
  the app's OIDC role and deploys. Workflows that deploy to the same ECS
  cluster share one concurrency group with `cancel-in-progress: false`, so one
  deploy never cuts another short.
- **Who can release:**
  - A tag ruleset on `*-v*` limits who may create release tags and blocks
    updating or deleting them.
  - Each `production-<app>` environment allows deployments only from
    `<app>-v*` tags, holds that app's deploy variables, and can require an
    approval.
  - Each app's OIDC role trusts only its environment's subject. A job that uses
    an environment gets `repo:<owner>/<repo>:environment:production-<app>`,
    with no tag in it, so the environment's tag rule is what limits a role to
    its own tags. Repositories created after 2026-07-15 put owner and repo ids
    in the subject: match the format the repo's tokens carry.

  These are one-time steps for the owner in the setup checklist.
- **The version check** is a small script with a test: its map from app to
  `package.json`, each rejected case above, and that every mapped
  `package.json` holds a canonical version.
- **The record:** the product's deploy doc has a table with one row per app:
  tag, version file, workflow, environment and role, and the deploy command.

## Cut-over

1. Deploy the stacks next to the running Railway product.
2. Copy the data with a one-off script; compare row counts per tenant.
3. Switch DNS one host at a time, the API last, with Railway still serving.
4. Register the new webhook URLs with the providers.
5. Retire the Railway services and Turso databases after a quiet week.
