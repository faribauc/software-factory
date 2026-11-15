---
name: sf
description: Software factory, a workflow that takes a GitHub issue to a reviewed, merged pull request. Use when the user runs /sf or $sf with a command (spec, council, build, ship, pr, dashboard), asks to spec, triage or scope an issue, asks for a council, review or second opinion on a change, asks to open, watch, babysit, revive or take over a pull request, is about to post a GitHub comment, or asks for the dashboard of T3 projects.
---

# Software factory

This skill bundles six commands. Each one is a file in `skills/<command>/SKILL.md`
in this skill's directory, and `PRINCIPLES.md` next to this file applies to all
of them.

1. Read `PRINCIPLES.md` unless it's already part of your instructions.
2. Pick the command. If the user ran `/sf <command> ...`, it's the first word;
   the rest is its input. Otherwise pick the one whose use matches the request:

   | Command | Use it to |
   | --- | --- |
   | `spec` | accept, question or reject an issue and post a spec with testable acceptance criteria |
   | `council` | review or validate a change with three models from different providers |
   | `build` | run the whole flow unattended and stop at a ready PR; only when the user names it |
   | `ship` | the same flow, then merge once the merge gate passes; only when the user names it |
   | `pr` | file, watch and update PRs, post GitHub comments, revive or take over unfinished work |
   | `dashboard` | start the local dashboard of every T3 Code project |

   With no command and no match, list the commands and ask which one.
3. Read `skills/<command>/SKILL.md` and follow it. When it refers to another
   skill by name (the council skill, the pr skill), that skill is
   `skills/<name>/SKILL.md` here.
