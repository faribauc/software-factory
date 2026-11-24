# Account lifecycle, legal pages and email

## Legal pages

Public `/privacy` and `/terms` on the site (or the dashboard when there's no
site), plus `/data-deletion` for consumer products. OAuth providers (Google's
consent screen, Meta's app settings) need these URLs before a public launch.

- The privacy policy lists the processors (the auth provider, Polar, Railway,
  Turso, Resend, Sentry, PostHog), the retention period, and the backup window
  (the Turso plan's point-in-time recovery).
- A version (business products, for the terms gate) or an effective date in
  config; change it whenever the text changes.
- Each page has its own tab title.
- The copy is the user's: write placeholders marked as such.

## Export

`exportData` returns everything stored about the account as a JSON download:
user, account (status, terms, opt-outs), the product's data, keys as views
(never hashes or plaintexts), the subscription summary, usage and the audit
trail. It records a `data.exported` audit event.

## How an account ends (asked)

### Delete now (consumer products)

**Delete my account** on `/data-deletion`, signed in, says which account it
deletes and asks for confirmation. It then:

1. revokes the Polar subscription and deletes the Polar customer, if any;
2. deletes every row for the tenant in one batch;
3. deletes the auth provider's user.

Data goes before the provider user, so a failed provider call can be retried
and never leaves data nobody can reach.

### Close, then purge (business products)

**Close** is refused (`409`) while a non-default plan runs, even with a switch
back scheduled: no refunds or proration. Otherwise:

1. Revoke the Polar subscription and **store the revoked state at once**, so
   reopening before the webhook arrives still seeds a new plan.
2. Revoke every key (`system:account-closed`).
3. Set `closedAt` and enter the retention queue (step 0, due date from
   `RETENTION`).
4. Audit `account.closed`, email `account-closed` with the purge date and a
   sign-in link, send `account_closed` to PostHog, sign out to
   `/signed-out?closed=<purge date>`.

Confirmation by typing the account's email. With teams, only the owner can
close.

**Reopen:** signing in again runs provisioning, which reactivates the account on
the default plan and leaves the queue. Old keys stay revoked.

**Retention** (`RETENTION` in config): win-backs on days 7, 30 and 60 after
closing, a final notice on day 76 stating the deletion date, the purge on day
90. The days ascend and the purge is last (tested).

- `apps/jobs/retention.ts` runs daily as a Railway cron service. It finds due
  accounts (`retentionQueue = 'closed'` and `retentionDueAt <= now`) and per
  account sends the step's email, or purges after the last step. It exits when
  done.
- **Claim, then act:** each step is claimed with an update conditional on the
  current step and the same `closedAt`, so repeated or concurrent runs never
  send twice and a claim from an earlier closing can't touch a later one. A
  failed send releases the claim for the next run; a failed purge stays due; one
  account's failure never stops the others.
- One step per account per run, so an outage never sends three emails in a
  day.
- Win-backs are marketing: skipped for opted-out and disabled accounts. The
  final notice and the purge always happen.
- It runs under a Sentry cron monitor, so a missed or failed run alerts.
- By hand, from the repo root:
  `bun run --filter @<slug>/jobs retention -- --dry-run` (the default) or
  `-- --apply`;
  emails go to the log unless `EMAIL_TRANSPORT=resend`; exit 1 if a step
  failed.

**Purge** (`purgeOrganization`), used by the job and by WorkOS's
`organization.deleted` webhook:

1. Revoke the Polar subscription if active, then delete the Polar customer.
2. Delete the auth provider's organization, then the user **unless they still
   belong to another organization** (an operator keeps admin access).
3. Delete every row for the tenant (`data.md`).
4. Log one line with the tenant id and counts, no personal data.

Providers go first so a retry still finds their ids; every step accepts
"already gone".

**Unsubscribe:** `GET` and `POST /unsubscribe?token=…` on the API service (or
the dashboard). The token is `<base64url tenantId>.<HMAC-SHA256>` signed with
`EMAIL_UNSUBSCRIBE_SECRET`, compared in constant time. `GET` only shows a
confirmation button, because link scanners prefetch links; `POST`, from the
button or a mail client's one-click, sets `emailOptOut`. A bad token is 400, an
already purged account a quiet 200. The token never signs anyone in: signing in
to a closed account would reopen it.

## Email (`packages/email`, Resend)

We send account emails. The auth provider sends auth emails, and Polar sends
receipts, invoices and failed-payment emails; never duplicate theirs.

- `sendEmail(transport, to, template, data, { unsubscribeUrl })` renders,
  escapes every dynamic value and adds headers.
- Templates are typed functions (data checked at compile time, escaping in one
  place) on one accessible single-column layout with HTML and plain text, and a
  footer with the product name and support address. Dates written as
  "1 March 2026" in UTC.
- **Marketing emails must carry an unsubscribe link** (rendering throws without
  one) and RFC 8058 one-click headers (`List-Unsubscribe`,
  `List-Unsubscribe-Post`). Transactional emails carry neither.
- **Nothing is sent unless `EMAIL_TRANSPORT=resend`.** Otherwise a log
  transport prints messages and keeps them for assertions.
- The Resend transport is a small `fetch` call to its HTTP API with
  `RESEND_API_KEY`, so MSW can intercept it in tests.
- No secrets, keys or tokens in bodies, except the signed unsubscribe link.
- Starter templates: `welcome`, `plan-changed`, `quota-warning` (API products),
  `account-closed`, `account-reactivated`, `winback` (marketing),
  `final-notice` (retention products).
- Sending domain: a subdomain such as `mail.<domain>` with the SPF, DKIM and
  DMARC records Resend shows, and a mailbox for DMARC reports.

### Translated emails (when users read more than one language)

Templates stay in our code; never Resend's dashboard templates, which have no
locales and can't be mixed with our own HTML. Translate them with `gt-node`,
GT's library for code outside React:

- Each template's subject and text are tagged with `msg()` and translated with
  `getGT()`, with `{name}` variables and ICU plurals like the apps (`apps.md`).
  The product name, users' own text and links are never translated.
- `sendEmail` takes the recipient's locale: the language saved on the account,
  else the product's default. It renders inside `withGT(locale, …)`, so a
  request and a job send alike; win-backs and final notices from `apps/jobs`
  wrap each send the same way.
- Translations come from the build, as in the apps: `gt translate` writes
  `translations/[locale].json`, and `initializeGT({ loadTranslations })` reads
  them, so sending never calls GT. Every service that sends email (dashboard,
  api, jobs) runs `gt translate` in its build and gets the GT keys. A missing
  string falls back to the source text.
- Dates go through `Intl.DateTimeFormat` with the locale (still in UTC).
- Check once that `gt translate` picks up the `msg()` calls in
  `packages/email`; its docs only promise `<T>` and dictionaries. If it
  doesn't, keep each template's text in a JSON file the CLI translates.

## Tests

With a fake clock, the real data layer, the log transport and the provider
fakes: each retention step once on its day then the purge, nothing early,
re-runs and concurrent runs send once, opt-out and disabled skip win-backs
only, reopening leaves the queue, failed sends retried, failed purges stay due,
the dry run, the unsubscribe endpoint. Every template renders, in every
locale when there's more than one; marketing and transactional headers;
escaping as a property test; the token round trip and tampering. End to end: export, close and reopen, or delete now.
