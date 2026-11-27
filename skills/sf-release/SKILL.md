---
name: sf-release
description: "Release one or more packages or apps: choose each SemVer bump from the real changes, update the version files and changelog, tag, publish the way the repo already does, and check that it landed. Use when the user runs /sf-release in Claude Code or $sf-release in Codex, or asks to bump a version, cut a release, or release a package."
---

# Release

A release is the one step in the flow that strangers see and that usually can't
be undone: a tag push can publish to a registry or deploy, and a published
version number is gone for good. So learn how this repo releases, agree the plan
with the user once, then carry it out exactly.

Three rules hold throughout:

- **The repo decides.** Its docs, scripts and CI define the process. This skill
  fills in only what they leave open.
- **Nothing publishes outside the confirmed plan.** A push or command that would
  publish or deploy something the plan didn't name needs a new question first.
- **Pushed tags are permanent.** Never move, delete or reuse a version tag once
  it is on a remote. If a release fails after its tag is out, the fix ships as
  the next version.

## 1. Read how this repo releases

Look at what runs releases, not only at what the docs say:

- `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and any release section of the
  README.
- CI workflows that run on a tag, a GitHub release or a push to the default
  branch, and what each one does: publish, deploy, build a GitHub release. Note
  the inputs they check, such as a tag that must match `package.json`, or notes
  taken from `CHANGELOG.md`.
- History: `git tag --sort=-v:refname` to see how tags are named and whether
  they are annotated, `git log --grep=release` for the commit style, and
  whether past releases landed through a PR or were pushed to the default
  branch directly.
- Release tooling, without running it yet. If the repo uses changesets,
  release-please, semantic-release or `npm version`, read what that tool and its
  scripts do on their own: commit, tag, write the changelog, push, publish
  (`changeset publish`, a `postversion` script). Those effects go into the plan.
  When the tool owns the bump itself (release-please, semantic-release), explain
  what it will do on the next merge or run, and stop.

If the process still isn't clear, ask before changing anything.

## 2. Decide what to release

Judge exactly what will ship. Run `git fetch --tags origin` first. Judge
uncommitted work the user wants released with the rest; it goes in only the way
the repo's release process takes it, never committed straight to the default
branch as part of the release.

For each package or app, list what changed since its latest release tag
(`git log <tag>..origin/<default branch> -- <path>`; a first release has no tag,
so judge its whole history) and read the diffs. Commit
messages and `Unreleased` notes are hints, not proof. A change in shared code
can affect several packages; judge each package on its own.

Pick each package's level from its biggest change:

- **MAJOR**: something that worked for its users now breaks: a removed or
  renamed export, a changed signature, CLI flag or config key, a dropped
  runtime.
- **MINOR**: new behaviour that existing users don't have to adapt to, or a
  public API newly marked deprecated.
- **PATCH**: fixes, and any change users don't see.

A `0.x` package bumps by the same levels: MAJOR takes `0.4.2` to `1.0.0`,
MINOR to `0.5.0`, PATCH to `0.4.3`. A version or level the user asked for wins; point out
when the changes suggest another. Packages with no changes keep their version.

**Apps and deployed services.** For an Expo app, the release also bumps iOS
`buildNumber` and Android `versionCode` where the repo sets them by hand rather
than leaving them to EAS. Flag any change in the resolved `runtimeVersion` per
platform, including one that follows the app version (the `appVersion`
policy): installed builds won't receive updates published for the new runtime.
A service that deploys on every push to the default branch and has no version
(for example on Railway) has nothing to release: leave it out, and name any
deploy the release pushes will start.

If nothing is left worth releasing, say why and stop.

## 3. Confirm the plan

Before editing anything, ask once with the question tool (see "Ask the
question itself" in PRINCIPLES.md). Show:

- each package, its level, old → new version, and the change that sets the
  level;
- each push, command or GitHub release that publishes or deploys, including
  what the release tool's own scripts do, and what each triggers: for example
  "pushing tag `v2.3.0` runs `publish.yml`, which publishes `pkg@2.3.0` to npm",
  "`changeset publish` publishes `a@1.4.0` and `b@0.9.1`", or "opens a release
  PR";
- whether you will merge a release PR, and anything on the "A human decides
  these" list in PRINCIPLES.md that the release touches;
- anything you're unsure of, such as a borderline MAJOR.

That answer approves the publishing steps in the plan, nothing more. Ask again
if the plan changes.

## 4. Make the release

1. Fetch again and start a branch at exactly the fetched tip, with a clean
   tree: `git switch -c <branch> --no-track origin/<default branch>`, named the
   repo's way (`release/2.3.0`) when releases go through PRs. If the tip moved
   since the plan, judge the new commits and ask again if a version changes.
   Work the plan counted must be there, or come in the repo's way in this step;
   if it can't, stop.
2. Set the new version everywhere it is recorded, with the repo's tool if it has
   one: manifests, lockfiles (bun and npm lockfiles record workspace versions,
   and an install doesn't always update them), generated files. Search for the
   old version string to find the rest. Run the tool in a mode that only edits
   files (`changeset version` with its `commit` option off,
   `npm version <v> --no-git-tag-version`, adding `--ignore-scripts` when its
   scripts push or publish); its commit, tag and publish happen in the steps
   below. Check that the versions it wrote match the plan; ask again if not.
3. If there is a changelog, give the pending entries a heading for the new
   version and today's date, keep the file's own layout (an empty `Unreleased`
   section if it has one), and point its compare links at the new version. Add
   entries for changes it is missing, and say so. If there is no changelog,
   don't create one.
4. Prove it before anything leaves the machine (PRINCIPLES.md, "Prove it"): run
   the checks the release CI runs. Confirm no tag of that name exists locally or
   on the remote (`git ls-remote --tags origin <tag>`). For each package the
   plan publishes to a registry, preview what will publish (`npm pack
   --dry-run` or the registry's equivalent) and check nothing private is in it,
   then get a clear "not found" for the new version, not an auth or network
   error.
5. Commit in the style of past releases, for example `chore(release): 2.3.0`.
   Change nothing unrelated.
6. Land the commit:
   - **Release PR:** file and watch it with the `sf-pr` skill. Without the
     user's go-ahead to merge, stop at a ready PR. With it, merge only once its
     checks pass and nothing on the "A human decides these" list is open, then
     confirm GitHub reports it merged. If the PR was rebased or the base gained
     commits since the plan, judge them first and ask again if a version
     changes.
   - **Direct:** push the commit to the default branch.
7. Find the release commit as it landed: the commit you pushed, or the PR's
   merge or squash commit (`gh pr view <n> --json mergeCommit`), never `HEAD` or
   the branch tip. Fetch, check it out (`git switch --detach <sha>`), and check
   it is on `origin/<default branch>` and that its version files show the new
   version. Every tag and local publish below runs from this checkout.
8. Publish in the repo's usual order, with the credentials already set up. If
   they are missing, stop; never ask for a token in chat or write one into the
   repo.
   - When the repo tags by hand, tag that commit by SHA, matching past tags:
     annotated (`git tag -a v2.3.0 <sha> -m v2.3.0`) unless they are
     lightweight.
   - When the publish step makes the tags itself, don't tag by hand. Run it
     from that checkout, or name the commit
     (`gh release create <tag> --target <sha>`). `changeset publish` publishes
     every package whose version the registry lacks: check that set matches
     the plan first.
   - Run each publish command or GitHub release the plan names exactly once.
   - Push tags made locally by name (`git push origin v2.3.0`), never `--tags`
     or `--follow-tags`, which also push stray local tags. Then check every
     tag on the remote points at that commit:
     `git ls-remote --tags origin <tag> '<tag>^{}'`; for an annotated tag the
     `^{}` line holds the commit, the other the tag object.

## 5. Watch it land

- If the plan names a publishing run, find it by workflow, commit and trigger;
  a run started by a tag reports the tag as its branch
  (`gh run list --workflow <file> --commit <sha> --branch <tag>`). Where the
  harness offers `t3_background_wait` (Claude Code in T3), start
  `gh run watch <id> --exit-status` as a background command and wait on it with
  that tool. Otherwise run `gh run watch <id> --exit-status` directly, so a
  failed run reports as a failure.
- Then confirm what the plan names: the tag on the remote
  (`git ls-remote --tags origin <tag>`), the registry version (allow a minute
  or so for it to appear), the GitHub release.

If a step fails, report which one and what is left. Don't retag.

## Report

Lead with the outcome. For each package: level, new version, files changed. Then
the commit, PR, tag, CI run and published result, each with how you checked it,
and anything you couldn't confirm.
