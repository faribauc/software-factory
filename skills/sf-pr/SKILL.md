---
name: sf-pr
description: File, watch and update GitHub pull requests, and post comments on the user's behalf. Use when the user asks to open, file, watch, babysit, rebase, revive or take over a PR, branch or agent thread, or whenever you post a GitHub comment.
---

# PR

Everything about a pull request after the code exists: opening it, getting it
through CI and review, keeping it current, and picking up someone else's.
Merging belongs to the `sf-ship` skill or an explicit request from the user.

## File

1. Check whether the branch already has a PR (`gh pr view`). Update it rather
   than opening a second one.
2. Read the full diff against the base (`git diff origin/<base>...HEAD`) and
   make sure it holds only what the goal needs.
3. **Title:** follow the repo's convention (read recent merged PRs). Say what
   changes for the user, not which function moved: "Cut websocket frames by
   70% with compression" beats "negotiate permessage-deflate".
4. **Description:** open with the problem in a sentence or two, then the fix.
   No inventory of every file. Add one line on how the change was proved, link
   the issue with `Closes #<n>` when there is one, and end with the models and
   harness that wrote it (`Created with <model> in <harness>.`), using the names
   the harness reports.
5. Check the title and description for secrets and private details.
6. Open it ready for review, not as a draft, so review bots run.

## Watch

- **In T3 Code:** handle what is already there (failed checks, open comments),
  then call `watch_pull_request` and end your turn. T3 wakes you on failed or
  passing checks, new comments and reviews, and conflicts. A wake is news, not
  permission to merge. Only the thread that owns the PR watches it: a delegated
  child never does. Call `unwatch_pull_request` before you hand off, stop, or
  ask the user something.
- **Elsewhere:** `gh pr checks <n> --watch --required`, then re-read comments
  with `gh pr view <n> --comments`. Never write a polling loop.
- If nothing needs action, end your turn silently. Never post "still waiting".

## Respond to reviews

- Act only on checks and comments newer than the latest push.
- Verify every finding, human or bot, against the code before changing
  anything. Fix real bugs in the intended case. Tell real failures from
  infrastructure flakes, and rerun a flake once before investigating it.
- Decline the rest with a written reason and resolve the thread: tests the
  change doesn't need, guards for cases that don't matter, extra compatibility,
  small performance costs. List them as follow-ups. Prefer the fix that deletes
  or narrows code.
- Advisory bots don't block a merge. Required checks and human "changes
  requested" reviews do.

## Comments

Every comment you post for the user starts with this line, then a blank line,
then the comment:

```markdown
> 🤖 Agent reply · <model> for <user's GitHub login>
```

Use the model name the harness reports, or the harness name if it reports none.
Don't add the line to PR descriptions, commit messages, or text the user asked
you to post verbatim. Write the comment itself conclusion first, cite the code,
check or reproduction behind it, and keep facts apart from judgment. Check it
for secrets before posting, and confirm GitHub returned its URL before you
resolve a thread.

## Keep it current

Before calling a PR ready, `git fetch` and check `mergeStateStatus`. When it is
`BEHIND` or `DIRTY`, rebase onto the latest base, rerun the checks, and push
with `git push --force-with-lease=<branch>:<sha you last saw>`. Never force-push
without a lease, and never force-push a branch that isn't this task's.

If another PR makes this one obsolete, stop and tell the user. Don't close it
without permission.

## Revive an old PR

A clean rebase doesn't prove a PR still belongs. Before rebasing:

1. Read the PR in full (body, commits, review threads, diff) and state the
   smallest goal it was after.
2. Read what landed on the base since it diverged (`git log`, `git diff` from
   the merge base), and search merged and open PRs for the same problem. Did it
   get solved another way? Did the APIs, types or architecture it relies on
   change? Was the code it edits deleted or simplified?
3. Choose one and say why:
   - **UPDATE**: still useful and still the right shape. Rebase in a disposable
     worktree, resolve conflicts by the PR's intent and the base's newer rules,
     compare the series with `git range-diff` so nothing intended is lost and
     nothing already landed comes back, rerun checks, and push with a lease.
   - **REWORK**: still useful, but the implementation is now wrong. Describe the
     smallest rewrite and stop unless the user asked for it.
   - **CLOSE**: obsolete or no longer worth it. Cite the evidence and stop; close
     it only with permission. Age alone is not evidence, and past effort is no
     reason to keep it.

## Take over unfinished work

When you finish someone else's PR, branch or agent thread:

1. Read the original and everything said about it: reviews, the user's later
   corrections, uncommitted changes. Treat it as context, not proof, and don't
   defend the implementation just because it exists.
2. Start a new branch from the original commits and add your work as separate
   commits, unless the user asked to continue in place.
3. Keep credit: preserve authorship and co-author trailers, and name and link
   the original in the PR description. If the PR will be squashed, keep human
   co-authors in the merge commit, using identities you verified, never guessed
   emails.
4. Update it against the current base as in **Revive an old PR**, verify it
   yourself, and file or update the PR as above.

## GitHub rate limits

`gh pr create`, `gh pr view` and `gh pr checks` use GraphQL. When it runs out
(`gh api rate_limit --jq .resources.graphql`), REST usually still has room:
`gh api repos/<owner>/<repo>/pulls/<n>` to read a PR,
`gh api repos/<owner>/<repo>/commits/<sha>/check-runs` for checks, and
`gh api repos/<owner>/<repo>/pulls -f title=... -f head=... -f base=... -F body=@<file>`
to open one.
