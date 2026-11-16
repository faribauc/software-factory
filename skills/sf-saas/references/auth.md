# Auth and tenancy

Identity is bought, not built: hosted sign-in and the provider's own
components, never custom auth screens. What we own is the **tenant boundary**.

## The provider is derived

- **WorkOS** when customers' code calls a public API with API keys. Those
  customers are businesses that will ask for enterprise SSO (SAML, directory
  sync), which WorkOS is built for.
- **Clerk** otherwise.

Read the `workos` skill or Clerk's current docs before wiring either; their
SDKs move fast.

## Tenancy is asked

| | Solo | Teams |
| --- | --- | --- |
| Tenant | One per user: a WorkOS organization owned by the user, or the Clerk user itself | An organization (WorkOS organization or Clerk organization) with members |
| Check | The tenant row's `ownerUserId` is the session user | An active membership of the session user in the session's organization, checked against our membership rows |
| Roles | None for customers | `owner`, `admin`, `member` at least; the product names its own |
| Invites | None | Invite by email through the provider, accepted into the organization; seats counted if billing needs it |
| Billing | Per tenant | Per organization; only owners and admins manage it |

Teams from day one costs more now and far less than adding members later,
which touches every tenant check, billing and the admin app.

## Rules for both providers

- **The tenant id comes from the server session**, never from input, and is
  re-checked against our database on every call, so a purge or a removed member
  takes effect at once.
- **Every data function takes the tenant id first** and filters by it. Another
  tenant's row behaves like a missing one: 404, never 403.
- **One guard per kind of caller**, wrapping every server function:
  `customerCall` for customers, `adminCall` for operators. No session → 401
  before any database call.
- **A security registry test** reads every server function's source and fails
  when one skips its guard, takes input without a validator, or skips the terms
  gate. A short allow-list holds each exception with its reason (the "who's
  signed in" probe, provisioning, the terms acceptance). For handlers that take
  ids, it calls each with another tenant's ids and expects 404.
- **Redirects are same-origin paths only.**
- **CSRF:** keep TanStack Start's CSRF middleware for server functions; listing
  `requestMiddleware` replaces the default, so include it explicitly.
- **Sign-out** returns to a public `/signed-out` page.
- **Turn off the provider's self-service account deletion**: it would leave our
  data behind. Accounts end through our own flow (`lifecycle.md`).

## WorkOS

**Provisioning (`ensureTenant`)**, from the signed-in layout before any page
loads, on every visit, idempotent and cheap once done:

1. Find the user's organization by `externalId` = their user id, or create it
   ("<first name>'s account", idempotency key `tenant-<userId>`); read back a
   concurrent creation. With teams, a user arriving from an invite joins that
   organization instead.
2. Ensure the membership and role.
3. Ensure our organization row (conditional insert), reopening it if it was
   closed; an operator's disable survives.
4. Ensure the default environment and the default subscription when those
   modules exist.
5. Switch the session to the tenant organization if it isn't there.
6. On creation or reactivation only: audit event, welcome or reactivated email,
   analytics event.

If a provider fails midway, the page says "We couldn't finish setting up your
account" with a retry; the next attempt picks up where this one stopped.
Provisioning runs on sign-in rather than from a webhook, so the app and API
work at once.

- Tenant organizations carry the owner's user id as `external_id`, so webhooks
  tell them from the operator organization, which has none.
- The profile and security pages use WorkOS's widgets with a server-minted
  widget token.
- The webhook handles `organization.deleted` for tenant organizations by
  purging (`lifecycle.md`); everything else is logged and answered 200. The
  signature is checked first (`WorkOS-Signature: t=…, v1=…`, HMAC-SHA256 of
  `t.body`, a few minutes' tolerance).
- Code outside the apps (webhooks, jobs) may call WorkOS through a small
  `fetch` client for the few calls it needs, so MSW can intercept it.
- Setup: roles `customer` (default) and `admin`; redirect URIs
  `<app>/api/auth/callback` per app; the sign-in endpoint
  `<dashboard>/api/auth/sign-in`; sign-out redirects to each app's
  `/signed-out`; staging environment for development; cookie password from
  `openssl rand -base64 32`.

## Clerk

- `clerkMiddleware()` in `start.ts`, `auth()` on the server, Clerk's
  `<SignIn />`, `<SignUp />` and `<UserButton />` only.
- A `signedIn` function middleware on every customer server function: no
  `userId` → 401 before any database call; handlers get `context.userId` (and
  `context.orgId` with teams).
- One server function answers signed-out visitors (`getSignedInUser`), for the
  root route's guard. A short `isPublicPage` pattern lists the routes open
  signed out: sign-in, sign-up, the legal pages.
- A first-run page (`/welcome`) collects settings that must exist before the
  app works, saved once.
- Clerk's screens follow the app's locale (`@clerk/localizations`).
- With teams, turn on Clerk organizations and mirror memberships into our
  database through Clerk's webhooks (signature checked), so the tenant check
  reads our rows.
- Until billing exists, sign-ups can be Restricted with invitations.
- **Production creates new user ids.** Moving to Clerk's production instance
  gives every user a new id; move their rows with checked SQL
  (`deploy-railway.md`), or go to production before anyone has real data.

## Operator access

- **WorkOS:** an operator organization created by hand, its id in
  `WORKOS_ADMIN_ORG_ID`, with no external id. `requireAdmin` needs a session on
  that organization and an active `admin` membership, checked against WorkOS on
  every call so a removed admin is out at once. A customer session never counts,
  even for someone who is also an admin; page load switches an admin's session
  onto the operator organization.
- **Clerk:** a Clerk operators organization with an `admin` role, its id in
  `CLERK_ADMIN_ORG_ID`. `requireAdmin` checks the session user's membership and
  role in it through Clerk's API on every call. Needs Clerk organizations turned
  on.
- Both: the admin app **fails closed** without the org id, uses its own cookie
  name or Clerk instance settings so the two apps' sessions don't collide on
  localhost, and nobody is seeded: members are added by hand.

## Terms gate (business products)

- `LEGAL.termsVersion` and `LEGAL.privacyVersion` in config form the current
  version.
- Provisioning reports `needsTerms`; the signed-in layout redirects to
  `/terms/accept?redirect=<target>` until it's accepted.
- Acceptance stores the version and time on the tenant, with an audit and an
  analytics event.
- Server functions refuse with `403 terms_required` until then, except the
  acceptance itself. Bumping a version re-prompts everyone. It never blocks the
  public API.

Consumer products link the legal pages from the sign-in page instead.

## Tests

Guard unit tests (no session, no org, someone else's org, non-member, removed
admin, missing operator org); the security registry test; provisioning (first
sign-in once, concurrent first sign-ins make one org, a provider outage then a
retry, reactivation, a disable surviving it); invites and roles with teams; end
to end through the fake provider (`testing.md`): hosted sign-in, return to the
requested page, sign-out, the open-redirect guard.
