# Repo, tooling and config

## Layout

Always a monorepo on Bun workspaces, even with one app, so a second app needs
no restructure. Create only the folders the product's modules need.

```
apps/
  dashboard/      the signed-in app (always)
  admin/          operator app (if in scope)
  web/            marketing site and customer docs, prerendered (if in scope)
  api/            public API, webhooks, MCP (if there's a public API; otherwise webhooks live in dashboard)
  jobs/           scheduled scripts: retention (if in scope)
packages/
  config/         product identity and settings
  env/            env loading and the list of secrets
  db/             Drizzle schema, migrations, data access
  billing/        Polar client, sync, entitlements (if it charges)
  email/          templates and the Resend transport
  observability/  Sentry, PostHog, scrubbing
  docs/           customer docs as Markdown (with web)
  start-kit/      TanStack Start plumbing shared by the apps
  ui/             design system and Storybook
  testing/        guards, fakes, factories
  typescript-config/
  sdk-typescript/ public client, a submodule of its own repository (if in scope)
e2e/              Playwright
scripts/          docs check, migrations runner, one-off scripts
docs/             internal docs, one per area
.railway/railway.ts
.github/workflows/ci.yml  .github/dependabot.yml
.vite-hooks/pre-commit  .vite-hooks/pre-push
AGENTS.md  CLAUDE.md (links to AGENTS.md)  PRODUCT.md  CONTEXT.md  README.md  .env.example
```

- Package scope `@<slug>/*`. Packages are TypeScript sources, not built or
  published: `bunfig.toml` sets `linker = "hoisted"` and
  `linkWorkspacePackages = false`. The SDK is never a workspace.
- Tasks run across workspaces with `vp run` (`-r` for every package in
  dependency order, `--filter` for some), cached locally. No Turborepo.
- Apps import workspace packages, so each app is built and deployed from the
  repo root with one `bun.lock`, never as its own folder with its own install.
  An app's own scripts (its Railway build, a job run by hand) run with
  `bun run --filter` (`deploy-railway.md`); `vp run` stays the runner for
  workspace tasks.

## Tooling

