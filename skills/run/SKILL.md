---
name: run
description: Start the current project's dev server, or tell the user where it is already running. Use when the user asks to run, start or serve the project or its app, asks for the dev server or a local URL, or when another skill needs the app running to look at a change.
---

# Run

Get the project in the current checkout serving locally and hand the user its
URL. Run the checkout you're in: in T3 Code that's usually a worktree, and a
server started from the main checkout or another worktree serves different
code.

## 1. Find the command

Take the first source that names one:

1. The project's `AGENTS.md`, `CLAUDE.md` or `README`: a dev or start command.
2. Scripts the project defines: `dev`, then `start`, in `package.json`;
   `dev`, `run` or `serve` targets in a `justfile`, `Makefile` or `Procfile`;
   `bin/dev`.
3. The framework's own command, from its config file: `manage.py runserver`,
   `uvicorn`, `rails server`, `npx expo start`, `cargo run`, `go run .`.

Use the package manager the lockfile names (`bun.lock`, `pnpm-lock.yaml`,
`yarn.lock`, `package-lock.json`). In a monorepo, run the app the user means;
ask only when nothing tells you which. If no source settles it, ask rather than
guess.

## 2. Prepare

- **Dependencies.** Install them when they're missing (no `node_modules`, no
  virtualenv), with the same package manager. A fresh worktree has none.
- **Env files.** If the app reads a `.env` that the checkout doesn't have,
  look for it in the main checkout (the first path in `git worktree list`) and
  copy it over; it's gitignored, so worktrees don't get it. If it isn't there
  either, ask the user for what's missing. Never invent secrets or point the app
  at production.
- **Services.** Start what the project documents as needed to run, such as
  `docker compose up -d` for a database, and say that you did.

## 3. Check the port

Find the port from the command, its config or the docs, then see who has it:

```bash
lsof -nP -iTCP:<port> -sTCP:LISTEN          # who listens, with its PID
lsof -a -p <pid> -d cwd -Fn                 # that process's directory
```

- Nothing listens: start it.
- A server from this checkout listens: it's already running. Give the user the
  URL and stop here.
- Something else listens, such as the same app from another worktree: leave it
  alone and start this one on a free port, through the command's port flag or
  `PORT`.

## 4. Start it

Run the command as a long-running background command, never in the
foreground, so it outlives this turn. Wait until the URL answers or the output
says it's ready, with a time limit of a couple of minutes. If it exits or
errors first, read the output, fix what's in this task's scope (a missing
dependency, a wrong port) and start again; otherwise report the error.

Give the user the URL and the command you ran. In T3 Code, open it in the
preview only if the user asks to see it there. When the user asks to stop it,
stop the process you started, not one you found running.

If finding the command took guesswork, offer to add it to the project's
`AGENTS.md` so the next run doesn't.
