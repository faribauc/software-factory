# API keys, public API, MCP and SDK

For products whose customers' code calls them (which also makes them WorkOS
products). Environments, MCP, `llms.txt` and the SDK are optional: each is added
only when the interview says it's relevant.

## Hosting

`apps/api`, its own Railway service on `api.<domain>`: a TanStack Start app with
server routes only (no pages), so it shares the plumbing and the Bun server
build. It also hosts the webhooks (`/webhooks/polar`, `/webhooks/workos`), the
unsubscribe endpoint and MCP. It deploys, scales and fails apart from the
dashboard.

Railway has no WAF, so the app protects itself:

- the host allow-list (`deploy-railway.md`);
- a per-IP limit on unauthenticated paths and a per-key limit on keyed ones
  (`429 rate_limited` with `Retry-After`), counted in memory per replica with a
  `lean:` comment naming the limit (per-replica counts; move to a shared counter
  when there are replicas);
- a 64 KiB body cap.

Cloudflare stays DNS-only until abuse shows up; then turn on its proxy and
rules for `api.<domain>`.

Locally, `bun run dev` in `apps/api` serves on 3004; `dev:api -- --memory` runs
on an in-memory database migrated and seeded with a test account, and prints a
working key.

## Environments (optional)

- Fixed **roles**, not names: `production` (always there, can't be removed),
  plus `development` and `staging` when the product offers them (config) **and**
  the plan allows them (Polar metadata `environments`).
- One per role per tenant, id derived from tenant and role.
- Removing one deletes its keys first.
- A role the plan dropped shows "Not in your plan": its keys get
  `403 plan_required` and new ones can't be created.

Without this module every key is a production key.

## API keys

- **Format** `<prefix><64 hex>`: `<keyPrefix>_live_` for production,
  `<keyPrefix>_test_` for other roles; the secret from 32 random bytes.
- **Only the SHA-256 hash is stored** (unique index), plus a 4-character hint.
  The plaintext is returned once and shown once, with copy and a curl example.
  SHA-256 rather than a slow hash: keys are high-entropy and checked on every
  call.
- **Creating** needs a usable tenant, an environment of that tenant, and
  outside production the role in the entitlements. Names trimmed, 1 to 64
  characters, not unique.
- `orgId` and `environmentRole` are copied onto the key (both immutable), so
  checks don't read the environment.
- **Revoking** is idempotent and records when and by whom (`customer:<id>`,
  `admin:<id>`, `system:<reason>`). Revoked keys stay listed and can't be
  renamed. Closing an account revokes them all.
- **Validating:** a syntax check first (garbage never reaches the database),
  then the hash lookup. `lastUsedAt` is updated without waiting, and only if the
  key still exists, so a late write can't recreate a purged key.

## The pipeline (`withApiKey`)

Every keyed endpoint is a small handler wrapped in one function that does
everything else, in a fixed order, so no endpoint can forget a gate:

1. **Authenticate** the bearer token. Failure → `401 unauthorized` with
   `WWW-Authenticate: Bearer`.
2. **Load** the tenant and subscription in one batch.
3. **Gates:**

   | Condition | Response |
   | --- | --- |
   | tenant missing (purged mid-request) | `401 unauthorized` |
   | tenant disabled or closed | `403 organization_unavailable` |
   | no subscription row yet | `503 setup_pending`, `Retry-After: 5` |
   | subscription not active, trialing or past due | `403 no_active_plan` |
   | key's role not in the plan | `403 plan_required` |

4. **Body:** JSON up to 64 KiB (`413` above, `400 invalid_body` if malformed).
5. **Handler** gets `{ requestId, apiKey, org, subscription, entitlements, body }`
   and returns `{ status, body, headers? }`. A throw becomes `500 internal`,
   reported with the request id, never leaking internals.
6. **Meter** on 2xx only: one conditional increment against the quota (used up
   → `429 quota_exceeded` with `Retry-After` until the period ends). The call
   landing exactly on 80% or 100% claims that period's notice and emails the
   owner; a failing email never fails the call. The call that sets
   `firstApiCallAt` sends `first_api_call` to PostHog.

Every response carries `x-request-id`. Errors are
`{ "error": string, "code"?: string }`, with `issues` for validation errors. The
metering step is the one place to add usage billing later (Polar's usage
ingestion).

Endpoints live in one route list (`API_ROUTES`): a handler plus a path and
method, with `keyed: true` for those behind `withApiKey`. `GET /health` answers
`{ ok: true }` and touches nothing. Usage falls back to the UTC calendar month
when Polar hasn't given a period.

## MCP server (optional)

`POST https://api.<domain>/mcp`, so customers' AI agents can read the docs and
use the product.

- The official MCP TypeScript SDK's stateless, fetch-shaped handler: a fresh
  server per request, JSON responses. `GET` and `DELETE` answer `405`.
- **Docs tools**, public, read-only and not metered: `search_docs({ query, limit? })`
  and `get_doc({ slug })` from the docs package.
- **Product tools** go through `withApiKey` with the request's bearer key, so
  they're authenticated, gated and metered like HTTP. Each mirrors a keyed
  route and calls its handler in process.
- **Product functionality only:** never account, key, plan, billing or
  environment management. A test fails on any tool outside the two lists or
  named after those areas.
- API errors become tool errors (`isError: true`) whose text is the API's error
  JSON plus the status and request id.

## SDK (optional)

- A typed client in its own **public** repository,
  `<owner>/<slug>-sdk-typescript`, mounted at `packages/sdk-typescript` as a
  submodule from the start. Standalone: no workspace imports, its own lockfile,
  Vite+ config, CI and Dependabot; its README never mentions the monorepo.
- `Client({ apiKey?, baseUrl?, timeoutMs?, fetch? })`, the key defaulting to an
  env var; one method per public endpoint. It throws in a browser unless
  `dangerouslyAllowBrowser` is set. Errors: `ApiError` (`status`, `code`,
  `requestId`, `issues`, `retryAfter`) and `ConnectionError`.
- **Golden fixtures** pin each response; the SDK's tests use them, and a
  contract test in the monorepo runs the real pipeline and expects exactly
  them. An endpoint change updates the fixture, the SDK and the customer docs
  together.
- Built with `vp pack` (tsdown: ESM and CJS with declarations), smoke-loaded in Node.
- Publishes to npm from `v<x.y.z>` tags with **trusted publishing** (GitHub
  OIDC, no token, provenance included); `repository.url` must match the
  repository exactly. The monorepo never publishes.

### Extract an existing standalone SDK

1. Start from a clean, committed monorepo checkout. Record the source commit
   and SDK path. For `packages/sdk-typescript`, run
   `git subtree split --prefix=packages/sdk-typescript HEAD` and record the
   returned commit as `<split>`. Compare
   `git rev-parse '<split>^{tree}'` with
   `git rev-parse '<source>:packages/sdk-typescript'`; the tree IDs must match.
   Check `git log <split>` for the package's commits. Inspect the extracted
   files and history for secrets and private material before pushing. Stop
   and involve the owner if you find any.
   Get the owner's approval for the repository's visibility and publication
   before pushing.
2. Push the inspected history to the approved SDK repository. Keep the npm
   package name and existing release history. Update `repository.url` and
   verify the standalone build and tests, with publishing disabled during
   setup. Confirm the SDK commit to pin is reachable on the remote branch.
3. On the monorepo handoff branch, remove the tracked directory with
   `git rm -r packages/sdk-typescript`, add the SDK repository with
   `git submodule add <sdk-url> packages/sdk-typescript`, and check out the
   verified SDK commit inside the submodule. Stage `.gitmodules` and the
   submodule pointer. Follow [the CI guidance](repo.md#ci) wherever CI needs
   SDK files. The SDK repository owns package dependency bumps, and the
   monorepo updates the submodule pointer. Before merging, verify a fresh
   recursive clone checks out the pinned commit and passes the existing
   monorepo contract test against its golden fixtures.
4. Get the package owner's approval before changing the npm publisher.
   Disable publishing from the old workflow before enabling the new one.
   Verify the new
   `repository.url` and the trusted publisher's repository and workflow
   against the SDK repo. After the handoff, use its tag workflow and the next
   appropriate version for the first authorized release.

## Tests

Every 401, 403, 503 and 429 path; revoked keys, purged tenants, downgraded
environments; bodies (invalid, oversized); handler failures unmetered; metering
under concurrency; quota emails once each; `first_api_call` once under
concurrency; `x-request-id` everywhere; the rate limits. MCP with the official
client over HTTP: the exact tool list, docs tools without a key, product tools
metered. The SDK contract test.
