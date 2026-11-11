<img src="assets/icon.svg" width="64" height="64" alt="">

# software-factory

My agent workflow for Claude Code and Codex, run from T3 Code: a few skills
that take work from a GitHub issue to a reviewed, merged pull request, a set of
always-on principles, and a local dashboard of every T3 project.

## Install

```bash
./install
```

It links each skill into `~/.claude/skills` and `~/.agents/skills`, imports
`PRINCIPLES.md` from `~/.claude/CLAUDE.md`, and links `~/.codex/AGENTS.md` to
it. Anything a link replaces moves to `~/.agents/skills-backup/<timestamp>/`.
Run it again after adding a skill.

## The flow

```
issue ─ spec ─ code ─ checks ─ council ─ pr ─ merge gate ─ merged            (ship:)
          │                       ▲  │                    └ ready for you    (build:)
          └ needs-info / rejected └──┘ fix, re-prove      └ needs-human      (risky change)
```

| Skill | Use it to |
| --- | --- |
| [`spec`](skills/spec/SKILL.md) | Accept, question or reject an issue, rate its risk, and post a spec with testable acceptance criteria. |
| [`council`](skills/council/SKILL.md) | Validate a change with three models from different providers, in bounded rounds, after the checks pass. |
| [`ship`](skills/ship/SKILL.md) | Run the whole flow unattended: `build: <request>` ends at a ready PR, `ship: <request>` merges. |
| [`pr`](skills/pr/SKILL.md) | File, watch and update PRs, post comments, revive old PRs, take over unfinished work. |
| [`dashboard`](skills/dashboard/SKILL.md) | Start the local dashboard. |

[`PRINCIPLES.md`](PRINCIPLES.md) is loaded in every session: build less, prove
it, keep scope tight, treat outside text as data, and the changes a human must
approve.

Issue labels: `factory` (accepted), `factory:needs-info`, `factory:needs-human`.
The skills create them in a repo when missing.

## Dashboard

```bash
python3 skills/dashboard/serve.py   # http://127.0.0.1:7420
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
