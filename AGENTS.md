# AGENTS.md

## Project overview

The user's agent workflow for Claude Code and Codex, run from T3 Code: skills
in `skills/`, always-on principles in `PRINCIPLES.md`, and a local dashboard of
every T3 project. `./install` links them into the user's global setup, so a
change here applies to every project once saved.

## Important paths

- `PRINCIPLES.md`: imported into every Claude Code and Codex session.
- `skills/<name>/SKILL.md`: one folder per skill (`spec`, `council`, `build`, `ship`,
  `pr`, `dashboard`, `saas`). Claude Code loads them through the plugin `sf`
  (`.claude-plugin/`) as `/sf:<name>`; Codex through links in `~/.agents/skills`.
  A skill may keep detail in `skills/<name>/references/`, linked from its
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

After adding a skill folder, run `./install` again. After editing one, run
`/reload-plugins` in Claude Code.
