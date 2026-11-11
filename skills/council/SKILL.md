---
name: council
description: Validate a change with a council of three strong models from different providers, reviewing in parallel in bounded rounds. Use when the user says "council", asks for a review, validation or second opinion on a change, or when the ship skill reaches its review step.
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

Pick three members, each the latest flagship model of its provider, at high
reasoning effort. Use as many different providers as are available. When fewer
than three are, fill the remaining seats with another flagship model from an
available provider, and name every substitution in the report. If the user
named members, use exactly those. If one is unavailable, say so and don't
replace it silently.

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

Severity: blocker = the intended case is wrong. should = a real bug callers will
hit, within the intent. nit = everything else (other paths, rare cases, small
costs, style).
Reply in this format:
SCORE: <0-10>
VERDICT: APPROVE or CHANGES
<id> [blocker|should|nit] <file>:<line> <the problem>. Fix: <the smallest fix>
```

Give stable ids per member (`A1`, `B1`, `C1`) so later rounds can refer to them.

### Lenses

Every member gets **correctness and scope**. Add the lenses the change's
surfaces call for (the spec header has them; otherwise judge from the diff):

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
- **Next round** only when a blocker or should is open, or behaviour changed
  since the last approval. Send a fresh brief to every member, plus the ledger
  and what changed since their last round, and ask them to mark each of their
  earlier ids `resolved` or `still open: <why>`.
- **Stop early** when a round brings only nits.
- **Done:** every member approves the current diff, and no blocker or should is
  open.
- **Stuck:** a finding is still disputed after two exchanges, or the budget runs
  out. Running out of budget is not approval. Put both sides in two or three lines
  each and let the user decide.

## 6. Report

Lead with the outcome: approved, or stuck and why. Then rounds, members (with
any substitutions), scores per round, what changed because of the council, the
diff size before and after, and the declined findings with reasons.

If a PR exists, put the table in its description (edit it; don't comment),
just above the model credit line:

```markdown
## Council

| Member | Round 1 | Round 2 |
| --- | --- | --- |
| <model> | 7/10 | 9/10 |
```

Write `no score` when a member gave none. Never invent one.
