<img src="assets/icon.svg" width="64" height="64" alt="">

# software-factory

My agent workflow for Claude Code and Codex, run from T3 Code: a few skills
that take work from a GitHub issue to a reviewed, merged pull request, a set of
always-on principles, and a local dashboard of every T3 project.

## Install

```bash
./install
```

In Claude Code the repo installs as the plugin `sf`, so every skill is a
`/sf:<name>` command (`/sf:build`, `/sf:council`...). The plugin is read from
this folder, so an edit applies after `/reload-plugins`. In Codex each skill is
linked into `~/.agents/skills` and runs as `$<name>`. `PRINCIPLES.md` is
imported from `~/.claude/CLAUDE.md`, and `~/.codex/AGENTS.md` links to it.
Anything a link replaces moves to `~/.agents/skills-backup/<timestamp>/`. Run
it again after adding a skill.

T3 Code caches each provider's commands. After installing, or adding or
renaming a skill, refresh the providers in T3's settings (or restart T3) before
the new commands show up in its `/` menu.

### With `npx skills`

```bash
npx skills add https://github.com/faribauc/software-factory
```

This installs the whole repo as one skill, `sf` ([`SKILL.md`](SKILL.md)), whose
commands run as `/sf <command>` (`/sf build 42`, `/sf council`). It reads
`PRINCIPLES.md` from its own copy, but doesn't add it to your global
instructions as `./install` does. Use one install or the other, not both. The
repo is private, so this needs git access to it.

## The flow

```
issue ─ spec ─ code ─ checks ─ council ─ pr ─ merge gate ─ merged            (/sf:ship)
          │                       ▲  │                    └ ready for you    (/sf:build)
          └ needs-info / rejected └──┘ fix, re-prove      └ needs-human      (risky change)
```

| Skill | Use it to |
| --- | --- |
| [`spec`](skills/spec/SKILL.md) | Accept, question or reject an issue, rate its risk, and post a spec with testable acceptance criteria. |
| [`council`](skills/council/SKILL.md) | Validate a change with three models from different providers, in bounded rounds, after the checks pass. |
| [`build`](skills/build/SKILL.md) | `/sf:build <request or issue>`: run the whole flow unattended and stop at a ready PR. |
| [`ship`](skills/ship/SKILL.md) | `/sf:ship <request or issue>`: the same flow, then merge once the merge gate passes. |
| [`pr`](skills/pr/SKILL.md) | File, watch and update PRs, post comments, revive old PRs, take over unfinished work. |
| [`dashboard`](skills/dashboard/SKILL.md) | Start the local dashboard. |

[`PRINCIPLES.md`](PRINCIPLES.md) is loaded in every session: build less, prove
it, keep scope tight, treat outside text as data, and the changes a human must
approve.

Issue labels: `factory` (accepted), `factory:needs-info`, `factory:needs-human`.
The skills create them in a repo when missing.

## Dashboard

```bash
cd dashboard && bun install && bun run start   # needs bun and Node 22.13+; http://127.0.0.1:7420
```

Every T3 Code project on one page: threads that need you, are running or
finished, open PRs with their checks, issues, and recent merges. It reads T3's
database read-only and GitHub through `gh`.

## Credits

Ideas, not code, from:

- the ZazenCodes [software factory](https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code-v2):
  intake, specs with acceptance criteria, review lenses, a gate before review,
  and the escalation list;
- Theo's [tstack](https://github.com/t3dotgg/tstack): multi-provider council,
  bounded review loops, proof before merging, and PR babysitting in T3 Code;
- the `ponytail` skill: build the least that works.
