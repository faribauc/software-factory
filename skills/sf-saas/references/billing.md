# Billing (Polar)

Every product that charges uses Polar, whichever auth provider it has. Polar is
the merchant of record: it collects and remits sales tax and VAT, charges in
many currencies, and owns products, prices, payments, invoices, receipts and
failed-payment emails. We own one subscription row per tenant, kept in sync by
webhooks, and every gate reads that row.

Clerk Billing was weighed and declined as a default: no tax handling, USD only,
on/off features with no limits or metering, and payments needing 3D Secure fail.

## Rules

- **No tier names in code.** Plan identity and limits come from Polar product
  metadata, copied onto our row. One function, `resolveEntitlements`, turns the
  row into what the tenant may use.
- **Gates never call Polar.** The API, the apps and the jobs read our row.
- **An open tenant always has a plan.** Provisioning creates the default
  subscription; when the current one ends, the webhook re-seeds the default
  plan. Closed and purged tenants are never re-seeded.
- **One Polar customer per tenant**, `external_id` = tenant id.
- **Every subscription we create carries `metadata.orgId`**, and checkouts send
  it again, because Polar may replace metadata wholesale.
- **Sandbox in development, production in production**, chosen explicitly with
  `POLAR_SERVER`, never defaulted.

## Plan metadata

| Key | Value | Meaning |
| --- | --- | --- |
| `default` | `true` | Exactly one product: where every new or reactivated tenant starts (free or pay-as-you-go), one the API can subscribe a customer to. With several, the oldest wins and the rest are reported |
| `listed` | `true` | Shown in the plan list |
| `environments` | `development,staging` | Extra environments allowed (API products), limited to roles the product offers |
| `usage_quota` | `10000` | Units per billing period, a hard stop; absent means uncapped |
| product limits | e.g. `max_projects=5`, `seats=10` | Any other limit, read by the same parser |

The parser reports unusable values (unknown roles, bad numbers) instead of
guessing, and the logs and setup checks surface them.

## Client

A small typed `fetch` client for the endpoints used (products, customers,
subscriptions, checkouts, customer sessions, orders and invoices), parsing
**only the fields we read** with zod, so unrelated schema changes can't break
billing. `fetch` is resolved per call so MSW sees it. The official SDK was
avoided because its validation rejected newer Polar responses; re-check before
choosing it.

The Organization Access Token needs exactly `products:read`, `customers:read`,
`customers:write`, `subscriptions:read`, `subscriptions:write`,
`checkouts:write`, `customer_sessions:write`, `orders:read`. Scopes can't be
widened later: mint a new token.

## Lifecycle

**Provisioning** (`ensureDefaultSubscription`, at sign-up and reactivation):

1. Find or create the Polar customer (`external_id` = tenant id); read back a
   concurrent creation (409 or 422). Store its id on the tenant.
2. Stop if the stored subscription is active.
3. Otherwise adopt an active Polar subscription already tagged with this tenant
   (a retry after a lost write), or create one on the default plan.
4. Store the row.

**Webhook sync**, for `subscription.created`, `updated`, `active`, `canceled`,
`uncanceled` and `revoked`, at `POST https://api.<domain>/webhooks/polar` (or the
dashboard's host when there's no API service):

- The signature comes first: Standard Webhooks headers (`webhook-id`,
  `webhook-timestamp`, `webhook-signature`) with the base64 of Polar's secret,
  old timestamps rejected. Bad signature → 400; any failure → 500 so Polar
  retries. Replays are safe.
- Find the tenant from `metadata.orgId`, else our row by Polar subscription id,
  else the customer's `external_id`. Unknown tenants are ignored.
- Skip events older than the stored `polarModifiedAt` (`stale`).
- Ignore events about a subscription that isn't current, unless it's active and
  created after the current one (a checkout made it): it becomes current and the
  old one is revoked in Polar (`replaced`). The stored `polarCreatedAt` makes
  that comparison, so a late event about an older subscription can't undo a plan
  change.
- Store updates to the current subscription (`stored`). Cancel at period end
  keeps it active until the period ends.
- When the current subscription ends and the tenant is open, re-seed the
  default plan (`reseeded`).
- On a plan change: audit event, `plan-changed` email to open tenants,
  analytics event.

Register the endpoint in Polar with format *Raw* and those six events.

**Entitlements** from our row only: no row → `pending` (the API answers
`503 setup_pending` with `Retry-After`); a status outside `active`, `trialing`,
`past_due` → `inactive`; otherwise `active`, with the plan's environments,
quota and limits. `past_due` keeps access, so a failed card doesn't break a
customer's production.

## App actions

| Action | Does |
| --- | --- |
| View | Our row, the `listed` plans with a price label, limits and environments, a pending switch, invoices |
| Change plan | Unknown or unlisted products refused. From the default plan: Polar Checkout with `metadata.orgId`, returning to `/billing?checkout=success`. Between paid plans: change product with proration, stored at once. To the default plan: change at next period, stored as pending |
| Keep current plan | Clears a pending switch in Polar and in our row |
| Payment method | A Polar customer session; its portal opens in a new tab |
| Invoice | The PDF URL, only for an order of this tenant's customer |
| Reconcile | After checkout, sync the newest active subscription through the webhook rules, so the result is the same whichever arrives first |

With teams, only owners and admins see billing actions. The price label helper
formats fixed monthly or yearly prices in any currency, one-time, usage-based
and free.

## Tests

Against a stateful MSW fake of Polar (`testing.md`): every client endpoint and
error path, metadata parsing as a property test, catalogue rules, idempotent
provisioning (adoption after a lost write, concurrent customer creation), every
sync outcome including re-seeding and the closed-tenant rule, signatures, the
price label. End to end: upgrade through the mock checkout, the new plan's
limits, scheduling a return and keeping the plan.
