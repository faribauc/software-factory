---
name: ship
description: Take a change from request or issue to a reviewed pull request, end to end, without the user watching. Use when a message starts with the command "build:" (stop at a ready PR) or "ship:" (merge). Only "ship:" allows merging.
---

# Ship

The user isn't watching. You own the work from its current state to a PR that
is ready (**build**) or merged (**ship**). Messages you write along the way go
unread until long after you stop.

Each mode starts only from a command at the start of the user's message:
`build: <request or issue>` or `ship: <request or issue>`. The words used in
passing ("build a settings page", "let's ship this") are ordinary requests, not
this skill. When it's unclear which mode the user meant, use **build**: merging
needs an explicit `ship:`.

## What the user granted

- **Both modes:** create a branch or worktree, commit, push this task's branch,
  rebase it and force-push it with a lease, open and update its PR, and use the
  testing methods proof needs: run the app or dev server, drive a browser, take
  screenshots. That overrides project rules that say to ask before those. It
  doesn't override rules about *how* to test, and doesn't cover production,
  deleting data, other branches, or anything outside the repo.
- **Ship only:** merge the PR once the merge gate passes.
- **Build:** never merge, enable auto-merge, join a merge queue, or push to
  the default branch. If auto-merge is on, turn it off and say so.

## Steps

1. **Pin the goal.** For an issue, use its spec comment, or run the `spec`
   skill if it has none. For a plain request that fits in one sentence, write
   the goal and two or three acceptance criteria in your first note and go on.
2. **Get off the default branch.** Work on a new branch. In T3 Code, if this
   thread is in the project's main checkout, move into a worktree with
   `t3_worktree_handoff`, with a `continuationPrompt` that resumes these steps.
3. **Build** the smallest change that meets the goal (PRINCIPLES.md).
4. **Prove** every change in the diff (PRINCIPLES.md, "Prove it").
5. **Validate** with the `council` skill. Prove each fix it leads to.
6. **File** with the `pr` skill. Rebase onto the latest base first, and put
   the proof line and the council table in the description.
7. **Watch** with the `pr` skill. Fix real findings and failures, and prove each
   fix before pushing it. Stay active: if you end your turn without a watch
   running, the work stops, because no one will prompt you again.
8. **Check the merge gate**, below.
9. **Finish.** Ship: merge with the repo's method (read the allowed
   methods and recent merges). If it uses a merge queue or auto-merge, stay
   until GitHub reports the PR merged. Build: leave it open and ready.
10. **Report** in your final message: the PR link, merged commit or final head,
    the proof, the council outcome, every decision you made for the user, and
    what remains unverified.

## Merge gate

All of these must hold on the latest commit:

- The proof covers every change in the diff.
- Required checks pass.
- Every review thread is fixed, or declined with a written reason.
- No human review still requests changes.
- The council approved, or the user decided its open dispute.
- The branch is up to date with the base and GitHub reports it mergeable.
- Nothing in the change is on the "A human decides these" list in
  PRINCIPLES.md.

If the last point fails, stop at ready even with ship. Label the issue
`factory:needs-human` and ask the user, naming the exact decision and the files
to read. Never merge with `--admin` or any other way around branch protection.

## Asking the user

A question in a normal message goes unseen, and the thread looks finished. Ask
with the harness's question tool (`AskUserQuestion` in Claude Code,
`request_user_input` in Codex), with all the context in the question: the PR
link, what blocks you, and the options with your recommendation first. In T3
Code, unwatch the PR first.

Ask only when you can't continue alone: you can't prove the change, the gate
can't pass and you can't fix it, the next step is outside the grant, the goal
is ambiguous in a way that changes the result, or another PR makes this one
obsolete. Decide everything else with sensible defaults and list those
decisions in the report.

If there is no question tool or no answer comes, take the safe path: leave the
PR open and unmerged, and start your final message with the question.
