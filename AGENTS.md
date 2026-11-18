# AGENTS.md

## Project overview

The user's agent workflow for Claude Code and Codex, run from T3 Code: skills
in `skills/`, always-on principles in `PRINCIPLES.md`, and a local dashboard of
every T3 project. `./install` links them into the user's global setup, so a
change here applies to every project once saved.

## Important paths

- `PRINCIPLES.md`: imported into every Claude Code and Codex session.
- `skills/sf-<name>/SKILL.md`: one folder per skill (`sf-spec`, `sf-council`,
  `sf-build`, `sf-ship`, `sf-pr`, `sf-release`, `sf-dashboard`, `sf-saas`), each
  its own command: `/sf-<name>` in Claude Code, `$sf-<name>` in Codex. They install with
  `npx skills add <repo URL>`, or from a checkout with `./install` (links in
  `~/.claude/skills` and `~/.agents/skills`). Each folder must work on its own.
  A skill may keep detail in `skills/sf-<name>/references/`, linked from its
  `SKILL.md`.
- `dashboard/`: the dashboard, a TanStack Start app (bun, Tailwind, shadcn/ui).
  `t3Projects()` in `src/server/state.ts` is the only code that reads T3's
  internal database; `src/lib/factory.ts` holds the stage and stats rules.
- `install`: links skills and principles; backs up whatever it replaces.

## Conventions

- Write every skill and principle in your own words. Other skill packs are
  inspiration only: don't copy their text.
- Skills refer to each other by name and to principles as `PRINCIPLES.md`.
  Keep one source for each rule; link to it rather than repeating it.
- Skill frontmatter has only `name` and `description`. The description says
  when to trigger it.
- The dashboard is the only part with dependencies, managed with bun in
  `dashboard/`. Add shadcn components with `bunx shadcn@latest add <name>` there.
- Short one-line commit messages.

## Setup and validation

Skills need nothing installed. The dashboard needs bun and Node 22.13 or later.

```bash
bash -n install
cd dashboard && bun install
bun test && bun run typecheck && bun run build
bun run dev                                 # dashboard on http://127.0.0.1:7420
```

After adding or renaming a skill folder, run `./install` again; an edit applies
in the next session. Check that `npx skills add . --list` still finds every
skill: it skips one whose frontmatter isn't valid YAML (an unquoted `: ` in the
description).
