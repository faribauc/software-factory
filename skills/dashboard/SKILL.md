---
name: dashboard
description: Start or open the local dashboard of every T3 Code project's threads, pull requests and issues. Use when the user asks for the dashboard, the board, or an overview of what's running or waiting across projects.
---

# Dashboard

One page for every project T3 Code manages: which threads are running or need
the user, open PRs with their checks, open issues, and recent merges. It reads
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

Thread states, worked out from T3's records:

| State | Meaning |
| --- | --- |
| needs you | a question or approval is waiting |
| failed | the last run failed or was interrupted |
| running | a run is in progress |
| ready | the last run finished and the thread isn't settled yet |
| done | settled; hidden, and counted per project |

PR chips: check status (`success`, `failure`, `pending`, `no checks`), `draft`,
`approved`, `changes`, `conflict`. GitHub results are cached for two minutes,
one GraphQL call per repository.

## When it breaks

T3's database is internal and can change in an update. Everything that reads it
is in `t3_projects()` in `serve.py`. If `/api/state` returns an error naming a
table or column, fix that function against the new schema
(`sqlite3 -readonly ~/.t3/userdata/statev2.sqlite .schema`).
