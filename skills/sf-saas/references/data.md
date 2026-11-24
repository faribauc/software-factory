# Data

Our database is the source of truth. Providers are synced into it, and gates on
the hot path read only it. All access goes through `packages/db`; nothing else
writes queries.

## Stack

- **Turso** (hosted libSQL) in production, one database per environment: a
  local file or a dev Turso database in development, the production database in
  production. Never point development at production.
- **Drizzle** for the schema (`packages/db/src/schema.ts`), typed queries and
  migrations, with the `@libsql/client` driver.
- **Tests run on the real engine** in memory (`url: ":memory:"`), migrated
  from the same migration files.

## Connection

- One client per process, opened lazily; concurrent first requests share the
  opening promise, and a failed opening is forgotten so the next request
  retries.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` online; `file:data/<slug>.db`
  when the URL is empty (with `PRAGMA journal_mode = WAL`); `:memory:` in
  tests.
- Use a **database** token (`turso db tokens create <db>`), never a Platform API
  token; `--read-only` for anything that only reads.
- Create the Turso database in the region nearest the Railway region; every
  query crosses the network, so keep round trips per request low (one batch
  rather than several queries).

## Migrations

- `bun run db:generate` (drizzle-kit) writes a SQL migration from the schema
  change. Read it before committing: drizzle-kit can't know a rename from a
  drop and add.
- `bun run db:migrate` applies pending migrations. Railway runs it as the
  owning service's **pre-deploy command**: a failure stops the deploy and the old
  version keeps serving. Tests and `dev:api -- --memory` run it on their fresh
  database.
- **Migrations are additive.** The old code keeps running while the new one
  deploys, and a rollback redeploys old code over the new schema. Add tables
  and columns first; drop them in a later release once nothing reads them.
- A table rebuild (SQLite can't alter some constraints) follows SQLite's
  procedure with foreign keys off: create the new table, copy, drop, rename,
  then `PRAGMA foreign_key_check` must return nothing or the migration fails.
- Only one service owns migrations (the dashboard, or `api` in API products);
  the others' pre-deploy only checks the schema is current.

## Rules

- **Tenant first.** Every exported function over tenant data takes the tenant
  id as its first argument and filters by it, directly or through a join.
- **Ids:** random where new, derived from their parts (`hash(orgId, role)`)
  where a retried write must hit the same row.
- **Constraints do what the database can:** `CHECK` for enums, lengths and
  non-negative amounts, `NOT NULL`, foreign keys with `ON DELETE CASCADE` for
  owned rows, partial unique indexes ("one default address per account"). libSQL turns
  foreign keys on for every connection.
- **Multi-row writes run as one `db.batch([...])`**, which is atomic. Never an
  interactive transaction: an open one makes other requests' writes fail with
  `SQLITE_BUSY` on a local file, and holds a remote connection on Turso.
- **Idempotent creation:** insert with `onConflictDoNothing()`, then select.
- **Counters and claims are one conditional update with `RETURNING`:**
  - quota: insert the period's usage row if missing, then
    `UPDATE usage SET count = count + 1 WHERE id = ? AND count < ? RETURNING count`;
    no row back means the quota is used up;
  - once-only work (quota notices, retention steps):
    `UPDATE … SET step = step + 1 WHERE id = ? AND step = ? RETURNING …`.
- **Status and lifecycle are separate fields** (an operator's `disabled`, the
  customer's `closedAt`), so one can't clear the other.
- **Money is integer minor units** with its currency code; fractional
  quantities are integer hundredths.
- **A user's dates are their day**, sent by the browser and validated; servers
  run in UTC and never decide someone's "today".
- **Audit events** record who (`admin`, `customer` or `system` plus an id) did
  what (a typed action) to which tenant, with scalar details, never secrets.
- **Ad-hoc production SQL** (moving rows between user ids, data fixes) is
  written out in the docs, safe to run twice, and ends with `SELECT`s that show
  the result.

## Entities of the full foundation

Create only what the product's modules use.

| Entity | Id | Key fields |
| --- | --- | --- |
| Organization (tenant) | provider org id, or the user id (Clerk, solo) | `name`, `ownerUserId`, `ownerEmail`, `status` and who disabled it and why, `closedAt`, retention fields, `termsAcceptedVersion`, `firstApiCallAt`, `emailOptOut`, `polarCustomerId` |
| Membership (teams) | derived from org and user | `orgId`, `userId`, `role` |
| Environment (API) | derived from org and role | `orgId`, `role` |
| ApiKey (API) | random | `orgId`, `environmentId`, `environmentRole`, `prefix`, `keyHash` (unique index), `hint`, `name`, `isActive`, `revokedAt`, `revokedBy`, `lastUsedAt` |
| Subscription (billing) | derived from org | Polar subscription, product and customer ids, `productName`, `isDefaultProduct`, `usageQuota`, `environmentRoles`, status, period, `pendingProductId`, `polarModifiedAt`, `polarCreatedAt` |
| Usage (API) | `<orgId>#<periodStart>` | `count`, `periodEnd`, `notified80`, `notified100` |
| AuditEvent | random | `orgId`, `actorType`, `actorId`, `action`, `details`, `createdAt` (index on `orgId, createdAt`) |
| UserSettings (consumer) | user id | settings chosen once, settings that follow the account (locale) |

Retention adds an index on `(retentionQueue, retentionDueAt)` for the due query.

## Backups and branches

- `turso db create <new> --from-db <db>` copies a database: a staging copy, a
  rehearsal for a risky migration, a PR environment.
- Point-in-time recovery creates a **new** database:
  `turso db create <new> --from-db <db> --timestamp <RFC3339>`. It never
  restores in place; switching `TURSO_DATABASE_URL` to the copy is the restore.
  The window depends on the Turso plan (24 hours on Free); the privacy policy
  states it.

## Purge

`purgeOrganizationData(orgId)` deletes every row stored for a tenant in one
batch, children first. It finds rows by tenant id, so a retry after a partial
failure finishes the job. Provider records are the caller's job
(`lifecycle.md`).

## Tests

Every repository function on `:memory:` through the real migrations: tenant
scoping (another tenant's ids return nothing), idempotent and concurrent
creation, counters that never pass the quota under concurrency (property test;
a quota of 0 never counts), claims that fire once, the purge removing one
tenant's rows and nothing else (twice), and a migration test that upgrades a
database with data from the previous schema.
