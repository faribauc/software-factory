#!/usr/bin/env python3
"""Local dashboard for every T3 Code project: threads, pull requests, issues.

Usage: python3 skills/dashboard/serve.py [port]     (default 7420, localhost only)

Reads T3's database read-only and GitHub through `gh`. Writes nothing.
"""

import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DB = Path(os.environ.get("T3_HOME", Path.home() / ".t3")) / "userdata" / "statev2.sqlite"
PAGE = Path(__file__).with_name("index.html")
GH_TTL = 120  # seconds; one GraphQL call per repo per TTL keeps well under the rate limit
GH_QUERY = """
query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
  issues(states: OPEN, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes { number title url updatedAt labels(first: 6) { nodes { name } } } }
  open: pullRequests(states: OPEN, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes { number title url isDraft headRefName reviewDecision mergeable updatedAt
            commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } }
  merged: pullRequests(states: MERGED, first: 5, orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes { number title url mergedAt } }
} }
"""
_gh_cache = {}  # slug -> (fetched_at, data)


def t3_projects():
    """Projects and their threads from T3's database.

    lean: T3's schema is internal, not an API. Everything that reads it is
    in this one function, so a T3 update that changes it breaks only this.
    """
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    try:
        projects = {
            pid: {"id": pid, "title": title, "root": root, "threads": []}
            for pid, title, root in db.execute(
                "select project_id, title, workspace_root from projection_projects where deleted_at is null")
        }
        latest_run = dict(db.execute(
            "select thread_id, status from orchestration_v2_projection_runs r where ordinal ="
            " (select max(ordinal) from orchestration_v2_projection_runs where thread_id = r.thread_id)"))
        waiting = {t for (t,) in db.execute(
            "select thread_id from orchestration_v2_projection_runtime_requests"
            " where status not in ('resolved', 'cancelled')")}
        rows = db.execute(
            "select thread_id, project_id, title, updated_at, payload_json"
            " from orchestration_v2_projection_threads"
            " where deleted_at is null and archived_at is null and thread_id not in"
            " (select child_thread_id from orchestration_v2_projection_subagents where child_thread_id is not null)"
            " order by updated_at desc")
        for tid, pid, title, updated, payload in rows:
            if pid not in projects:
                continue
            p = json.loads(payload)
            run = latest_run.get(tid)
            projects[pid]["threads"].append({
                "id": tid,
                "title": title,
                "updated": updated,
                "state": thread_state(run, tid in waiting, bool(p.get("settledAt"))),
                "branch": p.get("branch"),
                "worktree": p.get("worktreePath"),
                "prs": [
                    {"number": pr["number"], "url": pr["url"], "state": (pr.get("snapshot") or {}).get("state")}
                    for pr in p.get("pullRequests") or []
                ],
            })
        return list(projects.values())
    finally:
        db.close()


def thread_state(run, waiting, settled):
    if waiting:
        return "needs-you"
    if run == "running":
        return "running"
    if settled:
        return "done"
    if run in ("failed", "interrupted"):
        return "failed"
    return "ready"  # finished, not yet settled: waiting for you to look


def github_slug(root):
    res = subprocess.run(["git", "-C", root, "remote", "get-url", "origin"], capture_output=True, text=True)
    m = re.search(r"github\.com[:/]([^/]+)/(.+?)(?:\.git)?/?$", res.stdout.strip())
    return f"{m[1]}/{m[2]}" if m else None


def github(slug):
    cached = _gh_cache.get(slug)
    if cached and time.time() - cached[0] < GH_TTL:
        return cached[1]
    owner, name = slug.split("/", 1)
    res = subprocess.run(
        ["gh", "api", "graphql", "-f", f"query={GH_QUERY}", "-f", f"owner={owner}", "-f", f"name={name}"],
        capture_output=True, text=True, timeout=30)
    if res.returncode != 0:
        return {"error": (res.stderr.strip().splitlines() or ["gh failed"])[-1]}  # not cached: retry next poll
    repo = json.loads(res.stdout)["data"]["repository"]
    data = {
        "issues": [
            {**i, "labels": [label["name"] for label in i.pop("labels")["nodes"]]}
            for i in repo["issues"]["nodes"]
        ],
        "prs": [
            {**pr, "checks": checks(pr.pop("commits"))}
            for pr in repo["open"]["nodes"]
        ],
        "merged": repo["merged"]["nodes"],
    }
    _gh_cache[slug] = (time.time(), data)
    return data


def checks(commits):
    nodes = commits["nodes"]
    rollup = nodes[0]["commit"]["statusCheckRollup"] if nodes else None
    return rollup["state"].lower() if rollup else "none"


def state():
    projects = t3_projects()
    for p in projects:
        p["repo"] = github_slug(p["root"]) if os.path.isdir(p["root"]) else None
    with ThreadPoolExecutor(8) as pool:
        for p, gh in zip(projects, pool.map(lambda p: github(p["repo"]) if p["repo"] else None, projects)):
            p["github"] = gh
    projects.sort(key=lambda p: max((t["updated"] for t in p["threads"]), default=""), reverse=True)
    return {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "projects": projects}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            self.send(200, "text/html; charset=utf-8", PAGE.read_bytes())
        elif self.path == "/api/state":
            try:
                self.send(200, "application/json", json.dumps(state()).encode())
            except Exception as e:  # show the reason on the page instead of a dead poll
                self.send(500, "application/json", json.dumps({"error": f"{type(e).__name__}: {e}"}).encode())
        else:
            self.send(404, "text/plain", b"not found")

    def send(self, code, kind, body):
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7420
    print(f"http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
