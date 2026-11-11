"""Run: python3 skills/dashboard/test_serve.py"""

from datetime import datetime

from serve import checks, issue_stage, run_stats, thread_state

assert thread_state("running", waiting=True, settled=False) == "needs-you"
assert thread_state("running", waiting=False, settled=False) == "running"
assert thread_state("completed", waiting=False, settled=True) == "done"
assert thread_state("failed", waiting=False, settled=False) == "failed"
assert thread_state("interrupted", waiting=False, settled=True) == "done"
assert thread_state("completed", waiting=False, settled=False) == "ready"
assert thread_state(None, waiting=False, settled=False) == "ready"

assert checks({"nodes": []}) == "none"
assert checks({"nodes": [{"commit": {"statusCheckRollup": None}}]}) == "none"
assert checks({"nodes": [{"commit": {"statusCheckRollup": {"state": "FAILURE"}}}]}) == "failure"
assert issue_stage(["factory:needs-human"], closed=True, open_pr=True) == "done"
assert issue_stage(["factory:needs-human", "factory"], closed=False, open_pr=True) == "needs-human"
assert issue_stage(["factory", "factory:building"], closed=False, open_pr=True) == "in-review"
assert issue_stage(["factory", "factory:building"], closed=False, open_pr=False) == "building"
assert issue_stage(["factory:needs-info"], closed=False, open_pr=False) == "needs-info"
assert issue_stage(["factory:rejected", "bug"], closed=False, open_pr=False) == "rejected"
assert issue_stage(["factory"], closed=False, open_pr=False) == "accepted"
assert issue_stage(["bug"], closed=False, open_pr=False) == "new"

now = datetime.fromisoformat("2026-11-10T12:00:00Z").timestamp()
run = lambda status, start, end=None: {"status": status, "provider": "codex", "start": start, "end": end}
stats = run_stats([
    run("completed", "2026-11-10T10:00:00Z", "2026-11-10T10:01:00Z"),  # 60 s, today
    run("failed", "2026-11-08T10:00:00Z", "2026-11-08T10:03:00Z"),     # 180 s
    run("completed", "2026-10-20T10:00:00Z", "2026-10-20T10:10:00Z"),  # 600 s, outside 7 days and the chart
    run("running", "2026-11-10T11:59:00Z"),
    run("completed", "2026-09-01T10:00:00Z", "2026-09-01T10:01:00Z"),  # outside 30 days
    run("completed", None),
], now)
assert (stats["runs7"], stats["runs30"]) == (3, 4)
assert (stats["agent7"], stats["agent30"]) == (240, 840)
assert stats["failRate30"] == 1 / 3 and stats["median30"] == 180
assert stats["providers30"] == {"codex": 4}
assert len(stats["daily"]) == 14 and sum(d["runs"] for d in stats["daily"]) == 3
assert any(d["runs"] == 0 for d in stats["daily"])
assert run_stats([], now)["failRate30"] is None and run_stats([], now)["median30"] is None
print("ok")