| Tool | Use |
| --- | --- |
| Bun | Package manager, and the runtime of the servers and scripts. Pinned in `packageManager` and in CI |
| Vite+ (`vite-plus`, CLI `vp`) | The toolchain: `vp check` (Oxfmt, Oxlint, type checks), `vp test` (Vitest), `vp run` (tasks), `vp pack` (the SDK's build), `vp hooks` and `vp staged` (git hooks). Runs on Node 22.18 or later |
| TanStack Start | Every app: Vite, file routes, server functions; Nitro's `bun` preset for servers |
| Tailwind v4, shadcn/ui | Styling and primitives, added with the shadcn CLI into `packages/ui` |
| TypeScript | `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, bundler resolution; shared configs in `typescript-config`. Type checks run through Vite+'s TypeScript Go toolchain |

### Vite+ setup

- `bun add -D vite-plus oxlint-tsgolint` at the root. Each app's
  `vite.config.ts` imports `defineConfig` from `vite-plus`; never a separate
  `vitest.config.ts`.
- **TanStack Start needs one copy of Vite.** Two copies break an `instanceof`
  check and the app answers 404 (TanStack Start issue #1391). Alias Vite to Vite+'s core and pin
  Vitest in the root `package.json`:

  ```json
  "overrides": {
    "vite": "npm:@voidzero-dev/vite-plus-core@<vite-plus version>",
    "vitest": "<the Vitest version from vp toolchain vitest>"
  }
  ```

  Dependabot can bump one without the other: group `vite-plus`, `vite` and
  `vitest` updates together, and check `bun pm ls vite` shows one copy.
- **One root `vite.config.ts`** holds the shared `lint`, `fmt`, `staged` and
  `run` blocks; apps never repeat them. Directory-specific rules go in
  `lint.overrides` with globs relative to the root (the design-system rule in
  `ui.md`). Apps' own `vite.config.ts` hold only Vite, framework and `test`
  settings.
- `lint`: the `typescript`, `react`, `jsx-a11y` and `import` plugins,
  `options: { typeAware: true, typeCheck: true }` (type-aware rules such as
  `typescript/no-floating-promises`, and the type check itself, need both).
  ESLint plugins through `jsPlugins` (`react-hooks`, `playwright`,
  `testing-library`, `storybook`) are still alpha: add them one at a time and
  drop any that misbehave.
- `fmt`: `sortImports` and `sortTailwindcss` on; ignore generated files (route
  trees, generated docs content, translations).
- `staged: { "*": "vp check --fix" }`, run by the pre-commit hook.
| Drizzle | Schema, queries and migrations (`data.md`) |
| Playwright + axe | End to end and accessibility (`testing.md`) |
| Storybook | The design system's catalogue (`ui.md`) |

Hold back a major version when the tooling isn't ready, with a Dependabot
ignore and a line in `docs/testing.md` saying why.

## Scripts

| Script | Does |
| --- | --- |
| `verify` | `vp check`, `vp run -r test` (coverage gates included), `docs:check`, and the SDK's verify if present. CI, the pre-push hook and agents run it |
| `verify:full` | `verify` plus the Storybook build, end to end and workflow lint (`actionlint` in Docker) |
| `dev` per app | Fixed ports: web 3000, dashboard 3001, admin 3003, api 3004, Storybook 6006 |
| `dev:api -- --memory` | The API on an in-memory database with a seeded account and a printed key |
| `generate-routes` | Regenerate route trees after route changes; commit them |
| `db:generate`, `db:migrate` | drizzle-kit: generate a migration from the schema; apply pending ones |
| `docs:check` | The docs guard (`docs-system.md`) |
| `storybook` | Storybook on 6006 |

`prepare` runs `vp hooks enable`: the pre-commit hook runs `vp staged`, the
pre-push hook runs `verify`. The end-to-end suite
uses ports from 4300 so it never collides with the dev servers.

## CI

`.github/workflows/ci.yml`, on `pull_request` and on `push` to `main`:

- `permissions: contents: read`; actions on current majors; Bun pinned to the
  `packageManager` version and Node for Vite+; checkout with `submodules: true` once the SDK is a
  submodule; `bun install --frozen-lockfile`; `verify`.
- Separate jobs for the Storybook build, end to end (upload the Playwright
  report on failure) and actionlint.
- Concurrency: a newer push to a PR cancels its older run, but **every push to
  `main` gets its own group**, so no `main` run is cancelled and Railway's Wait
  for CI deploys every merge that matches a service's watch paths:

  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}
    cancel-in-progress: true
  ```

- Build-time secrets (General Translation's keys) come from GitHub Actions
  secrets, given only to the step that needs them.
- Dependabot: npm, GitHub Actions, and `gitsubmodule` once the SDK is split;
  weekly, minor updates grouped.

## Product config (`packages/config`)

One module with the product's identity and product-level settings. Everything
that would otherwise repeat is derived from it. It ships to browsers, so it
holds no secrets.

| Export | Holds |
| --- | --- |
| `PRODUCT` | `name`, `slug`, `domain`, `keyPrefix` (API products), `repo` |
| `HOSTS`, `URLS`, `LOCAL_PORTS` | `app.`, `admin.`, `api.`, docs and MCP URLs, local ports |
| Environment roles | `production` always; the extra roles the product offers (API products) |
| `apiKeyPrefixForRole()` | `<keyPrefix>_live_` for production, `<keyPrefix>_test_` otherwise |
| `EMAIL` | Sender, support and alerts addresses |
| `RETENTION` | Win-back and final-notice days, the purge day (retention products) |
| `LEGAL` | Terms and privacy versions or effective date |
| Limits | API rate limits, body cap, analytics host |

Rules: derive, don't repeat; no secrets; no tier names. Test the derivations:
key prefixes per role, hosts, retention days ascending with the purge last.

## Env files and secrets

- `.env.example`, committed: every variable, grouped by setup step, with where
  to get it and how to generate it (`openssl rand -base64 32`).
- `.env.local` at the root for development, never committed (`.env*` ignored
  except the example). Apps may have their own `.env.local`, which wins for the
  keys it sets.
- `packages/env` reads and merges them (the shell wins), and lists the secret
  keys in one array, so adding a secret is one line. In production the values
  are Railway variables.
- Only `VITE_*` values reach browsers, and only public identifiers go there
  (Sentry DSN, PostHog key, Clerk publishable key).
- Builds fail closed when a value they bake into production is blank.
- Tests pin the database and blank every provider key in the shared test setup file, so
  a developer's `.env.local` can never reach a real service.
