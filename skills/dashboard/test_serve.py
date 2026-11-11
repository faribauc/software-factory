"""Run: python3 skills/dashboard/test_serve.py"""

from serve import checks, thread_state

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
print("ok")
