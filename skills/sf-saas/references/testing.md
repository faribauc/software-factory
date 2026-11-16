# Testing

Every behaviour ships with its tests in the same commit. Tests never touch the
network, a real provider or a real database, and the guards below make that
structural, not a convention. The kit is built before the first feature.

## Rules

- **No real network.** The shared setup file replaces `fetch` with a guard that
  rejects every non-loopback URL; MSW (`mockHttp()`) sits on top and fails any
  request without a handler. The guard exists because a client that captured
  `fetch` at import once reached the real Polar sandbox past MSW. Provider
  clients use `fetch`, so the same code runs in tests and on the Bun server.
- **No real database.** `freshDb()` gives a migrated libSQL `:memory:`
  database. The setup file pins `TURSO_DATABASE_URL=:memory:`, blanks the token
  and every provider key, and stops env-file loading, so a developer's
  `.env.local` can't leak in.
- **Temp files stay in the run's sandbox:** a global setup points `TMPDIR` at
  one directory per run and removes it at the end.
- **The guards live in one setup file** (`packages/testing/setup.ts`), listed in
  every package's `test.setupFiles`, so no package can run without them.
- **Time is controlled** with `installFakeClock()`, never by sleeping.
- **Coverage gates are part of `vp test`:** Vitest's coverage thresholds in
  each package's `test.coverage` (95% for packages with logic, 90% for apps'
  `server/` and `lib/`; routes, components and real-provider wiring are covered
  end to end). The coverage provider's version must match Vite+'s Vitest. Never
  lower a threshold to pass; add the test. Branch thresholds too, now that
  Vitest measures them.
- **Fakes throw on what they don't implement**, and keep to real behaviour.
- **Selectors never use translated text:** `data-` attributes or roles.

## Layers

| Layer | Tool | Covers |
| --- | --- | --- |
| Unit | `vp test` (Vitest) | Pure logic, next to the code |
| Property | `fast-check` | Quotas under concurrency, escaping, redaction, metadata parsing |
| Data | `freshDb()` | Repositories, tenant scoping, migrations, purge |
| External HTTP | MSW | Provider clients against stateful fakes |
| Components and stories | happy-dom, Testing Library, `composeStories` | The design system |
| Security registry | source scan plus generated cases | Every server function guarded and validated; other tenants' ids get 404 |
| End to end | Playwright against **built** apps | Real flows through fake providers |
| Accessibility | `@axe-core/playwright` | No serious or critical WCAG 2.2 AA violation on any page the flows visit |

## The kit (`packages/testing`)

| Export | Does |
| --- | --- |
| `freshDb()` | A new migrated in-memory database |
| `installFakeClock(start)` | Freeze time; `set`, `advance({ days })`; reset after each test |
| `mockHttp(...handlers)` | An MSW server for the file; unhandled requests fail |
| `seedAccount(db, options)` | A tenant with its subscription, and for API products environments and a working key (plaintext returned) |
| `recordingAnalytics()` | Records captures for assertions |
| `createFakePolar()` | A stateful fake of Polar: products, customers, subscriptions, checkouts, sessions, orders; signed webhook payloads; forced failures |
| `createFakeWorkOS()` | A stateful fake: AuthKit (authorize, code and refresh exchange, RS256 JWKS, logout), organizations, users, memberships; `loginAs(email)` |
| `createFakeResend()` | Records sent emails |
| `serveHandlers(handlers, port)` | Serves MSW handlers over real HTTP, for apps running in another process |
| `request(…)` | A `Request` for server-route and webhook tests |

Each fake lands with the issue that brings its provider, and the kit has its own
tests.

## End to end

`e2e/playwright.config.ts` starts its own processes on ports from 4300:

1. A mock server for the providers (auth and Polar on their own ports),
   steered by `/__test/reset`, `/__test/login`, `/__test/make-admin` and
   `/__test/state`.
2. A fresh libSQL file database, migrated.
3. The **built** apps (`vite build`, then the Bun server), pointed at the mocks,
   with env-file loading off and analytics keys empty.
4. The prerendered site, served like Railway serves it (directory index,
   `404.html` with status 404, `.md` as Markdown).

Each test starts signed out with fresh mocks and a new random user (an
automatic fixture). A `signIn(page, path)` helper visits and accepts the terms
when asked.

**Clerk products:** Clerk's hosted components can't be faked like WorkOS.
Keep logic out of components, test the `signedIn` rule with the registry, and
sign in end to end with Clerk's testing tokens against its development
instance, run as a separate CI job with the token in a secret.

## Decisions to record in each product

Why the guards exist, each Dependabot hold-back and why, and any fake that
differed from the real provider and how it now matches.
