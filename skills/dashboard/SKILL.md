---
name: dashboard
description: Start or open the local dashboard of every T3 Code project's threads, pull requests and issues. Use when the user asks for the dashboard, the board, or an overview of what's running or waiting across projects.
---

# Dashboard

One page for every project T3 Code manages: where each issue is in the flow,
which threads are running or need the user, open PRs with their checks, recent
merges, and agent activity. It reads
T3's database read-only and GitHub through `gh`, and writes nothing.

## Start it

`serve.py` sits next to this file. Check whether it's already up:

```bash
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:7420/
```

If that doesn't print `200`, start it as a long-running background command:

```bash
python3 <this skill's directory>/serve.py        # optional port argument, default 7420
```

Give the user http://127.0.0.1:7420. It listens on localhost only. In T3 Code,
open it in the preview only if the user asks to see it there.

## What it shows

The overview (`/`) leads with what's waiting on the user, then totals across
all projects, issues per stage, a 14-day chart of runs per day, a ranked list of
what needs attention, and a table of projects. Click a project's row to open its
view (`/#<project id>`): its stats, a board of issues by stage, runs per day and
per provider, open PRs, and all threads including finished ones. Every chart has
a table view.

Issue stages, from GitHub. The first rule that matches wins:

| Stage | How it's detected |
| --- | --- |
| done | the issue is closed |
| needs human | label `factory:needs-human`: the merge gate needs the user's decision |
| in review | an open PR closes it (`Closes #<n>`) |
| building | label `factory:building`: a build or ship run is working on it |
| needs info | label `factory:needs-info`: spec asked the author a question |
| rejected | label `factory:rejected`: spec declined it |
| accepted | label `factory`: spec accepted it |
| new | none of the above |

An issue in review also shows its PR's chips and the state of the T3 thread
that owns that PR.

Stats come from T3's runs: runs in the last 7 and 30 days, agent time, median
run length, the share of runs that failed or were interrupted, and runs per
provider. PRs merged and issues closed come from GitHub. GitHub returns at most
30 open issues, 20 closed issues, 30 open PRs and 30 merged PRs per repository,
so counts for busy repos are lower bounds.

Thread states, worked out from T3's records:

| State | Meaning |
| --- | --- |
| needs you | a question or approval is waiting |
| failed | the last run failed or was interrupted |
| running | a run is in progress |
| ready | the last run finished and the thread isn't settled yet |
| done | settled; hidden on the overview, listed in the project view |

PR status: checks (`passing`, `failing`, `pending`, `no checks`), `draft`,
`approved`, `changes requested`, `conflict`. GitHub results are cached for two minutes,
one GraphQL call per repository.

## When it breaks

T3's database is internal and can change in an update. Everything that reads it
is in `t3_projects()` in `serve.py`. If `/api/state` returns an error naming a
table or column, fix that function against the new schema
(`sqlite3 -readonly ~/.t3/userdata/statev2.sqlite .schema`).
