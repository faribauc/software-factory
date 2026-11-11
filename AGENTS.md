# AGENTS.md

## Project overview

The user's agent workflow for Claude Code and Codex, run from T3 Code: skills
in `skills/`, always-on principles in `PRINCIPLES.md`, and a local dashboard of
every T3 project. `./install` links them into the user's global setup, so a
change here applies to every project once saved.

## Important paths

- `PRINCIPLES.md`: imported into every Claude Code and Codex session.
- `skills/<name>/SKILL.md`: one folder per skill (`spec`, `council`, `ship`,
  `pr`, `dashboard`), linked into `~/.claude/skills` and `~/.agents/skills`.
- `skills/dashboard/serve.py`: the dashboard server. `t3_projects()` is the only
  code that reads T3's internal database.
- `install`: links skills and principles; backs up whatever it replaces.

## Conventions

- Write every skill and principle in your own words. Other skill packs are
  inspiration only: don't copy their text.
- Skills refer to each other by name and to principles as `PRINCIPLES.md`.
  Keep one source for each rule; link to it rather than repeating it.
- Skill frontmatter has only `name` and `description`. The description says
  when to trigger it.
- Python is standard library only, with no dependencies.
- Short one-line commit messages.

## Setup and validation

No dependencies to install.

```bash
python3 -B skills/dashboard/test_serve.py   # prints ok
bash -n install
python3 skills/dashboard/serve.py           # dashboard on http://127.0.0.1:7420
```

After adding a skill folder, run `./install` again.
