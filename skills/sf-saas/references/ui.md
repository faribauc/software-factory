# Design system (`packages/ui`)

shadcn/ui on Tailwind v4, Storybook-first: every app builds its UI from this
package, and every component in it has stories. We own the components; there's
no styled wrapper library.

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
- **Design in Storybook first.** When a page needs something missing, add a
  pattern with stories (`Patterns/<Name>`), then use it. Apps keep only what
  binds data: queries, mutations, forms, routing and copy.
- **Patterns are router- and data-agnostic:** content through props and slots,
  `asChild` to wrap a router link. No TanStack Query, Router, Table or Form in
  the package.
- **Semantic tokens only** (`bg-background`, `text-muted-foreground`,
  `bg-primary`), no hard-coded colours.
- **One copy of `sonner`:** `toast` is re-exported next to `Toaster`. Two
  installed copies once meant toasts never reached the toaster.

## Setup

- `components.json`: new-york style, zinc base, CSS variables, lucide icons.
- Storybook with the React + Vite framework, the Docs and Accessibility addons;
  the preview loads the global CSS and theme class the apps use. Port 6006.
- Tokens in OKLCH in `src/styles/globals.css`, imported once by each app's root
  route. The product rebrands with `--primary`, `--primary-foreground` and
  `--ring`.
- `prefers-reduced-motion` turns animations off globally.
- The theme (light, dark, or both with a toggle) is a product question; one
  theme is less to design and test.

## Starter patterns

| Pattern | For |
| --- | --- |
| `AppShell`, `NavLink` | The signed-in layout: header, home link, nav, account area |
| `PageHeader` | The page's h1, a badge outside the heading, description, actions |
| `CenteredMessage` | Whole-page errors, not found, signed out, not authorized |
| `LoadingState` | Route pending |
| `FormField` | Label, one control, its error or hint, wiring `id`, `aria-invalid`, `aria-describedby` |
| `UsageMeter` | Usage against a limit (`role="meter"`), destructive at 100% |
| `CopyButton`, `SecretField` | Copy; a secret shown once |
| `CodeBlock` | Commands and snippets |
| `TypedConfirmDialog` | Destructive actions confirmed by typing a name |
| `ConsentBanner` | Analytics consent |
| `Logo` | An inline SVG mark plus the product name from config |

Add only those the product's pages use.

## Accessibility

Every control labelled, focus visible, dialogs returning focus, keyboard
reachable everything, AA contrast. Destructive alerts use a red border, tint and
icon with normal text: red text on a dark card fails AA. `PRODUCT.md` holds the
brand personality and design principles the UI follows.

## Tests

The story render test, component tests for the patterns' accessibility wiring
(labels, ARIA, roles, focus), the Storybook build in CI, and axe on every page
in the end-to-end suite.
