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
- Releases: `bun run release <app> <patch|minor|major>` bumps, commits and tags
  `<app>-v<x.y.z>`; pushing the tag runs the release workflow in the GitHub
  `production` environment, which checks the tag matches the version and is on
  `main`, runs `verify`, assumes that app's OIDC role (trusted only for its own
  tags) and deploys. Release tags are protected by a ruleset.

## Cut-over

1. Deploy the stacks next to the running Railway product.
2. Copy the data with a one-off script; compare row counts per tenant.
3. Switch DNS one host at a time, the API last, with Railway still serving.
4. Register the new webhook URLs with the providers.
5. Retire the Railway services and Turso databases after a quiet week.
