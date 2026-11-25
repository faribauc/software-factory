# Apps

Every app is TanStack Start on Bun. Read the `tanstack-router` and `vite`
skills before wiring routes or config.

## The shape every app follows

- **Data goes through server functions** (`createServerFn`), each with a zod
  validator on its input. No `/api/*` data routes: `/api/*` belongs to the auth
  provider's routes.
- **Server functions are thin.** They call plain handlers in
  `src/server/handlers/` that take `deps` (database, providers, email,
  analytics) and return values. Tests call handlers with test deps; one
  `deps.ts` wires the real ones and is covered end to end.
- **Errors are returned, not thrown**, because status and code don't survive
  serializing a thrown error: `Result<T>` is `{ ok: true, data }` or
  `{ ok: false, error: { status, code, message } }`. `toResult()` maps known
  errors (not found 404, validation 400, forbidden and plan required 403,
  conflict 409, auth 401 or 403) and turns anything else into a generic 500
  reported to Sentry. The client's `unwrap()` throws an `ApiError` into TanStack
  Query.
- **Bootstrap once per process**, as the first request middleware after the
  host allow-list: load `.env.local` locally (unless `<APP>_ENV_FILE=none`),
  derive the app's URL and the auth redirect URI from config unless set, and
  swap in an in-memory database when `<APP>_DB=memory`. Server-only modules are
  imported dynamically so they stay out of the client bundle.
- **`/health`** answers in the server entry, before auth or env loading.
- **Middleware order:** host allow-list, bootstrap, CSRF for server functions,
  auth, then translations.
- The shared plumbing (bootstrap, session reading, `Result`, errors, safe
  redirects, the host allow-list, the theme script from `ui.md`) lives in
  `packages/start-kit`, so every app behaves the same.

## Dashboard (`apps/dashboard`, port 3001)

- **SPA mode** (`defaultSsr: false`): pages render in the browser and every
  byte of data comes from server functions. Keep SSR only if a page must render
  on the server (for example in the account's language before hydration).
- TanStack Query for data (loaders prefetch, mutations invalidate on settle),
  TanStack Table for tables (module-scope features, memoized columns), TanStack
  Form for forms. Inputs are validated twice: the server's validator for
  safety, the form for messages.
- The signed-in layout (`_authenticated`) requires a session (else sign-in with
  the current path), runs provisioning, applies the terms gate, and renders the
  app shell from `@<slug>/ui`.
- Unknown pages say "Page not found"; 4xx errors show the server's message, 5xx
  a retry.
- Foundation pages, by module:

  | Route | Module | Content |
  | --- | --- | --- |
  | `/` | core | The product's home; for API products, plan, usage with a meter and reset date, environments with key counts |
  | `/environments/$id` | API | Keys: create (shown once), rename, revoke with typed confirmation |
  | `/billing` | billing | Plan, listed plans, upgrade, switch, scheduled return and keep, payment method, invoices |
  | `/account` | core | Profile and security (WorkOS widgets, or Clerk's `<UserProfile />`), export my data, close or delete my account |
  | `/team` | teams | Members, roles, invites |
  | `/terms/accept` | terms gate | The gate |
  | `/welcome` | consumer | First-run settings |
  | `/sign-in`, `/sign-up`, `/signed-out`, `/auth/error` | core | Auth routes |

## Admin (`apps/admin`, port 3003)

Same stack and plumbing, its own session cookie, every server function through
`adminCall` (`auth.md`).

- `/`: every tenant with owner, plan (or "Setup pending"), usage against quota,
  status (active, disabled, closed with the purge date), created; a text
  filter. A scan plus a read per row is fine for thousands of tenants; paginate
  past that.
- `/orgs/$orgId`: details, members, environments and keys (revoke with typed
  confirmation), disable with a reason or enable, the retention schedule, the
  audit timeline.
- Every action is attributed (`admin:<userId>`) and audited.
- Left out on purpose: impersonation, refunds, catalogue edits. Operators use
  the providers' dashboards for those.

## Marketing site (`apps/web`, port 3000)

**Prerendered entirely** at build; its own Railway service serves the files
(`deploy-railway.md`).

- Prerender from `/` following links; list unlinked pages (`/404`,
  `robots.txt`, `llms-full.txt`) in the config. Bundle server dependencies so
  the prerender uses one React.
- Every page sets its title, description and canonical URL through one
  `pageHead()` helper. The sitemap comes from the prerender, text files left
  out.
- `/404` prerenders to `404.html` with `noindex`; the server answers it with
  status 404.
- Home page, pricing (from the Polar catalogue at build) and legal pages are
  the product's copy.
- Analytics stay light: Sentry errors and cookieless PostHog until consent,
  never session replay.
- Links to the dashboard point at localhost in dev and the production URL in
  builds.

## Customer docs (`packages/docs`)

Markdown in `content/` with frontmatter (`title`, `description`, `section`,
`order`), compiled by a generator into a TypeScript module that's committed (a
test fails when it's stale), so the site and MCP bundle it without reading
files.

- Names, URLs and limits come from config through `{{token}}` placeholders
  filled at import; an unknown token throws.
- `<!-- … -->` comments are notes for authors, stripped before serving.
- Never link to internal docs or repo paths; every `/docs/…` link and anchor
  resolves (tested).
- The API reference matches the API: the same routes, error codes and limits.
  Never document an endpoint or option that doesn't exist.
- Exports: the page list and lookup, `toMarkdown(page)`, and keyword
  `searchDocs()` (title ×5, description ×3, body) for MCP; with the `llms.txt`
  extra, `llmsTxt()` and `llmsFullTxt()` in llmstxt.org format.
- The site renders pages with `marked` at build (heading ids matching docs
  anchors, highlight.js, scrolling tables), with "Copy as Markdown" and, with
  the extra, a `.md` twin at every page's URL plus `/llms.txt` and
  `/llms-full.txt`.
- Starter pages: overview, quickstart, API reference, plus SDK and AI pages
  when those extras are in.

## Translations (when users read more than one language)

General Translation (`gt-tanstack-start` and the `gt` CLI), pinned:

- `gtMiddleware` in `start.ts`, `initializeGT` in the router, the root loader
  and `<GTProvider>` in the root route; locales in `gt.config.json`.
- The locale comes from a cookie set by the language selector (a shadcn Select
  on `useLocaleSelector()`), then `Accept-Language`; no `/fr` URLs. Signed in,
  the language belongs to the account: saved on each switch and applied on load.
- Every visible string goes through it: `<T>` around JSX text, `gt("…")` for
  attributes and props, `{name}` variables and ICU plurals instead of
  concatenation. Server messages are tagged with `msg()` where raised and
  translated in the browser. Never translate what users typed or the product
  name.
- Translations are generated at build (`gt translate` before `vite build`) and
  never committed, so the build needs `GT_PROJECT_ID` and `GT_API_KEY` locally,
  in CI secrets and on Railway. Nothing calls GT at runtime.
- Tests and selectors never depend on translated text: use `data-` attributes.
- The auth provider's screens follow the same locale.
- Emails go out in the account's language through `gt-node` (`lifecycle.md`).

## Tests

Handlers with test deps; the security registry (`auth.md`); `Result` mapping
with no leaked internals; bootstrap locally and in production; safe redirects.
End to end per page with axe. Site: heading ids and anchors, SEO tags, robots,
the 404, `llms.txt` and the twins when present. Docs: freshness, tokens, no
internal links, search ranking.
