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
- **Nothing publishes outside the confirmed plan.** A push that would publish or
  deploy something the plan didn't name needs a new question first.
- **Tags are permanent.** Never move, delete or reuse an existing version tag.
  If a release fails after its tag is out, the fix ships as the next version.

## 1. Read how this repo releases

Few repos write the process down, so read what actually runs it:

- `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and any release section of the
  README.
- CI workflows that run on a tag, a GitHub release or a push to the default
  branch, and what each one does: publish, deploy, build a GitHub release. Note
  the inputs they check, such as a tag that must match `package.json`, or notes
  taken from `CHANGELOG.md`.
- History: `git tag --sort=-v:refname` to see how tags are named and whether
  they are annotated, `git log --grep=release` for the commit style, and
  whether past releases went through a release branch and PR or straight to the
  default branch.
- Release tooling. If the repo uses changesets, release-please,
  semantic-release or `npm version`, run that tool rather than editing versions
  by hand. When the tool owns the bump itself (release-please, semantic-release),
  explain what it will do on the next merge or run, and stop.

If the process still isn't clear, ask before changing anything.

## 2. Decide what to release

For each package or app in the repo, list what changed since its latest release
tag (`git log <tag>..origin/<default branch> -- <path>`), plus any uncommitted
changes the user means to include. Read the diffs: commit messages and
`Unreleased` notes are hints, not proof. A change in shared code can affect
several packages; judge each package on its own.

Pick each package's level from its biggest change:

- **MAJOR**: something that worked for its users now breaks: a removed or
  renamed export, a changed signature, CLI flag or config key, a dropped
  runtime.
- **MINOR**: new behaviour that existing users don't have to adapt to.
- **PATCH**: fixes, and any change users don't see.

Below `1.0.0`, do what the repo's history does. With no history, use MINOR for
breaking changes and PATCH for the rest, and say so. If the user asked for a
specific version or level, follow it, and say so if the changes point
elsewhere. Leave packages with no changes alone. If nothing is worth releasing, say why and stop.

**Apps and deployed services.** For an Expo app, the release also bumps iOS
`buildNumber` and Android `versionCode` where the repo sets them by hand rather
than leaving them to EAS. Flag any `runtimeVersion` change: builds already
installed stop receiving OTA updates. A service that deploys on every push to
the default branch and has no version (for example on Railway) has nothing to
release: say so and stop.

## 3. Confirm the plan

Before editing anything, ask once with the question tool (see "Ask the
question itself" in PRINCIPLES.md). Show:

- each package, its level, and old → new version;
- each push and what it will trigger, for example "pushing tag `v2.3.0` runs
  `publish.yml`, which publishes `pkg@2.3.0` to npm" or "opens a release PR";
- anything you're unsure of, such as a borderline MAJOR.

That answer approves the publishing pushes in the plan. Ask again only if the
plan changes.

## 4. Make the release

1. Start from the up-to-date default branch with a clean tree. If releases go
   through PRs, branch with the repo's naming (for example `release/2.3.0`).
2. Set the new version everywhere it is recorded: manifests, lockfiles (bun and
   npm lockfiles record workspace versions, and an install doesn't always update
   them), generated files. Search for the old version string to find the rest.
3. If there is a changelog, move its `Unreleased` entries under a heading for
   the new version and today's date in the file's style, leave an empty
   `Unreleased` heading above it, and update the compare links. Add entries for
   changes it is missing, and say so. If there is no changelog, don't create one.
4. Prove it before anything leaves the machine (PRINCIPLES.md, "Prove it"): run
   the checks the release CI runs, preview what will publish (`npm pack
   --dry-run` or the registry's equivalent), and confirm the new version is
   neither tagged (`git tag -l`) nor published (`npm view <name>@<version>
   version` prints nothing).
5. Commit in the style of past releases, for example
   `chore(release): 2.3.0`. Change nothing unrelated.
6. Through a release PR: file it with the `sf-pr` skill, and stop there unless
   the user asked you to merge. Straight to the default branch: push the commit.
7. Tag the commit that is on the default branch: the release commit after a
   direct push or merge commit, the squash commit after a squash merge. A tag on
   a commit outside the default branch leaves the release out of its history.
   Match past tags; prefer annotated (`git tag -a v2.3.0 -m v2.3.0`) unless they
   are lightweight. Push the tag only as the plan says.

## 5. Watch it land

- In T3 Code, use its tools: watch a release PR through the `sf-pr` skill, and
  wait for the tag's CI run as a background command with `t3_background_wait`.
- Without T3, use `gh`: `gh pr checks <n> --watch --required` for the PR, and
  `gh run list --workflow <file>` then `gh run watch <id>` for the tag's run.
- Then confirm the result: the tag on the remote (`git ls-remote --tags origin
  <tag>`), the registry version (allow a minute or so for it to appear), and
  the GitHub release if the automation makes one.

If a step fails, report which one and what is left. Don't retag.

## Report

Lead with the outcome. For each package: level, new version, files changed. Then
the commit, PR, tag, CI run and published result, each with how you checked it,
and anything you couldn't confirm.
