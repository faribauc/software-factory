---
name: sf-council
description: Validate a change with a council of three strong models from different providers, reviewing in parallel in bounded rounds. Use when the user says "council", asks for a review, validation or second opinion on a change, or when the sf-ship skill reaches its review step.
---

# Council

Three independent reviewers from different model families catch what one model
misses about its own work. The council reviews; you decide. Keep the change
small while you answer it.

## 1. Before convening

1. **Finish known work first.** Address open PR comments and fix what you
   already know is broken. Don't spend a review on known problems.
2. **Run the gate.** Run the repo's checks (lint, types, tests, build, from
   `AGENTS.md` or CI). If they fail, fix that first. No reviewer looks at a
   failing build.
3. **Pin the change.** `git fetch origin`, then take the base as
   `git merge-base HEAD origin/<default-branch>`. Use the same diff command in
   every round. Write the intent and what's out of scope in two sentences.
4. **Look at UI changes yourself.** For a `ui` surface, run the app and check
   the changed pages in the browser at desktop and phone width (T3's preview
   in T3 Code). Record what you saw, with screenshots where you can, and give
   it to the members. They may not have a browser.

## 2. Seat the council

Three seats, one per provider, each at high reasoning effort:

| Seat | Default model | Leads on |
| --- | --- | --- |
| A | OpenAI's flagship: GPT-6.1 Sol (Codex) | correctness and scope, in depth |
| B | Muse's flagship: Muse Wonder 1.0 | security when the change touches it, otherwise ux and ui |
| C | Claude's flagship that isn't the builder's model: Claude Fable 5.2, or Claude Opus 5.5 when Fable built the change | ux and ui when the change touches `ui`, otherwise security |

- **Never seat the builder's model.** A model reviewing its own work is not an
  independent reviewer.
- **One seat per provider.** If a provider is unavailable, fill its seat with a
  second model from another provider, never the builder's, and name the
  substitution in the report.
- **Newer models replace the defaults.** When a provider ships a newer flagship,
  use it and update this table.
- **The user's choice wins.** If the user named members, use exactly those. If
  one is unavailable, say so and don't replace it silently.
- **Every seat reviews correctness and scope.** The lead lens is where it goes
  deepest, not the only thing it reports.

To start them:

- **In T3 Code:** call `orchestrator_capabilities` to resolve models, then
  start one `delegate_task` per member in the same turn: `role: "review"`,
  `mode: "async"`, a new `clientRequestId` each round. Keep each `taskId`. Wait
  for their completion notices; don't poll, and don't edit the reviewed files
  while they run.
- **Elsewhere:** use the harness's subagents and report which providers you
  couldn't reach.

## 3. The brief

Members start with no history, so the brief carries everything:

```text
Review only. Do not edit files, commit, push, comment on GitHub, or start other agents.
Repo: <absolute path>. Base: <sha>. Diff: git diff <base> [-- <paths>]; read untracked files from git status --short.
Intent: <two sentences>. Out of scope: <list>. Checks run: <commands and results>.
Spec: <issue URL, or "none">. Visual check: <notes or screenshot paths, or "no UI change">.

Read the surrounding code, not just the diff. Look for bugs, broken callers, and
mismatches with the intent and the spec's acceptance criteria. Hold the change to
its intent: flag code, tests, options or guards the intent doesn't need.
<lens checklists for this change's surfaces, from below>
You lead on <this seat's lens>: go deepest there, and still report anything else you find.

Severity: blocker = the intended case is wrong. should = a real bug callers will
hit, within the intent. nit = everything else (other paths, rare cases, small
costs, style).
Approve only at a score of 9 or higher. Below 9, your findings must say what
keeps it there.
Reply in this format:
SCORE: <0-10>
VERDICT: APPROVE or CHANGES
<id> [blocker|should|nit] <file>:<line> <the problem>. Fix: <the smallest fix>
```

Give stable ids per member (`A1`, `B1`, `C1`) so later rounds can refer to them.

### Lenses

Every member gets **correctness and scope**, plus the lenses the change's
surfaces call for (the spec header has them; otherwise judge from the diff).
Each seat's brief also names the lens it leads, from the seat table:

- **security**: who can call each new or changed path, and whether they own
  what they touch; input reaching SQL, shells, file paths, templates or HTML
  unescaped; data leaking into responses, logs or URLs; webhook signatures and
  anything that grants access or money; abuse without a rate limit; secrets in
  the diff; new dependencies and whether they're needed.
- **ux**: the flow does what the spec promises with no dead ends; loading,
  empty and error states say something useful; each kind of user gets a
  sensible path; the copy is short and plain; real buttons and links, labels,
  focus order, keyboard use, alt text; it works at phone width.
- **ui**: it matches the surrounding colours, type scale, spacing and
  components; it uses the existing styling system instead of one-off CSS or
  hard-coded values; nothing overflows on a phone; text contrast is readable.

## 4. Answer the findings

Check every finding against the code yourself, and re-grade its severity:
another path, a rare case or a small cost is a nit, whatever it was labelled.

- **Agree:** make the smallest fix. Prefer deleting or narrowing code to adding
  a guard, option or helper.
- **Disagree:** say why, with evidence: file and line, a test, command output.
- **Nit or out of scope:** decline in one line and list it as a follow-up.

Keep a ledger: id, member, severity, and outcome (`fixed`, `disputed`,
`declined`). Rerun the checks after fixing, and compare
`git diff --shortstat <base>` with the last round. If the review grew the
change, cut it back before the next round. Don't agree just to end the loop.

## 5. Rounds

- **Budget:** three rounds. Up to five when a blocker or should on security,
  auth, data loss or concurrency is still open with evidence, or when the user
  asks.
- **Next round** only when a blocker or should is open, a member scored below
  9, or behaviour changed since the last approval. Send a fresh brief to every
  member, plus the ledger and what changed since their last round, and ask them
  to mark each of their earlier ids `resolved` or `still open: <why>`.
- **Stop early** when a round brings only nits and every member scored 9 or
  higher.
- **Done:** every member approves the current diff with a score of 9 or higher,
  and no blocker or should is open. A member who gave no score hasn't approved.
- **Stuck:** a finding is still disputed after two exchanges, or the budget runs
  out. Running out of budget is not approval. Put both sides in two or three lines
  each and let the user decide.

## 6. Report

Lead with the outcome: approved, or stuck and why. Then rounds, members with
their seat and lead lens (and any substitutions), scores per round, what changed
because of the council, the diff size before and after, and the declined
findings with reasons.

If a PR exists, put the table in its description (edit it; don't comment),
just above the model credit line:

```markdown
## Council

| Member | Round 1 | Round 2 |
| --- | --- | --- |
| <model> | 7/10 | 9/10 |
```

Write `no score` when a member gave none. Never invent one.
