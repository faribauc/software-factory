# Design system (`packages/ui`)

shadcn/ui on Tailwind v4, Storybook-first: every app builds its UI from this
package, every component in it has stories, and every kind of page is a screen
here that can be tested in Storybook. We own the components; there's no styled
wrapper library.

## Rules

- **Apps build UI from `@<slug>/ui`.** They never import the primitives'
  dependencies (`radix-ui`, `@radix-ui/*`, `sonner`, `class-variance-authority`,
  `cmdk`, `vaul`, `input-otp`, `react-day-picker`, `recharts`…) or the
  package's internals. Oxlint's `no-restricted-imports` enforces it, in a
  `lint.overrides` entry for `apps/**` in the root `vite.config.ts`:

  ```ts
  overrides: [{
    files: ["apps/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["radix-ui", "@radix-ui/*", "sonner", "class-variance-authority", "cmdk", "vaul", "@<slug>/ui/src/*"],
          message: "Use the @<slug>/ui component (it has stories). Missing one? Add it to packages/ui with a story.",
        }],
      }],
    },
  }],
  ```

  Check once with a deliberate bad import that a scoped pattern like
  `@radix-ui/*` matches.
- **Every component has stories:** a `<name>.stories.tsx` next to it (CSF 3,
  `satisfies Meta<typeof Component>`, realistic product copy), one story per
  variant or state the apps use. A test composes every story file
  (`composeStories`) and renders each story under happy-dom with `vp test`; CI builds
  Storybook to catch stories that compile but don't load.
- **Add primitives with the CLI** from `packages/ui`:
  `bunx --bun shadcn@latest add <name>`, then its stories (`Primitives/<Name>`)
  and its export, in the same change.
- **Design in Storybook first.** A page is a screen (below): reuse one, or
  add it with its stories, then render it from the app's route. When a screen
  needs something missing, add a pattern with stories (`Patterns/<Name>`)
  first. Apps keep only what binds data: queries, mutations, forms, routing and
  copy.
- **Patterns and screens are router- and data-agnostic:** content through
  props and slots, `asChild` to wrap a router link. No TanStack Query, Router,
  Table or Form, server code or env in the package.
- **Semantic tokens only** (`bg-background`, `text-muted-foreground`,
  `bg-primary`), no hard-coded colours.
- **One copy of `sonner`:** `toast` is re-exported next to `Toaster`. Two
  installed copies once meant toasts never reached the toaster.

## Setup

- `components.json`: new-york style, zinc base, CSS variables, lucide icons.
- Storybook with the React + Vite framework, the Docs, Accessibility and
  themes addons; the preview loads the global CSS the apps use. Port 6006. The
  toolbar switches light and dark (`withThemeByClassName`, the `dark` class)
  and has a 360px phone viewport next to the built-in ones.
- Tokens in OKLCH in `src/styles/globals.css`, imported once by each app's root
  route, with a value for each theme. The product rebrands with `--primary`,
  `--primary-foreground` and `--ring`.
- **Fonts** are open fonts installed with Fontsource in this package
  (`bun add @fontsource-variable/<font>`), imported at the top of
  `globals.css` and set as `--font-sans` (and a heading font if the brand pairs
  two). Never a Google Fonts or other CDN link.
- `prefers-reduced-motion` turns animations off globally.

## Themes

Every product ships light and dark.

- The theme follows the system preference until the user picks one with the
  `ThemeToggle` in `AppShell`. The pick lives in a `theme` cookie (`light` or
  `dark`; absent means system) set on the apex domain, so every app shares it.
- Each app's root route runs a small inline script before first paint that
  reads the cookie, else the system preference, and sets the `dark` class on
  `<html>`. That holds for server-rendered, SPA and prerendered apps alike, so
  no page flashes the wrong theme. A CSP that blocks inline scripts lists the
  script's hash.
- The marketing site has no toggle: it reads the same cookie and otherwise
  follows the system preference.
- The cookie helpers and the inline script live in `packages/start-kit`;
  `ThemeToggle` only takes the current value and an `onChange`.
- Every story is checked in both themes, contrast included.

## Design phase

The skeleton step of the `sf-saas` skill runs this when only the workspace
root, the product config package and this package exist. It starts from `PRODUCT.md`: the brand
personality, the references (products whose look the user likes), the
anti-references, the design principles and the accessibility commitment.

1. **Directions.** Two or three brand directions, each a
   `Design/Directions/<Name>` story in `src/design/directions/` with its own
   token values scoped to a wrapper class. Each shows the colour tokens, the
   type scale, the logo and a few primitives (buttons, a card, an input), in
   light and dark. The user picks one. Its values move into `globals.css`; the
   direction stories, their CSS and the font packages only they used are
   deleted.
2. **Brand.** A `Design/Brand` story showing the live tokens of both themes,
   the type scale and the `Logo`. It stays as the reference for the tokens.
3. **Key screens.** Two or three screens the plan needs, built as below: the
   signed-in shell around the product's home, one more kind of page from the
   plan (a list, a detail view or a settings form), and the marketing home when
   the product has a site. Sign-in is the auth provider's hosted page, not a
   screen. Add only the starter patterns those screens use.

**The logo** is the product name set in the brand font plus a simple geometric
SVG mark, which is also the favicon. No illustrative logo.

## Screens

A screen is one unique kind of page, not one page: a list, a detail view, a
settings form, a home. Storybook covers each kind once.

- Screens live in `src/screens/<name>.tsx`, with `<name>.stories.tsx` next to
  them titled `Screens/<Name>`, and follow the pattern rules: content through
  props and slots, sample data in the stories, no fetching or routing.
- Every page with its own UI renders a screen. Its route only connects data
  and passes the content (provider widgets go in through a slot).
- A page that fits an existing screen reuses it and adds no story. A page with
  a new layout or behaviour adds a screen, with a story per state it shows:
  filled, empty, loading, error, as they apply. A screen that needs many flags
  to fit a page is two screens.
- Each screen is checked in Storybook at desktop and phone width, and works at
  360px wide with no horizontal scroll.
- A screen used by several apps (a list in both dashboard and admin) stays one
  screen.

## Starter patterns

| Pattern | For |
| --- | --- |
| `AppShell`, `NavLink` | The signed-in layout: header, home link, nav, account area, `ThemeToggle` |
| `ThemeToggle` | Light, dark or system, from a value and an `onChange` |
| `PageHeader` | The page's h1, a badge outside the heading, description, actions |
| `CenteredMessage` | Whole-page errors, not found, signed out, not authorized |
| `LoadingState` | Route pending |
| `FormField` | Label, one control, its error or hint, wiring `id`, `aria-invalid`, `aria-describedby` |
| `UsageMeter` | Usage against a limit (`role="meter"`), destructive at 100% |
| `CopyButton`, `SecretField` | Copy; a secret shown once |
| `CodeBlock` | Commands and snippets |
| `TypedConfirmDialog` | Destructive actions confirmed by typing a name |
| `ConsentBanner` | Analytics consent |
| `Logo` | The SVG mark plus the product name from config in the brand font (see the design phase) |

Add only those the product's screens use.

## Accessibility

Every control labelled, focus visible, dialogs returning focus, keyboard
reachable everything, AA contrast. Destructive alerts use a red border, tint and
icon with normal text: red text on a dark card fails AA. `PRODUCT.md` holds the
brand personality and design principles the UI follows.

## Tests

The story render test (it covers screens and their states too), component
tests for the patterns' accessibility wiring (labels, ARIA, roles, focus), the
Storybook build in CI, and axe on every page in the end-to-end suite.
