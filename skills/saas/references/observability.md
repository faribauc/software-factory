# Observability (`packages/observability`)

**Sentry** for errors, traces and cron monitors. **PostHog** for product
analytics, and session replay in the dashboard after consent. One shared
scrubber sits in front of both. Everything is off without a DSN or key, which
is the default locally and in tests.

## Rules

- **No personal data or secrets leave.** Every Sentry event goes through
  `scrubSentryEvent`: query strings, cookies and request bodies dropped, only
  the user id kept, sensitive keys, API keys, bearer tokens and emails redacted.
  Analytics properties go through the same `scrub`. `sendDefaultPii: false`
  alone isn't enough: it keeps emails in messages and keys in headers.
- **Analytics never breaks a request.** Server captures are sent once, with a
  short timeout and no retries, and never throw.
- **Events come from a typed catalogue.** Users are identified by the auth
  provider's user id, with the tenant id as the only person property; no emails,
  names or keys in properties.
- **DSNs and project keys are public config** (`SENTRY_DSN`, `VITE_SENTRY_DSN`,
  `POSTHOG_KEY`, `VITE_POSTHOG_KEY`), not secrets. A Sentry auth token for
  source maps is a secret.

## Entry points

| Import | Runtime | Exports |
| --- | --- | --- |
| `@<slug>/observability` | any | `scrub`, `scrubSentryEvent`, base Sentry options, the event catalogue |
| `…/browser` | browsers | `startBrowserObservability` (once, with the Vite env values passed in), consent read and subscribe, `identify(userId, tenantId)`, `resetIdentity()` |
| `…/server` | Bun servers and jobs | `initServerObservability`, `captureException`, `withCronMonitor(slug, crontab, job)`, `createServerAnalytics` |

- PostHog runs **cookieless until the consent banner is accepted**; replay only
  after consent, with every input masked. The marketing site never records
  sessions.
- A same-origin `/ingest` proxy route forwards to PostHog so ad blockers don't
  drop events.
- `withCronMonitor` sends in-progress, then ok or error check-ins, so a missed
  or failed scheduled run alerts.
- Releases are named `<app>@<commit>` from `RAILWAY_GIT_COMMIT_SHA`.
- Source maps are left out at launch (minified browser traces). When needed:
  `build.sourcemap: "hidden"`, an upload step with the auth token, and `*.map`
  kept off the public host.

## Starter events

`account_created`, `account_reactivated`, `account_closed`, `terms_accepted`,
`plan_changed`, plus `environment_created`, `api_key_created` and
`first_api_call` for API products. `first_api_call` is sent once per tenant,
guarded by a stored timestamp, so the hot path never calls PostHog after that.
Add the product's own activation events.

## Tests

Scrubbing with property tests (keys and emails never survive); Sentry through an
in-memory transport (scrubbed events, release, cron check-ins); the no-DSN path;
PostHog through an injected `fetch` (sent once, never throws).
