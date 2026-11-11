---
name: build
description: Take a change from request or issue to a reviewed pull request that is ready for the user to merge, end to end, without the user watching. Use only when the user runs the /build command. Never merges.
---

# Build

Read the `ship` skill (`../ship/SKILL.md`, next to this one) and follow its
workflow in **build** mode: everything up to a ready pull request, then stop.
Never merge, enable auto-merge, join a merge queue, or push to the default
branch, even if the merge gate passes. The user merges.
